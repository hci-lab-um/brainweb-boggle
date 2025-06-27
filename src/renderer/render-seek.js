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
let currentSearchText = '';          // This is the text currently being searched in the page
let currentFindIndex = 0;            // This is the index of the current found text in the page
let currentFindCount = 0;            // This is the total number of found texts in the page

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

ipcRenderer.on('text-findInPage-response', (event, { searchText, count }) => {
    try {
        currentFindCount = count; // Update the total count of found texts
        currentSearchText = searchText; // Update the current search text
        removeHighlightFromScrollableElements(); // Remove any existing highlights
        console.log(`Find in page response: searchText="${searchText}", count=${count}`);
        if (count > 0) {
            currentFindIndex = 1;
            displayFindInPage(searchText, count);
        } else {
            displayFindInPage(`No results found for "${searchText}"`, count);
        }
    } catch (err) {
        console.error('Error finding text in page:', err.message);
    }
});

window.addEventListener('resize', async () => {
    initSeekOverlay(`Element ${currentScrollableElement.labelNumber}`, currentScrollableElement);
});

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

    const closeButton = document.getElementById('closeSeekBtn');
    closeButton.innerHTML = createMaterialIcon('s', 'close');

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
    scrollableElements = await ipcRenderer.invoke('scrollableElements-get'); // Fetching scrollable elements from the tabView
    console.log('Scrollable Elements after pressing the button:', scrollableElements);
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

    const closeButton = document.getElementById('closeSeekBtn');
    closeButton.innerHTML = createMaterialIcon('s', 'arrow_back');

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

async function displayFindInPage(searchText, count = 0) {
    const title = document.querySelector('.scroll-title');
    title.innerHTML = searchText;

    const closeButton = document.getElementById('closeSeekBtn');
    closeButton.innerHTML = createMaterialIcon('s', 'arrow_back');

    navbar.innerHTML = '';
    const navbarTitle = document.createElement('div');
    navbarTitle.classList.add('navbar-title');
    navbarTitle.textContent = 'Find in Page';
    navbarTitle.id = 'findInPageTitle';
    navbar.appendChild(navbarTitle);

    if (count > 0) {
        let counter = document.querySelector('.scroll-counter');
        if (!counter) {
            counter = document.createElement('div');
            counter.id = 'findInPageCounter';
            counter.classList.add('scroll-counter');
            counter.innerHTML = `1/${count}`;
        } else {
            counter.innerHTML = `1/${count}`;
        }

        // Appending the counter after the title
        title.parentNode.insertBefore(counter, title.nextSibling);

        await updateScenarioId(13, buttons, ViewNames.SEEK, false);
    } else {
        // Displaying not found message
        const scrollButtonsContainer = document.querySelector('.scroll-buttons-container');
        scrollButtonsContainer.remove();

        await updateScenarioId(9, buttons, ViewNames.SEEK, false);
    }
}

