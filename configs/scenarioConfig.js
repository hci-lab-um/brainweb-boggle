const { ViewNames } = require('../src/utils/constants/enums');

const scenarioConfig = {
    // HOME
    scenario_0: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Disabled nav buttons, inactive read mode, hidden scrollbars',
        buttonIds: ['searchBtn', 'readBtn', 'selectBtn', 'moreBtn'],
        frequencies: [6, 14.5, 10.5, 8],
        phases: [1, 0.5, 1.5, 1.5],
    },
    scenario_4: {
        name: ViewNames.MAIN_WINDOW,
        description: 'Disabled nav buttons, active read mode, hidden scrollbars',
        buttonIds: ['readBtn'],
        frequencies: [14.5],
        phases: [0.5],
    },

    // MORE
    scenario_20: {
        name: ViewNames.MORE,
        description: 'More options menu with 10 buttons',
        buttonIds: ['tabsBtn', 'bookmarksBtn', 'refreshBtn', 'zoomInBtn', 'zoomOutBtn', 'zoomResetBtn', 'settingsBtn', 'aboutBtn', 'exitBtn', 'closeMoreBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 9.5, 8, 14, 12, 10],
        phases: [0, 0.5, 1, 0, 1, 0, 1.5, 0, 0.5, 1],
    },

    // KEYBOARD
    scenario_80: {
        name: ViewNames.KEYBOARD,
        description: 'No text in search field',
        buttonIds: ['keyboardCloseBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'dotComBtn', 'spaceBtn', 'keyboardSendBtn'],
        frequencies: [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9],
        phases: [0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0, 0.5],
    },
    scenario_81: {
        name: ViewNames.KEYBOARD,
        description: 'Text in search field, word suggestion available, cursor at end position',
        buttonIds: ['keyboardCloseBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'dotComBtn', 'spaceBtn', 'arrowKeysBtn', 'autoCompleteBtn', 'backspaceBtn', 'keyboardSendBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9, 14.5],
        phases: [0, 0.5, 1, 0, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 0.5],
    },
    scenario_82: {
        name: ViewNames.KEYBOARD,
        description: 'Text in search field, word suggestion unavailable, cursor at start position (autocomplete and backspace buttons disabled)',
        buttonIds: ['keyboardCloseBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'dotComBtn', 'spaceBtn', 'arrowKeysBtn', 'keyboardSendBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11],
        phases: [0, 0.5, 1, 0, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0],
    },
    scenario_83: {
        name: ViewNames.KEYBOARD,
        description: 'Text in search field, word suggestion unavailable, cursor NOT at start position',
        buttonIds: ['keyboardCloseBtn', 'numbersBtn', 'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'upperCaseBtn', 'zxcBtn', 'vbnmBtn', 'enterBtn', 'symbolsBtn', 'dotComBtn', 'spaceBtn', 'arrowKeysBtn', 'backspaceBtn', 'keyboardSendBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 14.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11],
        phases: [0, 0.5, 1, 0, 0.5, 1, 1.5, 1.5, 0, 0.5, 1, 1.5, 0, 0.5, 1, 1.5, 0],
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
        phases: [0, 0.5, 1, 0, 1, 1.5, 1.5],
    },
    scenario_94: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '5 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'fifthKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6, 10.5],
        phases: [0, 0.5, 1, 0, 1, 1.5],
    },
    scenario_95: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '4 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'fourthKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5, 6],
        phases: [0, 0.5, 1, 0, 1],
    },
    scenario_96: {
        name: ViewNames.KEYBOARD_KEYS,
        description: '3 keys, and cancel button',
        buttonIds: ['firstKeyBtn', 'secondKeyBtn', 'thirdKeyBtn', 'cancelBtn'],
        frequencies: [7, 6.5, 8.5, 12.5],
        phases: [0, 0.5, 1, 0],
    },

    stimuliFrequenciesScenarioMapping: [
        // Home screen
        // Scenario 0: disabled nav buttons, inactive read mode, hidden scrollbars
        [6, 14.5, 10.5, 8],

        // Scenario 1: disabled nav buttons, inactive read mode, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 2: disabled nav buttons, inactive read mode, hidden scroll up
        [12.5, 6, 14.5, 10.5, 8],

        // Scenario 3: disabled nav buttons, inactive read mode, hidden scroll down
        [8.5, 6, 14.5, 10.5, 8],

        // Scenario 4: disabled nav buttons, active read mode, hidden scrollbars
        [14.5],

        // Scenario 5: disabled nav buttons, active read mode, visible scrollbars
        [14.5, 8.5, 12.5],

        // Scenario 6: disabled nav buttons, active read mode, hidden scroll up
        [12.5, 14.5],

        // Scenario 7: disabled nav buttons, active read mode, hidden scroll down
        [8.5, 14.5],

        // Scenario 8: enabled nav buttons, inactive read mode, hidden scrollbars
        [7, 6.5, 6, 14.5, 10.5, 8],

        // Scenario 9: enabled nav buttons, inactive read mode, visible scrollbars
        [7, 6.5, 8.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 10: enabled nav buttons, inactive read mode, hidden scroll up
        [7, 6.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 11: enabled nav buttons, inactive read mode, hidden scroll down
        [7, 6.5, 8.5, 6, 14.5, 10.5, 8],

        // Scenario 12: left enabled nav button, inactive read mode, hidden scrollbars
        [7, 6, 14.5, 10.5, 8],

        // Scenario 13: left enabled nav button, inactive read mode, visible scrollbars
        [7, 8.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 14: left enabled nav button, inactive read mode, hidden scroll up
        [7, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 15: left enabled nav button, inactive read mode, hidden scroll down
        [7, 8.5, 6, 14.5, 10.5, 8],

        // Scenario 16: right enabled nav button, inactive read mode, hidden scrollbars
        [6.5, 6, 14.5, 10.5, 8],

        // Scenario 17: right enabled nav button, inactive read mode, visible scrollbars
        [6.5, 8.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 18: right enabled nav button, inactive read mode, hidden scroll up
        [6.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 19: right enabled nav button, inactive read mode, hidden scroll down
        [6.5, 8.5, 6, 14.5, 10.5, 8],

        // Target area selection screen
        // Scenario 20: target area selection
        [8.5, 12.5, 6, 14.5, 10.5, 8, 14],

        // Target element selection screen
        // Scenario 21: target element selection, no selection elements, hidden scrollbars
        [6],

        // Scenario 22: target element selection, no selection elements, visible scrollbars
        [8.5, 12.5, 6],

        // Scenario 23: target element selection, no selection elements, hidden scroll up
        [12.5, 6],

        // Scenario 24: target element selection, no selection elements, hidden scroll down
        [8.5, 6],

        // Scenario 25: target element selection, one selection element, hidden scrollbars
        [6, 14.5],

        // Scenario 26: target element selection, one selection element, visible scrollbars
        [8.5, 12.5, 6, 14.5],

        // Scenario 27: target element selection, one selection element, hidden scroll up
        [12.5, 6, 14.5],

        // Scenario 28: target element selection, one selection element, hidden scroll down
        [8.5, 6, 14.5],

        // Scenario 29: target element selection, one selection element, left arrow active, hidden scrollbars
        [6, 14.5, 8],

        // Scenario 30: target element selection, one selection element, left arrow active, visible scrollbars
        [8.5, 12.5, 6, 14.5, 8],

        // Scenario 31: target element selection, one selection element, left arrow active, hidden scroll up
        [12.5, 6, 14.5, 8],

        // Scenario 32: target element selection, one selection element, left arrow active, hidden scroll down
        [8.5, 6, 14.5, 8],

        // Scenario 33: target element selection, two selection elements, hidden scrollbars
        [6, 14.5, 10.5],

        // Scenario 34: target element selection, two selection elements, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5],

        // Scenario 35: target element selection, two selection elements, hidden scroll up
        [12.5, 6, 14.5, 10.5],

        // Scenario 36: target element selection, two selection elements, hidden scroll down
        [8.5, 6, 14.5, 10.5],

        // Scenario 37: target element selection, two selection elements, left arrow active, hidden scrollbars
        [6, 14.5, 8, 14],

        // Scenario 38: target element selection, two selection elements, left arrow active, visible scrollbars
        [8.5, 12.5, 6, 14.5, 8, 14],

        // Scenario 39: target element selection, two selection elements, left arrow active, hidden scroll up
        [12.5, 6, 14.5, 8, 14],

        // Scenario 40: target element selection, two selection elements, left arrow active, hidden scroll down
        [8.5, 6, 14.5, 8, 14],

        // Scenario 41: target element selection, three selection elements, hidden scrollbars
        [6, 14.5, 10.5, 8],

        // Scenario 42: target element selection, three selection elements, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 8],

        // Scenario 43: target element selection, three selection elements, hidden scroll up
        [12.5, 6, 14.5, 10.5, 8],

        // Scenario 44: target element selection, three selection elements, hidden scroll down
        [8.5, 6, 14.5, 10.5, 8],

        // Scenario 45: target element selection, three selection elements, left arrow active, hidden scrollbars
        [6, 14.5, 8, 14, 12],

        // Scenario 46: target element selection, three selection elements, left arrow active, visible scrollbars
        [8.5, 12.5, 6, 14.5, 8, 14, 12],

        // Scenario 47: target element selection, three selection elements, left arrow active, hidden scroll up
        [12.5, 6, 14.5, 8, 14, 12],

        // Scenario 48: target element selection, three selection elements, left arrow active, hidden scroll down
        [8.5, 6, 14.5, 8, 14, 12],

        // Scenario 49: target element selection, four selection elements, hidden scrollbars
        [6, 14.5, 10.5, 14],

        // Scenario 50: target element selection, four selection elements, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 14],

        // Scenario 51: target element selection, four selection elements, hidden scroll up
        [12.5, 6, 14.5, 10.5, 14],

        // Scenario 52: target element selection, four selection elements, hidden scroll down
        [8.5, 6, 14.5, 10.5, 14],

        // Scenario 53: target element selection, four selection elements, left arrow active, hidden scrollbars
        [6, 14.5, 8, 14, 12, 10],

        // Scenario 54: target element selection, four selection elements, left arrow active, visible scrollbars
        [8.5, 12.5, 6, 14.5, 8, 14, 12, 10],

        // Scenario 55: target element selection, four selection elements, left arrow active, hidden scroll up
        [12.5, 6, 14.5, 8, 14, 12, 10],

        // Scenario 56: target element selection, four selection elements, left arrow active, hidden scroll down
        [8.5, 6, 14.5, 8, 14, 12, 10],

        // Scenario 57: target element selection, five selection elements, hidden scrollbars
        [6, 14.5, 10.5, 8, 14, 12],

        // Scenario 58: target element selection, five selection elements, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 8, 14, 12],

        // Scenario 59: target element selection, five selection elements, hidden scroll up
        [12.5, 6, 14.5, 10.5, 8, 14, 12],

        // Scenario 60: target element selection, five selection elements, hidden scroll down
        [8.5, 6, 14.5, 10.5, 8, 14, 12],

        // Scenario 61: target element selection, five selection elements, right arrow active, hidden scrollbars
        [6, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 62: target element selection, five selection elements, right arrow active, visible scrollbars
        [8.5, 6, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 63: target element selection, five selection elements, right arrow active, hidden scroll up
        [12.5, 6, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 64: target element selection, five selection elements, right arrow active, hidden scroll down
        [8.5, 6, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 65: target element selection, five selection elements, both arrows active, hidden scrollbars
        [6, 14.5, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 66: target element selection, five selection elements, both arrows active, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 67: target element selection, five selection elements, both arrows active, hidden scroll up
        [12.5, 6, 14.5, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 68: target element selection, five selection elements, both arrows active, hidden scroll down
        [8.5, 6, 14.5, 10.5, 8, 14, 12, 10, 7.5],

        // Scenario 69: target element selection, five selection elements, left arrow active, hidden scrollbars
        [6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 70: target element selection, five selection elements, left arrow active, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 71: target element selection, five selection elements, left arrow active, hidden scroll up
        [12.5, 6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 72: target element selection, five selection elements, left arrow active, hidden scroll down
        [8.5, 6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 73: target element selection, six selection elements, hidden scrollbars
        [6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 74: target element selection, six selection elements, visible scrollbars
        [8.5, 12.5, 6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 75: target element selection, six selection elements, hidden scroll up
        [12.5, 6, 14.5, 10.5, 8, 14, 12, 10],

        // Scenario 76: target element selection, six selection elements, hidden scroll down
        [8.5, 6, 14.5, 10.5, 8, 14, 12, 10],

        // Browsing screen
        // Scenario 77: search button active
        [7, 6.5, 8.5],

        // Scenario 78: search button inactive
        [7, 8.5],

        // Keyboard screen
        // Scenario 79: no text in search field
        [7, 6.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9],

        // Scenario 80: text in search field, word suggestion available, cursor at end position
        [7, 6.5, 8.5, 12.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9],

        // Scenario 81: text in search field, word suggestion unavailable, cursor at start position
        [7, 6.5, 8.5, 12.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9],

        // Scenario 82: text in search field, word suggestion unavailable, cursor NOT at start position
        [7, 6.5, 8.5, 12.5, 14.5, 6, 10.5, 8, 14, 12, 10, 7.5, 9.5, 11.5, 13.5, 13, 11, 9],

        // Scenario 83: 10 keys, and cancel button
        [7, 6.5, 8.5, 12.5, 6, 10.5, 8, 14, 12, 10],

        // Scenario 84: 5 keys, and cancel button
        [7, 6.5, 8.5, 12.5, 6, 10.5],

        // Scenario 85: 3 keys, and cancel button
        [7, 6.5, 8.5, 12.5],

        // Scenario 86: 2 keys, and cancel button
        [7, 6.5, 8.5],

        // More screen
        // Scenario 87: more options menu, excluding the history button
        [7, 6.5, 8.5, 12.5, 6, 9.5],

        // Bookmarks options screen
        // Scenario 88: bookmarks options menu
        [7, 6.5, 8.5],

        // Bookmarks list screen
        // Scenario 89: no bookmarks available
        [8.5],

        // Scenario 90: one bookmark, delete all button active, no arrows active
        [7, 8.5, 6, 10.5],

        // Scenario 91: two bookmarks, delete all button active, no arrows active
        [7, 8.5, 6, 10.5, 14.5],

        // Scenario 92: three bookmarks, delete all button active, no arrows active
        [7, 8.5, 6, 10.5, 14.5, 10.5],

        // Scenario 93: four bookmarks, delete all button active, no arrows active
        [7, 8.5, 6, 10.5, 14.5, 10.5, 8],

        // Scenario 94: five bookmarks, delete all button active, no arrows active
        [7, 8.5, 6, 10.5, 14.5, 10.5, 8, 14],

        // Scenario 95: six bookmarks, delete all button active, no arrows active
        [7, 8.5, 6, 10.5, 14.5, 10.5, 8, 14, 12],

        // Scenario 96: six bookmarks, delete all button active, right arrow active
        [7, 8.5, 12.5, 6, 10.5, 14.5, 10.5, 8, 14],

        // Scenario 97: one bookmark, delete all button active, left arrow active
        [7, 6.5, 8.5, 6, 10.5],

        // Scenario 98: two bookmarks, delete all button active, left arrow active
        [7, 6.5, 8.5, 6, 10.5, 14.5],

        // Scenario 99: three bookmarks, delete all button active, left arrow active
        [7, 6.5, 8.5, 6, 10.5, 14.5, 10.5],

        // Scenario 100: four bookmarks, delete all button active, left arrow active
        [7, 6.5, 8.5, 6, 10.5, 14.5, 10.5, 8],

        // Scenario 101: five bookmarks, delete all button active, left arrow active
        [7, 6.5, 8.5, 6, 10.5, 14.5, 10.5, 8, 14],

        // Scenario 102: six bookmarks, delete all button active, left arrow active
        [7, 6.5, 8.5, 6, 10.5, 14.5, 10.5, 8, 14, 12],

        // Scenario 103: six bookmarks, delete all button active, both arrows active
        [7, 6.5, 8.5, 6, 10.5, 14.5, 10.5, 8, 14, 12, 9],

        // Bookmark preview modal
        // Scenario 104:
        [7, 6.5, 8.5],

        // Delete all bookmarks modal
        // Scenario 105:
        [7, 6.5]
    ],
}

module.exports = { scenarioConfig };