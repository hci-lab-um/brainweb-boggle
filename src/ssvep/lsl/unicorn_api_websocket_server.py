import asyncio
import json
import os
import time
import gc
import struct

import websockets
from scipy.signal import butter, lfilter, iirnotch

import os
import sys
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Adding the sibling folder fbcca-py to sys.path so it can import fbcca_config_service.fbcca_config.
try:
    FBCCA_DIR = os.path.join(os.path.dirname(BASE_DIR), "fbcca-py")
    if FBCCA_DIR not in sys.path:
        sys.path.insert(0, FBCCA_DIR)

    from fbcca_config_service import fbcca_config
except Exception as e:
    print(f"[ERROR] Failed to import fbcca_config_service.fbcca_config: {e}")
    # Stop here so the rest of the script doesn't run with missing config
    raise SystemExit(1)

# Adding the unicorn_vendor folder to sys.path so it can import the UnicornPy package.
try:
    UNICORN_DIR = os.path.join(BASE_DIR, "unicorn_vendor")

    if UNICORN_DIR not in sys.path:
        sys.path.insert(0, UNICORN_DIR)

    if hasattr(os, "add_dll_directory"):
        os.add_dll_directory(UNICORN_DIR)

    import UnicornPy
except Exception as e:
    print(f"[ERROR] Failed to set up UnicornPy from unicorn_vendor: {e}")
    # Stop here so the rest of the script doesn't run without UnicornPy
    print("READY")


# v---------- CONFIGS ----------v

CHANNELS = fbcca_config["channels"]              # Default number of EEG channels (will be read from device)
SAMPLING_RATE = fbcca_config["samplingRate"]    # Hz, will be overridden by UnicornPy.SamplingRate if available

if UnicornPy is not None and hasattr(UnicornPy, "SamplingRate"):
    SAMPLING_RATE = UnicornPy.SamplingRate

SAMPLES_PER_SECOND = 250     # Max samples pushed per second to WebSocket
APPLY_FILTERING = True       # Enable/disable bandpass + notch
SAVE_RAW_DATA = False        # Enable/disable saving raw data to JSON

# ^---------- CONFIGS ----------^


# Raw data JSON storage
RAW_JSON_FILENAME = "datasets/RAW-eeg-data_unicorn_api.json"
RAW_SAMPLE_BUFFER = []
RAW_SAMPLE_BUFFER_SIZE = 1000


def save_raw_sample_to_json(sample, filename: str = RAW_JSON_FILENAME) -> None:
    """Buffer raw EEG samples and periodically write to JSON.

    Stored format: { "eegData": [ [], [], ... ] }
    """
    global RAW_SAMPLE_BUFFER
    RAW_SAMPLE_BUFFER.append(sample)

    if len(RAW_SAMPLE_BUFFER) < RAW_SAMPLE_BUFFER_SIZE:
        return

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

        for buffered_sample in RAW_SAMPLE_BUFFER:
            for i, value in enumerate(buffered_sample):
                eeg_data[i].append(value)

        with open(filename, "w") as f:
            json.dump({"eegData": eeg_data}, f, indent=2)

        RAW_SAMPLE_BUFFER = []
    except Exception as e:
        print(f"[ERROR] Error saving raw EEG samples: {e}")


# Filters

def butter_bandpass(lowcut: float, highcut: float, fs: float, order: int = 5):
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    return butter(order, [low, high], btype="band")


def notch_filter(freq: float, fs: float, quality: float = 30.0):
    nyquist = 0.5 * fs
    norm_freq = freq / nyquist
    return iirnotch(norm_freq, quality)


def apply_filter(data, b, a):
    return lfilter(b, a, data)


def init_filters():
    fs = SAMPLING_RATE
    lowcut = 2.0
    highcut = 100.0
    notch_freq = 50.0

    b_band, a_band = butter_bandpass(lowcut, highcut, fs, order=5)
    b_notch, a_notch = notch_filter(notch_freq, fs, quality=30.0)
    return (b_band, a_band), (b_notch, a_notch)


# Unicorn device helpers

