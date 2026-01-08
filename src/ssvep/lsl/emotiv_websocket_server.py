# =========================================================================================
# Resilient Emotiv/Cortex connection + headset reconnection flow
# =========================================================================================
# Overview
# - Maintains a persistent connection to Emotiv Cortex, continuously searches for a headset,
#   creates/reuses a session, subscribes to EEG/dev/eq streams, and keeps recovering until
#   EEG data flows again after any disconnect.
# - Emits JSON-RPC style events to stdout for the Node launcher:
#     {"jsonrpc":"2.0","method":"event","params":{"type":"<event>", ...}}
#   Events: server-ready, headset-connected, session-created, session-reused,
#           subscription-confirmed, headset-disconnected, error.
# - App-side "connected" state is considered true only when EEG samples actually arrive
#   over the local ws://localhost:8765 stream (first data packet), not merely on control events.
#
# Boot / reconnect loop
# 1) start()
#    - Infinite loop that (re)creates the Cortex WebSocket and calls run_forever().
#    - If the socket drops or we call hard_reset(), the loop waits RECONNECT_INTERVAL and retries.
#
# 2) connect_cortex()
#    - Builds a fresh websocket.WebSocketApp with bound callbacks:
#      on_open -> run_sequence
#      on_message -> handle_response/handle_eeg_data/handle_device_data/handle_quality_data
#      on_error/on_close -> schedule_authorise_retry
#
# 3) on_open()
#    - Spawns run_sequence() in a thread.
#
# 4) run_sequence()  [Access/Authorise]
#    - On first run sends requestAccess (id=0). If access is already granted (or request fails
#      because the app is already registered), proceeds to authorise (id=1) on this and all retries.
#
# 5) handle_response(id=1)  [Authorised]
#    - Stores cortexToken, then queryHeadsets (id=2).
#
# 6) handle_response(id=2)  [Headset discovery]
#    - If found: sets headset_id and controlDevice:connect (id=3).
#    - If none: logs "[WARN] No headset found." and schedule_headset_search() to re-query.
#
# 7) handle_response(id=3)  [Headset connected]
#    - Logs "[INFO] Headset connected." (kept for compatibility) and emits event "headset-connected".
#    - Attempts createSession (id=4).
#
# 8) handle_response(id=4)  [Session handling]
#    - Success: stores session_id, emits "session-created", then subscribe(['eeg','dev','eq']) (id=5).
#    - Error code -32005 (session exists): querySessions (id=6) and reuse it.
#    - Error code -32004 (headset not available): schedule_headset_search() and keep polling.
#
# 9) handle_response(id=6)  [Reuse session]
#    - Picks a session for the current headset (prefers active/open), sets session_id, emits "session-reused",
#      then subscribe (id=5). If none reusable: falls back to createSession (id=4).
#
# 10) handle_response(id=5)  [Subscribe ACK]
#    - On success: sets subscribed=True, logs and emits "subscription-confirmed", then start_post_subscribe_guard().
#    - Error code -32007 (session does not exist): hard_reset(). Others: schedule_headset_search().
#
# Data flow and success path
# A) on_message() routes:
#    - 'eeg' -> handle_eeg_data()  (updates last_data_time and forwards to browser clients)
#    - 'dev' -> handle_device_data()
#    - 'eq'  -> handle_quality_data()
#
# B) handle_eeg_data()
#    - Updates last_data_time, clears disconnection flags, resets resubscribe_attempts.
#    - Extracts EEG channel values (SSVEP-only or all electrodes), applies optional filtering,
#      and pushes to browser WebSocket clients via data_callback().
#
# Guards and recovery
# G1) start_post_subscribe_guard()
#     - 5s after a confirmed subscribe, if no EEG has arrived: retries subscribe up to a limit,
#       then full reset via hard_reset().
#
# G2) watchdog_loop()  (daemon thread)
#     - Checks every second if EEG has been silent for > TIMEOUT_SECONDS; emits headset-disconnected,
#       clears ids, and keeps polling for a headset.
#
# G3) on_error() / on_close()
#     - Schedules authorise retry after RECONNECT_INTERVAL.
#
# Error code handling (Cortex)
# - -32004 "headset not available": keep polling with schedule_headset_search().
# - -32005 "session already exists": querySessions (id=6) and reuse it, then subscribe.
# - -32007 "session does not exist": full restart via hard_reset().
#
# Browser/WebSocket server (ws://localhost:8765)
# - websockets.serve(emotiv_to_websocket, "localhost", 8765) broadcasts EEG/dev/eq to all connected clients.
# - emotiv_to_websocket() sets a thread-safe callback that schedules async sends in the main asyncio loop.
#
# Typical sequence on success
# - {"event":"server-ready"}
# - [INFO] Authenticated. Token received.
# - [INFO] Headset found: <id>
# - [INFO] Headset connected.  +  {"event":"headset-connected"}
# - [INFO] Session created: <sid>  +  {"event":"session-created"}
# - [INFO] Sent subscribe request for streams: [...]
# - [INFO] Subscription confirmed: {...}  +  {"event":"subscription-confirmed"}
# - (EEG data starts arriving; app marks connected on first data packet)
#
# Typical recovery after a disconnect or silent stream
# - [WARN] No EEG data received for Xs. Headset likely disconnected.
# - [INFO] Headset disconnected.  +  {"event":"headset-disconnected"}
# - [WARN] No headset found.        (repeats until headset returns)
# - [INFO] Headset found: <id>
# - [INFO] Headset connected.  +  {"event":"headset-connected"}
# - (Reuse/create session) -> subscribe -> guard -> EEG resumes or full reset kicks in if needed)
# =========================================================================================

