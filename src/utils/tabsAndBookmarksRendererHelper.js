const { ipcRenderer, View } = require('electron')
const { ViewNames, CssConstants } = require('./constants/enums');
const { updateScenarioId, stopManager } = require('./scenarioManager');
const { addButtonSelectionAnimation } = require('./selectionAnimation');
const { createMaterialIcon, createPopup, createNavigationButton, updatePaginationIndicators, paginate } = require('./utilityFunctions');

let buttons = [];
let itemsList = [];     // This will hold the list of items loaded from the main process
const pageSize = 4;     // This is the maximum number of items that can be displayed at once in a page
let currentPage = 0;    // Current page index
let overlayName;

async function initialise(overlayData, isReload = false, name) {
    try {
        console.log('Initialising items overlay with data:', overlayData, 'isReload:', isReload, 'name:', name);
        overlayName = name;

        if (overlayName === ViewNames.BOOKMARKS) {
            let { bookmarksList } = overlayData;
            itemsList = bookmarksList;
        }
        else if (overlayName === ViewNames.TABS) {
            let { tabsList } = overlayData;
            itemsList = tabsList;
        }

        const activeIndex = itemsList.findIndex(tab => tab.isActive);
        if (activeIndex !== -1) {
            currentPage = Math.floor(activeIndex / pageSize);
        } else {
            currentPage = 0;
        }

        buttons = document.querySelectorAll('button');

        /**
         * This is used to update the current page and display the last page of the items if the current page is the last page
         * 
         * items.length % pageSize === 0 : This checks if each page has exactly 4 items (after the deletion of the item).
         * isReload == true : We only want to update the current page if we are reloading the items overlay.
         * Math.ceil((items.length + 1)/ pageSize) - 1 : We add 1 to items.length to identify if the user was on the last 
         * page before the deletion occurred.
         */
        if (itemsList.length % pageSize === 0 && isReload && currentPage === Math.ceil((itemsList.length + 1) / pageSize) - 1) {
            // Sets currentPage to the new last page.
            currentPage = (itemsList.length / pageSize) - 1;
        }

        initialiseItemsOverlay();

        // Update pagination indicators if this is a reload
        if (isReload) {
            updatePaginationIndicators();
        }

        // Obtaining the scenarioId based on the number of items and pagination state
        const scenarioId = getItemsScenarioId(
            itemsList.length,
            false,
            itemsList.length > pageSize
        );
        // Updating the scenarioId for the overlay
        await updateScenarioId(scenarioId, buttons, overlayName);
    } catch (error) {
        console.error('Error in items-loaded handler:', error);
    }
}

function getItemsScenarioId(itemsCount, hasLeftArrow, hasRightArrow) {
    // If there are no items, return the scenario ID for the empty state
    if (itemsCount === 0) return 21;

    const totalPages = Math.ceil(itemsCount / pageSize);
    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage === totalPages - 1;
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, itemsCount);
    const itemsOnPage = end - start;

    const getScenarioId = (itemsOnPage, left, right) => {
        // Determine the scenario ID based on the number of items and arrow visibility
        if (itemsOnPage >= 1 && itemsOnPage <= 3) {
            // 21–24 (no arrow), 25–28 (left arrow), 29–30 (right arrow)
            return 21 + itemsOnPage + ((left || right) ? 4 : 0);
        }
        if (itemsOnPage === 4) {
            if (left && right) return 30;
            if (left || right) return 29;
            return 25;
        }
        return 21;
    };

    if (itemsCount <= pageSize || isLastPage) {
        return getScenarioId(itemsOnPage, hasLeftArrow, hasRightArrow);
    }

    // If there are more than 4 items, we need to consider pagination
    if (!isFirstPage && !isLastPage) return 30; // both arrows
    if (isFirstPage && hasRightArrow) return 29;
    if (isLastPage && hasLeftArrow) return 29;

    return 25;
}

