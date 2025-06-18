const { ipcRenderer } = require('electron');
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

const scrollDistance = 100; // Distance to scroll in pixels

let buttons = [];
let webpageBounds = null;
let zoomFactor;
let sidebar;
let navbar;
let webpage;
let scrollableElements = [];         // These are all the scrollable elements visible in the current tab
let currentScrollableElement = null; // This is the currently selected scrollable element

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
    if (scrollableElements && scrollableElements.length > 0) {
        // Getting the scrollable mainBody element with tagName 'html' or 'body'
        const mainBody = scrollableElements.find(element => {
            return element.tagName && (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body');
        });

        if (mainBody) {
            currentScrollableElement = mainBody;

            const title = document.createElement('h1');
            title.textContent = 'Main Body';
            title.classList.add('scroll-title');

            scrollButtonsContainer.appendChild(title);

            // Render top and bottom scroll buttons
            const scrollUpButton = document.createElement('button');
            scrollUpButton.classList.add('scroll-button', 'scroll-up');
            scrollUpButton.innerHTML = createMaterialIcon('sm', 'keyboard_arrow_up');
            scrollUpButton.setAttribute('id', 'scrollUpBtn');

            const scrollDownButton = document.createElement('button');
            scrollDownButton.classList.add('scroll-button', 'scroll-down');
            scrollDownButton.innerHTML = createMaterialIcon('sm', 'keyboard_arrow_down');
            scrollDownButton.setAttribute('id', 'scrollDownBtn');

            scrollButtonsContainer.appendChild(scrollUpButton);
            scrollButtonsContainer.appendChild(scrollDownButton);
            sidebar.appendChild(scrollButtonsContainer);
        }

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


    buttons = document.querySelectorAll('button');
    if (mainBody) await updateScenarioId(10, buttons, ViewNames.SEEK, false);
    else await updateScenarioId(11, buttons, ViewNames.SEEK, false);
    
    attachEventListeners();
}

function attachEventListeners() {
    const overlay = document.getElementById('seekOverlay');
    if (!overlay) return;

    // Avoids attaching multiple listeners
    if (overlay.dataset.listenerAttached === 'true') return;
    overlay.dataset.listenerAttached = 'true';

    overlay.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        addButtonSelectionAnimation(button);
        const buttonId = button.getAttribute('id');

        setTimeout(async () => {
            await stopManager();

            switch (buttonId) {
                case "selectScrollableElementBtn":
                    break;
                case "scrollUpBtn":
                    if (currentScrollableElement && currentScrollableElement.scrollBy) {
                        currentScrollableElement.scrollBy({ top: -scrollDistance, behavior: 'smooth' });
                    } else if (currentScrollableElement && currentScrollableElement.scrollTop !== undefined) {
                        currentScrollableElement.scrollTop -= scrollDistance;
                    }
                    break;
                case "scrollDownBtn":
                    if (currentScrollableElement && currentScrollableElement.scrollBy) {
                        currentScrollableElement.scrollBy({ top: scrollDistance, behavior: 'smooth' });
                    } else if (currentScrollableElement && currentScrollableElement.scrollTop !== undefined) {
                        currentScrollableElement.scrollTop += scrollDistance;
                    }
                    break;
                case "findBtn":
                    break;
                case "closeSeekBtn":
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.SEEK);
                    break;
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

