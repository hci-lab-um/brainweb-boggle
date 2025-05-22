const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { QuadtreeBuilder, QtBuilderOptions } = require('cactus-quadtree-builder');

let buttons = [];
let webpageURL = null;
let webpageBounds = null;

ipcRenderer.on('select-loaded', async (event, webpageData) => {
    try {
        ({ webpageURL, webpageBounds } = webpageData);
        console.log('webpageBounds:', webpageBounds);
        await initSelectOverlay();
        // buttons = document.querySelectorAll('button');
        // await updateScenarioId(scenarioId, buttons, ViewNames.SELECT);
        // attachEventListeners();
    } catch (error) {
        console.error('Error in select-loaded handler:', error);
    }
});

async function initSelectOverlay() {
    const noOfRegions = await getNoOfRegions();

    // // dynamically create a grid that splits the screen into 4 or 6 regions
    // const regions = getScreenRegions(noOfRegions);
    // const regionElements = regions.map((region, index) => {
    //     const regionElement = document.createElement('div');
    //     regionElement.className = 'region';
    //     regionElement.style.position = 'absolute';
    //     regionElement.style.left = `${region.x}px`;
    //     regionElement.style.top = `${region.y}px`;
    //     regionElement.style.width = `${region.width}px`;
    //     regionElement.style.height = `${region.height}px`;
    //     regionElement.style.border = '1px solid red';
    //     regionElement.style.zIndex = 1000 + index; // Ensure regions are on top
    //     return regionElement;
    // });
    // document.body.append(...regionElements);
    // regionElements.forEach((regionElement, index) => {
    //     regionElement.addEventListener('click', async () => {
    //         const selectedRegion = regions[index];
    //         const noOfElementsInRegion = await getNoOfInteractiveElementsInRegion(selectedRegion);
    //         console.log(`Number of interactive elements in selected region: ${noOfElementsInRegion}`);
    //         // Handle the click event for the selected region
    //         // You can add your logic here to process the selected region
    //     });
    // });
    
}

async function getNoOfRegions() {
    let noOfElementsInTabView = await getNoOfInteractiveElementsInRegion(webpageBounds);
    let regions = [];

    if (noOfElementsInTabView <= 36) {
        return 1;
    }
    else {
        let splitIntoSix = false;

        // Splits the tabView screen into 4 quadrants
        regions = getScreenRegions(4)
        console.log('regions: ', regions);

        for (let idx = 0; idx < regions.length; idx++) {;
            const region = regions[idx];
            let noOfElementsInQuadrant = await getNoOfInteractiveElementsInRegion(region);

            if (noOfElementsInQuadrant > 36) {
                splitIntoSix = true;
                break; // Exit the loop early
            }
        }

        if (splitIntoSix) {
            return 6;
            let splitRegionIntoFour = false;
            regions = getScreenRegions(6)

            // WAIT for user to select Region and then CHECK if that region has got more than 36 elements
            // If so split the Region into 4
        }
        else {
            return 4;
        }
    }

}

function getScreenRegions(numRegions) {
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
    return regions;
}

async function getNoOfInteractiveElementsInRegion(region) {
    const qtOptions = new QtBuilderOptions(region.width, region.height, 'new', 36);
    const qtBuilder = new QuadtreeBuilder(qtOptions);

    const pageDocument = await qtBuilder.initializePageDocumentAsync(webpageURL);

    if (pageDocument && pageDocument.interactiveElements) {
        console.log('Total interactive elements in quadrant:', pageDocument.interactiveElements.length);
        return pageDocument.interactiveElements.length;
    } else {
        console.log('Failed to retrieve interactive elements.');
        return 0;
    }
}