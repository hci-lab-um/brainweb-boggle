const { ipcRenderer } = require('electron');
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon, getCenterCoordinates } = require('../utils/utilityFunctions');
const logger = require('../main/modules/logger');

// Prefix used for generating button IDs
const idPrefix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

let buttons = [];
let regions = [];
let webpageBounds = null;
let zoomFactor;
let sidebar;
let navbar;
let webpage;
let elementsInTabView = [];                 // These are all the interactive elements visible in the current tab
let currentElements = [];                   // These are a subset of the interactive elements. They pertain to the selected region/group
let previousElementsStack = [];             // This contains a history of current elements. It is used when pressing the BACK button
let startIndex;                             // This is used when clicking the 'Toggle Numbers Visibility' button. It is updated in the renderNumericalButtonsInSidebar function
let isRegionSplitView = false;              // This is used to determine if the current view is split into regions or not
let selectedSpecialElementBoggleId = null;  // This is used to store the boggleId of the video/audio element that is currently selected

ipcRenderer.on('select-loaded', async (event, overlayData) => {
    try {
        ({ webpageBounds, zoomFactor } = overlayData);
        sidebar = document.getElementById('sidebar-buttons');
        navbar = document.getElementById('navbar');
        webpage = document.getElementById('webpage');

        webpageBounds = webpage.getBoundingClientRect();
        await initSelectOverlay(); // Begin initialisation
    } catch (error) {
        logger.error('Error in select-loaded handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

window.addEventListener('resize', async () => {
    await reInitialiseSelectOverlay();
});

async function initSelectOverlay() {
    elementsInTabView = await ipcRenderer.invoke('interactiveElements-get'); // Fetching interactive elements from the tabView
    currentElements = elementsInTabView;

    // Choose layout strategy based on number of elements
    if (elementsInTabView.length <= 36) {
        isRegionSplitView = false; // Not in region split view
        await renderNumericalButtonsInSidebar(currentElements);
    } else {
        isRegionSplitView = true; // In region split view
        await splitIntoRegions();
    }
}

// Adds numerical labels and highlights each element on the webpage
function addLabelsAndHighlightToElements(elements, startIdx) {
    try {
        ipcRenderer.send('interactiveElements-addHighlight', elements);

        elements.forEach(async (element, idx) => {
            const label = document.createElement('span');
            label.classList.add('element-number');
            label.textContent = startIdx + idx + 1;

            // ADDING A LABEL NUMBER ATTRIBUTE TO THE OBJECT IN THE CURRENT ELEMENTS ARRAY
            // The label number differs from the id because:
            // - The id is given to all the elements in the tabView 
            // - The label is given only to the elements in the selected region
            // This label number matches the text content of the button in the sidebar
            currentElements[idx].labelNumber = startIdx + idx + 1;

            webpageBounds = await webpage.getBoundingClientRect();
            let left = (element.x * zoomFactor) + webpageBounds.x;
            let top = (element.y * zoomFactor) + webpageBounds.y;

            // Placing label position at the edges of the visible bounds
            left = Math.max(webpageBounds.x, Math.min(left, webpageBounds.x + webpageBounds.width - label.offsetWidth));
            top = Math.max(webpageBounds.y, Math.min(top, webpageBounds.y + webpageBounds.height - label.offsetHeight));

            label.style.left = `${left}px`;
            label.style.top = `${top}px`;

            webpage.appendChild(label);
        });
    } catch (error) {
        logger.error('Error in addLabelsAndHighlightToElements:', error);
    }
}

// Removes element labels and highlights
function removeLabelsAndHighlightFromElements(elements) {
    try {
        ipcRenderer.send('interactiveElements-removeHighlight');

        const labels = webpage.querySelectorAll('.element-number');
        if (labels) labels.forEach(async label => await label.remove());
    } catch (error) {
        logger.error('Error in interactiveElements-removeHighlight handler:', error);
    }
}

// Divides the webpage into 4 or 6 regions based on density of interactive elements
async function splitIntoRegions() {
    webpageBounds = await webpage.getBoundingClientRect();

    let splitIntoSix = false;
    let rows = 1, cols = 1;

    // Initial layout: 4 regions
    ({ regions, rows, cols } = calculateRegionLayout(4));

    for (let idx = 0; idx < regions.length; idx++) {
        const region = regions[idx];
        const elementsInQuadrant = await getInteractiveElementsInRegion(elementsInTabView, region);
        if (elementsInQuadrant.length > 36) {
            // If a quadrant is still too dense, split into 6 smaller regions
            ({ regions, rows, cols } = calculateRegionLayout(6));

            splitIntoSix = true;
            break;
        }
    }

    displayGrid(rows, cols); // Draw grid layout on page
    await renderLetterButtonsInSidebar(regions.length); // A, B, C... buttons

    // Updating the scenario according to whether the screen is split into 4 or 6 regions
    buttons = document.querySelectorAll('button');
    if (splitIntoSix) await updateScenarioId(47, buttons, ViewNames.SELECT);
    else await updateScenarioId(46, buttons, ViewNames.SELECT);
}

// Computes region layout (grid dimensions and bounding boxes)
function calculateRegionLayout(numRegions) {
    // Finds the grid size (rows x cols) as close to square as possible
    let rows = Math.floor(Math.sqrt(numRegions));
    let cols = Math.ceil(numRegions / rows);
    while (rows * cols < numRegions) rows++;

    const regionWidth = Math.floor(webpageBounds.width / cols);
    const regionHeight = Math.floor(webpageBounds.height / rows);
    const regions = [];

    let count = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (count >= numRegions) break;
            regions.push({
                x: col * regionWidth,
                y: row * regionHeight,
                width: regionWidth,
                height: regionHeight
            });
            count++;
        }
    }
    return { regions, rows, cols };
}

// Filters elements that fall within a specified region
async function getInteractiveElementsInRegion(elements, region) {
    return elements.filter(element =>
        element.x >= region.x &&
        element.x <= region.x + region.width &&
        element.y >= region.y &&
        element.y <= region.y + region.height
    );
}

// Draws a visible grid on the webpage and labels each region with A, B, C...
function displayGrid(rows, cols) {
    const gridContainer = document.getElementById('webpage');
    gridContainer.classList.add('grid__container');
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    // Adds a child div to the grid for each region
    regions.forEach(region => {
        const regionDiv = document.createElement('div');
        regionDiv.classList.add('grid__region');

        const labelDiv = document.createElement('div');
        labelDiv.classList.add('grid__label');
        labelDiv.textContent = String.fromCharCode(65 + regions.indexOf(region)); // A, B, C...

        regionDiv.appendChild(labelDiv);
        gridContainer.appendChild(regionDiv);
    });
}

// Renders number buttons in sidebar; groups elements into sets of 6 if required
async function renderNumericalButtonsInSidebar(elements, startIdx = 0, endIdx = elements.length) {
    sidebar.innerHTML = '';
    navbar.innerHTML = '';
    startIndex = startIdx;

    // Show message if there are no options
    if (!elements || elements.length === 0) {
        sidebar.textContent = 'No options available';
    }

    removeLabelsAndHighlightFromElements(elements);
    addLabelsAndHighlightToElements(elements, startIdx);

    if (elements.length > 6) {
        // Group elements into labeled ranges (like 1–6, 7–12, ... etc.)
        const groups = [];
        for (let i = 0; i < elements.length; i += 6) {
            groups.push(elements.slice(i, i + 6));
        }

        groups.forEach((group, groupIdx) => {
            const button = document.createElement('button');
            button.setAttribute('id', `${idPrefix[groupIdx]}Btn`);
            button.classList.add('button');
            button.classList.add('isGroupButton');

            const start = groupIdx * 6 + 1;
            const end = start + group.length - 1;
            button.textContent = `${start} – ${end}`;

            sidebar.appendChild(button);
        });
    } else {
        // One button per element (1, 2, 3, ...)
        for (let idx = startIdx; idx < endIdx; idx++) {
            const button = document.createElement('button');
            button.setAttribute('id', `${idPrefix[idx - startIdx]}Btn`);
            button.classList.add('button');
            button.classList.add('isElementButton');
            button.textContent = (idx + 1).toString();
            sidebar.appendChild(button);
        }
    }

    // Add toggle to hide/show element numbers
    const toggleNumbersContainer = document.createElement('div');
    toggleNumbersContainer.classList.add('toggle-numbers-container');

    const toggleNumbersButton = document.createElement('button');
    toggleNumbersButton.classList.add('button', 'button--toggle');
    toggleNumbersButton.setAttribute('id', 'toggleNumbersBtn');
    toggleNumbersButton.innerHTML = createMaterialIcon('sm', 'toggle_on');

    const toggleSpan = document.createElement('span');
    toggleSpan.textContent = 'Toggle Numbers Visibility';

    toggleNumbersButton.insertBefore(toggleSpan, toggleNumbersButton.firstChild);
    toggleNumbersContainer.appendChild(toggleNumbersButton);
    navbar.appendChild(toggleNumbersContainer);

    // Assign scenario ID depending on number of group buttons
    buttons = document.querySelectorAll('button');
    switch (buttons.length) {
        case 3: await updateScenarioId(40, buttons, ViewNames.SELECT); break;
        case 4: await updateScenarioId(41, buttons, ViewNames.SELECT); break;
        case 5: await updateScenarioId(42, buttons, ViewNames.SELECT); break;
        case 6: await updateScenarioId(43, buttons, ViewNames.SELECT); break;
        case 7: await updateScenarioId(44, buttons, ViewNames.SELECT); break;
        case 8: await updateScenarioId(45, buttons, ViewNames.SELECT); break;
        default: await updateScenarioId(48, buttons, ViewNames.SELECT); break;
    }

    // Track current state for possible navigation back
    previousElementsStack.push(elements);
    const closeSelectBtnIcon = document.getElementById('closeSelectBtn').querySelector('i');
    closeSelectBtnIcon.innerText = previousElementsStack.length > 1 ? 'arrow_back' : 'close';

    attachEventListeners();
}

// Renders lettered buttons (A–F) for region selection
async function renderLetterButtonsInSidebar(numButtons) {
    sidebar.innerHTML = '';
    for (let idx = 0; idx < numButtons; idx++) {
        const button = document.createElement('button');
        button.setAttribute('id', `${idPrefix[idx]}Btn`);
        button.classList.add('button');
        button.classList.add('isRegionButton'); // Identifier for event listener
        button.textContent = String.fromCharCode(65 + idx); // A, B, C...
        await sidebar.appendChild(button);
    }

    previousElementsStack.push(currentElements);
    const closeSelectBtnIcon = document.getElementById('closeSelectBtn').querySelector('i');
    closeSelectBtnIcon.innerText = previousElementsStack.length > 1 ? 'arrow_back' : 'close';

    attachEventListeners();
};

async function reInitialiseSelectOverlay() {
    // Only re-initialize if in region split view
    if (isRegionSplitView) {
        // Remove any existing grid overlays
        const gridContainer = document.getElementById('webpage');
        if (gridContainer) gridContainer.innerHTML = '';
        await initSelectOverlay();
    }
    else {
        previousElementsStack = [];
        removeLabelsAndHighlightFromElements(currentElements);
        await initSelectOverlay(); // Re-initialise the overlay with the current elements
    }
}

async function initSpecialInteractiveElements(elementType) {
    try {
        sidebar.innerHTML = '';
        navbar.innerHTML = '';

        const navbarTitle = document.createElement('div');
        navbarTitle.classList.add('navbar-title');
        navbar.appendChild(navbarTitle);
        navbar.classList.add('navbar--opaque');

        previousElementsStack.length = 0;
        const closeSelectBtnIcon = document.getElementById('closeSelectBtn').querySelector('i');
        closeSelectBtnIcon.innerText = previousElementsStack.length > 1 ? 'arrow_back' : 'close';

        if (elementType === 'video' || elementType === 'audio') {
            if (elementType === 'video') navbarTitle.innerHTML = `Video`;
            else navbarTitle.innerHTML = `Audio`;

            const buttonLabels = ['Pause/Play', 'Mute/Unmute', '10 secs', '10 secs'];
            const buttonIcons = ['play_pause', 'no_sound', 'fast_forward', 'fast_rewind'];

            for (let idx = 0; idx < 4; idx++) {
                const button = document.createElement('button');
                button.setAttribute('id', `${idPrefix[idx]}Btn`);
                button.classList.add('button');
                button.classList.add('isVideoAudioButton');
                button.innerHTML = `${buttonLabels[idx]} ${createMaterialIcon('sm', buttonIcons[idx])}`;
                sidebar.appendChild(button);
            }

            await updateScenarioId(43, buttons, ViewNames.SELECT);
        } else if (elementType === 'range') {
            navbarTitle.innerHTML = `Range`;

            // Creating range buttons based on the range object of the selected element
            const rangeElement = currentElements.find(element => element.boggleId === selectedSpecialElementBoggleId);
            if (!rangeElement) {
                logger.error('Range element not found:', selectedSpecialElementBoggleId);
                return;
            }

            let { min, max, step } = rangeElement.rangeObject;
            // Setting default values if not provided
            min = (typeof min === 'number') ? min : 0;
            max = (typeof max === 'number') ? max : 100;
            step = (typeof step === 'number') ? step : 1;

            // Helper to snap a value to the nearest valid step
            function snapToStep(val) {
                const steps = Math.round((val - min) / step);
                return min + steps * step;
            }

            // Calculate the 5 button values: min, 1/4, 1/2, 3/4, max
            const positions = [0, 0.25, 0.5, 0.75, 1];
            const values = positions.map(p => {
                const raw = min + p * (max - min);
                let snapped = snapToStep(raw);
                // Clamp to min/max
                if (snapped < min) snapped = min;
                if (snapped > max) snapped = max;
                return snapped;
            });

            // Ensure uniqueness and strictly increasing order (in case of coarse step)
            for (let i = 1; i < values.length; i++) {
                if (values[i] <= values[i - 1]) values[i] = values[i - 1] + step;
                if (values[i] > max) values[i] = max;
            }

            for (let idx = 0; idx < 5; idx++) {
                const button = document.createElement('button');
                button.setAttribute('id', `${idPrefix[idx]}Btn`);
                button.classList.add('button');
                button.classList.add('isRangeButton');
                button.textContent = `${values[idx]}`;
                sidebar.appendChild(button);
            }

            await updateScenarioId(44, buttons, ViewNames.SELECT);
        }
    } catch (error) {
        logger.error('Error in initSpecialInteractiveElements:', error);
    }
}

function attachEventListeners() {
    const overlay = document.getElementById('selectOverlay')
    if (!overlay) return;

    // Avoids attaching multiple listeners
    if (overlay.dataset.listenerAttached === 'true') return;
    overlay.dataset.listenerAttached = 'true';

    overlay.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        // Disable the button immediately to prevent multiple clicks
        button.disabled = true;
        setTimeout(() => { button.disabled = false; }, 1500);

        addButtonSelectionAnimation(button);
        const buttonId = button.getAttribute('id');
        const buttonText = button.textContent.trim();

        setTimeout(async () => {
            // Handle the 'Toggle Numbers Visibility' button
            if (buttonId === 'toggleNumbersBtn') {
                const buttonIcon = button.querySelector('i');
                if (buttonIcon.innerHTML === 'toggle_on') {
                    removeLabelsAndHighlightFromElements(currentElements);
                    buttonIcon.innerHTML = 'toggle_off'
                } else {
                    addLabelsAndHighlightToElements(currentElements, startIndex); ''
                    buttonIcon.innerHTML = 'toggle_on'
                }
                return;
            }

            // Handle region button click (A, B, C...)
            if (button.classList.contains('isRegionButton')) {
                await stopManager();

                const gridContainer = document.getElementById('webpage');
                if (gridContainer) gridContainer.innerHTML = '';

                const regionIdx = buttonText.charCodeAt(0) - 65;
                const region = regions[regionIdx];
                if (region) {
                    const elementsInRegion = await getInteractiveElementsInRegion(elementsInTabView, region);
                    currentElements = elementsInRegion;
                    await renderNumericalButtonsInSidebar(elementsInRegion);
                }

                isRegionSplitView = false;
                return;
            }
            // Handle grouped element buttons (1–6, 7–12, etc.)
            else if (button.classList.contains('isGroupButton')) {
                await stopManager();

                const groupIdx = idPrefix.findIndex(prefix => buttonId.startsWith(prefix));
                if (groupIdx !== -1) {
                    const startIdx = groupIdx * 6;
                    const endIdx = Math.min(startIdx + 6, currentElements.length);
                    const groupElements = currentElements.slice(startIdx, endIdx);
                    currentElements = groupElements;
                    await renderNumericalButtonsInSidebar(groupElements, startIdx, endIdx);
                }
                return;
            }
            // Handle clicking of element
            else if (button.classList.contains('isElementButton')) {
                removeLabelsAndHighlightFromElements(currentElements);

                const elementToClick = currentElements.find(element => element.labelNumber === Number(button.innerHTML));
                const elementTagName = elementToClick.tagName ? elementToClick.tagName.toLowerCase() : null;
                const elementTypeAttribute = elementToClick.type ? elementToClick.type.toLowerCase() : null

                console.log(`Element to click: ${elementToClick.boggleId}, Tag: ${elementTagName}, Type: ${elementTypeAttribute}`);

                if (elementTagName !== 'video' && elementTagName !== 'audio' && elementTypeAttribute !== 'range') {
                    await stopManager();
                    await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.SELECT);
                }

                let loadKeyboard = false;

                switch (elementTagName) {
                    case 'textarea':
                        loadKeyboard = true;
                        break;
                    case 'input':
                        switch (elementTypeAttribute) {
                            case 'text':
                            case 'password':
                            case 'search':
                            case 'number':
                            case 'tel':
                            case 'email':
                            case 'url':
                            case 'datetime-local':
                            case 'date':
                            case 'time':
                            case 'month':
                            case 'week':
                                loadKeyboard = true;
                                break;
                            case 'range':
                                selectedSpecialElementBoggleId = elementToClick.boggleId;
                                initSpecialInteractiveElements(elementTypeAttribute);
                                break;
                        }
                        break;
                    case 'audio':
                    case 'video':
                        selectedSpecialElementBoggleId = elementToClick.boggleId;
                        initSpecialInteractiveElements(elementTagName);
                        break;
                }

                if (loadKeyboard) {
                    try {
                        // -1 is an invalid scenarioId. In this case, the scenarioId will be calculated inside the overlay itself.
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD, -1, null, null, elementToClick);
                    } catch (error) {
                        logger.error('Error creating keyboard overlay:', error);
                    }
                } else {
                    try {
                        // Calculate intersection of element and visible bounds
                        webpageBounds = await webpage.getBoundingClientRect();
                        const coordinates = getCenterCoordinates(elementToClick, webpageBounds)

                        if (elementTagName !== 'video' && elementTagName !== 'audio' && elementTypeAttribute !== 'range') {
                            ipcRenderer.send('mouse-click-nutjs', coordinates);
                            ipcRenderer.send('elementsInDom-removeBoggleId');
                        }
                    } catch (error) {
                        logger.error('Error calculating the coordinates of the element', error);
                    }
                }
                return;
            }
            else if (button.classList.contains('isVideoAudioButton')) {
                const buttonId = button.getAttribute('id');

                switch (buttonId) {
                    case "firstBtn":
                        ipcRenderer.send('videoAudioElement-handle', 'play-pause', selectedSpecialElementBoggleId);
                        break;
                    case "secondBtn":
                        ipcRenderer.send('videoAudioElement-handle', 'mute-unmute', selectedSpecialElementBoggleId);
                        break;
                    case "thirdBtn":
                        ipcRenderer.send('videoAudioElement-handle', 'seek-forward', selectedSpecialElementBoggleId);
                        break;
                    case "fourthBtn":
                        ipcRenderer.send('videoAudioElement-handle', 'seek-backward', selectedSpecialElementBoggleId);
                        break;
                }
            }
            else if (button.classList.contains('isRangeButton')) {
                const buttonValue = button.textContent.trim();
                ipcRenderer.send('rangeElement-handle', buttonValue, selectedSpecialElementBoggleId);
            }

            // Handle the CLOSE/BACK button
            else if (buttonId === 'closeSelectBtn') {
                await stopManager();

                removeLabelsAndHighlightFromElements(currentElements);
                if (previousElementsStack.length > 1) {
                    previousElementsStack.pop();
                    currentElements = previousElementsStack.pop();

                    if (currentElements.length <= 36) await renderNumericalButtonsInSidebar(currentElements);
                    else {
                        navbar.innerHTML = '' // Removing the 'Toggle Numbers Visibility' button
                        isRegionSplitView = true;
                        await splitIntoRegions();
                    }
                } else {
                    // No previous state, exit overlay
                    ipcRenderer.send('elementsInDom-removeBoggleId');
                    await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.SELECT);
                }
                return;
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);

        button.dataset.listenerAttached = "true";
    });
}