import asyncio
import os
import time
import websockets
import json
import ssl
import threading
import numpy as np
from scipy.signal import butter, lfilter, iirnotch
import websocket
from dotenv import load_dotenv

# Load credentials from a path provided by the Electron app when available.
_ENV_PATH = os.getenv("EMOTIV_ENV_PATH")
if _ENV_PATH and os.path.isfile(_ENV_PATH):
    load_dotenv(dotenv_path=_ENV_PATH)
else:
    # Fallback to default .env discovery (e.g. for development)
    load_dotenv()

# === Emotiv Cortex Credentials ===
CLIENT_ID = os.getenv('EMOTIV_CLIENT_ID')
CLIENT_SECRET = os.getenv('EMOTIV_CLIENT_SECRET')

# === FILTER CONFIGURATION ===
FS = 256  # EpocX sampling rate
LOWCUT = 2.0
HIGHCUT = 100.0
NOTCH_FREQ = 50.0
FILTER_ORDER = 5
NOTCH_Q = 30.0
EMOTIV_CHANNEL_NAMES = ["AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2", "P8", "T8", "FC6", "F4", "F8", "AF4"] # Emotiv Epoc X channel names always in this order
APPLY_FILTERING = False      # Set to True/False to enable/disable bandpass and notch filters
SAVE_RAW_DATA = False        # Set to True/False to enable/disable saving raw data to JSON files
RECONNECT_INTERVAL = 3.0     # Seconds between reconnect/retry attempts

# === ELECTRODE CONFIGURATION ===
# Epoc X electrode layout: AF3, F7, F3, FC5, T7, P7, O1, O2, P8, T8, FC6, F4, F8, AF4
# For SSVEP applications, occipital and parietal channels are most relevant
USE_SSVEP_CHANNELS_ONLY = True  # Set to False to use all channels

# Function to save raw EEG sample to JSON in the format:
# { "eegData": [ [], [], ... ] }
RAW_JSON_FILENAME = "datasets/RAW-eeg-data.json"

# Buffer for raw samples
RAW_SAMPLE_BUFFER = []
RAW_SAMPLE_BUFFER_SIZE = 1000