function initialiseItemsOverlay() {
    try {
        const itemsAndArrowsContainer = document.getElementById('itemsAndArrowsContainer');
        const itemsContainer = document.getElementById('itemsOnlyContainer');

        if (itemsAndArrowsContainer && itemsContainer) {
            const displayNoItemsMessage = () => {
                itemsAndArrowsContainer.innerHTML = ''; // Clears the container

                const noItemsMessage = document.createElement('div');
                noItemsMessage.classList.add('noItemsMessage');

                if (overlayName === ViewNames.BOOKMARKS) {
                    noItemsMessage.innerHTML = 'No bookmarks found :(';
                } else if (overlayName === ViewNames.TABS) {
                    noItemsMessage.innerHTML = 'No tabs found :(';
                }

                itemsAndArrowsContainer.appendChild(noItemsMessage);
            };

            const createItem = (item, index) => {
                try {
                    const idSuffix = ['first', 'second', 'third', 'fourth'][index];

                    const itemButton = document.createElement('button');
                    itemButton.setAttribute('id', `${idSuffix}ItemBtn`);
                    itemButton.classList.add('button');

                    if (overlayName === ViewNames.TABS && item.isActive) {
                        itemButton.classList.add('accent');

                        const labelDiv = document.createElement('div');
                        labelDiv.classList.add('button__label');
                        labelDiv.textContent = 'ACTIVE';
                        itemButton.appendChild(labelDiv);
                    }

                    const buttonTitle = document.createElement('span');
                    buttonTitle.classList.add('button__title');
                    buttonTitle.textContent = item.title;
                    itemButton.appendChild(buttonTitle);

                    const buttonUrl = document.createElement('span');
                    buttonUrl.classList.add('button__url');
                    buttonUrl.textContent = item.url;
                    itemButton.appendChild(buttonUrl);

                    return itemButton;
                } catch (error) {
                    console.error('Error creating itemButton:', error);
                }
            };

            const handleNavigation = async (direction) => {
                currentPage += direction === 'left' ? -1 : 1;

                await stopManager();
                renderPage();

                requestAnimationFrame(async () => {
                    const scenarioId = getItemsScenarioId(
                        itemsList.length,
                        currentPage > 0,
                        (currentPage + 1) * pageSize < itemsList.length
                    );
                    await updateScenarioId(scenarioId, buttons, overlayName);
                });
            };

            const renderPage = () => {
                itemsContainer.innerHTML = '';
                itemsAndArrowsContainer.innerHTML = '';
                const pageItems = paginate(itemsList, pageSize, currentPage);

                // Add left navigation button
                if (currentPage > 0) {
                    const leftArrow = createNavigationButton('left', () => handleNavigation('left'));
                    itemsAndArrowsContainer.insertBefore(leftArrow, itemsAndArrowsContainer.firstChild);
                }
                // Add items for the current page
                pageItems.forEach((item, pageIndex) => {
                    const itemElement = createItem(item, pageIndex);
                    itemsContainer.appendChild(itemElement);
                    itemsAndArrowsContainer.appendChild(itemsContainer);
                });
                // Add right navigation button
                if ((currentPage + 1) * pageSize < itemsList.length) {
                    const rightArrow = createNavigationButton('right', () => handleNavigation('right'));
                    itemsAndArrowsContainer.appendChild(rightArrow);
                }
                // Add pagination indicators using utility function
                updatePaginationIndicators(itemsList, pageSize, currentPage, '.pagination__container');
            };

            if (itemsList.length === 0) {
                displayNoItemsMessage();
            } else {
                renderPage();
            }

            buttons = document.querySelectorAll('button');
            attachEventListeners();
        }
    } catch (error) {
        console.error('Error initialising items overlay:', error);
    }
}

