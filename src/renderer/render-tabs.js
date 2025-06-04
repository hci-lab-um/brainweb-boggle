const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon, createPopup, createNavigationButton, updatePaginationIndicators, paginate } = require('../utils/utilityFunctions');

let buttons = [];
let tabsList = [];
const pageSize = 4;     // This is the maximum number of tabs that can be displayed at once in a page
let currentPage = 0;    // Current page index

ipcRenderer.on('tabs-loaded', async (event, overlayData, isReload = false) => {
    try {
        ({ tabsList } = overlayData);
        console.log('Tabs loaded:', tabsList);
        buttons = document.querySelectorAll('button');

        /**
         * This is used to update the current page and display the last page of the tabs if the current page is the last page
         *
         * tabs.length % pageSize === 0 : This checks if each page has exactly 4 tabs (after the deletion of the tab).
         * isReload == true : We only want to update the current page if we are reloading the tabs overlay.
         * Math.ceil((tabs.length + 1)/ pageSize) - 1 : We add 1 to tabs.length to identify if the user was on the last
         * page before the deletion occurred.
         */
        if (tabsList.length % pageSize === 0 && isReload && currentPage === Math.ceil((tabsList.length + 1) / pageSize) - 1) {
            // Sets currentPage to the new last page.
            currentPage = (tabsList.length / pageSize) - 1;
        }

        initialiseTabsOverlay();

        // Update pagination indicators if this is a reload
        if (isReload) {
            updatePaginationIndicators();
        }

        // Obtaining the scenarioId based on the number of tabs and pagination state
        const scenarioId = getTabsScenarioId(
            tabsList.length,
            false,
            tabsList.length > pageSize
        );
        // Updating the scenarioId for the tabs overlay
        await updateScenarioId(scenarioId, buttons, ViewNames.TABS);
    } catch (error) {
        console.error('Error in tabs-loaded handler:', error);
    }
});

function getTabsScenarioId(tabsCount, hasLeftArrow, hasRightArrow) {
    // If there are no tabs, return the scenario ID for the empty state
    if (tabsCount === 0) return 21;

    const totalPages = Math.ceil(tabsCount / pageSize);
    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage === totalPages - 1;
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, tabsCount);
    const tabsOnPage = end - start;

    const getScenarioId = (tabsOnPage, left, right) => {
        // Determine the scenario ID based on the number of tabs and arrow visibility
        if (tabsOnPage >= 1 && tabsOnPage <= 3) {
            // 21–24 (no arrow), 25–28 (left arrow), 29–30 (right arrow)
            return 21 + tabsOnPage + ((left || right) ? 4 : 0);
        }
        if (tabsOnPage === 4) {
            if (left && right) return 30;
            if (left || right) return 29;
            return 25;
        }
        return 21;
    };

    if (tabsCount <= pageSize || isLastPage) {
        return getScenarioId(tabsOnPage, hasLeftArrow, hasRightArrow);
    }

    // If there are more than 4 tabs, we need to consider pagination
    if (!isFirstPage && !isLastPage) return 30; // both arrows
    if (isFirstPage && hasRightArrow) return 29;
    if (isLastPage && hasLeftArrow) return 29;

    return 25;
}

