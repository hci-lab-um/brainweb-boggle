const path = require('path');
const { PythonShell } = require('python-shell');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const fbccaConfiguration = require('../../../configs/fbccaConfig.json');
const { ConnectionTypes } = require('../../utils/constants/enums');

const eegEvents = new EventEmitter();
const requiredSampleCount = totalDataPointCount();
let connectionType;
let messageResult = { data: [] };
let ws = null;
let pythonShellInstance = null;
let pythonShellInitPromise = null;
let pythonRequestQueue = Promise.resolve();
let serverState = { ready: false, errorSinceReady: false };
let headsetConnected = false;
let pythonProcessRef = null; // track spawned websocket server process
let lastQualityPercent = null; // track latest Emotiv signal quality percent

function totalDataPointCount(config = fbccaConfiguration) {
    return Math.ceil(config.samplingRate * config.gazeLengthInSecs);
}

function clearMessageBuffer() {
    messageResult.data = [];
}

// Function used to run the LSL or Emotiv WebSocket Server
async function spawnPythonWebSocketServer(defaultConnectionType) {
    return new Promise((resolve, reject) => {
        connectionType = defaultConnectionType;

        console.log(`Starting ${defaultConnectionType.toUpperCase()} EEG WebSocket server...`);

        // reset state at start
        serverState.ready = false;
        serverState.errorSinceReady = false;

        // Selecting the appropriate Python script based on configuration
        const pythonScriptPath = (() => {
            switch (connectionType) {
                case ConnectionTypes.CORTEX_API.NAME:
                    return path.join(__dirname, '../../ssvep/lsl/emotiv_websocket_server.py');
                case ConnectionTypes.TCP_IP.NAME:
                    return "";
                case ConnectionTypes.LSL.NAME:                    
                    return path.join(__dirname, '../../ssvep/lsl/lsl_websocket_server.py');
                default:
                    return path.join(__dirname, '../../ssvep/lsl/lsl_websocket_server.py');
            }
        })();

        const pythonProcess = spawn('python', ['-u', pythonScriptPath]); // -u was used to disable output buffering (allow logs to pass in stdout)
        pythonProcessRef = pythonProcess; // store for later kill

        // Buffer stdout to handle partial lines
        let stdoutBuffer = '';

        const handleJsonEvent = (evtObj) => {
            try {
                if (!evtObj || evtObj.jsonrpc !== '2.0' || evtObj.method !== 'event') return false;
                const params = evtObj.params || {};
                const type = params.type;
                if (!type) return false;

                if (type === 'server-ready') {
                    if (!serverState.ready) {
                        serverState.ready = true;
                        serverState.errorSinceReady = false;
                        resolve(pythonProcess);
                    }
                    return true;
                }

                // Do NOT set headsetConnected true from these events! Wait for actual data flow.
                if (type === 'headset-connected' || type === 'session-created' || type === 'subscription-confirmed' || type === 'session-reused') {
                    // Clear any previous errors
                    serverState.errorSinceReady = false;
                    return true;
                }

                if (type === 'headset-disconnected' || type === 'error') {
                    serverState.errorSinceReady = true;
                    if (headsetConnected) {
                        headsetConnected = false;
                        clearMessageBuffer();
                        eegEvents.emit('headset-disconnected');
                    }
                    return true;
                }

                if (type === 'credentials-invalid') {
                    serverState.errorSinceReady = true;
                    eegEvents.emit('credentials-invalid');
                    return true;
                } else if (type === 'credentials-valid') {
                    eegEvents.emit('credentials-valid', params);
                    return true;
                }

                return false;
            } catch (err) {
                console.error('Error handling JSON event:', err.message);
                return false;
            }
        };

        pythonProcess.stdout.on('data', (data) => {
            stdoutBuffer += data.toString('utf-8');
            const lines = stdoutBuffer.split(/\r?\n/);
            stdoutBuffer = lines.pop() || '';

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;

                let handledByJson = false;
                if (line.startsWith('{') && line.endsWith('}')) {
                    try {
                        const parsed = JSON.parse(line);
                        // Passive logging of JSON content
                        if (parsed && parsed.jsonrpc === '2.0' && parsed.method === 'event') {
                            const evtType = parsed.params && parsed.params.type ? parsed.params.type : 'unknown';
                            console.log(`[EVENT] ${evtType}`);
                        } else {
                            console.log(`[JSON] ${line}`);
                        }
                        handledByJson = handleJsonEvent(parsed);
                    } catch (err) {
                        console.log(`[MALFORMED JSON] ${line}`);
                        handledByJson = false;
                    }
                } else {
                    // Passive logging of non-JSON stdout lines
                    console.log(`[PYTHON] ${line}`);
                }
                if (handledByJson) continue; // logic has been handled by handleJsonEvent

                // Minimal fallback for READY only
                if (line === 'READY' && !serverState.ready) {
                    serverState.ready = true;
                    serverState.errorSinceReady = false;
                    resolve(pythonProcess);
                }
            }
        });

        pythonProcess.on('close', (code) => {
            console.log(`${defaultConnectionType}_websocket_server.py process exited with code ${code}`);
        });
    });
}

