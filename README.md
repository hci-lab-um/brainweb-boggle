<div style="text-align: center;">
	 <img src="resources/boggle_logo.png" alt="Boggle Logo" width="90" height="90">
	 <h1>Boggle – Brain-Controlled Browser – Setup Guide</h1>
</div>

Boggle is a brain-controlled web browser that uses Steady-State Visually Evoked Potentials (SSVEP) to enable hands‑free web access for users with severe motor impairments. This guide explains how to install Boggle, configure supported EEG headsets, and understand when credentials are required.


## Installation

There are two ways to get started.

### 1. Download and install the latest release

[Download latest release](https://github.com/hci-lab-um/brainweb-boggle/releases)

Once downloaded:

1. Extract or install the archive for your platform.
2. Launch the Boggle executable from the installed location.

### 2. Download the code and build from source

**Prerequisites**

- Node.js 20 LTS or newer (tested with Node 20.x).
- Python 3.10+ available on your `PATH`.
- `git` (optional, for cloning).

**Steps**

1. Install Node.js and Python.
2. Download or clone this repository:
	- `git clone https://github.com/hci-lab-um/brainweb-boggle.git`
	- `cd brainweb-boggle`
3. Install JavaScript dependencies:
	- `npm install`
4. (Recommended) Create and activate a Python virtual environment.
5. Install Python dependencies:
	- `python -m pip install -r requirements.txt`

You can build distributable binaries using

```bash
npm run dist
```

> Note: `npm run dist` may require additional platform-specific tooling (e.g. build tools on Windows).


## Running Boggle

From the project root:

```bash
npm run start
```

This will:

- Compile the SCSS styles into CSS.
- Launch the Electron-based Boggle browser.

On first launch Boggle will create a local SQLite database in your user data directory and populate default settings, including a default headset and connection type.


## Supported Headsets and Connection Types

Boggle is designed to work with SSVEP-capable EEG headsets. Supported headsets and connection modes are currently:

- **Emotiv EPOC X** (Emotiv)
  - Connection type: **Cortex API**
  - **Requires credentials** (client ID and client secret)
- **DSI-VR300** (Wearable Sensing)
  - Connection types: **LSL**, **TCP/IP**
  - Does **not** require credentials
  - LSL is the primary, fully supported mode
- **g.USBamp** (g.tec)
  - Connection type: **LSL**
  - Does **not** require credentials

You can select the default headset and connection type from **More → Settings → Headset Settings** inside Boggle. These choices determine which Python WebSocket server script is launched and which EEG transport is used.


## General Setup and Usage

There are two ways to perform the initial configuration:

1. Using **NeuroTune** (recommended).
2. Configuring everything directly inside **Boggle**.


### OPTION 1: Initial Setup via NeuroTune (Recommended)

NeuroTune is a companion calibration tool for Boggle. Using it first is recommended, especially in research or clinical setups, because it allows you to identify per-user optimal SSVEP settings and then export them into Boggle.

In NeuroTune, the user can:

- Select the **headset** and **connection type** that will be used with Boggle.
- Enter and store **credentials** when required (for example, Emotiv Cortex client ID and secret).
- Run a **calibration process** to identify the best SSVEP **frequencies**, **colour combination**, and **stimuli pattern** for that individual.

After (or, with some options greyed out, even before) completing calibration, the user can choose **Export to → Export to Boggle**. The user may select which items to include in the export; it can contain any combination of:

- Credentials (if previously entered; shown but greyed out when not available).
- Default headset and connection type.
- Best frequencies.
- Best colours.
- Best stimuli pattern.

Once this export is complete, Boggle will start with these values pre-configured, and the user can immediately begin using the browser.


### OPTION 2: Manual Setup in Boggle

If you prefer to configure everything directly in Boggle, or if NeuroTune is not available, follow these steps:

1. **Set up your EEG headset** according to the manufacturer’s instructions.
2. Ensure electrodes are correctly placed and impedance/quality indicators are acceptable.
3. **Start the vendor software** that exposes EEG data:
	- For LSL-based devices, ensure an EEG stream of type `EEG` is available on the network.
	- For Emotiv EPOC X, ensure Emotiv Cortex is running using a valid license and that the headset is connected.
4. Launch **Boggle**.
5. The default headset headset is **Epoc X by Emotiv**, using the **Cortex API** as the default connection type. To change this setting, click on the `Change Defaults` button from the credentials required modal. Otherwise, close the modal and navigate **More → Settings → Headset Settings**. Here:
	- Choose your headset (e.g. `EPOC X - Emotiv`, `DSI-VR300 - Wearable Sensing`, `g.USBamp - g.tec`).
	- Select the appropriate **Connection Type** (e.g. `Cortex API`, `LSL`).
6. If you update the default headset settings, restart the browser to see the changes. 
7. Monitor the **status bar** at the bottom of the main window:
	- The headset name should match your selection.
	- The connection indicator will change once EEG data is detected.
	- Signal quality is visualised as a percentage and colour.

Once the headset is streaming and connected, SSVEP stimuli will appear on buttons throughout the browser. Users can then control Boggle by focusing their gaze on flickering targets; the EEG pipeline performs FBCCA-based classification to infer which control to activate.

> Initial configuration (settings, calibration, credential entry), whether performed in NeuroTune or directly in Boggle, requires standard mouse and keyboard interaction. After setup, the browser can be operated using BCI alone.


## Emotiv EPOC X – Cortex API (Credentials Required)

The Emotiv EPOC X uses the **Cortex API** connection type and requires an application **Client ID** and **Client Secret**. These are used by the Python server at `src/ssvep/lsl/emotiv_websocket_server.py` to authenticate with Emotiv Cortex.

### What you need

- An **Emotiv EPOC X** headset.
- Emotiv Launcher software installed and running.
- An Emotiv account with access to the Cortex API license to be able to stream EEG data.
- A registered Cortex client application (to obtain Client ID and Client Secret).

### Setup steps

1. Install and open the Emotiv software and sign in to your Emotiv account.
2. Pair and connect the EPOC X headset until the vendor application reports a stable connection.
3. In your Emotiv account, create or locate a **Cortex client** and note its **Client ID** and **Client Secret**.
4. Start **Boggle**.
5. Monitor the Status Bar located at the bottom and ensure:
	- **Headset** is set to `EPOC X - Emotiv`.
	- **Signal Health** is green and a number is present indicating the signal quality.
6. If credentials are missing or invalid, Boggle will open a **Credentials Required** overlay (requires mouse/keyboard):
	- Enter your **Client ID** and **Client Secret**.
	- Click **Save**.
	- Optionally choose **Change Defaults** to adjust which headset/connection combination is used by default.

After saving, Boggle will update its internal configuration and `.env` file and restart the EEG WebSocket server. When data begins flowing from Cortex, the headset indicator and signal quality in the status bar will update, and Boggle will be ready for brain‑controlled browsing.


## DSI-VR300 – LSL / TCP-IP (No Credentials)

> ⚠️ **In Development** – This feature is still under active development and may change.


The **DSI-VR300** can be used via:

- **LSL (Lab Streaming Layer)** – recommended and fully supported.
- **TCP/IP** – for custom or lab-specific integrations (experimental, requires your own bridge/server implementation).

### LSL Setup

1. Download and run a suitable DSI to LSL executable software such as [this](https://github.com/labstreaminglayer/App-WearableSensing) one.
2. If the above software recommended above is used, enter the port number and the following montage and reference, then press `Start`:
    - Montage: `PO3, PO4, POz, O1, O2, Oz`
    - Reference: `LE`
3. Start **Boggle**.
4. In **More → Settings → Headset Settings** select:
	- Headset: `DSI-VR300 - Wearable Sensing`.
	- Connection Type: `LSL`.
5. Once an LSL EEG stream is detected, the Python server at `src/ssvep/lsl/lsl_websocket_server.py` will forward data to Boggle, and the headset indicator will show as connected.

### TCP/IP (Experimental)

- The **TCP/IP** option is intended for advanced users with a custom network bridge that forwards EEG data to Boggle.
- No credentials are required, but additional configuration and code may be needed on your side.
- If you are unsure, prefer the **LSL** option.


## g.USBamp – LSL (No Credentials)
> ⚠️ **In Development** – This feature is still under active development and may change.

The **g.USBamp** from g.tec is supported via **LSL** only.

### Setup steps

1. Install and configure the g.tec acquisition software.
2. Enable streaming of EEG data via **LSL** with stream type `EEG`.
3. Start **Boggle**.
4. In **More → Settings → Headset Settings**, select:
	- Headset: `g.USBamp - g.tec`.
	- Connection Type: `LSL`.
5. Confirm that Boggle shows the headset as connected and that signal quality information appears in the status bar once data is streaming.


## Experimental and Not Yet Tested

Some combinations of headsets and connection types, or custom LSL/TCP bridges, may not have been fully tested with Boggle. If you attempt to use an unsupported configuration and encounter issues, please open a GitHub issue so the development team can review it.

- Repository: https://github.com/hci-lab-um/brainweb-boggle


## Troubleshooting

- **Headset not detected / status shows disconnected**
  - Confirm your headset is powered on and connected in the vendor software.
  - For LSL, verify that an `EEG` stream is visible on the network (e.g. using LabRecorder or similar tools).
  - For Emotiv, ensure Cortex is running and your account is signed in.

- **Credentials error (Emotiv EPOC X)**
  - If Boggle reports invalid credentials or cannot authenticate:
	 - Open the **Credentials** overlay again from the **Headset Settings**.
	 - Re‑enter your **Client ID** and **Client Secret**.
	 - Make sure the Cortex client is active and has appropriate permissions.

- **Boggle appears unresponsive**
  - Try closing Boggle and restarting both the headset vendor software and Boggle.
  - On repeated failure, collect logs and open an issue on GitHub.


## Status Bar

The status bar at the bottom of the window summarises Boggle’s current state:

- **Browser**

	Shows whether the browser is ready or busy:

	- Icon `check`, value **Ready** – browser is idle and ready for interaction.
	- Icon `autorenew`, value **Loading…** – a page or overlay is loading.
	- Icon `error`, value **Error** – an error page or unexpected problem was detected.

- **Adaptive Switch**

	Indicates whether the adaptive switch feature is active and which grouping state is currently used:

	- Icon `toggle_off`, value **Disabled** – adaptive switch is off.
	- Icon `toggle_on`, value **Read Mode** – all stimuli are off and Boggle is in read‑only mode.
	- Icon `toggle_on`, value **Group X of Y** – only a subset of buttons (group X) is flickering.
	- When enabled, the **Shortcut** section on the right shows the keyboard shortcut (by default `Alt+Shift+S`) to cycle through adaptive switch states. This shortcut is not configurable.

- **Headset**

	Reflects the configured headset and its connection state:

	- Icon `sensors_off`, value **Not configured** (or `—`) – no headset has been selected.
	- Icon `sensors`, value `<Headset Name>` – the selected headset is configured and EEG data is being received.

- **Signal Health**

	Summarises the estimated signal quality from the SSVEP‑relevant electrodes:

	- Icon `vital_signs` plus a coloured circle showing a percentage.
	- `--` with a **grey** circle – no valid signal yet (headset disconnected or not streaming).
	- **0–30%**, **red** – poor signal quality.
	- **30–70%**, **yellow** – moderate signal quality.
	- **70–100%**, **green** – good signal quality suitable for classification.


## People

- Daniel Calleja
- Marie Buhagiar
- Chris Porter
- Tracey Camilleri
- Kenneth Camilleri


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. When contributing, please:

- Keep changes focused and well‑documented.
- Add or update tests and documentation where appropriate.
- Respect the existing coding style and structure.


## License

This project is licensed under the **GNU General Public License v3.0 (GPL‑3.0)**. See the [LICENSE](LICENSE) file for the full text.


## Citing Boggle

If you use Boggle in academic work, please cite it.

**APA style example:**

> Calleja, D., Buhagiar, M., Porter, C., Camilleri, T., & Camilleri, K. (2025). *Boggle* (Version 1.0.0) [Computer software]. https://hci-lab-um.github.io/brainweb-boggle/

Alternatively, see the [CITATION.cff](CITATION.cff) file or click **“Cite this repository”** on the GitHub page for additional formats.


## Need Help?

If you are unsure how to configure your headset or encounter problems while setting up Boggle, you can:

- Open an issue in this repository: https://github.com/hci-lab-um/brainweb-boggle/issues

Happy browsing with Boggle!