class UnicornDeviceWrapper:
    """Simple wrapper around Unicorn Hybrid Black Python API.

    This uses the official UnicornPy API from g.tec. The logic follows the
    UnicornPythonAcquisitionExample: GetAvailableDevices, Unicorn, StartAcquisition,
    GetData, StopAcquisition.
    """

    def __init__(self):
        if UnicornPy is None:
            raise RuntimeError("UnicornPy package not available; install Unicorn Hybrid Black Python API.")

        # Get available devices (serials)
        device_list = UnicornPy.GetAvailableDevices(True)
        if not device_list:
            raise RuntimeError("No Unicorn Hybrid Black device available. Please pair with a Unicorn first.")

        # For now, automatically select the first device
        selected_serial = device_list[0]
        print(f"[INFO] Connecting to Unicorn device '{selected_serial}'.")
        self.device = UnicornPy.Unicorn(selected_serial)
        print(f"[INFO] Connected to '{selected_serial}'.")

        # Setting the number of channels
        self.num_channels = CHANNELS

        self.frame_length = 1  # one sample per GetData call
        self.buffer_length = self.frame_length * self.num_channels * 4  # float32 -> 4 bytes
        self.buffer = bytearray(self.buffer_length)

        print("[INFO] Acquisition Configuration:")
        print(f"        Sampling Rate: {UnicornPy.SamplingRate if UnicornPy is not None else SAMPLING_RATE} Hz")
        print(f"        Frame Length: {self.frame_length}")
        print(f"        Number Of Acquired Channels: {self.device.GetNumberOfAcquiredChannels()} but USING {self.num_channels}")

        # Start data acquisition (testsig disabled -> real EEG)
        test_signals_enabled = False
        self.device.StartAcquisition(test_signals_enabled)
        print("[INFO] Unicorn data acquisition started.")

    def get_sample(self):
        """Return a single EEG sample as a list of CHANNELS values.

        Uses UnicornPy.Unicorn.GetData with frame length 1, then unpacks the
        float32 values from the byte buffer.
        """
        # Fill internal byte buffer with one frame of data
        self.device.GetData(self.frame_length, self.buffer, self.buffer_length)

        # Unpack as little-endian float32
        total_floats = self.frame_length * self.num_channels
        fmt = f"<{total_floats}f"
        values = struct.unpack(fmt, self.buffer)

        # For frame_length == 1, this is exactly one sample per channel
        return [float(values[ch]) for ch in range(self.num_channels)]

    def close(self):
        # Stop acquisition
        try:
            self.device.StopAcquisition()
        except Exception as e:
            print(f"[WARN] Failed to stop Unicorn acquisition cleanly: {e}")

        # Release receive buffer
        try:
            del self.buffer
        except Exception:
            pass

        # Close / delete device
        try:
            del self.device
        except Exception as e:
            print(f"[WARN] Failed to release Unicorn device: {e}")


# WebSocket streaming

async def unicorn_to_websocket(websocket):
    """Acquire Unicorn Hybrid Black EEG via Python API and stream over WebSocket.

    JSON packet format matches your existing LSL server:
      { "time": timestamp, "values": [ch1, ch2, ...] }
    """
    device = None
    (b_band, a_band), (b_notch, a_notch) = init_filters()

    try:
        print("[INFO] Initializing Unicorn Hybrid Black device (Python API)...")
        device = UnicornDeviceWrapper()
        print("[INFO] Unicorn Hybrid Black device ready.")

        count = 0
        start_time = time.time()
        gc_timer = time.time()

        while True:
            now = time.time()

            # Reset throughput counter each second
            if now - start_time >= 1.0:
                start_time = now
                count = 0

            if count < SAMPLES_PER_SECOND:
                raw_sample = device.get_sample()  # list of length CHANNELS
                
                if SAVE_RAW_DATA:
                    save_raw_sample_to_json(raw_sample)

                # Filtering
                if APPLY_FILTERING:
                    filtered = apply_filter(raw_sample[:CHANNELS], b_band, a_band)
                    filtered = apply_filter(filtered, b_notch, a_notch)
                    values = list(map(float, filtered))
                else:
                    values = list(map(float, raw_sample[:CHANNELS]))
                packet = {
                    "time": now,
                    "values": values,
                }

                try:
                    await websocket.send(json.dumps(packet))
                    count += 1
                except websockets.exceptions.ConnectionClosed:
                    print("[INFO] WebSocket client disconnected.")
                    break

            # Periodic GC to keep memory usage stable
            if now - gc_timer >= 5.0:
                gc.collect()
                gc_timer = now

            await asyncio.sleep(0.0001)

    except Exception as e:
        print(f"[ERROR] Unicorn WebSocket loop error: {e}")
    finally:
        if device is not None:
            device.close()
        gc.collect()


async def main():
    # Mirror the behavior of lsl_websocket_server/emotiv_websocket_server:
    # start a WebSocket server on ws://localhost:8765 and print READY when up.
    async with websockets.serve(unicorn_to_websocket, "localhost", 8765):
        print("READY")
        await asyncio.Future()  # Run indefinitely


if __name__ == "__main__":
    asyncio.run(main())
