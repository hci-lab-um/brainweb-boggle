# # ------------------- Generating mock LSL data and sending to WebSocket --------------------------

# import random
# import time
# import asyncio
# import websockets
# import json

# # Simulate EEG sample data
# def generate_mock_eeg_sample():
#     # Generate 8 channels of EEG data with random values between -100 and 100
#     values = [random.uniform(-100, 100) for _ in range(8)]
#     timestamp = time.time()  # Use the current time as the timestamp
#     return {"time": timestamp, "values": values}

# # # WebSocket server handler
# # async def lsl_to_websocket(websocket, path):
# #     while True:
# #         sample = generate_mock_eeg_sample()
# #         # Send the sample data as a JSON string
# #         await websocket.send(json.dumps(sample))
# #         await asyncio.sleep(1)  # Send a new sample every 1 second

# async def lsl_to_websocket(websocket, path):
#     count = 0
#     start_time = time.time()
    
#     while True:
#         # Check if 1 second has passed and reset count
#         if time.time() - start_time >= 1:
#             start_time = time.time()
#             count = 0

#         # Generate and send sample if under 1000 samples for the current second
#         if count < 250:
#             sample = generate_mock_eeg_sample()
#             await websocket.send(json.dumps(sample))
#             count += 1

#         # Sleep for a very short time to prevent CPU overload
#         await asyncio.sleep(0.0001)

# # Start the WebSocket server
# async def main():
#     async with websockets.serve(lsl_to_websocket, "localhost", 8765):
#         print("READY")
#         await asyncio.Future()  # Run indefinitely

# asyncio.run(main())


# ------------------- Reading from LSL and sending to WebSocket -------------------
# import time
# import asyncio
# import websockets
# import json
# from pylsl import StreamInlet, resolve_stream

# # Function to initialize the LSL stream inlet
# def initialize_lsl_inlet():
#     # Resolve an EEG stream on the lab network
#     print("Looking for an EEG stream...")
#     streams = resolve_stream('type', 'EEG')
    
#     # Create an inlet to read from the stream
#     inlet = StreamInlet(streams[0])
#     print("Connected to EEG stream.")
#     return inlet

# # # Function to fetch EEG sample from LSL stream
# def fetch_eeg_sample(inlet):
#     sample, timestamp = inlet.pull_sample(timeout=0.0)  # Pull non-blocking
#     if sample:
#         return {"time": timestamp, "values": sample[:8]} # Only returns the first 8 channels
#     else:
#         return None

# async def lsl_to_websocket(websocket, path):
#     inlet = initialize_lsl_inlet()

#     # while True:
#     #     sample = fetch_eeg_sample(inlet)
#     #     if sample:
#     #       await websocket.send(json.dumps(sample))
#     #     await asyncio.sleep(0.002)
    
#     count = 0
#     start_time = time.time()
    
#     while True:
#         # Check if 1 second has passed and reset count
#         if time.time() - start_time >= 1:
#             start_time = time.time()
#             count = 0

#         # Fetch and send sample if under 250 samples for the current second
#         if count < 250:
#             sample = fetch_eeg_sample(inlet)
#             if sample:
#                 await websocket.send(json.dumps(sample))
#                 count += 1

#         # Sleep for a very short time to prevent CPU overload
#         await asyncio.sleep(0.0001)

# # Start the WebSocket server
# async def main():
#     async with websockets.serve(lsl_to_websocket, "localhost", 8765):
#         print("READY")
#         await asyncio.Future()  # Run indefinitely

# asyncio.run(main())


# ------------------- Reading from LSL and performing bandpass and notch filtering -------------------
# import time
# import asyncio
# import websockets
# import json
# from pylsl import StreamInlet, resolve_stream
# from scipy.signal import butter, lfilter, iirnotch

# # Function to initialize the LSL stream inlet
# def initialize_lsl_inlet():
#     # Resolve an EEG stream on the lab network
#     print("Looking for an EEG stream...")
#     streams = resolve_stream('type', 'EEG')
    
#     # Create an inlet to read from the stream
#     inlet = StreamInlet(streams[0])
#     print("Connected to EEG stream.")
#     return inlet

# # Function to create a bandpass filter
# def butter_bandpass(lowcut, highcut, fs, order=10):
#     nyquist = 0.5 * fs
#     low = lowcut / nyquist
#     high = highcut / nyquist
#     b, a = butter(order, [low, high], btype='band')
#     return b, a

