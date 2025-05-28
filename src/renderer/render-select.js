const { ipcRenderer } = require('electron');
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

// Prefix used for generating button IDs
const idPrefix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

let buttons = [];
let regions = [];
let webpageBounds = null;
let sidebar;
let webpage;
let elementsInTabView = [];
let currentElements = [];
let previousElementsStack = [];

ipcRenderer.on('select-loaded', async (event, overlayData) => {
    try {
        ({ webpageBounds } = overlayData);
        sidebar = document.getElementById('sidebar-buttons');
        webpage = document.getElementById('webpage');

        await initSelectOverlay(); // Begin initialisation
    } catch (error) {
        console.error('Error in select-loaded handler:', error);
    }
});

async function initSelectOverlay() {
    elementsInTabView = await ipcRenderer.invoke('interactiveElements-get'); // Fetching interactive elements from the tabView
    currentElements = elementsInTabView;

    // Choose layout strategy based on number of elements
    if (elementsInTabView.length <= 36) {
        await renderNumericalButtonsInSidebar(currentElements);
    } else {
        await splitIntoRegions();
    }
}

// Adds numerical labels and highlights each element on the webpage
function addLabelsAndHighlightToElements(elements, startIdx) {
    try {
        ipcRenderer.send('interactiveElements-addHighlight', elements);

        elements.forEach((element, idx) => {
            const label = document.createElement('span');
            label.classList.add('element-number');
            label.textContent = startIdx + idx + 1;

            webpageBounds = webpage.getBoundingClientRect();
            label.style.left = `${element.x + webpageBounds.x}px`;
            label.style.top = `${element.y + webpageBounds.y}px`;

            webpage.appendChild(label);
        });
    } catch (error) {
        console.error('Error in interactiveElements-displayNumbers handler:', error);
    }
}

// Removes element labels and highlights
function removeLabelsAndHighlightFromElements(elements) {
    try {
        ipcRenderer.send('interactiveElements-removeHighlight', elements);

        const labels = webpage.querySelectorAll('.element-number');
        if (labels) labels.forEach(label => label.remove());
    } catch (error) {
        console.error('Error in interactiveElements-removeHighlight handler:', error);
    }
}

// Divides the webpage into 4 or 6 regions based on density of interactive elements
async function splitIntoRegions() {
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
    if (splitIntoSix) await updateScenarioId(51, buttons, ViewNames.SELECT);
    else await updateScenarioId(49, buttons, ViewNames.SELECT);
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
    const navbar = document.getElementById('navbar');
    sidebar.innerHTML = '';
    navbar.innerHTML = '';

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
            button.setAttribute('id', `${idPrefix[groupIdx]}GroupBtn`);
            button.classList.add('button');

            const start = groupIdx * 6 + 1;
            const end = start + group.length - 1;
            button.textContent = `${start} – ${end}`;

            sidebar.appendChild(button);
        });

        // Assign scenario ID depending on number of group buttons
        buttons = document.querySelectorAll('button');
        switch (buttons.length) {
            case 2: await updateScenarioId(46, buttons, ViewNames.SELECT); break;
            case 3: await updateScenarioId(47, buttons, ViewNames.SELECT); break;
            case 4: await updateScenarioId(48, buttons, ViewNames.SELECT); break;
            case 5: await updateScenarioId(49, buttons, ViewNames.SELECT); break;
            case 6: await updateScenarioId(50, buttons, ViewNames.SELECT); break;
            case 7: await updateScenarioId(51, buttons, ViewNames.SELECT); break;
        }
    } else {
        // One button per element (1, 2, 3, ...)
        for (let idx = startIdx; idx < endIdx; idx++) {
            const button = document.createElement('button');
            button.setAttribute('id', `${idPrefix[idx - startIdx]}ElementBtn`);
            button.classList.add('button');
            button.textContent = (idx + 1).toString();
            sidebar.appendChild(button);
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

        // Assign scenario ID for this setup
        buttons = document.querySelectorAll('button');
        switch (buttons.length) {
            case 3: await updateScenarioId(40, buttons, ViewNames.SELECT); break;
            case 4: await updateScenarioId(41, buttons, ViewNames.SELECT); break;
            case 5: await updateScenarioId(42, buttons, ViewNames.SELECT); break;
            case 6: await updateScenarioId(43, buttons, ViewNames.SELECT); break;
            case 7: await updateScenarioId(44, buttons, ViewNames.SELECT); break;
            case 8: await updateScenarioId(45, buttons, ViewNames.SELECT); break;
        }
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
        button.setAttribute('id', `${idPrefix[idx]}GroupBtn`);
        button.classList.add('button');
        button.textContent = String.fromCharCode(65 + idx); // A, B, C...
        await sidebar.appendChild(button);
    }

    previousElementsStack.push(currentElements);
    const closeSelectBtnIcon = document.getElementById('closeSelectBtn').querySelector('i');
    closeSelectBtnIcon.innerText = previousElementsStack.length > 1 ? 'arrow_back' : 'close';

    attachEventListeners();
};

function attachEventListeners() {
    const sidebar = document.querySelector('#sidebar');
    if (!sidebar) return;

    // Avoids attaching multiple listeners
    if (sidebar.dataset.listenerAttached === 'true') return;
    sidebar.dataset.listenerAttached = 'true';

    sidebar.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        addButtonSelectionAnimation(button);
        const buttonId = button.getAttribute('id');
        const buttonText = button.textContent.trim();

        setTimeout(async () => {
            await stopManager();

            // Handle region button click (A, B, C...)
            if (/^[A-Z]$/.test(buttonText)) {
                const gridContainer = document.getElementById('webpage');
                if (gridContainer) gridContainer.innerHTML = '';

                const regionIdx = buttonText.charCodeAt(0) - 65;
                const region = regions[regionIdx];
                if (region) {
                    const elementsInRegion = await getInteractiveElementsInRegion(elementsInTabView, region);
                    currentElements = elementsInRegion;
                    await renderNumericalButtonsInSidebar(elementsInRegion);
                }
                return;
            }

            // Handle grouped element buttons (1–6, 7–12, etc.)
            switch (buttonId) {
                case 'firstGroupBtn':
                case 'secondGroupBtn':
                case 'thirdGroupBtn':
                case 'fourthGroupBtn':
                case 'fifthGroupBtn':
                case 'sixthGroupBtn': {
                    const groupIdx = idPrefix.findIndex(prefix => buttonId.startsWith(prefix));
                    if (groupIdx !== -1) {
                        const startIdx = groupIdx * 6;
                        const endIdx = Math.min(startIdx + 6, currentElements.length);
                        const groupElements = currentElements.slice(startIdx, endIdx);
                        currentElements = groupElements;
                        await renderNumericalButtonsInSidebar(groupElements, startIdx, endIdx);
                    }
                    break;
                }
                case "closeSelectBtn":
                    // Handles back button clicks
                    removeLabelsAndHighlightFromElements(currentElements);
                    if (previousElementsStack.length > 1) {
                        previousElementsStack.pop();
                        currentElements = previousElementsStack.pop();
                        if (currentElements.length <= 36) await renderNumericalButtonsInSidebar(currentElements);
                        else await splitIntoRegions();
                    } else {
                        // No previous state, exit overlay
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.SELECT);
                    }
                    break;
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);

        button.dataset.listenerAttached = "true";
    });
}