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

async function initSeekOverlay(titleContent = 'Element 1', selectedScrollableElement = null) {
    scrollableElements = await ipcRenderer.invoke('scrollableElements-get'); // Fetching scrollable elements from the tabView
    console.log('Scrollable Elements:', scrollableElements);

    removeHighlightFromScrollableElements(); // Remove any existing highlights

    navbar.innerHTML = '';  // Clear existing navbar content
    sidebar.innerHTML = ''; // Clear existing sidebar content
    let title;

    const scrollButtonsContainer = document.createElement('div');
    scrollButtonsContainer.classList.add('scroll-buttons-container');

    // Getting the scrollable mainBody element with tagName 'html' or 'body'
    const mainBody = await scrollableElements.find(element => {
        console.log(`Checking element: ${element.tagName}`);
        return element.tagName && (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body');
    });

    // Choose layout strategy based on number of elements
    if (scrollableElements && scrollableElements.length > 0) {
        title = document.createElement('div');
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

        if (scrollableElements.length > 1) {
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

    if (mainBody && !selectedScrollableElement) {
        // If the main body is found, set it as the current scrollable element
        currentScrollableElement = mainBody;
        const mainBodyIndex = scrollableElements.indexOf(mainBody);
        title.textContent = `Element ${mainBodyIndex + 1}`; // Set title for main body 
        addHighlightToScrollableElements([currentScrollableElement]);
    } else if (!mainBody && !selectedScrollableElement && scrollableElements.length === 1) {
        currentScrollableElement = scrollableElements[0];
        addHighlightToScrollableElements([currentScrollableElement]);
    } else if (!mainBody && !selectedScrollableElement && scrollableElements.length > 1) {
        // Display a selectable list of scrollable elements if no main body is found and multiple scrollable elements exist
        await displayScrollableElements();
    } else if (selectedScrollableElement) {
        // If a specific scrollable element is selected, set it as the current scrollable element
        currentScrollableElement = selectedScrollableElement;
        addHighlightToScrollableElements([currentScrollableElement]);
    }

    buttons = document.querySelectorAll('button');

    // When there is only 1 scrollable element, we set the scenarioId to 11
    if (scrollableElements.length === 1) await updateScenarioId(11, buttons, ViewNames.SEEK, false);
    // When there are multiple scrollable elements, we set the scenarioId to 10
    else if (scrollableElements.length > 1) await updateScenarioId(10, buttons, ViewNames.SEEK, false);
    // When there are no scrollable elements, we set the scenarioId to 12
    else if (scrollableElements.length === 0) await updateScenarioId(12, buttons, ViewNames.SEEK, false);

    attachEventListeners();
}

async function displayScrollableElements() {
    removeHighlightFromScrollableElements(); // Remove any existing highlights
    addHighlightToScrollableElements(scrollableElements);

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

async function addHighlightToScrollableElements(elements) {
    console.log('Adding highlight to scrollable elements:', elements);
    if (!elements || elements.length === 0) return;

    webpageBounds = await webpage.getBoundingClientRect();
    console.log('Webpage bounds:', webpageBounds);

    elements.forEach((element, idx) => {
        const highlight = document.createElement('div');
        highlight.classList.add('scrollable-element-highlight');
        highlight.style.position = 'absolute';
        highlight.style.left = `${element.x + webpageBounds.x}px`;
        highlight.style.top = `${element.y + webpageBounds.y}px`;
        highlight.style.width = `${element.width}px`;
        highlight.style.height = `${element.height}px`;
        highlight.style.zIndex = '1000';
        highlight.style.border = '3px solid rgba(183, 255, 0, 0.50)';
        highlight.style.borderRadius = '8px';
        highlight.style.boxSizing = 'border-box';
        highlight.style.transition = 'border-color 0.3s ease';

        const label = document.createElement('span');
        label.classList.add('element-number');

        // If the element does not have a labelNumber already set, then set it and the label's text content to idx + 1
        if (!elements[idx].labelNumber) {
            label.textContent = idx + 1;
            elements[idx].labelNumber = idx + 1;
        } else {
            // If it already has a labelNumber, use that
            label.textContent = elements[idx].labelNumber;
        }

        let left = (element.x * zoomFactor) + webpageBounds.x;
        let top = (element.y * zoomFactor) + webpageBounds.y;

        // Placing label position at the edges of the visible bounds
        left = Math.max(webpageBounds.x, Math.min(left, webpageBounds.x + webpageBounds.width - label.offsetWidth));
        top = Math.max(webpageBounds.y, Math.min(top, webpageBounds.y + webpageBounds.height - label.offsetHeight));

        label.style.left = `${left}px`;
        label.style.top = `${top}px`;

        document.body.appendChild(highlight);
        document.body.appendChild(label);
    });
}

function removeHighlightFromScrollableElements() {
    document.querySelectorAll('.scrollable-element-highlight, .element-number').forEach(el => el.remove());
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
                    ipcRenderer.on('elementsInDom-removeBoggleId', ViewNames.SEEK);
                    break;
                case "firstScrollableElementBtn":
                case "secondScrollableElementBtn":
                case "thirdScrollableElementBtn":
                case "fourthScrollableElementBtn":
                case "fifthScrollableElementBtn":
                case "sixthScrollableElementBtn":
                    await stopManager();
                    const chosenElement = scrollableElements[idMap[buttonId] - 1];
                    console.log(`Element ${idMap[buttonId]}`)
                    console.log(`Chosen Element: ${chosenElement}`);
                    initSeekOverlay(`Element ${idMap[buttonId]}`, chosenElement);
                    break;
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

