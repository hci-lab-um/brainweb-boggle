const { ipcRenderer } = require('electron');
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

let buttons = [];
let webpageBounds = null;
let zoomFactor;
let sidebar;
let navbar;
let webpage;
let scrollableElements = [];        // These are all the scrollable elements visible in the current tab

ipcRenderer.on('seek-loaded', async (event, overlayData) => {
    try {
        ({ webpageBounds, zoomFactor } = overlayData);
        sidebar = document.getElementById('sidebar-buttons');
        navbar = document.getElementById('navbar');
        webpage = document.getElementById('webpage');

        webpageBounds = webpage.getBoundingClientRect();
        await initSeekOverlay(); // Begin initialisation
    } catch (error) {
        console.error('Error in select-loaded handler:', error);
    }
});

// ipcRenderer.on('select-reInitialise', async () => {
//     await reInitialiseSelectOverlay();
// });

// window.addEventListener('resize', async () => {
//     await reInitialiseSelectOverlay();
// });

async function initSeekOverlay() {
    scrollableElements = await ipcRenderer.invoke('scrollableElements-get'); // Fetching scrollable elements from the tabView

    const scrollButtonsContainer = document.createElement('div');
    scrollButtonsContainer.classList.add('scroll-buttons-container');

    // Choose layout strategy based on number of elements
    if (scrollableElements) {
        // check whether the scrollableElements contains an element with tagNAme 'html' or 'body'
        const isMainBodyScrollable = scrollableElements.some(element => {
            return element.tagName && (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body');
        });

        if (isMainBodyScrollable) {
            const title = document.createElement('h1');
            title.textContent = 'Main Body';
            title.classList.add('scroll-title');

            scrollButtonsContainer.appendChild(title);
        }

        // Render top and bottom scroll buttons
        const scrollUpButton = document.createElement('button');
        scrollUpButton.classList.add('scroll-button', 'scroll-up');
        scrollUpButton.innerHTML = createMaterialIcon('sm', 'keyboard_arrow_up');

        const scrollDownButton = document.createElement('button');
        scrollDownButton.classList.add('scroll-button', 'scroll-down');
        scrollDownButton.innerHTML = createMaterialIcon('sm', 'keyboard_arrow_down');

        scrollButtonsContainer.appendChild(scrollUpButton);
        scrollButtonsContainer.appendChild(scrollDownButton);
        sidebar.appendChild(scrollButtonsContainer);
        
        // Add button to select scrollable elements
        const selectScrollableElementContainer = document.createElement('div');
        selectScrollableElementContainer.classList.add('select-scrollable-container');

        const selectScrollableElementButton = document.createElement('button');
        selectScrollableElementButton.classList.add('button');
        selectScrollableElementButton.setAttribute('id', 'selectScrollableElementBtn');
        // selectScrollableElementButton.innerHTML = createMaterialIcon('sm', 'ads_click');

        const scrollableSpan = document.createElement('span');
        scrollableSpan.textContent = 'Select Scrollable Element';

        selectScrollableElementButton.insertBefore(scrollableSpan, selectScrollableElementButton.firstChild);
        selectScrollableElementContainer.appendChild(selectScrollableElementButton);
        navbar.appendChild(selectScrollableElementContainer);
    }

    // Add button to find
    const findContainer = document.createElement('div');
    findContainer.classList.add('find-container');

    const findButton = document.createElement('button');
    findButton.classList.add('button');
    findButton.setAttribute('id', 'findBtn');
    findButton.innerHTML = createMaterialIcon('sm', 'manage_search');

    const findSpan = document.createElement('span');
    findSpan.textContent = 'Find';

    findButton.insertBefore(findSpan, findButton.firstChild);
    findContainer.appendChild(findButton);
    navbar.appendChild(findContainer);
}
