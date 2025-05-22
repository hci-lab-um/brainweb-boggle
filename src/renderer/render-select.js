const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');

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
        // display the numbers associated with the elements (grouped if need be)
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
