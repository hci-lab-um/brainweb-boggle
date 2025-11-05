const ViewNames = Object.freeze({
    MAIN_WINDOW: "main",
    KEYBOARD: "keyboard",
    KEYBOARD_KEYS: "keyboardKeys",
    MORE: "more",
    SELECT: "select",
    BOOKMARKS: "bookmarks",
    TABS: "tabs",
    SEEK: "seek",
    DROPDOWN: "dropdown",
    ABOUT: "about",
    SETTINGS: "settings"
});

const CssConstants = Object.freeze({
    SELECTION_ANIMATION_DURATION: 500, // This is in milliseconds. It is used in the addButtonSelectionAnimation function.
});

const SwitchShortcut = Object.freeze({
    TOGGLE_BUTTON_GROUPINGS: 'Space'
});

const ConnectionTypes = Object.freeze({
    LSL: {
        NAME: "LSL",
        DESCRIPTION: "Connects through a local data stream. Choose this if your headset sends data via LSL."
    },
    TCP_IP: {
        NAME: "TCP/IP",
        DESCRIPTION: "Connects using your network address. Choose this for direct local or remote connections."
    },
    CORTEX_API: {
        NAME: "Cortex API",
        DESCRIPTION: "Connects through Emotiv’s official web service. Choose this for Emotiv headsets."
    }
});

const Headsets = Object.freeze({
    EPOC_X: {
        NAME: "EPOC X",
        COMPANY: "Emotiv",
        USED_ELECTRODES: ["O1", "P7", "P8", "O2"],
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: ConnectionTypes.CORTEX_API.NAME,
        },
        IMAGE: "../../resources/epocx_headset.png"
    },
    DSI_VR300: {
        NAME: "DSI-VR300",
        COMPANY: "Wearable Sensing",
        USED_ELECTRODES: ["PO3", "POz", "PO4", "O1", "Oz", "O2"],
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: ConnectionTypes.LSL.NAME,
            CONNECTION_TYPE_2: ConnectionTypes.TCP_IP.NAME,
        },
        IMAGE: "../../resources/dsi_vr300_headset.png"
    },
    G_USBAMP: {
        NAME: "g.USBamp",
        COMPANY: "g.tec",
        USED_ELECTRODES: ["PO7", "PO3", "POz", "PO4", "PO8", "O1", "Oz", "O2"],
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: ConnectionTypes.LSL.NAME
        },
        IMAGE: "../../resources/gusbamp_headset.png"
    }
});

const KeyboardLayouts = Object.freeze({
    FULL: {
        NAME: "Full",
        DESCRIPTION: "A QWERTY keyboard layout where keys are selectable from the start. Recommended for use with g.USBamp.",
        IMAGE: "../../resources/full_keyboard_layout.png"
    },
    MINIMISED: {
        NAME: "Minimised",
        DESCRIPTION: "A compact keyboard layout with fewer flickering stimuli at one time. Recommended for use with Epoc X.",
        IMAGE: "../../resources/minimised_keyboard_layout.png"
    }
});

const SettingCategories = Object.freeze({
    GENERAL: "General",
    STIMULI: "Stimuli",
    HEADSET: "Headset"
});

const Settings = Object.freeze({
    DEFAULT_URL: {
        NAME: "defaultUrl",
        LABEL: "Home Page",
        DESCRIPTION: "The URL that will be opened when the application starts and a new tab is opened.",
        DEFAULT: "https://www.google.com",
        CATEGORY: SettingCategories.GENERAL,
    },
    DEFAULT_KEYBOARD_LAYOUT: {
        NAME: "keyboardLayout",
        LABEL: "Keyboard Layout",
        DESCRIPTION: "The keyboard layout to be used throughout the browser.",
        DEFAULT: KeyboardLayouts.MINIMISED.NAME,
        CATEGORY: SettingCategories.GENERAL,
    },
    ADAPTIVE_SWITCH_CONNECTED: {
        NAME: "adaptiveSwitchConnected",
        LABEL: "Adaptive Switch Connected",
        DESCRIPTION: "Whether an adaptive switch is currently connected.",
        DEFAULT: true,
        CATEGORY: SettingCategories.GENERAL,
    },
    BEST_USER_FREQUENCIES: {
        NAME: "bestUserFrequencies",
        LABEL: "Best User Frequencies",
        DESCRIPTION: "The best frequencies for the user’s brain activity.",
        DEFAULT: [6.5, 7.5, 8.5, 7, 8],
        CATEGORY: SettingCategories.GENERAL,
    },
    DEFAULT_HEADSET: {
        NAME: "defaultHeadset",
        LABEL: "Headset",
        DESCRIPTION: "The headset that will be used by default when the application starts.",
        DEFAULT: `${Headsets.EPOC_X.NAME} - ${Headsets.EPOC_X.COMPANY}`,
        CATEGORY: SettingCategories.HEADSET,
    },
    DEFAULT_CONNECTION_TYPE: {
        NAME: "defaultConnectionType",
        LABEL: "Connection Type",
        DESCRIPTION: "The connection type that will be used to obtain the data from the default headset.",
        DEFAULT: Headsets.EPOC_X.CONNECTION_TYPE.CONNECTION_TYPE_1,
        CATEGORY: SettingCategories.HEADSET,
    },
    DEFAULT_STIMULI_PATTERN: {
        NAME: "defaultStimuliPattern",
        LABEL: "Default Stimuli Pattern",
        DESCRIPTION: "The default pattern used for SSVEP stimuli.",
        DEFAULT: "line", // CREATE enum for patterns later
        CATEGORY: SettingCategories.STIMULI,
    },
    DEFAULT_STIMULI_LIGHT_COLOR: {
        NAME: "defaultStimuliLightColor",
        LABEL: "Default Stimuli Light Color",
        DESCRIPTION: "The default light color used for SSVEP stimuli.",
        DEFAULT: "255,255,255,1", // CREATE enum for colors later
        CATEGORY: SettingCategories.STIMULI,
    },
    DEFAULT_STIMULI_DARK_COLOR: {
        NAME: "defaultStimuliDarkColor",
        LABEL: "Default Stimuli Dark Color",
        DESCRIPTION: "The default dark color used for SSVEP stimuli.",
        DEFAULT: "127,127,127,1", // CREATE enum for colors later
        CATEGORY: SettingCategories.STIMULI,
    }
});

module.exports = {
    ViewNames,
    CssConstants,
    SwitchShortcut,
    ConnectionTypes,
    Headsets,
    KeyboardLayouts,
    Settings,
    SettingCategories
};