# # Function to create a notch filter
# def notch_filter(freq, fs, quality=30):
#     nyquist = 0.5 * fs
#     freq = freq / nyquist
#     b, a = iirnotch(freq, quality)
#     return b, a

# # Function to apply a filter to data
# def apply_filter(data, b, a):
#     return lfilter(b, a, data)

# # Function to fetch EEG sample from LSL stream
# def fetch_eeg_sample(inlet):
#     sample, timestamp = inlet.pull_sample(timeout=0.0)  # Pull non-blocking
#     if sample:
#         # Define filter parameters
#         fs = 500  # Sampling frequency (Hz)
#         lowcut = 2.0  # Low cut frequency (Hz)
#         highcut = 100.0  # High cut frequency (Hz)
#         notch_freq = 50.0  # Notch filter frequency (Hz)

#         # Create filters
#         b_bandpass, a_bandpass = butter_bandpass(lowcut, highcut, fs)
#         b_notch, a_notch = notch_filter(notch_freq, fs)

#         # Apply filters to the sample
#         filtered_sample = apply_filter(sample[:8], b_bandpass, a_bandpass)
#         filtered_sample = apply_filter(filtered_sample, b_notch, a_notch)

#         return {"time": timestamp, "values": filtered_sample.tolist()}
#     else:
#         return None

# async def lsl_to_websocket(websocket, path):
#     inlet = initialize_lsl_inlet()

#     count = 0
#     start_time = time.time()
    
#     while True:
#         # Check if 1 second has passed and reset count
#         if time.time() - start_time >= 1:
#             start_time = time.time()
#             count = 0

#         # Fetch and send sample if under 250 samples for the current second
#         if count < 20000:
#             sample = fetch_eeg_sample(inlet)
#             if sample:
#                 await websocket.send(json.dumps(sample))
#                 count += 1

#         # Sleep for a very short time to prevent CPU overload
#         await asyncio.sleep(0.0001)

# # Start the WebSocket server
# async def main():
#     async with websockets.serve(lsl_to_websocket, "localhost", 8765):
#         print("READY")
#         await asyncio.Future()  # Run indefinitely

# asyncio.run(main())


# ------------------- Reading from LSL, performing bandpass and notch filtering and saving the data into a csv file -------------------

# import time
# import asyncio
# import websockets
# import json
# import csv
# import os
# from pylsl import StreamInlet, resolve_stream
# from scipy.signal import butter, lfilter, iirnotch

# CSV_FILENAME = "eeg_data_9_5Hz.csv"

# # Function to initialize the LSL stream inlet
# def initialize_lsl_inlet():
#     print("Looking for an EEG stream...")
#     # streams = resolve_stream('type', 'EEG')
#     # inlet = StreamInlet(streams[0])
#     streams = resolve_stream()
#     # Then filter for EEG streams:
#     eeg_streams = [s for s in streams if s.type() == 'EEG']
#     if not eeg_streams:
#         raise RuntimeError("No EEG stream found.")
#     inlet = StreamInlet(eeg_streams[0])
#     print("Connected to EEG stream.")
#     return inlet

# # Function to create a bandpass filter
# def butter_bandpass(lowcut, highcut, fs, order=10):
#     nyquist = 0.5 * fs
#     low = lowcut / nyquist
#     high = highcut / nyquist
#     b, a = butter(order, [low, high], btype='band')
#     return b, a

# # Function to create a notch filter
# def notch_filter(freq, fs, quality=30):
#     nyquist = 0.5 * fs
#     freq = freq / nyquist
#     b, a = iirnotch(freq, quality)
#     return b, a

# # Function to apply a filter to data
# def apply_filter(data, b, a):
#     return lfilter(b, a, data)

# # Function to fetch EEG sample from LSL stream
# def fetch_eeg_sample(inlet):
#     sample, timestamp = inlet.pull_sample(timeout=0.5)
#     if sample:
#         fs = 300
#         lowcut = 2.0
#         highcut = 100.0
#         notch_freq = 50.0
        
#         b_bandpass, a_bandpass = butter_bandpass(lowcut, highcut, fs)
#         b_notch, a_notch = notch_filter(notch_freq, fs)
        
