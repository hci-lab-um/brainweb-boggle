import asyncio
import os
import websockets
import json
import ssl
import threading
import time
import numpy as np
from scipy.signal import butter, lfilter, iirnotch
import websocket

# === Emotiv Cortex Credentials ===
CLIENT_ID = 'hrvraMnWRFjtpyYt9uFKt75bszZiAh52UB6jTIVJ'
CLIENT_SECRET = 'OOoAUhXBtbEJEmiAK9AsafAq1Bo06pIJKrPoS4xXf0SqESqFUJTVqBS3NVvFjgcInxEuBJvU2zNegSoTfG8QGUzUUPQ2RmgsdhMIEQ0F8pcYWloQKZWAO4fDBrpB3BSJ'

# === FILTER CONFIGURATION ===
FS = 256  # EpocX sampling rate
LOWCUT = 2.0
HIGHCUT = 100.0
NOTCH_FREQ = 50.0
FILTER_ORDER = 5
NOTCH_Q = 30.0
EMOTIV_CHANNEL_NAMES = ["AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2", "P8", "T8", "FC6", "F4", "F8", "AF4"] # Emotiv Epoc X channel names always in this order
APPLY_FILTERING = False      # Set to True/False to enable/disable bandpass and notch filters
SAVE_RAW_DATA = True        # Set to True/False to enable/disable saving raw data to JSON files

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


class EmotivEEGClient:
    def __init__(self, data_callback=None):
        self.ws = websocket.WebSocketApp(
            "wss://localhost:6868",
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
            on_open=self.on_open
        )
        self.data_callback = data_callback
        self.auth_token = None
        self.headset_id = None
        self.session_id = None
        self.connected_clients = set()  # Track connected WebSocket clients
        self.latest_device_data = None
        self.latest_quality_data = None

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

    def on_close(self, ws, close_status_code=None, close_msg=None):
        print("[INFO] WebSocket closed")

    def on_open(self, ws):
        threading.Thread(target=self.run_sequence, daemon=True).start()

    def send_request(self, request):
        self.ws.send(json.dumps(request))

    def handle_response(self, data):
        # Check for errors in the response
        if 'error' in data:
            print(f"[ERROR] Request {data['id']} failed: {data['error']}")
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
            else:
                print("[ERROR] Failed to query headsets")

        # Connect headset
        elif data['id'] == 3:
            print("[INFO] Headset connected.")
            self.create_session()

        # Create session
        elif data['id'] == 4:
            if 'result' in data and 'id' in data['result']:
                self.session_id = data['result']['id']
                print(f"[INFO] Session created: {self.session_id}")
                self.subscribe(['eeg', 'dev', 'eq'])  # Subscribe to all three streams
            else:
                print("[ERROR] Failed to create session - no session ID received")

    def handle_eeg_data(self, data):
        try:
            eeg_data = data.get('eeg', None)
            timestamp = data.get('time', None)  # Get timestamp from main message
            
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
                # print(f"[QUALITY] Time: {timestamp}, EEG Quality: {eq_data}")
                
        except Exception as e:
            print(f"[ERROR] Quality data handling failed: {e}")

    def run_sequence(self):
        # Step 1: Request Access
        request_access = {
            "jsonrpc": "2.0",
            "method": "authorize",
            "params": {
                "clientId": CLIENT_ID,
                "clientSecret": CLIENT_SECRET,
                "debit": 1  # Required when session limit is reached
            },
            "id": 1
        }
        self.send_request(request_access)

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
        self.send_request(request)
        print(f"[INFO] Subscribed to streams: {streams}")

    def start(self):
        self.ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})


# Global variable to store the EEG client
emotiv_client = None
connected_websockets = set()
main_loop = None  # Store reference to main event loop

# === WebSocket Server Handler (For browser clients) ===
async def emotiv_to_websocket(websocket, path):
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
    start_server = websockets.serve(emotiv_to_websocket, "localhost", 8765)
    asyncio.get_event_loop().run_until_complete(start_server)
    print("READY")  # Signal to Node.js that the server is ready
    asyncio.get_event_loop().run_forever()


if __name__ == "__main__":
    main()