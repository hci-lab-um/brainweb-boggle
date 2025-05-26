const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

let buttons = [];
let regions = [];
let webpageBounds = null;

ipcRenderer.on('select-loaded', async (event, overlayData) => {
    try {
        ({ webpageBounds } = overlayData);
        console.log('webpageBounds:', webpageBounds);
        await initSelectOverlay();

        buttons = document.querySelectorAll('button');
        // await updateScenarioId(scenarioId, buttons, ViewNames.SELECT);
        attachEventListeners();
    } catch (error) {
        console.error('Error in select-loaded handler:', error);
    }
});

async function initSelectOverlay() {
    // let noOfElementsInTabView = await getNoOfInteractiveElementsInRegion(webpageBounds);
    let elementsInTabView = await ipcRenderer.invoke('interactiveElements-get');
    console.log('elementsInTabView: ', elementsInTabView);
    let rows = 1, cols = 1;

    if (elementsInTabView.length <= 36) {
        renderButtonsInSidebar(elementsInTabView);
    }
    else {
        let splitIntoSix = false;

        // Splits the tabView screen into 4 quadrants
        ({ regions, rows, cols } = calculateRegionLayout(4));
        console.log('regions: ', regions);

        for (let idx = 0; idx < regions.length; idx++) {
            const region = regions[idx];
            let noOfElementsInQuadrant = await getNoOfInteractiveElementsInRegion(elementsInTabView, region);
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

async function getNoOfInteractiveElementsInRegion(elements, region) {
    const elementsInRegion = elements.filter(element => {
        // This includes elements whose top-left corner (x, y) is within the region
        return (
            element.x >= region.x &&
            element.x <= region.x + region.width &&
            element.y >= region.y &&
            element.y <= region.y + region.height
        );
    });
    return elementsInRegion.length;
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
            addButtonSelectionAnimation(button);
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                // await stopManager();

                switch (buttonId) {
                    case "closeSelectBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.SELECT);
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}

/** 
 * Renders sidebar buttons: one per element if ≤6, or grouped in ranges
 * of 6 (e.g., 1-6, 7-12, ...) if more than 6 elements, up to 36.
 */
async function renderButtonsInSidebar(elementsInTabView) {
    const idSuffix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

    const sidebar = document.getElementById('sidebar-buttons');
    sidebar.innerHTML = ''; // Clear existing buttons

    if (elementsInTabView.length > 6) {
        // Group into ranges of 6
        const groups = [];
        for (let i = 0; i < elementsInTabView.length; i += 6) {
            groups.push(elementsInTabView.slice(i, i + 6));
        }

        groups.forEach((group, groupIdx) => {
            const button = document.createElement('button');
            button.setAttribute('id', `${idSuffix[groupIdx]}GroupBtn`);
            button.classList.add('button');

            const start = groupIdx * 6 + 1;
            const end = start + group.length - 1;
            const label = `${start}-${end}`;
            button.textContent = label;

            sidebar.appendChild(button);
        });

        const buttons = document.querySelectorAll('button');
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
        elementsInTabView.forEach((element, idx) => {
            const button = document.createElement('button');
            button.setAttribute('id', `${idSuffix[idx]}ElementBtn`);
            button.classList.add('button');
            button.textContent = (idx + 1).toString();

            sidebar.appendChild(button);
        });

        const toggleNumbersButton = document.createElement('button');
        toggleNumbersButton.setAttribute('id', 'toggleNumbersBtn');
        toggleNumbersButton.innerHTML = createMaterialIcon('l', 'toggle_on');

        sidebar.appendChild(toggleNumbersButton);

        const buttons = document.querySelectorAll('button');
        switch (buttons.length) {
            case 3: await updateScenarioId(40, buttons, ViewNames.SELECT); break;
            case 4: await updateScenarioId(41, buttons, ViewNames.SELECT); break;
            case 5: await updateScenarioId(42, buttons, ViewNames.SELECT); break;
            case 6: await updateScenarioId(43, buttons, ViewNames.SELECT); break;
            case 7: await updateScenarioId(44, buttons, ViewNames.SELECT); break;
            case 8: await updateScenarioId(45, buttons, ViewNames.SELECT); break;
        }
    }
}