#         filtered_sample = apply_filter(sample[:6], b_bandpass, a_bandpass)
#         filtered_sample = apply_filter(filtered_sample, b_notch, a_notch)

#         print("Sample received:", sample)
#         return {
#             "time": timestamp,
#             "values": filtered_sample.tolist()
#         }
#     else:
#         print("No sample received")
#         return None

# # Function to save data to CSV
# def save_to_csv(data):
#     file_exists = os.path.isfile(CSV_FILENAME)
#     with open(CSV_FILENAME, mode='a', newline='') as file:
#         writer = csv.writer(file)
#         if not file_exists:
#             writer.writerow([f"Sample_{i}" for i in range(1, len(data) + 1)])
#         writer.writerow(data)

# async def lsl_to_websocket(websocket):
#     inlet = initialize_lsl_inlet()
#     count = 0
#     start_time = time.time()
    
#     while True:
#         if time.time() - start_time >= 1:
#             start_time = time.time()
#             count = 0
        
#         if count < 20000:
#             sample = fetch_eeg_sample(inlet)
#             if sample:
#                 await websocket.send(json.dumps(sample))
#                 save_to_csv(sample)
#                 count += 1

#         await asyncio.sleep(0.0001)

# # Start the WebSocket server
# async def main():
#     async with websockets.serve(lsl_to_websocket, "localhost", 8765):
#         print("READY")
#         await asyncio.Future()

# asyncio.run(main())


# ------------------- Reading from LSL and performing bandpass and notch filtering WITH Garbage Collection -------------------

import time
import asyncio
import websockets
import json
import gc  # Garbage collector interface
from pylsl import StreamInlet, resolve_stream
from scipy.signal import butter, lfilter, iirnotch
# from fbcca_config import fbcca_config

# Function to initialize the LSL stream inlet
def initialize_lsl_inlet():
    print("Looking for an EEG stream...")
    streams = resolve_stream('type', 'EEG')
    inlet = StreamInlet(streams[0])
    print("Connected to EEG stream.")
    return inlet

# Bandpass filter
def butter_bandpass(lowcut, highcut, fs, order=10):
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    return butter(order, [low, high], btype='band')

# Notch filter
def notch_filter(freq, fs, quality=30):
    nyquist = 0.5 * fs
    freq = freq / nyquist
    return iirnotch(freq, quality)

# Apply filter
def apply_filter(data, b, a):
    return lfilter(b, a, data)

# Fetch EEG sample from LSL
def fetch_eeg_sample(inlet, b_bandpass, a_bandpass, b_notch, a_notch):
    sample, timestamp = inlet.pull_sample(timeout=0.0)
    if sample:
        filtered_sample = apply_filter(sample[:8], b_bandpass, a_bandpass)
        filtered_sample = apply_filter(filtered_sample, b_notch, a_notch)
        return {"time": timestamp, "values": filtered_sample.tolist()}
    return None

# Main streaming function
async def lsl_to_websocket(websocket):
    inlet = initialize_lsl_inlet()

    # fs = fbcca_config.samplingRate
    fs = 256
    lowcut = 2.0
    highcut = 100.0
    notch_freq = 50.0

    b_bandpass, a_bandpass = butter_bandpass(lowcut, highcut, fs)
    b_notch, a_notch = notch_filter(notch_freq, fs)

    count = 0
    start_time = time.time()
    gc_timer = time.time()  # For periodic GC

    try:
        while True:
            now = time.time()

            # Reset counter every second
            if now - start_time >= 1:
                start_time = now
                count = 0

            # Fetch and send up to 20,000 samples/sec (adjust if needed)
            if count < 20000:
                sample = fetch_eeg_sample(inlet, b_bandpass, a_bandpass, b_notch, a_notch)
                if sample:
                    await websocket.send(json.dumps(sample))
                    count += 1

            # Run garbage collection every 5 seconds
            if now - gc_timer >= 5:
                gc.collect()
                gc_timer = now

            await asyncio.sleep(0.0001)

    except websockets.exceptions.ConnectionClosed:
        print("WebSocket closed")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        del inlet  # Help GC by removing references
        gc.collect()

# Start the WebSocket server
async def main():
    async with websockets.serve(lsl_to_websocket, "localhost", 8765):
        print("READY")
        await asyncio.Future()

asyncio.run(main())