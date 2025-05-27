const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

const idPrefix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
let buttons = [];
let regions = [];
let webpageBounds = null;
let sidebar;
let elementsInTabView = [];
let currentElements = [];

ipcRenderer.on('select-loaded', async (event, overlayData) => {
    try {
        ({ webpageBounds } = overlayData);
        sidebar = document.getElementById('sidebar-buttons');

        await initSelectOverlay();
        attachEventListeners();
    } catch (error) {
        console.error('Error in select-loaded handler:', error);
    }
});

async function initSelectOverlay() {
    // let noOfElementsInTabView = await getNoOfInteractiveElementsInRegion(webpageBounds);
    elementsInTabView = await ipcRenderer.invoke('interactiveElements-get');
    let rows = 1, cols = 1;
    let splitIntoSix = false;
    console.log('elementsInTabView: ', elementsInTabView);

    if (elementsInTabView.length <= 36) {
        currentElements = elementsInTabView; // Set context to all elements
        renderButtonsInSidebar(currentElements);
    }
    else {
        
        // Splits the tabView screen into 4 quadrants
        ({ regions, rows, cols } = calculateRegionLayout(4));

        for (let idx = 0; idx < regions.length; idx++) {
            const region = regions[idx];
            const elementsInQuadrant = await getInteractiveElementsInRegion(elementsInTabView, region);
            let noOfElementsInQuadrant = elementsInQuadrant.length;
            console.log(`No of elements in quadrant ${idx + 1}: ${noOfElementsInQuadrant}`);

            if (noOfElementsInQuadrant > 36) {
                splitIntoSix = true;
                break; // Exit the loop early
            }
        }

        if (splitIntoSix) {
            let splitRegionIntoFour = false;
            ({ regions, rows, cols } = calculateRegionLayout(6));

            // WAIT for user to select Region and then CHECK if that region has got more than 36 elements
            // If so split the Region into 4
        }
    }

    createGrid(regions.length, rows, cols);

    await renderButtonsInSidebarForGrid(regions.length);
    buttons = document.querySelectorAll('button');
    if (splitIntoSix) await updateScenarioId(51, buttons, ViewNames.SELECT);
    else await updateScenarioId(49, buttons, ViewNames.SELECT);
}

function calculateRegionLayout(numRegions) {
    // Finds the grid size (rows x cols) as close to square as possible
    let rows = Math.floor(Math.sqrt(numRegions));
    let cols = Math.ceil(numRegions / rows);

    // Adjusts the number of rows if not enough regions have been created
    while (rows * cols < numRegions) {
        rows++;
    }

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

async function getInteractiveElementsInRegion(elements, region) {
    const elementsInRegion = elements.filter(element => {
        // This includes elements whose top-left corner (x, y) is within the region
        return (
            element.x >= region.x &&
            element.x <= region.x + region.width &&
            element.y >= region.y &&
            element.y <= region.y + region.height
        );
    });
    return elementsInRegion;
}

function createGrid(noOfRegions, rows, cols) {
    const gridContainer = document.getElementById('webpage');
    gridContainer.classList.add('grid__container');
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    // add a child div to the grid for each region
    regions.forEach(region => {
        const regionDiv = document.createElement('div');
        regionDiv.classList.add('grid__region');

        const labelDiv = document.createElement('div');
        labelDiv.classList.add('grid__label');
        labelDiv.textContent = String.fromCharCode(65 + regions.indexOf(region));

        regionDiv.appendChild(labelDiv);
        gridContainer.appendChild(regionDiv);
    });
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            if (button.dataset.listenerAttached === "true") return;

            addButtonSelectionAnimation(button);
            const buttonId = button.getAttribute('id');
            const buttonText = button.textContent.trim();

            setTimeout(async () => {
                await stopManager();

                if (/^[A-Z]$/.test(buttonText)) {
                    // Region button clicked
                    const regionIdx = buttonText.charCodeAt(0) - 65;
                    const region = regions[regionIdx];
                    if (region) {
                        const elementsInRegion = await getInteractiveElementsInRegion(elementsInTabView, region);
                        currentElements = elementsInRegion; // Set context to region
                        await renderButtonsInSidebar(elementsInRegion, 0, elementsInRegion.length);
                    }
                    return;
                }

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
                            await renderButtonsInSidebar(groupElements, startIdx, endIdx);
                        }
                        break;
                    }
                    case "closeSelectBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.SELECT);
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);

            button.dataset.listenerAttached = "true";

        });
    });
}

/** 
 * Renders sidebar buttons: one per element if ≤6, or grouped in ranges
 * of 6 (e.g., 1-6, 7-12, ...) if more than 6 elements, up to 36.
 */
async function renderButtonsInSidebar(elements, startIdx = 0, endIdx = elements.length) {
    const sidebar = document.getElementById('sidebar-buttons');
    sidebar.innerHTML = ''; // Clear existing buttons

    if (elements.length > 6) {
        // Group into ranges of 6
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
            const label = `${start} – ${end}`;
            button.textContent = label;

            sidebar.appendChild(button);
        });

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
        // Just create one button per element
        for (let idx = startIdx; idx < endIdx; idx++) {
            const button = document.createElement('button');
            button.setAttribute('id', `${idPrefix[idx - startIdx]}ElementBtn`);
            button.classList.add('button');
            button.textContent = (idx + 1).toString();
            console.log(`Button created for element ${idx + 1}:`, button);
            sidebar.appendChild(button);
        }

        const navbar = document.getElementById('navbar');
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

    attachEventListeners();
}

async function renderButtonsInSidebarForGrid(numButtons) {
    for (let idx = 0; idx < numButtons; idx++) {
        const button = document.createElement('button');
        button.setAttribute('id', `${idPrefix[idx]}GroupBtn`);
        button.classList.add('button');
        button.textContent = String.fromCharCode(65 + idx);

        await sidebar.appendChild(button);
    }
};