async function addHighlightToScrollableElements(elements) {
    console.log('Adding highlight to scrollable elements:', elements);
    if (!elements || elements.length === 0) return;

    webpageBounds = await webpage.getBoundingClientRect();
    console.log('Webpage bounds:', webpageBounds);

    elements.forEach((element, idx) => {
        const zoomedX = element.x * zoomFactor;
        const zoomedY = element.y * zoomFactor;
        const zoomedWidth = element.width * zoomFactor;
        const zoomedHeight = element.height * zoomFactor;

        // Absolute position of element in the browser overlay (relative to browser, not webpage)
        const absoluteX = zoomedX + webpageBounds.x;
        const absoluteY = zoomedY + webpageBounds.y;

        // Clamp left and top position if part of element is outside the visible webpage area
        const visibleLeft = Math.max(absoluteX, webpageBounds.x);
        const visibleTop = Math.max(absoluteY, webpageBounds.y);

        // Clamp right and bottom to ensure highlight doesn't overflow outside the webpage bounds
        const visibleRight = Math.min(absoluteX + zoomedWidth, webpageBounds.x + webpageBounds.width);
        const visibleBottom = Math.min(absoluteY + zoomedHeight, webpageBounds.y + webpageBounds.height);

        // Compute visible dimensions
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        // Set highlight box styles
        let elementLeft = `${visibleLeft}px`;
        let elementTop = `${visibleTop}px`;
        let elementWidth = `${visibleWidth}px`;
        let elementHeight = `${visibleHeight}px`;

        // If the element is the main body (html or body), adjust its position and size
        if (element.tagName && (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body')) {
            if (element.inIframe && element.iframeBounds) {
                // Calculate iframe's absolute position within the webpage
                const iframeAbsoluteY = element.iframeBounds.y + webpageBounds.y;

                // Calculate the visible portion of the iframe (intersection with webpage viewport)
                const visibleIframeTop = Math.max(iframeAbsoluteY, webpageBounds.y);
                const visibleIframeBottom = Math.min(iframeAbsoluteY + element.iframeBounds.height, webpageBounds.y + webpageBounds.height);

                // Calculate visible iframe dimensions
                const visibleIframeHeight = Math.max(0, visibleIframeBottom - visibleIframeTop);

                // Only show highlight if iframe is actually visible
                if (visibleIframeHeight > 0) {
                    // Position the element within the visible iframe area
                    const clampedTop = Math.max(visibleIframeTop, Math.min(zoomedY + iframeAbsoluteY, visibleIframeBottom - element.height));

                    elementTop = `${clampedTop}px`;

                    // Dimensions should be constrained to the visible iframe area
                    const maxHeight = Math.min(element.iframeBounds.height * zoomFactor, visibleIframeBottom - clampedTop);

                    elementHeight = `${Math.max(0, maxHeight)}px`;
                } else {
                    // If iframe is completely out of view, hide the highlight
                    elementWidth = '0px';
                    elementHeight = '0px';
                }
            } else {
                elementLeft = `${Math.max(webpageBounds.x, Math.min(zoomedX + webpageBounds.x, webpageBounds.x + webpageBounds.width - element.width))}px`;
                elementTop = `${Math.max(webpageBounds.y, Math.min(zoomedY + webpageBounds.y, webpageBounds.y + webpageBounds.height - element.height))}px`;
                elementWidth = `${zoomedWidth}px`;
                elementHeight = `${zoomedHeight}px`;
            }
        }

        const highlight = document.createElement('div');
        highlight.classList.add('scrollable-element-highlight');
        highlight.style.position = 'absolute';
        // Calculates the left and top positions, clamped to the visible bounds of the webpage
        highlight.style.left = elementLeft;
        highlight.style.top = elementTop;
        highlight.style.width = elementWidth;
        highlight.style.height = elementHeight;
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

        label.style.left = elementLeft;
        label.style.top = elementTop;

        if (elementWidth === '0px' && elementHeight === '0px') {
            label.style.display = 'none';
        }

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
                    if (document.getElementById('findInPageTitle')) {
                        ipcRenderer.send('word-findNext', {
                            searchText: currentSearchText,
                            forward: false
                        });

                        let counter = document.getElementById('findInPageCounter');
                        if (counter) {
                            // Fixed: scroll up should go to previous result (decrement)
                            let nextIndex = currentFindIndex - 1;
                            if (nextIndex < 1) nextIndex = currentFindCount;
                            currentFindIndex = nextIndex; // Update the global variable
                            counter.innerHTML = `${nextIndex}/${currentFindCount}`;
                        }
                    } else if (currentScrollableElement) {
                        ipcRenderer.send('scrollableElement-scroll', {
                            scrollableBoggleId: currentScrollableElement.scrollableBoggleId,
                            top: -scrollDistance,
                            behavior: 'smooth'
                        });
                    }
                    break;
                case "scrollDownBtn":
                    if (document.getElementById('findInPageTitle')) {
                        ipcRenderer.send('word-findNext', {
                            searchText: currentSearchText,
                            forward: true
                        });

                        let counter = document.getElementById('findInPageCounter');
                        if (counter) {
                            // Fixed: scroll down should go to next result (increment)
                            let nextIndex = currentFindIndex + 1;
                            if (nextIndex > currentFindCount) nextIndex = 1;
                            currentFindIndex = nextIndex; // Update the global variable
                            counter.innerHTML = `${nextIndex}/${currentFindCount}`;
                        }
                    } else if (currentScrollableElement) {
                        ipcRenderer.send('scrollableElement-scroll', {
                            scrollableBoggleId: currentScrollableElement.scrollableBoggleId,
                            top: scrollDistance,
                            behavior: 'smooth'
                        });
                    }
                    break;
                case "findBtn":
                    await stopManager();
                    let keyboardObject = {
                        id: 'findInPage',
                        value: '',
                    }
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD, -1, null, null, keyboardObject);

                    break;
                case "closeSeekBtn":
                    await stopManager();

                    // If the button is a back button, we intialise the seek overlay with the current scrollable element
                    if (button.innerHTML.includes('arrow_back')) {
                        initSeekOverlay(`Element ${currentScrollableElement.labelNumber}`, currentScrollableElement);
                    } else {
                        ipcRenderer.send('elementsInDom-removeBoggleId', ViewNames.SEEK);
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.SEEK);
                    }
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

