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
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: "Cortex API"
        }
    },
    DSI_VR300: {
        NAME: "DSI-VR300",
        COMPANY: "Wearable Sensing",
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: "LSL",
            CONNECTION_TYPE_2: "TCP/IP",
        }
    },
    G_TEC: {
        NAME: "g.USBamp",
        COMPANY: "g.tec",
        CONNECTION_TYPE: {
            CONNECTION_TYPE_1: "LSL"
        }
    }
});

module.exports = {
    ViewNames,
    CssConstants,
    Headsets
};