function initialiseTabsOverlay() {
    try {
        const tabsAndArrowsContainer = document.getElementById('tabsAndArrowsContainer');
        const tabsContainer = document.getElementById('tabsOnlyContainer');

        if (tabsAndArrowsContainer && tabsContainer) {
            const displayNoTabsMessage = () => {
                tabsAndArrowsContainer.innerHTML = ''; // Clears the container

                const noTabsMessage = document.createElement('div');
                noTabsMessage.classList.add('noTabsMessage');
                noTabsMessage.innerHTML = 'No tabs found :(';

                tabsAndArrowsContainer.appendChild(noTabsMessage);
            };

            const createTab = (tab, index) => {
                try {
                    const idSuffix = ['first', 'second', 'third', 'fourth'][index];

                    const tabButton = document.createElement('button');
                    tabButton.setAttribute('id', `${idSuffix}ItemBtn`);
                    tabButton.classList.add('button');

                    const buttonTitle = document.createElement('span');
                    buttonTitle.classList.add('button__title');
                    buttonTitle.textContent = tab.title;
                    tabButton.appendChild(buttonTitle);

                    const buttonUrl = document.createElement('span');
                    buttonUrl.classList.add('button__url');
                    buttonUrl.textContent = tab.url;
                    tabButton.appendChild(buttonUrl);

                    return tabButton;
                } catch (error) {
                    console.error('Error creating tabButton:', error);
                }
            };

            const handleNavigation = async (direction) => {
                currentPage += direction === 'left' ? -1 : 1;
                await stopManager();
                renderPage();
                requestAnimationFrame(async () => {
                    const scenarioId = getTabsScenarioId(
                        tabsList.length,
                        currentPage > 0,
                        (currentPage + 1) * pageSize < tabsList.length
                    );
                    await updateScenarioId(scenarioId, buttons, ViewNames.TABS);
                });
            };

            const renderPage = () => {
                tabsContainer.innerHTML = '';
                tabsAndArrowsContainer.innerHTML = '';
                const pageTabs = paginate(tabsList, pageSize, currentPage);

                // Add left navigation button
                if (currentPage > 0) {
                    const leftArrow = createNavigationButton('left', () => handleNavigation('left'));
                    tabsAndArrowsContainer.insertBefore(leftArrow, tabsAndArrowsContainer.firstChild);
                }
                // Add tabs for the current page
                pageTabs.forEach((tab, pageIndex) => {
                    const tabElement = createTab(tab, pageIndex);
                    tabsContainer.appendChild(tabElement);
                    tabsAndArrowsContainer.appendChild(tabsContainer);
                });
                // Add right navigation button
                if ((currentPage + 1) * pageSize < tabsList.length) {
                    const rightArrow = createNavigationButton('right', () => handleNavigation('right'));
                    tabsAndArrowsContainer.appendChild(rightArrow);
                }
                // Add pagination indicators using utility function
                updatePaginationIndicators(tabsList, pageSize, currentPage, '.pagination__container');
            };

            if (tabsList.length === 0) {
                displayNoTabsMessage();
            } else {
                renderPage();
            }

            buttons = document.querySelectorAll('button');
            attachEventListeners();
        }
    } catch (error) {
        console.error('Error initialising tabs overlay:', error);
    }
}

function showTabExistsPopup() {
    try {
        createPopup({
            message: 'Tab already exists',
            icon: createMaterialIcon('m', 'warning'),
            timeout: 1750, // The duration of the fade-in animation + 1 second to read the message
            onClose: async () => {
                const scenarioId = getTabsScenarioId(
                    tabsList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < tabsList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.TABS);
            }
        });
    } catch (error) {
        console.error('Error opening tab exists popup:', error.message);
    }
}

function showTabAddedPopup() {
    try {
        createPopup({
            message: 'Tab added successfully',
            icon: createMaterialIcon('m', 'tab_added'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.TABS);
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
            }
        });
    } catch (error) {
        console.error('Error opening settings overlay:', error.message);
    }
}

function showTabDeletedPopup(url) {
    try {
        createPopup({
            message: 'Tab deleted successfully',
            icon: createMaterialIcon('m', 'tab_remove'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('tab-deleteByUrl', url);
            }
        });
    } catch (error) {
        console.error('Error opening settings overlay:', error.message);
    }
}

function showDeleteAllSuccessPopup() {
    try {
        createPopup({
            message: 'All tabs deleted',
            icon: createMaterialIcon('m', 'delete_forever'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.TABS);
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
            }
        });
    } catch (error) {
        console.error('Error opening delete all success popup:', error.message);
    }
}

async function showDeleteAllConfirmationPopup() {
    try {
        // Create buttons
        const confirmBtn = document.createElement('button');
        confirmBtn.setAttribute('id', 'confirmDeleteBtn');
        confirmBtn.classList.add('button', 'popup__btn');
        confirmBtn.textContent = 'Delete All';
        confirmBtn.onclick = () => {
            popupElements.close();
            tabsList = [];
            ipcRenderer.send('tabs-deleteAll');
            showDeleteAllSuccessPopup();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelDeleteBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            popupElements.close();
            requestAnimationFrame(async () => {
                const scenarioId = getTabsScenarioId(
                    tabsList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < tabsList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.TABS);
            });
        };

        const popupElements = createPopup({
            message: 'Delete all tabs?',
            // icon: createMaterialIcon('m', 'delete_forever'),
            classes: ['popup--deleteAllConfirmation'],
            buttons: [confirmBtn, cancelBtn]
        });

        await updateScenarioId(31, buttons, ViewNames.TABS);
    } catch (error) {
        console.error('Error opening delete all confirmation popup:', error.message);
    }
}

