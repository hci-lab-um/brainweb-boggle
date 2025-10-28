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

const Headsets = Object.freeze({
    EPOC_X: {
        NAME: "EPOC X",
        COMPANY: "Emotiv",
        USED_ELECTRODES: ["O1", "P7", "P8", "O2"],
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: "Cortex API"
        },
        IMAGE: "../../resources/epocx_headset.png"
    },
    DSI_VR300: {
        NAME: "DSI-VR300",
        COMPANY: "Wearable Sensing",
        USED_ELECTRODES: ["PO3", "POz", "PO4", "O1", "Oz", "O2"],
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: "LSL",
            CONNECTION_TYPE_2: "TCP/IP",
        },
        IMAGE: "../../resources/dsi_vr300_headset.png"
    },
    G_USBAMP: {
        NAME: "g.USBamp",
        COMPANY: "g.tec",
        USED_ELECTRODES: ["PO7", "PO3", "POz", "PO4", "PO8", "O1", "Oz", "O2"],
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: "LSL"
        },
        IMAGE: "../../resources/gusbamp_headset.png"
    }
});

const SettingCategories = Object.freeze({
    GENERAL: "General",
    STIMULI: "Stimuli"
});

const Settings = Object.freeze({
    DEFAULT_URL: {
        NAME: "defaultUrl",
        LABEL: "Home Page",
        DESCRIPTION: "The URL that will be opened when the application starts and a new tab is opened.",
        DEFAULT: "https://www.google.com",
        CATEGORY: SettingCategories.GENERAL,
    },
    DEFAULT_HEADSET: {
        NAME: "defaultHeadset",
        LABEL: "Headset",
        DESCRIPTION: "The headset that will be used by default when the application starts.",
        DEFAULT: `${Headsets.EPOC_X.NAME} - ${Headsets.EPOC_X.COMPANY}`,
        CATEGORY: SettingCategories.GENERAL,
    },
    DEFAULT_CONNECTION_TYPE: {
        NAME: "defaultConnectionType",
        LABEL: "Connection Type",
        DESCRIPTION: "The connection type that will be used to obtain the data from the default headset.",
        DEFAULT: Headsets.EPOC_X.CONNECTION_TYPE.CONNECTION_TYPE_1,
        CATEGORY: SettingCategories.GENERAL,
    },
    DEFAULT_STIMULI_PATTERN: {
        NAME: "defaultStimuliPattern",
        LABEL: "Default Stimuli Pattern",
        DESCRIPTION: "The default pattern used for SSVEP stimuli.",
        DEFAULT: "line",
        CATEGORY: SettingCategories.STIMULI,
    },
    DEFAULT_STIMULI_LIGHT_COLOR: {
        NAME: "defaultStimuliLightColor",
        LABEL: "Default Stimuli Light Color",
        DESCRIPTION: "The default light color used for SSVEP stimuli.",
        DEFAULT: "255,255,255,1",
        CATEGORY: SettingCategories.STIMULI,
    },
    DEFAULT_STIMULI_DARK_COLOR: {
        NAME: "defaultStimuliDarkColor",
        LABEL: "Default Stimuli Dark Color",
        DESCRIPTION: "The default dark color used for SSVEP stimuli.",
        DEFAULT: "127,127,127,1",
        CATEGORY: SettingCategories.STIMULI,
    }
});

module.exports = {
    ViewNames,
    CssConstants,
    Headsets,
    Settings,
    SettingCategories
};