function connectWebSocketClient() {
    ws = new WebSocket('ws://localhost:8765');

    ws.on('open', () => {
        console.log(`Connected to ${connectionType.toUpperCase()} WebSocket server`);
    });

    ws.on('message', function incoming(data) {
        // console.log('Received:', data);
        let latestData = [];

        latestData = latestData.concat(data);

        latestData.forEach(buffer => {
            const dataString = buffer.toString('utf-8');

            try {
                // Parse the string as JSON
                const jsonData = JSON.parse(dataString);

                // Handle different data formats based on the EEG data source
                if (connectionType === 'emotiv') {
                    // Emotiv data format enhanced: {time, values, qualityData: {timestamp, data: [...]}}
                    // Marking headset as connected only upon receiving actual data
                    if (jsonData.time && Array.isArray(jsonData.values)) {
                        if (!headsetConnected) {
                            serverState.errorSinceReady = false;
                            headsetConnected = true;
                            clearMessageBuffer();
                            eegEvents.emit('headset-connected');
                        }
                        messageResult.data.push(jsonData);
                        trimMessageBuffer();

                        // Handle quality data if present
                        if (jsonData.qualityData && jsonData.qualityData.data && Array.isArray(jsonData.qualityData.data)) {
                            const eqArray = jsonData.qualityData.data;
                            // Expecting an array of 17 entries (3 labels and 14 channels): [batteryPercent, overall, sampleRateQuality, <EEG Sensor Quality>]
                            const ssvepIndices = [8, 9, 10, 11];
                            let samples = [];
                            ssvepIndices.forEach(idx => {
                                if (idx < eqArray.length && typeof eqArray[idx] === 'number') {
                                    samples.push(eqArray[idx]);
                                }
                            });
                            if (samples.length > 0) {
                                // Emotiv quality scale assumed 0-4 inclusive
                                const maxQuality = 4;
                                const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
                                let percent = Math.round((avg / maxQuality) * 100);
                                if (percent < 0) percent = 0;
                                if (percent > 100) percent = 100;
                                lastQualityPercent = percent;
                                eegEvents.emit('quality-update', { percent });
                            }
                        }
                    } else {
                        console.log('[DEBUG] Emotiv data missing time or values:', jsonData);
                    }
                } else {
                    // LSL data format: {time: timestamp, values: [ch1, ch2, ...]}
                    if (jsonData && (jsonData.time !== undefined) && Array.isArray(jsonData.values)) {
                        if (!headsetConnected) {
                            serverState.errorSinceReady = false;
                            headsetConnected = true;
                            clearMessageBuffer();
                            eegEvents.emit('headset-connected');
                        }
                        messageResult.data.push(jsonData);
                        trimMessageBuffer();
                    }
                }
            } catch (error) {
                console.error("Failed to parse JSON:", error.message);
            }
        });
    });

    ws.on('error', (error) => {
        console.error(`${connectionType.toUpperCase()} WebSocket error:`, error.message);

        // Retry on ECONNREFUSED error
        if (error.message.includes('ECONNREFUSED')) {
            console.log(`Retrying ${connectionType.toUpperCase()} WebSocket connection in 1 second...`);
            setTimeout(connectWebSocketClient, 1000);  // Retry after 1 second
        }
    });
}

async function disconnectWebSocketClient() {
    if (ws) {
        try { await ws.close(); } catch (_) { }
        ws = null;
    }
    headsetConnected = false;
    clearMessageBuffer(); // ensure buffer cleared when socket closes
}

async function stopEegInfrastructure() {
    try {
        await disconnectWebSocketClient();
    } catch (e) {
        console.error('WS close error:', e);
    }

    if (pythonProcessRef && !pythonProcessRef.killed) {
        try {
            await pythonProcessRef.kill('SIGTERM');
        } catch (e) {
            console.error('Python process kill error:', e);
        }
    }

    pythonProcessRef = null;
    resetPythonShell({ terminate: true });
}

function trimMessageBuffer() {
    if (!Array.isArray(messageResult.data)) {
        return;
    }

    const excess = messageResult.data.length - requiredSampleCount;
    if (excess > 0) {
        messageResult.data.splice(0, excess);
    }
}

function resetPythonShell({ terminate = false } = {}) {
    if (terminate && pythonShellInstance && typeof pythonShellInstance.terminate === 'function') {
        try {
            pythonShellInstance.terminate();
        } catch (error) {
            console.error('Failed to terminate Python shell:', error.message);
        }
    }

    pythonShellInstance = null;
    pythonShellInitPromise = null;
}

async function ensurePythonShell() {
    if (pythonShellInstance) {
        return pythonShellInstance;
    }

    if (!pythonShellInitPromise) {
        pythonShellInitPromise = new Promise((resolve, reject) => {
            try {
                const scriptPath = path.join(__dirname, '../../ssvep/fbcca-py/run_fbcca.py');
                const shell = new PythonShell(scriptPath, { mode: 'json' });

                shell.on('stderr', (error) => {
                    console.error('Python Error:', error.toString());
                });

                shell.on('close', (code) => {
                    console.log('Python shell closed with code', code);
                    resetPythonShell();
                });

                pythonShellInstance = shell;
                resolve(shell);
            } catch (error) {
                resetPythonShell();
                reject(error);
            }
        }).catch((error) => {
            resetPythonShell();
            throw error;
        });
    }

    return pythonShellInitPromise;
}