async function showItemActionPopup(tab) {
    try {
        // Custom content: snapshot, title, url
        const snapshotContainer = document.createElement('div');
        snapshotContainer.classList.add('popup__snapshotContainer');

        const popupTitle = document.createElement('span');
        popupTitle.classList.add('popup__message', 'popup__message--itemAction');
        popupTitle.textContent = tab.title;
        snapshotContainer.appendChild(popupTitle);

        const urlSpan = document.createElement('span');
        urlSpan.classList.add('popup__url', 'popup__url--itemAction');
        urlSpan.textContent = tab.url;
        snapshotContainer.appendChild(urlSpan);

        if (tab.snapshot) {
            const img = document.createElement('img');
            img.src = tab.snapshot;
            img.alt = 'Tab snapshot';
            img.classList.add('popup__snapshot');
            snapshotContainer.appendChild(img);
        }

        // Buttons
        const visitBtn = document.createElement('button');
        visitBtn.setAttribute('id', 'visitItemBtn');
        visitBtn.classList.add('button', 'popup__btn');
        visitBtn.textContent = 'Visit';
        visitBtn.onclick = () => {
            popupElements.close();
            ipcRenderer.send('url-load', tab.url);
            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.TABS);
            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.setAttribute('id', 'deleteItemBtn');
        deleteBtn.classList.add('button', 'popup__btn');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            popupElements.close();
            showTabDeletedPopup(tab.url);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelItemBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            popupElements.close();
            requestAnimationFrame(async () => {
                const scenarioId = getTabsScenarioId(
                    tabsList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < tabsList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.TABS);
            });
        };

        const popupElements = createPopup({
            name: 'itemAction',
            customContent: snapshotContainer,
            classes: ['popup--itemAction', 'border', 'fadeInUp'],
            buttons: [visitBtn, deleteBtn, cancelBtn]
        });

        await updateScenarioId(32, buttons, ViewNames.TABS);
    } catch (error) {
        console.error('Error opening tab action popup:', error.message);
    }
}

function attachEventListeners() {
    const tabsOverlay = document.getElementById('tabs');
    console.log('Attaching event listeners to tabs overlay:', tabsOverlay);
    if (!tabsOverlay) return;

    // Ensure only one global listener is attached
    if (tabsOverlay.dataset.listenerAttached === 'true') return;
    tabsOverlay.dataset.listenerAttached = 'true';

    tabsOverlay.addEventListener('click', async (event) => {
        try {
            const button = event.target.closest('button');
            if (!button) return;

            const buttonId = button.id;
            addButtonSelectionAnimation(button);

            // Navigation buttons (pagination) should NOT be delayed
            if (['firstArrowKeyBtn', 'secondArrowKeyBtn'].includes(buttonId)) {
                await stopManager();
                // Navigation is handled by their own event listeners in createNavigationButton
                return;
            }

            setTimeout(async () => {
                await stopManager();

                if (buttonId.includes('ItemBtn')) {
                    const idMap = {
                        firstItemBtn: 0,
                        secondItemBtn: 1,
                        thirdItemBtn: 2,
                        fourthItemBtn: 3
                    };
                    const pageIndex = idMap[buttonId];
                    if (pageIndex !== undefined) {
                        const tabIndex = currentPage * pageSize + pageIndex;
                        const tab = tabsList[tabIndex];
                        if (tab) {
                            showItemActionPopup(tab);
                        }
                    }
                }
                if (buttonId === 'cancelBtn') {
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.TABS);
                }
                else if (buttonId === 'addBtn') {
                    // Only adds the tab if the url does not already exist in the tabs array
                    let isAdded = await ipcRenderer.invoke('tab-add');
                    if (!isAdded) {
                        // Creates a pop-up message to indicate that the tab already exists
                        showTabExistsPopup();
                        return;
                    }

                    // Creates a short pop-up message to indicate that the tab has been added then closes the overlay
                    showTabAddedPopup();
                }
                else if (buttonId === 'deleteAllBtn') {
                    showDeleteAllConfirmationPopup();
                }

            }, CssConstants.SELECTION_ANIMATION_DURATION);

        } catch (error) {
            console.error('Error in button click handler:', error);
        }
    });
}