function showBookmarkExistsPopup() {
    try {
        createPopup({
            message: 'Bookmark already exists',
            icon: createMaterialIcon('m', 'warning'),
            timeout: 1750, // The duration of the fade-in animation + 1 second to read the message
            onClose: async () => {
                const scenarioId = getItemsScenarioId(
                    itemsList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < itemsList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
            }
        });
    } catch (error) {
        console.error('Error opening bookmark exists popup:', error.message);
    }
}

function showItemAddedPopup() {
    try {
        createPopup({
            message: overlayName === ViewNames.BOOKMARKS ? 'Bookmark added successfully' : 'Tab added successfully',
            icon: overlayName === ViewNames.BOOKMARKS ? createMaterialIcon('m', 'bookmark_added') : createMaterialIcon('m', 'check'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', overlayName);
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
            }
        });
    } catch (error) {
        console.error('Error opening settings overlay:', error.message);
    }
}

function showItemDeletedPopup(url, tabId) {
    try {
        createPopup({
            message: overlayName === ViewNames.BOOKMARKS ? 'Bookmark deleted successfully' : 'Tab deleted successfully',
            icon: overlayName === ViewNames.BOOKMARKS ? createMaterialIcon('m', 'bookmark_remove') : createMaterialIcon('m', 'tab_close'),
            timeout: 1750,
            onClose: async () => {
                if (overlayName === ViewNames.BOOKMARKS) {
                    ipcRenderer.send('bookmark-deleteByUrl', url);
                } else {
                    ipcRenderer.send('tab-deleteById', tabId);

                    // If there are no tabs left, a new tab is created with the default URL
                    if (itemsList.length - 1 === 0) {
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', overlayName);
                        ipcRenderer.send('overlay-close', ViewNames.MORE);
                        await ipcRenderer.invoke('tab-add');
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error opening settings overlay:', error.message);
    }
}

function showDeleteAllSuccessPopup() {
    try {
        createPopup({
            message: overlayName === ViewNames.BOOKMARKS ? 'All bookmarks deleted' : 'All tabs deleted',
            icon: createMaterialIcon('m', 'delete_forever'),
            timeout: 1750,
            onClose: async () => {
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', overlayName);

                if (overlayName === ViewNames.BOOKMARKS) {
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                }

                if (overlayName === ViewNames.TABS) {
                    ipcRenderer.send('overlay-close', ViewNames.MORE);
                    await ipcRenderer.invoke('tab-add');
                }
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
            addButtonSelectionAnimation(confirmBtn);
            setTimeout(() => {
                popupElements.close();
                itemsList = [];

                if (overlayName === ViewNames.BOOKMARKS) {
                    ipcRenderer.send('bookmarks-deleteAll');
                } else {
                    ipcRenderer.send('tabs-deleteAll');
                }
                showDeleteAllSuccessPopup();
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelDeleteBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            addButtonSelectionAnimation(cancelBtn);
            setTimeout(() => {
                popupElements.close();
                requestAnimationFrame(async () => {
                    const scenarioId = getItemsScenarioId(
                        itemsList.length,
                        currentPage > 0,
                        (currentPage + 1) * pageSize < itemsList.length
                    );
                    await updateScenarioId(scenarioId, buttons, overlayName);
                });

            }, CssConstants.SELECTION_ANIMATION_DURATION);
        };

        const popupElements = createPopup({
            message: overlayName === ViewNames.BOOKMARKS ? 'Delete all bookmarks?' : 'Delete all tabs?',
            classes: ['popup--deleteAllConfirmation'],
            buttons: [confirmBtn, cancelBtn]
        });

        await updateScenarioId(31, buttons, overlayName);
    } catch (error) {
        console.error('Error opening delete all confirmation popup:', error.message);
    }
}

async function showItemActionPopup(item) {
    try {
        // Custom content: snapshot, title, url
        const snapshotContainer = document.createElement('div');
        snapshotContainer.classList.add('popup__snapshotContainer');

        const popupTitle = document.createElement('span');
        popupTitle.classList.add('popup__message', 'popup__message--itemAction');
        popupTitle.textContent = item.title;
        snapshotContainer.appendChild(popupTitle);

        const urlSpan = document.createElement('span');
        urlSpan.classList.add('popup__url', 'popup__url--itemAction');
        urlSpan.textContent = item.url;
        snapshotContainer.appendChild(urlSpan);

        if (item.snapshot) {
            const img = document.createElement('img');
            img.src = item.snapshot;
            img.alt = overlayName === ViewNames.BOOKMARKS ? 'Bookmark snapshot' : 'Tab snapshot';
            img.classList.add('popup__snapshot');
            snapshotContainer.appendChild(img);
        }

        // Buttons
        const visitBtn = document.createElement('button');
        visitBtn.setAttribute('id', 'visitItemBtn');
        visitBtn.classList.add('button', 'popup__btn');
        visitBtn.textContent = 'Visit';
        visitBtn.onclick = () => {
            addButtonSelectionAnimation(visitBtn);
            setTimeout(() => {
                popupElements.close();
                if (overlayName === ViewNames.BOOKMARKS) {
                    ipcRenderer.send('url-load', item.url);
                } else {
                    ipcRenderer.send('tab-visit', item.tabId);
                }
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', overlayName);
                ipcRenderer.send('overlay-close', ViewNames.MORE);
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.setAttribute('id', 'deleteItemBtn');
        deleteBtn.classList.add('button', 'popup__btn');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            addButtonSelectionAnimation(deleteBtn);
            setTimeout(() => {
                popupElements.close();
                showItemDeletedPopup(item.url, item.tabId);
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelItemBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            addButtonSelectionAnimation(cancelBtn);
            setTimeout(() => {
                popupElements.close();
                requestAnimationFrame(async () => {
                    const scenarioId = getItemsScenarioId(
                        itemsList.length,
                        currentPage > 0,
                        (currentPage + 1) * pageSize < itemsList.length
                    );
                    await updateScenarioId(scenarioId, buttons, overlayName);
                });
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        };

        const popupElements = createPopup({
            name: 'itemAction',
            customContent: snapshotContainer,
            classes: ['popup--itemAction', 'border', 'fadeInUp'],
            buttons: [visitBtn, deleteBtn, cancelBtn]
        });

        await updateScenarioId(32, buttons, overlayName);
    } catch (error) {
        console.error('Error opening item action popup:', error.message);
    }
}

function attachEventListeners() {
    const itemsOverlay = document.getElementById('items');
    console.log('Attaching event listeners to items overlay:', itemsOverlay);
    if (!itemsOverlay) return;

    // Ensure only one global listener is attached
    if (itemsOverlay.dataset.listenerAttached === 'true') return;
    itemsOverlay.dataset.listenerAttached = 'true';

    itemsOverlay.addEventListener('click', async (event) => {
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
                        const itemIndex = currentPage * pageSize + pageIndex;
                        const item = itemsList[itemIndex];
                        if (item) {
                            showItemActionPopup(item);
                        }
                    }
                }
                if (buttonId === 'cancelBtn') {
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', overlayName);
                }
                else if (buttonId === 'addBtn') {
                    if (overlayName === ViewNames.BOOKMARKS) {
                        // Only adds the bookmark if the url does not already exist in the items array
                        let isAdded = await ipcRenderer.invoke('bookmark-add');
                        if (!isAdded) {
                            // Creates a pop-up message to indicate that the bookmark already exists
                            showBookmarkExistsPopup();
                            return;
                        }

                        // Creates a short pop-up message to indicate that the item has been added then closes the overlay
                        showItemAddedPopup();
                    } else if (overlayName === ViewNames.TABS) {
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', overlayName);
                        ipcRenderer.send('overlay-close', ViewNames.MORE);
                        await ipcRenderer.invoke('tab-add');
                    }
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

module.exports = {
    initialise
}