function queuePythonTask(task) {
    const nextTask = pythonRequestQueue.then(() => task());
    pythonRequestQueue = nextTask.catch(() => { });
    return nextTask;
}

function runPythonFbcca(eegData, scenarioId, stimuliFrequencies, activeButtonIds) {
    return queuePythonTask(async () => {
        const shell = await ensurePythonShell();

        return new Promise((resolve, reject) => {
            const handleMessage = (selectedButtonId) => {
                shell.removeListener('message', handleMessage);
                shell.removeListener('close', handleClose);
                if (selectedButtonId && typeof selectedButtonId === 'object' && selectedButtonId.error) {
                    reject(new Error(selectedButtonId.error));
                    return;
                }
                resolve(selectedButtonId);
            };

            const handleError = (error) => {
                shell.removeListener('message', handleMessage);
                shell.removeListener('close', handleClose);
                resetPythonShell({ terminate: true });
                reject(error);
            };

            const handleClose = () => {
                handleError(new Error('Python shell closed before responding.'));
            };

            try {
                shell.once('message', handleMessage);
                shell.once('close', handleClose);
                shell.send({
                    eegData,
                    scenario_id: scenarioId,
                    stim_freqs: stimuliFrequencies,
                    active_button_ids: activeButtonIds
                }, (error) => {
                    if (error) {
                        handleError(error);
                    }
                });
            } catch (error) {
                handleError(error);
            }
        });
    });
}

// Function to handle incoming WebSocket data
async function processDataWithFbcca(currentScenarioID, viewsList, stimuliFrequencies, activeButtonIds) {
    if (!headsetConnected) {
        // Avoid repeated logs with stale partial data
        if (messageResult.data.length) {
            clearMessageBuffer();
        }
        return;
    }

    if (messageResult.data && messageResult.data.length >= requiredSampleCount) {
        // Bypass classification if Emotiv signal quality is too low
        // if (eegDataSource === 'emotiv' && typeof lastQualityPercent === 'number' && lastQualityPercent < 25) {
        //     console.log(`[INFO] Skipping classification due to low signal quality (${lastQualityPercent}%).`);
        //     return -1;
        // }

        console.log(`[DEBUG] Processing ${messageResult.data.length} data points from ${connectionType.toUpperCase()}`);

        const dataPoints = messageResult.data.slice(-requiredSampleCount);
        messageResult.data = [];

        console.log('Sample data point:', dataPoints[0]);

        // Determine the actual number of channels from the first data point
        const actualChannelCount = fbccaConfiguration.channels;
        console.log(`[DEBUG] Detected ${actualChannelCount} channels in the data`);

        // Initialize an array to hold data by channel (use actual channel count)
        const eegData = Array.from({ length: actualChannelCount }, () => []);

        // Populate the eegData array, where each row corresponds to a channel
        dataPoints.forEach((point, idx) => {
            const values = point['values'];
            if (values && values.length > 0) {
                values.forEach((value, i) => {
                    if (i < eegData.length) {  // Make sure we don't exceed channel count
                        eegData[i].push(value);
                    }
                });
            } else {
                console.log(`[WARNING] Data point ${idx} missing values:`, point);
            }
        });

        console.log(`[DEBUG] Processed data - Channel 0 has ${eegData[0] ? eegData[0].length : 0} samples`);

        // !!!!!!!!!!! CHECK THIS !!!!!!!!!!! 
        // Slice the first 200 samples from each channel DUE TO VISUAL LATENCY
        // eegData = eeg.map(channel => channel.slice(200));

        // Now `channels` is a 2D array where each row is a channel with values over time
        console.log(`[DEBUG] Organised data by channel count ${eegData.length}, samples per channel ${eegData[0] ? eegData[0].length : 0}`);

        // Run fbcca in Python
        return runPythonFbcca(eegData, currentScenarioID, stimuliFrequencies, activeButtonIds).then((selectedButtonId) => {
            if (parseInt(selectedButtonId) !== -1) {
                console.log('PYTHON - User selected button', selectedButtonId);

                let topMostView = viewsList[viewsList.length - 1];
                topMostView.webContentsView.webContents.send('selectedButton-click', selectedButtonId);
            } else {
                console.log('PYTHON - User is in Idle State!');
            }

            return selectedButtonId;
        }).catch((error) => {
            console.error('Error when executing Python:', error.message);
            return -1;
        });
        
    } else if (messageResult.data && messageResult.data.length > 0) {
        console.log(`[DEBUG] Not enough EEG data for processing. messageResult.data length: ${messageResult.data.length}`);
    }
}

module.exports = {
    spawnPythonWebSocketServer,
    connectWebSocketClient,
    disconnectWebSocketClient,
    stopEegInfrastructure,
    processDataWithFbcca,
    eegEvents
};