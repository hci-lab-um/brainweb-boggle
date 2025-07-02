const path = require('path');
const { PythonShell } = require('python-shell');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { run_fbcca } = require('../../ssvep/fbcca-js/run_fbcca');
const Configuration = require('../../ssvep/fbcca-js/fbcca_config');
const browserConfig = require('../../../configs/browserConfig');

const fbccaLanguage = browserConfig.fbccaLanguage; // 'javascript' or 'python'
let messageResult = { data: [] };

// Function used to run the LSL WebSocket Server
async function startLslWebSocket() {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(__dirname, '../../ssvep/lsl/lsl_websocket_server.py');
        const pythonProcess = spawn('python', ['-u', pythonScriptPath]); // -u was used to disable output buffering (allow logs to pass in stdout)

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();

            if (message === 'READY') {  // Wait for the 'READY' message from Python
                resolve(pythonProcess);   // Resolve the promise with the running Python process
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`lsl_websocket_server.py process exited with code ${code}`);
        });
    });
}

function connectWebSocket() {
    const ws = new WebSocket('ws://localhost:8765');

    ws.on('open', () => {
        console.log('Connected to WebSocket server');
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
                messageResult.data.push(jsonData);
            } catch (error) {
                console.error("Failed to parse JSON:", error);
            }
        });
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);

        // Retry on ECONNREFUSED error
        if (error.message.includes('ECONNREFUSED')) {
            console.log('Retrying WebSocket connection in 1 second...');
            setTimeout(connectWebSocket, 1000);  // Retry after 1 second
        }
    });
}

// Function to handle incoming WebSocket data
async function processDataWithFbcca(currentScenarioID) {
    if (messageResult.data) {
        // Initialize an array to hold data by channel
        const eegData = Array.from({ length: Configuration.channels }, () => []);

        const dataPoints = messageResult['data'];

        // Populate the eegData array, where each row corresponds to a channel
        dataPoints.forEach(point => {
            const values = point['values'];
            values.forEach((value, i) => {
                eegData[i].push(value);
            });
        });

        // !!!!!!!!!!! CHECK THIS !!!!!!!!!!! 
        // Slice the first 200 samples from each channel DUE TO VISUAL LATENCY
        // eegData = eeg.map(channel => channel.slice(200));

        // Now `channels` is a 2D array where each row is a channel with values over time
        console.log("Organised data by channel:", eegData);

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
            return new Promise((resolve, reject) => {
                let scriptPath = path.join(__dirname, '../../ssvep/fbcca-py/run_fbcca.py');
                let shell = new PythonShell(scriptPath, { mode: 'json' });
                
                console.log('Sending Scenario ID and EEG data to Python:', currentScenarioID);

                // Send both eegData and scenario_id in a single JSON message
                shell.send({ eegData: JSON.stringify(eegData), scenario_id: currentScenarioID.toString() });

                shell.on('message', (selectedButtonId) => {
                    try {
                        if (parseInt(selectedButtonId) != -1) {
                            console.log("PYTHON - User selected button", selectedButtonId);

                            // Obtaining the topmost view from the viewsList to send the button click for the button that has been classified by fbcca PYTHON
                            let topMostView = viewsList[viewsList.length - 1];
                            topMostView.webContentsView.webContents.send('selectedButton-click', selectedButtonId);
                        }
                        else {
                            console.log("PYTHON - User is in Idle State!");
                        }

                        resolve(shell);  // Resolve with running Python process after receiving selectedButtonId    
                    } catch (error) {
                        console.error("Error when executing Python:", error);
                        reject(error);
                    }
                });

                shell.on('stderr', (error) => {
                    console.error('Python Error:', error.toString());
                });

                shell.on('close', () => {
                    console.log('Python shell closed');
                });
            });
        }
    }

    messageResult.data = [];
}

module.exports = {
    startLslWebSocket,
    connectWebSocket,
    processDataWithFbcca
};