def save_raw_sample_to_json(sample, filename=RAW_JSON_FILENAME):
    """
    Buffer raw EEG samples and write to JSON file once every 1000 samples.
    """
    global RAW_SAMPLE_BUFFER
    RAW_SAMPLE_BUFFER.append(sample)
    if len(RAW_SAMPLE_BUFFER) >= RAW_SAMPLE_BUFFER_SIZE:
        try:
            folder = os.path.dirname(filename)
            if folder and not os.path.exists(folder):
                os.makedirs(folder, exist_ok=True)
            try:
                with open(filename, "r") as f:
                    file_data = json.load(f)
                eeg_data = file_data.get("eegData", [])
            except (FileNotFoundError, json.JSONDecodeError):
                eeg_data = [[] for _ in range(len(sample))]
            # Append buffered samples
            for buffered_sample in RAW_SAMPLE_BUFFER:
                for i, value in enumerate(buffered_sample):
                    eeg_data[i].append(value)
            with open(filename, "w") as f:
                json.dump({"eegData": eeg_data}, f, indent=2)
            RAW_SAMPLE_BUFFER = []
        except Exception as e:
            print(f"Error saving raw EEG samples: {e}")

# Design filters
def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    return butter(order, [low, high], btype='band')

def notch_filter(freq, fs, quality=30):
    nyq = 0.5 * fs
    norm_freq = freq / nyq
    return iirnotch(norm_freq, quality)

def apply_filter(data, b, a):
    return lfilter(b, a, data)

b_band, a_band = butter_bandpass(LOWCUT, HIGHCUT, FS, FILTER_ORDER)
b_notch, a_notch = notch_filter(NOTCH_FREQ, FS, NOTCH_Q)


# === JSON-RPC event emitter to stdout (for Node consumer) ===
def emit_event(event_type: str, **params):
    try:
        payload = {"jsonrpc": "2.0", "method": "event", "params": {"type": event_type}}
        if params:
            payload["params"].update(params)
        print(json.dumps(payload), flush=True)
    except Exception:
        # Avoid crashing on logging issues
        pass


