const { ViewNames } = require('../src/utils/constants/enums');

const scenarioConfig = {
    // HOME
    scenario_0: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Disabled nav buttons, inactive read mode, hidden scrollbars',
        buttonIds: ['searchBtn', 'readBtn', 'selectBtn', 'moreBtn', 'seekBtn'],
        frequencies: [6, 14.5, 10.5, 8, 7],
        phases: [1, 0.5, 1.5, 1.5, 0]
    },

    scenario_1: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Active back button, inactive read mode, hidden scrollbars',
        buttonIds: ['searchBtn', 'readBtn', 'selectBtn', 'moreBtn', 'seekBtn', 'backBtn'],
        frequencies: [6, 14.5, 10.5, 8, 7, 12.5],
        phases: [1, 0.5, 1.5, 1.5, 0, 0]
    },

    scenario_2: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Active forward button, inactive read mode, hidden scrollbars',
        buttonIds: ['searchBtn', 'readBtn', 'selectBtn', 'moreBtn', 'seekBtn', 'forwardBtn'],
        frequencies: [6, 14.5, 10.5, 8, 7, 9.5],
        phases: [1, 0.5, 1.5, 1.5, 0, 0]
    },

    scenario_3: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Active forward and back buttons, inactive read mode, hidden scrollbars',
        buttonIds: ['searchBtn', 'readBtn', 'selectBtn', 'moreBtn', 'seekBtn', 'forwardBtn', 'backBtn'],
        frequencies: [6, 14.5, 10.5, 8, 7, 9.5, 12.5],
        phases: [1, 0.5, 1.5, 1.5, 0, 0, 0]
    },

    scenario_4: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Disabled nav buttons, active read mode, hidden scrollbars',
        buttonIds: ['readBtn'],
        frequencies: [14.5],
        phases: [0.5]
    },


    // SEEK
    scenario_10: {
        name: ViewNames.SEEK,
        description: 'Find in Page overlay with only the close button',
        buttonIds: ['closeSeekBtn'],
        frequencies: [8],
        phases: [1.5]
    },
    
    scenario_11: {
        name: ViewNames.SEEK,
        description: 'Seek overlay with scroll buttons, find button, select scrollable element button, close button and read button',
        buttonIds: ['scrollUpBtn', 'scrollDownBtn', 'selectScrollableElementBtn', 'findBtn', 'closeSeekBtn', 'readBtn'],
        frequencies: [6, 14.5, 9.5, 10.5, 8, 12],
        phases: [1, 0.5, 0, 1.5, 1.5, 0.5]
    },

    scenario_12: {
        name: ViewNames.SEEK,
        description: 'Seek overlay with find button, close button and read button',
        buttonIds: ['findBtn', 'closeSeekBtn', 'readBtn'],
        frequencies: [10.5, 8, 12],
        phases: [1.5, 1.5, 0.5]
    },

    scenario_13: {
        name: ViewNames.SEEK,
        description: 'Find in page with scroll buttons, and close button',
        buttonIds: ['scrollUpBtn', 'scrollDownBtn', 'closeSeekBtn'],
        frequencies: [6, 14.5, 8],
        phases: [1, 0.5, 1.5]
    },

    scenario_14: {
        name: ViewNames.SEEK,
        description: 'Select scrollable element with 1 button and close button',
        buttonIds: ['firstScrollableElementBtn', 'closeSeekBtn'],
        frequencies: [6, 8],
        phases: [1, 1.5]
    },

    scenario_15: {
        name: ViewNames.SEEK,
        description: 'Select scrollable element with 2 buttons and close button',
        buttonIds: ['firstScrollableElementBtn', 'secondScrollableElementBtn', 'closeSeekBtn'],
        frequencies: [6, 14.5, 8],
        phases: [1, 0.5, 1.5]
    },

    scenario_16: {
        name: ViewNames.SEEK,
        description: 'Select scrollable element with 3 buttons and close button',
        buttonIds: ['firstScrollableElementBtn', 'secondScrollableElementBtn', 'thirdScrollableElementBtn', 'closeSeekBtn'],
        frequencies: [6, 14.5, 12.5, 8],
        phases: [1, 0.5, 0, 1.5]
    },

    scenario_17: {
        name: ViewNames.SEEK,
        description: 'Select scrollable element with 4 buttons and close button',
        buttonIds: ['firstScrollableElementBtn', 'secondScrollableElementBtn', 'thirdScrollableElementBtn', 'fourthScrollableElementBtn', 'closeSeekBtn'],
        frequencies: [6, 14.5, 12.5, 10.5, 8],
        phases: [1, 0.5, 0, 1.5, 1.5]
    },

    scenario_18: {
        name: ViewNames.SEEK,
        description: 'Select scrollable element with 5 buttons and close button',
        buttonIds: ['firstScrollableElementBtn', 'secondScrollableElementBtn', 'thirdScrollableElementBtn', 'fourthScrollableElementBtn', 'fifthScrollableElementBtn', 'closeSeekBtn'],
        frequencies: [6, 14.5, 12.5, 10.5, 7, 8],
        phases: [1, 0.5, 0, 1.5, 0, 1.5]
    },

    scenario_19: {
        name: ViewNames.SEEK,
        description: 'Select scrollable element with 6 buttons and close button',
        buttonIds: ['firstScrollableElementBtn', 'secondScrollableElementBtn', 'thirdScrollableElementBtn', 'fourthScrollableElementBtn', 'fifthScrollableElementBtn', 'sixthScrollableElementBtn', 'closeSeekBtn'],
        frequencies: [6, 14.5, 12.5, 10.5, 7, 12, 8],
        phases: [1, 0.5, 0, 1.5, 0, 0.5, 1.5]
    },


    // MORE
    scenario_20: {
        name: ViewNames.MORE,
        description: 'More options menu with 10 buttons',
        buttonIds: ['tabsBtn', 'bookmarksBtn', 'refreshBtn', 'zoomInBtn', 'zoomOutBtn', 'zoomResetBtn', 'settingsBtn', 'aboutBtn', 'exitBtn', 'closeMoreBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 9.5, 8, 14, 12, 10],
        phases: [0, 0.5, 1, 0, 1, 0, 1.5, 0, 0.5, 1]
    },


    // MORE - BOOKMARKS / TABS
    scenario_21: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'No bookmarks/tabs, add bookmark/tab and cancel button',
        buttonIds: ['addBtn', 'cancelBtn'],
        frequencies: [12.5, 7],
        phases: [0, 0]
    },

    scenario_22: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'One bookmark/tab, delete all, add bookmark/tab and cancel buttons',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn'],
        frequencies: [6, 14.5, 10.5, 8],
        phases: [1, 0.5, 1.5, 1.5]
    },

    scenario_23: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Two bookmarks/tabs, delete all, add bookmark/tab and cancel buttons',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5],
        phases: [1, 0.5, 1.5, 1.5, 0]
    },

    scenario_24: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Three bookmarks/tabs, delete all, add bookmark/tab and cancel buttons',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn', 'thirdItemBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5, 9],
        phases: [1, 0.5, 1.5, 1.5, 0, 0.5]
    },

    scenario_25: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Four bookmarks/tabs, delete all, add bookmark/tab and cancel buttons',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn', 'thirdItemBtn', 'fourthItemBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5, 9, 7.5],
        phases: [1, 0.5, 1.5, 1.5, 0, 0.5, 1.5]
    },

    scenario_26: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'One bookmark/tab, delete all, add bookmark/tab, cancel buttons and one active arrow',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'firstArrowKeyBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5],
        phases: [1, 0.5, 1.5, 1.5, 0]
    },

    scenario_27: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Two bookmarks/tabs, delete all, add bookmark/tab, cancel buttons and one active arrow',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn', 'firstArrowKeyBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5, 9],
        phases: [1, 0.5, 1.5, 1.5, 0, 0.5]
    },

    scenario_28: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Three bookmarks/tabs, delete all, add bookmark/tab, cancel buttons and one active arrow',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn', 'thirdItemBtn', 'firstArrowKeyBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5, 9, 7.5],
        phases: [1, 0.5, 1.5, 1.5, 0, 0.5, 1.5]
    },

    scenario_29: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Four bookmarks/tabs, delete all, add bookmark/tab, cancel buttons and one active arrow',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn', 'thirdItemBtn', 'fourthItemBtn', 'firstArrowKeyBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5, 9, 7.5, 11],
        phases: [1, 0.5, 1.5, 1.5, 0, 0.5, 1.5, 0]
    },

    scenario_30: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Four bookmarks/tabs, delete all, add bookmark/tab, cancel buttons and two active arrows',
        buttonIds: ['addBtn', 'cancelBtn', 'deleteAllBtn', 'firstItemBtn', 'secondItemBtn', 'thirdItemBtn', 'fourthItemBtn', 'firstArrowKeyBtn', 'secondArrowKeyBtn'],
        frequencies: [6, 14.5, 10.5, 8, 12.5, 9, 7.5, 11, 9.5],
        phases: [1, 0.5, 1.5, 1.5, 0, 0.5, 1.5, 0, 0]
    },

    scenario_31: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'Delete all bookmarks/tabs overlay, confirm and cancel button',
        buttonIds: ['confirmDeleteBtn', 'cancelDeleteBtn'],
        frequencies: [12.5, 7],
        phases: [0, 0]
    },

    scenario_32: {
        name: `${ViewNames.BOOKMARKS} or ${ViewNames.TABS}`,
        description: 'bookmark/tab overlay, visit, delete and cancel button',
        buttonIds: ['visitItemBtn', 'deleteItemBtn', 'cancelItemBtn'],
        frequencies: [6, 14.5, 10.5],
        phases: [1, 0.5, 1.5]
    },


    // SELECT
    scenario_40: {
        name: ViewNames.SELECT,
        description: '1 button in sidebar, with CLOSE/BACK button & toggle',
        buttonIds: ['firstBtn', 'closeSelectBtn', 'toggleNumbersBtn'],
        frequencies: [6, 14.5, 10.5],
        phases: [1, 0.5, 1.5]
    },

    scenario_41: {
        name: ViewNames.SELECT,
        description: '2 buttons in sidebar, with CLOSE/BACK button & toggle',
        buttonIds: ['firstBtn', 'secondBtn', 'closeSelectBtn', 'toggleNumbersBtn'],
        frequencies: [6, 8, 14.5, 10.5], // Frequencies of the firstElementBtn, closeSelectBtn and toggleNumbersBtn remained the same
        phases: [1, 1.5, 0.5, 1.5]
    },

    scenario_42: {
        name: ViewNames.SELECT,
        description: '3 buttons in sidebar, with CLOSE/BACK button & toggle',
        buttonIds: ['firstBtn', 'secondBtn', 'thirdBtn', 'closeSelectBtn', 'toggleNumbersBtn'],
        frequencies: [6, 8, 9, 14.5, 10.5],
        phases: [1, 1.5, 0.5, 0.5, 1.5]
    },

    scenario_43: {
        name: ViewNames.SELECT,
        description: '4 buttons in sidebar, with CLOSE/BACK button & toggle',
        buttonIds: ['firstBtn', 'secondBtn', 'thirdBtn', 'fourthBtn', 'closeSelectBtn', 'toggleNumbersBtn'],
        frequencies: [6, 8, 9, 7.5, 14.5, 10.5],
        phases: [1, 1.5, 0.5, 1.5, 0.5, 1.5]
    },

    scenario_44: {
        name: ViewNames.SELECT,
        description: '5 buttons in sidebar, with CLOSE/BACK button & toggle',
        buttonIds: ['firstBtn', 'secondBtn', 'thirdBtn', 'fourthBtn', 'fifthBtn', 'closeSelectBtn', 'toggleNumbersBtn'],
        frequencies: [6, 8, 9, 7.5, 13, 14.5, 10.5],
        phases: [1, 1.5, 0.5, 1.5, 1.5, 0.5, 1.5]
    },

    scenario_45: {
        name: ViewNames.SELECT,
        description: '6 buttons in sidebar, with CLOSE/BACK button & toggle',
        buttonIds: ['firstBtn', 'secondBtn', 'thirdBtn', 'fourthBtn', 'fifthBtn', 'sixthBtn', 'closeSelectBtn', 'toggleNumbersBtn'],
        frequencies: [6, 8, 9, 7.5, 13, 11.5, 14.5, 10.5],
        phases: [1, 1.5, 0.5, 1.5, 1.5, 0.5, 0.5, 1.5]
    },

    scenario_46: {
        name: ViewNames.SELECT,
        description: '4 sections with CLOSE/BACK button', // SECTIONS: A, B, C, D
        buttonIds: ['firstBtn', 'secondBtn', 'thirdBtn', 'fourthBtn', 'closeSelectBtn'],
        frequencies: [6, 8, 9, 7.5, 14.5],
        phases: [1, 1.5, 0.5, 1.5, 0.5]
    },

    scenario_47: {
        name: ViewNames.SELECT,
        description: '6 sections with CLOSE/BACK button', // SECTIONS: A, B, C, D, E, F
        buttonIds: ['firstBtn', 'secondBtn', 'thirdBtn', 'fourthBtn', 'fifthBtn', 'sixthBtn', 'closeSelectBtn'],
        frequencies: [6, 8, 9, 7.5, 13, 11.5, 14.5],
        phases: [1, 1.5, 0.5, 1.5, 1.5, 0.5, 0.5]
    },

    scenario_48: {
        name: ViewNames.SELECT,
        description: 'NO buttons in sidebar, only CLOSE/BACK button',
        buttonIds: ['closeSelectBtn'],
        frequencies: [14.5],
        phases: [0.5]
    },


    // KEYBOARD
    scenario_80: {
        name: ViewNames.KEYBOARD,
        description: 'No text in search field',
        buttonIds: ['closeKeyboardBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'spaceBtn', 'keyboardSendBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0]
    },
    scenario_81: {
        name: ViewNames.KEYBOARD,
        description: 'Text in search field, word suggestion available, cursor at end position',
        buttonIds: ['closeKeyboardBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'spaceBtn', 'keyboardSendBtn', 'clearAllBtn', 'arrowKeysBtn', 'backspaceBtn', 'autoCompleteBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9, 8.5, 12.5, 14.5],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 0, 0.5]
    },
    scenario_82: {
        name: ViewNames.KEYBOARD,
        description: 'Text in search field, word suggestion unavailable, cursor at start position (autocomplete and backspace buttons disabled)',
        buttonIds: ['closeKeyboardBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'spaceBtn', 'keyboardSendBtn', 'clearAllBtn', 'arrowKeysBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9, 8.5],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1]
    },
    scenario_83: {
        name: ViewNames.KEYBOARD,
        description: 'Text in search field, word suggestion unavailable, cursor NOT at start position',
        buttonIds: ['closeKeyboardBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'spaceBtn', 'keyboardSendBtn', 'clearAllBtn', 'arrowKeysBtn', 'backspaceBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9, 8.5, 12.5],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 0]
    },


    // KEYBOARD KEYS
    scenario_90: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '8 keys, 1 arrow button and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'fifthKeyBtn', 'sixthKeyBtn', 'seventhKeyBtn', 'eighthKeyBtn', 'cancelBtn', 'firstArrowKeyBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0]
    },
    scenario_91: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '8 keys, 2 arrow button and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'fifthKeyBtn', 'sixthKeyBtn', 'seventhKeyBtn', 'eighthKeyBtn', 'cancelBtn', 'firstArrowKeyBtn', 'secondArrowKeyBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5]
    },
    scenario_92: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '10 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'fifthKeyBtn', 'sixthKeyBtn', 'seventhKeyBtn', 'eighthKeyBtn', 'ninthKeyBtn', 'tenthKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 10.5, 8, 14, 12, 10, 7.5],
        phases: [0, 0.5, 1, 0, 1, 1.5, 1.5, 0, 0.5, 1, 1.5]
    },
    scenario_93: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '6 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'fifthKeyBtn', 'sixthKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 10.5, 8],
        phases: [0, 0.5, 1, 0, 1, 1.5, 1.5]
    },
    scenario_94: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '5 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'fifthKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 10.5],
        phases: [0, 0.5, 1, 0, 1, 1.5]
    },
    scenario_95: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '4 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6],
        phases: [0, 0.5, 1, 0, 1]
    },
    scenario_96: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '3 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5],
        phases: [0, 0.5, 1, 0]
    },
}

module.exports = { scenarioConfig };