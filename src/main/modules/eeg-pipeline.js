const path = require('path');
const { PythonShell } = require('python-shell');
const { spawn } = require('child_process');
const WebSocket = require('ws');
// const { run_fbcca } = require('../../ssvep/fbcca-js/run_fbcca');
const fbccaConfiguration = require('../../../configs/fbccaConfig.json');
const { browserConfig } = require('../../../configs/browserConfig');

const fbccaLanguage = browserConfig.fbccaLanguage; // 'javascript' or 'python'
const eegDataSource = browserConfig.eegDataSource; // 'lsl' or 'emotiv'
const requiredSampleCount = totalDataPointCount();
let messageResult = { data: [] };
let ws = null;
let pythonShellInstance = null;
let pythonShellInitPromise = null;
let pythonRequestQueue = Promise.resolve();

function totalDataPointCount(config = fbccaConfiguration) {
    return Math.ceil(config.samplingRate * config.gazeLengthInSecs);
}

// Function used to run the LSL or Emotiv WebSocket Server
async function startEegWebSocket() {
    return new Promise((resolve, reject) => {
        let pythonScriptPath;

        console.log(`Starting ${eegDataSource.toUpperCase()} EEG WebSocket server...`);

        // Choose the appropriate Python script based on configuration
        if (eegDataSource === 'emotiv') {
            pythonScriptPath = path.join(__dirname, '../../ssvep/lsl/emotiv_websocket_server.py');
        } else {
            pythonScriptPath = path.join(__dirname, '../../ssvep/lsl/lsl_websocket_server.py');
        }

        const pythonProcess = spawn('python', ['-u', pythonScriptPath]); // -u was used to disable output buffering (allow logs to pass in stdout)

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`${eegDataSource.toUpperCase()} Server:`, message);

            if (message === 'READY') {  // Wait for the 'READY' message from Python
                console.log(`${eegDataSource.toUpperCase()} WebSocket server is ready!`);
                resolve(pythonProcess);   // Resolve the promise with the running Python process
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`${eegDataSource.toUpperCase()} Python Error:`, data.toString());
        });

        pythonProcess.on('close', (code) => {
            console.log(`${eegDataSource}_websocket_server.py process exited with code ${code}`);
        });
    });
}

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8765');

    ws.on('open', () => {
        console.log(`Connected to ${eegDataSource.toUpperCase()} WebSocket server`);
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
                if (eegDataSource === 'emotiv') {
                    // Emotiv data format: {time: timestamp, values: [ch1, ch2, ...]}
                    if (jsonData.time && jsonData.values) {
                        // console.log(`[DEBUG] Adding Emotiv data: time=${jsonData.time}, channels=${jsonData.values.length}`);
                        messageResult.data.push(jsonData);
                        trimMessageBuffer();
                    } else {
                        console.log('[DEBUG] Emotiv data missing time or values:', jsonData);
                    }
                } else {
                    // LSL data format: {time: timestamp, values: [ch1, ch2, ...]}
                    messageResult.data.push(jsonData);
                    trimMessageBuffer();
                }
            } catch (error) {
                console.error("Failed to parse JSON:", error);
            }
        });
    });

    ws.on('error', (error) => {
        console.error(`${eegDataSource.toUpperCase()} WebSocket error:`, error.message);

        // Retry on ECONNREFUSED error
        if (error.message.includes('ECONNREFUSED')) {
            console.log(`Retrying ${eegDataSource.toUpperCase()} WebSocket connection in 1 second...`);
            setTimeout(connectWebSocket, 1000);  // Retry after 1 second
        }
    });
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
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
            console.error('Failed to terminate Python shell:', error);
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
    if (messageResult.data && messageResult.data.length >= requiredSampleCount) {
        console.log(`[DEBUG] Processing ${messageResult.data.length} data points from ${eegDataSource.toUpperCase()}`);

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

        // Run fbcca algorithm based on the selected language
        if (fbccaLanguage === 'javascript') {
            // Run fbcca in JavaScript
            const selectedButtonId = run_fbcca(eegData, currentScenarioID);

            if (selectedButtonId != -1) {
                console.log("JAVASCRIPT - User selected button", selectedButtonId);

                // Obtaining the topmost view from the viewsList to send the button click for the button that has been classified by fbcca JAVASCRIPT
                let topMostView = viewsList[viewsList.length - 1];
                topMostView.webContentsView.webContents.send('selectedButton-click', selectedButtonId);
            } else {
                console.log("JAVASCRIPT - User is in Idle State!");
            }

        } else {
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
                console.error('Error when executing Python:', error);
                return -1;
            });
        }
    } else if (messageResult.data && messageResult.data.length > 0) {
        console.log(`[DEBUG] Not enough EEG data for processing. messageResult.data length: ${messageResult.data.length}`);
    }
}

module.exports = {
    startEegWebSocket,
    connectWebSocket,
    disconnectWebSocket,
    processDataWithFbcca
};