class EmotivEEGClient:
    def __init__(self, data_callback=None):
        self.ws = None
        self.data_callback = data_callback
        self.auth_token = None
        self.headset_id = None
        self.session_id = None
        self.connected_clients = set()  # Track connected WebSocket clients
        self.latest_device_data = None
        self.latest_quality_data = None
        self.last_data_time = None
        self.disconnected = False
        self.retry_timer = None
        self.subscribed = False
        self.last_subscribe_time = None
        self.resub_timer = None
        self.resubscribe_attempts = 0
        self.max_resubscribe_attempts = 3
        self.access_granted = False

        # Start watchdog once for lifetime
        threading.Thread(target=self.watchdog_loop, daemon=True).start()

    def hard_reset(self, reason: str = ""):
        try:
            msg = f"[WARN] Performing full reset" + (f": {reason}" if reason else "")
            print(msg)
        except Exception:
            pass

        # Cancel any timers
        self.cancel_retry_timer()
        self.cancel_resub_timer()

        # Clear state
        self.subscribed = False
        self.session_id = None
        self.headset_id = None
        self.last_data_time = None
        self.disconnected = True
        self.resubscribe_attempts = 0

        # Close WS to trigger reconnect loop in start()
        try:
            if self.ws is not None:
                self.ws.close()
        except Exception:
            pass

    def connect_cortex(self):
        # Build a fresh WebSocketApp each time so callbacks re-bind correctly
        self.ws = websocket.WebSocketApp(
            "wss://localhost:6868",
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
            on_open=self.on_open
        )

    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            # print(f"[DEBUG] Received: {data}")  # Add debug output
            if 'id' in data:
                self.handle_response(data)
            elif 'eeg' in data:
                self.handle_eeg_data(data)
            elif 'dev' in data:
                self.handle_device_data(data)
            elif 'eq' in data:
                self.handle_quality_data(data)
        except json.JSONDecodeError as e:
            print(f"[ERROR] Failed to parse JSON: {e}")
            print(f"[ERROR] Raw message: {message}")

    def on_error(self, ws, error):
        print("[ERROR] ", error)
        try:
            emit_event("error", message=str(error))
        except Exception:
            pass
        # Schedule re-auth/reconnect attempts
        self.schedule_authorise_retry()

    def on_close(self, ws, close_status_code=None, close_msg=None):
        print("[INFO] WebSocket closed")
        self.disconnected = True
        self.schedule_authorise_retry()

    def on_open(self, ws):
        # Kick off authorisation sequence on each (re)open
        threading.Thread(target=self.run_sequence, daemon=True).start()

    def on_headset_disconnected(self):
        """Handle headset disconnection gracefully"""
        print("[INFO] Headset disconnected.")
        try:
            emit_event("headset-disconnected")
        except Exception:
            pass
        self.session_id = None
        self.headset_id = None
        self.schedule_headset_search()

    def send_request(self, request):
        try:
            if self.ws is None:
                raise RuntimeError("Cortex WebSocket not initialized")
            self.ws.send(json.dumps(request))
        except Exception as e:
            print(f"[ERROR] Failed to send request {request.get('id')}: {e}")
            # Attempt to re-open Cortex socket and re-run sequence
            self.schedule_authorise_retry()

    def watchdog_loop(self):
        """Monitor incoming data and detect silent disconnection."""
        TIMEOUT_SECONDS = 5.0  # adjust for your expected EEG frequency
        while True:
            time.sleep(1)
            if self.last_data_time is not None:
                silence_duration = time.time() - self.last_data_time
                if silence_duration > TIMEOUT_SECONDS and not self.disconnected:
                    print(f"[WARN] No EEG data received for {silence_duration:.1f}s. Headset likely disconnected.")
                    self.disconnected = True
                    self.on_headset_disconnected()
                    # Begin retry cycle
                    self.schedule_headset_search()

    def cancel_retry_timer(self):
        try:
            if self.retry_timer and self.retry_timer.is_alive():
                self.retry_timer.cancel()
        except Exception:
            pass
        finally:
            self.retry_timer = None

    def cancel_resub_timer(self):
        try:
            if self.resub_timer and self.resub_timer.is_alive():
                self.resub_timer.cancel()
        except Exception:
            pass
        finally:
            self.resub_timer = None

    def schedule_headset_search(self):
        # Throttle retries to avoid spamming Cortex
        self.cancel_retry_timer()
        self.retry_timer = threading.Timer(RECONNECT_INTERVAL, self.query_headsets)
        self.retry_timer.daemon = True
        self.retry_timer.start()

    def schedule_authorise_retry(self):
        # Re-run full flow beginning with authorise
        def _retry():
            try:
                self.run_sequence()
            except Exception as e:
                print(f"[ERROR] Retry authorise failed: {e}")
        self.cancel_retry_timer()
        self.retry_timer = threading.Timer(RECONNECT_INTERVAL, _retry)
        self.retry_timer.daemon = True
        self.retry_timer.start()

    def handle_response(self, data):
        # Check for errors in the response
        if 'error' in data:
            print(f"[ERROR] Request {data['id']} failed: {data['error']}")
            # Decide next action based on which step failed
            try:
                err = data.get('error') or {}
                code = err.get('code') if isinstance(err, dict) else None
                
                # If requestAccess errors (often means already registered), try to authorise
                if data.get('id') == 0:
                    print("[INFO] requestAccess failed. Assuming app may already be registered. Trying authorise...")
                    self.access_granted = True
                    self.authorise()
                    if code == -32021:
                        # Informing Node.js that credentials are invalid
                        emit_event("credentials-invalid")
                    return

                if data.get('id') == 1:
                    # Authorisation failed, retry authorisation
                    self.schedule_authorise_retry()
                
                elif data.get('id') in (2, 3, 4, 5):
                    if data.get('id') == 4 and code == -32005:
                        # A session already exists for this headset; reuse it
                        print("[INFO] Session already exists; querying sessions to reuse")
                        self.query_sessions()
                    
                    elif data.get('id') == 4 and code == -32004:
                        # Headset not available; retry discovery
                        self.schedule_headset_search()
                    
                    elif data.get('id') == 5 and code == -32007:
                        # Subscribe says session doesn't exist; do a full reset
                        self.hard_reset("subscribe failed: session does not exist (-32007)")
                    
                    else:
                        # Generic fallback
                        self.schedule_headset_search()
            except Exception:
                pass
            return
        
        # Handle requestAccess
        if data['id'] == 0:
            granted = bool((data.get('result') or {}).get('accessGranted'))
            if granted:
                self.access_granted = True
                print("[INFO] Access granted (app registered). Proceeding to authorise...")
                # emit event with the client credentials
                emit_event("credentials-valid", clientId=CLIENT_ID, clientSecret=CLIENT_SECRET)
                self.authorise()
            else:
                print("[WARN] Access not granted yet. Will retry...")
                self.schedule_authorise_retry()
            return

        # Authorisation
        if data['id'] == 1:
            if 'result' in data and 'cortexToken' in data['result']:
                self.auth_token = data['result']['cortexToken']
                print("[INFO] Authenticated. Token received.")
                self.query_headsets()
            else:
                print("[ERROR] Authentication failed - no token received")

        # Query headsets
        elif data['id'] == 2:
            if 'result' in data:
                headsets = data['result']
                if headsets:
                    self.headset_id = headsets[0]['id']
                    print(f"[INFO] Headset found: {self.headset_id}")
                    self.connect_headset()
                else:
                    print("[WARN] No headset found.")
                    # Keep polling for headsets until one appears
                    self.schedule_headset_search()
            else:
                print("[ERROR] Failed to query headsets")
                self.schedule_headset_search()

        # Connect headset
        elif data['id'] == 3:
            #!!!!!!!!!!!!!!!!!!!!!!!!! DO NOT UPDATE/REMOVE THIS PRINT STATEMENT !!!!!!!!!!!!!!!!!!!!!!!!!
            print("[INFO] Headset connected.") # This line is used by main.js to detect successful headset connection
            try:
                emit_event("headset-connected")
            except Exception:
                pass
            self.create_session()

        # Create session
        elif data['id'] == 4:
            if 'result' in data and 'id' in data['result']:
                self.session_id = data['result']['id']
                print(f"[INFO] Session created: {self.session_id}")
                try:
                    emit_event("session-created", sessionId=self.session_id)
                except Exception:
                    pass
                self.subscribe(['eeg', 'dev', 'eq'])  # Subscribe to all three streams
            else:
                print("[ERROR] Failed to create session - no session ID received")
                self.schedule_headset_search()

        # Query existing sessions
        elif data['id'] == 6:
            sessions = data.get('result', []) or []
            chosen = None
            try:
                for s in sessions:
                    headset_identifier = s.get('headset') or s.get('headsetId')
                    status = s.get('status')
                    if self.headset_id and headset_identifier and self.headset_id == headset_identifier:
                        # Prefer active/opened sessions
                        if status in ("active", "opened", "open"):
                            chosen = s
                            break
                        if chosen is None:
                            chosen = s
                if chosen is None and sessions:
                    chosen = sessions[0]
            except Exception:
                chosen = None

            if chosen and chosen.get('id'):
                self.session_id = chosen['id']
                print(f"[INFO] Using existing session: {self.session_id}")
                try:
                    emit_event("session-reused", sessionId=self.session_id)
                except Exception:
                    pass
                self.subscribe(['eeg', 'dev', 'eq'])
            else:
                print("[WARN] No existing session found to reuse; attempting to create a new session")
                self.create_session()

        # Subscribe ACK
        elif data['id'] == 5:
            # Some Cortex versions return result with subscribed streams; treat presence of result as ACK
            if 'result' in data:
                self.subscribed = True
                print(f"[INFO] Subscription confirmed: {data['result']}")
                try:
                    # Include minimal streams info if available
                    streams = None
                    try:
                        streams = (data.get('result') or {}).get('success') or (data.get('result') or {}).get('streams')
                    except Exception:
                        streams = None
                    if isinstance(streams, list):
                        emit_event("subscription-confirmed", streams=streams)
                    else:
                        emit_event("subscription-confirmed")
                except Exception:
                    pass
                # Start a short guard timer to verify data begins flowing
                self.start_post_subscribe_guard()
            else:
                print("[ERROR] Subscribe failed or returned no result; will retry")
                self.schedule_headset_search()

    def handle_eeg_data(self, data):
        try:
            eeg_data = data.get('eeg', None)
            timestamp = data.get('time', None)  # Get timestamp from main message

            self.last_data_time = time.time()  # mark last received time
            self.disconnected = False
            self.subscribed = True
            self.resubscribe_attempts = 0  # reset on first EEG
            
            if eeg_data and len(eeg_data) > 2 and timestamp:
                # Skip the first two elements (sequence number and unknown)
                # Take all EEG channels (excluding the last few elements which might be quality indicators)
                # Typically the structure is: [sequence, unknown, ...EEG_channels..., quality_indicators, metadata]
                
                if USE_SSVEP_CHANNELS_ONLY:
                    # === SSVEP-SPECIFIC ELECTRODES ONLY ===
                    # Epoc X electrode order: AF3, F7, F3, FC5, T7, P7, O1, O2, P8, T8, FC6, F4, F8, AF4
                    # SSVEP optimal channels: P7(5), O1(6), O2(7), P8(8) - using 0-based indexing after skipping first 2 elements
                    # These channels are positioned over occipital and parietal regions, optimal for SSVEP signal detection
                    
                    ssvep_channel_indices = [5, 6, 7, 8]                # P7, O1, O2, P8  --> HEADSET NORMAL
                    # ssvep_channel_indices = [0, 13, 1, 12, 2, 11, 3, 10]  # AF3, AF4, F7, F8, F3, F4, FC5, FC6  --> HEADSET UPSIDE DOWN

                    eeg_channels = []
                    for idx in ssvep_channel_indices:
                        channel_pos = idx + 2  # Add 2 to account for sequence number and unknown at start
                        if channel_pos < len(eeg_data) and isinstance(eeg_data[channel_pos], (int, float)):
                            eeg_channels.append(eeg_data[channel_pos])
                    
                    # print(f"[DEBUG] Using SSVEP channels only: {len(eeg_channels)} channels (P7, O1, O2, P8)")
                else:
                    # === ORIGINAL CODE - ALL ELECTRODES ===
                    # Find the actual EEG channels (exclude non-numeric values at the end)
                    eeg_channels = []
                    for i in range(2, len(eeg_data)):
                        if isinstance(eeg_data[i], (int, float)) and eeg_data[i] != 0.0:
                            eeg_channels.append(eeg_data[i])
                        elif isinstance(eeg_data[i], list):  # Stop when we hit arrays/lists (metadata)
                            break
                    
                    # print(f"[DEBUG] Using all available channels: {len(eeg_channels)} channels")
                
                if len(eeg_channels) > 0:
                    raw_values = np.array(eeg_channels)

                    # Select channel names corresponding to SSVEP indices
                    if USE_SSVEP_CHANNELS_ONLY:
                        channel_names = [EMOTIV_CHANNEL_NAMES[idx] for idx in ssvep_channel_indices]
                    else:
                        channel_names = EMOTIV_CHANNEL_NAMES

                    # Save raw data before filtering
                    if SAVE_RAW_DATA:
                        save_raw_sample_to_json(raw_values.tolist())

                    # Apply filters
                    if APPLY_FILTERING:
                        filtered_values = apply_filter(raw_values, b_band, a_band)
                        filtered_values = apply_filter(filtered_values, b_notch, a_notch)
                    else:
                        filtered_values = raw_values.copy()

                    data_packet = {
                        "time": timestamp,
                        "values": filtered_values.tolist(),
                        "deviceData": self.latest_device_data,
                        "qualityData": self.latest_quality_data,
                        "channelNames": channel_names
                    }
                    
                    # print(f"[DEBUG] Sending filtered data: time={timestamp}, channels={len(filtered_values)}")
                    
                    if self.data_callback:
                        self.data_callback(data_packet)
                else:
                    print(f"[WARNING] No valid EEG channels found in data: {eeg_data}")
                    
        except Exception as e:
            print(f"[ERROR] EEG data handling failed: {e}")
            import traceback
            traceback.print_exc()

    def handle_device_data(self, data):
        """Handle device information data"""
        try:
            dev_data = data.get('dev', None)
            timestamp = data.get('time', None)
            
            if dev_data and timestamp:
                self.latest_device_data = {
                    "timestamp": timestamp,
                    "data": dev_data
                }
                # Debug visibility for initial troubleshooting
                # print(f"[DEVICE] Time: {timestamp}, Device data: {dev_data}")
                
        except Exception as e:
            print(f"[ERROR] Device data handling failed: {e}")

    def handle_quality_data(self, data):
        """Handle EEG quality data"""
        try:
            eq_data = data.get('eq', None)
            timestamp = data.get('time', None)
            
            if eq_data and timestamp:
                self.latest_quality_data = {
                    "timestamp": timestamp,
                    "data": eq_data
                }
                # Debug visibility for initial troubleshooting
                # print(f"[QUALITY] Time: {timestamp}, EEG Quality: {eq_data}")
                
        except Exception as e:
            print(f"[ERROR] Quality data handling failed: {e}")

    def run_sequence(self):
        # Start by ensuring access is granted once; then only authorise on retries
        if not self.access_granted:
            self.request_access()
        else:
            self.authorise()

    def request_access(self):
        request_access = {
            "id": 0,  
            "jsonrpc": "2.0",
            "method": "requestAccess",
            "params": {
                "clientId": CLIENT_ID,
                "clientSecret": CLIENT_SECRET
            }
        }
        self.send_request(request_access)

    def authorise(self):
        request = {
            "jsonrpc": "2.0",
            "method": "authorize",
            "params": {
                "clientId": CLIENT_ID,
                "clientSecret": CLIENT_SECRET,
                "debit": 1
            },
            "id": 1
        }
        self.send_request(request)

    def query_headsets(self):
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "queryHeadsets"
        }
        self.send_request(request)

    def connect_headset(self):
        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "controlDevice",
            "params": {
                "command": "connect",
                "headset": self.headset_id
            }
        }
        self.send_request(request)

    def query_sessions(self):
        request = {
            "jsonrpc": "2.0",
            "id": 6,
            "method": "querySessions",
            "params": {
                "cortexToken": self.auth_token
            }
        }
        self.send_request(request)

    def create_session(self):
        request = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "createSession",
            "params": {
                "cortexToken": self.auth_token,
                "headset": self.headset_id,
                "status": "active"
            }
        }
        self.send_request(request)

    def subscribe(self, streams):
        request = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "subscribe",
            "params": {
                "cortexToken": self.auth_token,
                "session": self.session_id,
                "streams": streams
            }
        }

        self.subscribed = False
        self.last_subscribe_time = time.time()
        self.cancel_resub_timer()
        self.send_request(request)
        print(f"[INFO] Sent subscribe request for streams: {streams}")

    def start_post_subscribe_guard(self):
        # After subscribing, ensure data arrives within a grace period; otherwise retry
        def _guard():
            try:
                no_recent_eeg = (self.last_data_time is None) or ((time.time() - self.last_data_time) > 5.0)
                if no_recent_eeg:
                    if self.resubscribe_attempts < self.max_resubscribe_attempts:
                        self.resubscribe_attempts += 1
                        print(f"[WARN] No EEG data after subscribe; re-subscribing (attempt {self.resubscribe_attempts}/{self.max_resubscribe_attempts})...")
                        if self.session_id and self.auth_token:
                            self.subscribe(['eeg', 'dev', 'eq'])
                        else:
                            self.schedule_authorise_retry()
                    else:
                        print("[WARN] Still no EEG after multiple resubscribe attempts; restarting full flow...")
                        self.resubscribe_attempts = 0
                        self.hard_reset("no EEG after multiple resubscribe attempts")
            except Exception as e:
                print(f"[ERROR] Post-subscribe guard error: {e}")
        self.cancel_resub_timer()
        self.resub_timer = threading.Timer(5.0, _guard)
        self.resub_timer.daemon = True
        self.resub_timer.start()

    def start(self):
        # Robust reconnect loop for the Cortex WebSocket
        while True:
            try:
                self.connect_cortex()
                self.ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
            except Exception as e:
                print(f"[ERROR] run_forever exception: {e}")

            # Short delay before attempting to reconnect
            time.sleep(RECONNECT_INTERVAL)


