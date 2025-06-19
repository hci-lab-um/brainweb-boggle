const { ipcRenderer } = require('electron');
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

const scrollDistance = 400; // Distance to scroll in pixels

// Prefix used for generating button IDs
const idPrefix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

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

async function initSeekOverlay(titleContent = 'Main Body', selectedScrollableElement = null) {
    scrollableElements = await ipcRenderer.invoke('scrollableElements-get'); // Fetching scrollable elements from the tabView
    console.log('Scrollable Elements:', scrollableElements);

    navbar.innerHTML = '';  // Clear existing navbar content
    sidebar.innerHTML = ''; // Clear existing sidebar content

    const scrollButtonsContainer = document.createElement('div');
    scrollButtonsContainer.classList.add('scroll-buttons-container');

    // Getting the scrollable mainBody element with tagName 'html' or 'body'
    const mainBody = scrollableElements.find(async element => {
        return await element.tagName && (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body');
    });

    if (mainBody && !selectedScrollableElement) currentScrollableElement = mainBody;

    // Choose layout strategy based on number of elements
    if (scrollableElements && scrollableElements.length > 0) {
        if (currentScrollableElement) {

            const title = document.createElement('div');
            title.textContent = titleContent;
            title.classList.add('scroll-title');

            sidebar.appendChild(title);

            // Render top and bottom scroll buttons
            const scrollUpButton = document.createElement('button');
            scrollUpButton.classList.add('button', 'scroll-button', 'scroll-up');
            scrollUpButton.innerHTML = createMaterialIcon('xl', 'keyboard_arrow_up');
            scrollUpButton.setAttribute('id', 'scrollUpBtn');

            const scrollDownButton = document.createElement('button');
            scrollDownButton.classList.add('button', 'scroll-button', 'scroll-down');
            scrollDownButton.innerHTML = createMaterialIcon('xl', 'keyboard_arrow_down');
            scrollDownButton.setAttribute('id', 'scrollDownBtn');

            scrollButtonsContainer.appendChild(scrollUpButton);
            scrollButtonsContainer.appendChild(scrollDownButton);
            sidebar.appendChild(scrollButtonsContainer);
        }

        if ((scrollableElements.length === 1 && !mainBody) || scrollableElements.length > 1) {
            // Add button to select scrollable elements
            const selectScrollableElementButton = document.createElement('button');
            selectScrollableElementButton.classList.add('button');
            selectScrollableElementButton.setAttribute('id', 'selectScrollableElementBtn');
            selectScrollableElementButton.innerHTML = createMaterialIcon('sm', 'swap_vert');

            const scrollableSpan = document.createElement('span');
            scrollableSpan.textContent = 'Select Scrollable Element';

            selectScrollableElementButton.insertBefore(scrollableSpan, selectScrollableElementButton.firstChild);
            navbar.appendChild(selectScrollableElementButton);
        }
    }

    // Add button to find
    const findButton = document.createElement('button');
    findButton.classList.add('button');
    findButton.setAttribute('id', 'findBtn');
    findButton.innerHTML = createMaterialIcon('sm', 'manage_search');

    const findSpan = document.createElement('span');
    findSpan.textContent = 'Find in Page';

    findButton.insertBefore(findSpan, findButton.firstChild);
    navbar.appendChild(findButton);
    navbar.classList.add('navbar');

    buttons = document.querySelectorAll('button');
    if (mainBody && scrollableElements.length > 0) await updateScenarioId(10, buttons, ViewNames.SEEK, false);
    else if ((scrollableElements.length === 1 && !mainBody) || scrollableElements.length > 1) await updateScenarioId(11, buttons, ViewNames.SEEK, false);
    else await updateScenarioId(12, buttons, ViewNames.SEEK, false);

    // ipcRenderer.send('scrollableElements-removeHighlight');
    ipcRenderer.send('scrollableElement-addHighlight', currentScrollableElement);
    attachEventListeners();
}

async function displayScrollableElements() {
    ipcRenderer.send('allScrollableElements-addHighlight', scrollableElements);
    
    const scrollButtonsContainer = document.querySelector('.scroll-buttons-container');
    scrollButtonsContainer.innerHTML = ''; // Clear existing buttons
    const title = document.querySelector('.scroll-title');
    title.remove();
    navbar.innerHTML = '';

    const navbarTitle = document.createElement('div');
    navbarTitle.classList.add('navbar-title');
    navbarTitle.textContent = 'Select Scrollable Element';
    navbar.appendChild(navbarTitle);

    // get the first 6 scrollable elements
    const elementsToDisplay = scrollableElements.slice(0, 6);
    elementsToDisplay.forEach((_, idx) => {
        const button = document.createElement('button');
        button.classList.add('button');
        button.setAttribute('id', `${idPrefix[idx]}ScrollableElementBtn`);
        button.textContent = `${idx + 1}`;
        scrollButtonsContainer.appendChild(button);
    });

    attachEventListeners();
    switch (elementsToDisplay.length) {
        case 1: await updateScenarioId(14, buttons, ViewNames.SEEK, false); break;
        case 2: await updateScenarioId(15, buttons, ViewNames.SEEK, false); break;
        case 3: await updateScenarioId(16, buttons, ViewNames.SEEK, false); break;
        case 4: await updateScenarioId(17, buttons, ViewNames.SEEK, false); break;
        case 5: await updateScenarioId(18, buttons, ViewNames.SEEK, false); break;
        case 6: await updateScenarioId(19, buttons, ViewNames.SEEK, false); break;
    }
}

function attachEventListeners() {
    const idMap = {
        firstScrollableElementBtn: 1,
        secondScrollableElementBtn: 2,
        thirdScrollableElementBtn: 3,
        fourthScrollableElementBtn: 4,
        fifthScrollableElementBtn: 5,
        sixthScrollableElementBtn: 6
    };

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
            switch (buttonId) {
                case "selectScrollableElementBtn":
                    await stopManager();
                    displayScrollableElements();
                    break;
                case "scrollUpBtn":
                    if (currentScrollableElement) {
                        ipcRenderer.send('scrollableElement-scroll', {
                            scrollableBoggleId: currentScrollableElement.scrollableBoggleId,
                            top: -scrollDistance,
                            behavior: 'smooth'
                        });
                    }
                    break;
                case "scrollDownBtn":
                    if (currentScrollableElement) {
                        ipcRenderer.send('scrollableElement-scroll', {
                            scrollableBoggleId: currentScrollableElement.scrollableBoggleId,
                            top: scrollDistance,
                            behavior: 'smooth'
                        });
                    }
                    break;
                case "findBtn":
                    await stopManager();
                    break;
                case "closeSeekBtn":
                    await stopManager();
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.SEEK);
                    break;
                case "firstScrollableElementBtn":
                case "secondScrollableElementBtn":
                case "thirdScrollableElementBtn":
                case "fourthScrollableElementBtn":
                case "fifthScrollableElementBtn":
                case "sixthScrollableElementBtn":
                    const chosenElement = scrollableElements[idMap[buttonId] - 1];
                    console.log(`Chosen Element: ${chosenElement}`);
                    initSeekOverlay(`Element ${idMap[buttonId]}`, chosenElement);
                    break;
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