# Global variable to store the EEG client
emotiv_client = None
connected_websockets = set()
main_loop = None  # Store reference to main event loop

# === WebSocket Server Handler (For browser clients) ===
async def emotiv_to_websocket(websocket):
    global emotiv_client, connected_websockets, main_loop
    
    print("[INFO] Browser WebSocket client connected")
    connected_websockets.add(websocket)
    
    # Store the main event loop reference
    if main_loop is None:
        main_loop = asyncio.get_event_loop()
    
    def send_to_browser(data_packet):
        # Send data to all connected WebSocket clients using thread-safe method
        if main_loop and not main_loop.is_closed():
            for ws in connected_websockets.copy():  # Use copy to avoid modification during iteration
                try:
                    # Use call_soon_threadsafe for thread-safe scheduling
                    main_loop.call_soon_threadsafe(
                        asyncio.create_task,
                        send_data_to_client(ws, data_packet)
                    )
                except Exception as e:
                    print(f"[ERROR] Failed to schedule data send: {e}")
                    connected_websockets.discard(ws)

    # Start Emotiv client if not already started
    if emotiv_client is None:
        emotiv_client = EmotivEEGClient(data_callback=send_to_browser)
        threading.Thread(target=emotiv_client.start, daemon=True).start()
    else:
        # Update the callback for existing client
        emotiv_client.data_callback = send_to_browser

    # Keep connection alive
    try:
        while True:
            await asyncio.sleep(1)
    except websockets.exceptions.ConnectionClosed:
        print("[INFO] Browser WebSocket client disconnected")
        connected_websockets.discard(websocket)

# Helper function to send data to a specific client
async def send_data_to_client(websocket, data_packet):
    try:
        if websocket in connected_websockets:  # Check if still connected
            await websocket.send(json.dumps(data_packet))
    except websockets.exceptions.ConnectionClosed:
        print("[INFO] WebSocket client disconnected during send")
        connected_websockets.discard(websocket)
    except Exception as e:
        print(f"[ERROR] Failed to send data to WebSocket client: {e}")
        connected_websockets.discard(websocket)


# === Start WebSocket Server ===
def main():
    print("Starting Emotiv EEG WebSocket server at ws://localhost:8765")

    async def start():
        server = await websockets.serve(emotiv_to_websocket, "localhost", 8765)
        print("READY")
        try:
            emit_event("server-ready")
        except Exception:
            pass
        await server.wait_closed()

    asyncio.run(start())

if __name__ == "__main__":
    main()