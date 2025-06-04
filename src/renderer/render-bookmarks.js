const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon, createPopup, createNavigationButton, updatePaginationIndicators, paginate } = require('../utils/utilityFunctions');

let buttons = [];
let bookmarksList = [];
const pageSize = 4;     // This is the maximum number of bookmarks that can be displayed at once in a page
let currentPage = 0;    // Current page index

// POSSIBLE CODE DUPLICATION WITH KEYBOARD KEYS!!!!!!!
ipcRenderer.on('bookmarks-loaded', async (event, overlayData, isReload = false) => {
    try {
        ({ bookmarksList } = overlayData);
        buttons = document.querySelectorAll('button');

        /**
         * This is used to update the current page and display the last page of the bookmarks if the current page is the last page
         * 
         * bookmarks.length % pageSize === 0 : This checks if each page has exactly 4 bookmarks (after the deletion of the bookmark).
         * isReload == true : We only want to update the current page if we are reloading the bookmarks overlay.
         * Math.ceil((bookmarks.length + 1)/ pageSize) - 1 : We add 1 to bookmarks.length to identify if the user was on the last 
         * page before the deletion occurred.
         */
        if (bookmarksList.length % pageSize === 0 && isReload && currentPage === Math.ceil((bookmarksList.length + 1) / pageSize) - 1) {
            // Sets currentPage to the new last page.
            currentPage = (bookmarksList.length / pageSize) - 1;
        }

        initialiseBookmarksOverlay();

        // Update pagination indicators if this is a reload
        if (isReload) {
            updatePaginationIndicators();
        }

        // Obtaining the scenarioId based on the number of bookmarks and pagination state
        const scenarioId = getBookmarksScenarioId(
            bookmarksList.length,
            false,
            bookmarksList.length > pageSize
        );
        // Updating the scenarioId for the bookmarks overlay
        await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
    } catch (error) {
        console.error('Error in bookmarks-loaded handler:', error);
    }
});

function getBookmarksScenarioId(bookmarksCount, hasLeftArrow, hasRightArrow) {
    // If there are no bookmarks, return the scenario ID for the empty state
    if (bookmarksCount === 0) return 21;

    const totalPages = Math.ceil(bookmarksCount / pageSize);
    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage === totalPages - 1;
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, bookmarksCount);
    const bookmarksOnPage = end - start;

    const getScenarioId = (bookmarksOnPage, left, right) => {
        // Determine the scenario ID based on the number of bookmarks and arrow visibility
        if (bookmarksOnPage >= 1 && bookmarksOnPage <= 3) {
            // 21–24 (no arrow), 25–28 (left arrow), 29–30 (right arrow)
            return 21 + bookmarksOnPage + ((left || right) ? 4 : 0);
        }
        if (bookmarksOnPage === 4) {
            if (left && right) return 30;
            if (left || right) return 29;
            return 25;
        }
        return 21;
    };

    if (bookmarksCount <= pageSize || isLastPage) {
        return getScenarioId(bookmarksOnPage, hasLeftArrow, hasRightArrow);
    }

    // If there are more than 4 bookmarks, we need to consider pagination
    if (!isFirstPage && !isLastPage) return 30; // both arrows
    if (isFirstPage && hasRightArrow) return 29;
    if (isLastPage && hasLeftArrow) return 29;

    return 25;
}

function initialiseBookmarksOverlay() {
    try {
        const bookmarksAndArrowsContainer = document.getElementById('bookmarksAndArrowsContainer');
        const bookmarksContainer = document.getElementById('bookmarksOnlyContainer');

        if (bookmarksAndArrowsContainer && bookmarksContainer) {
            const displayNoBookmarksMessage = () => {
                bookmarksAndArrowsContainer.innerHTML = ''; // Clears the container

                const noBookmarksMessage = document.createElement('div');
                noBookmarksMessage.classList.add('noBookmarksMessage');
                noBookmarksMessage.innerHTML = 'No bookmarks found :(';

                bookmarksAndArrowsContainer.appendChild(noBookmarksMessage);
            };

            const createBookmark = (bookmark, index) => {
                try {
                    const idSuffix = ['first', 'second', 'third', 'fourth'][index];

                    const bookmarkButton = document.createElement('button');
                    bookmarkButton.setAttribute('id', `${idSuffix}ItemBtn`);
                    bookmarkButton.classList.add('button');

                    const buttonTitle = document.createElement('span');
                    buttonTitle.classList.add('button__title');
                    buttonTitle.textContent = bookmark.title;
                    bookmarkButton.appendChild(buttonTitle);

                    const buttonUrl = document.createElement('span');
                    buttonUrl.classList.add('button__url');
                    buttonUrl.textContent = bookmark.url;
                    bookmarkButton.appendChild(buttonUrl);

                    return bookmarkButton;
                } catch (error) {
                    console.error('Error creating bookmarkButton:', error);
                }
            };

            const handleNavigation = async (direction) => {
                currentPage += direction === 'left' ? -1 : 1;
                await stopManager();
                renderPage();
                requestAnimationFrame(async () => {
                    const scenarioId = getBookmarksScenarioId(
                        bookmarksList.length,
                        currentPage > 0,
                        (currentPage + 1) * pageSize < bookmarksList.length
                    );
                    await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
                });
            };

            const renderPage = () => {
                bookmarksContainer.innerHTML = '';
                bookmarksAndArrowsContainer.innerHTML = '';
                const pageBookmarks = paginate(bookmarksList, pageSize, currentPage);

                // Add left navigation button
                if (currentPage > 0) {
                    const leftArrow = createNavigationButton('left', () => handleNavigation('left'));
                    bookmarksAndArrowsContainer.insertBefore(leftArrow, bookmarksAndArrowsContainer.firstChild);
                }
                // Add bookmarks for the current page
                pageBookmarks.forEach((bookmark, pageIndex) => {
                    const bookmarkElement = createBookmark(bookmark, pageIndex);
                    bookmarksContainer.appendChild(bookmarkElement);
                    bookmarksAndArrowsContainer.appendChild(bookmarksContainer);
                });
                // Add right navigation button
                if ((currentPage + 1) * pageSize < bookmarksList.length) {
                    const rightArrow = createNavigationButton('right', () => handleNavigation('right'));
                    bookmarksAndArrowsContainer.appendChild(rightArrow);
                }
                // Add pagination indicators using utility function
                updatePaginationIndicators(bookmarksList, pageSize, currentPage, '.pagination__container');
            };

            if (bookmarksList.length === 0) {
                displayNoBookmarksMessage();
            } else {
                renderPage();
            }

            buttons = document.querySelectorAll('button');
            attachEventListeners();
        }
    } catch (error) {
        console.error('Error initialising bookmarks overlay:', error);
    }
}

function showBookmarkExistsPopup() {
    try {
        createPopup({
            message: 'Bookmark already exists',
            icon: createMaterialIcon('m', 'warning'),
            timeout: 1750, // The duration of the fade-in animation + 1 second to read the message
            onClose: async () => {
                const scenarioId = getBookmarksScenarioId(
                    bookmarksList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < bookmarksList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
            }
        });
    } catch (error) {
        console.error('Error opening bookmark exists popup:', error.message);
    }
}

function showBookmarkAddedPopup() {
    try {
        createPopup({
            message: 'Bookmark added successfully',
            icon: createMaterialIcon('m', 'bookmark_added'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
            }
        });
    } catch (error) {
        console.error('Error opening settings overlay:', error.message);
    }
}

function showBookmarkDeletedPopup(url) {
    try {
        createPopup({
            message: 'Bookmark deleted successfully',
            icon: createMaterialIcon('m', 'bookmark_remove'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('bookmark-deleteByUrl', url);
            }
        });
    } catch (error) {
        console.error('Error opening settings overlay:', error.message);
    }
}

function showDeleteAllSuccessPopup() {
    try {
        createPopup({
            message: 'All bookmarks deleted',
            icon: createMaterialIcon('m', 'delete_forever'),
            timeout: 1750,
            onClose: () => {
                ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
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
            bookmarksList = [];
            ipcRenderer.send('bookmarks-deleteAll');
            showDeleteAllSuccessPopup();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelDeleteBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            popupElements.close();
            requestAnimationFrame(async () => {
                const scenarioId = getBookmarksScenarioId(
                    bookmarksList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < bookmarksList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
            });
        };

        const popupElements = createPopup({
            message: 'Delete all bookmarks?',
            // icon: createMaterialIcon('m', 'delete_forever'),
            classes: ['popup--deleteAllConfirmation'],
            buttons: [confirmBtn, cancelBtn]
        });

        await updateScenarioId(31, buttons, ViewNames.BOOKMARKS);
    } catch (error) {
        console.error('Error opening delete all confirmation popup:', error.message);
    }
}

async function showItemActionPopup(bookmark) {
    try {
        // Custom content: snapshot, title, url
        const snapshotContainer = document.createElement('div');
        snapshotContainer.classList.add('popup__snapshotContainer');

        const popupTitle = document.createElement('span');
        popupTitle.classList.add('popup__message', 'popup__message--itemAction');
        popupTitle.textContent = bookmark.title;
        snapshotContainer.appendChild(popupTitle);

        const urlSpan = document.createElement('span');
        urlSpan.classList.add('popup__url', 'popup__url--itemAction');
        urlSpan.textContent = bookmark.url;
        snapshotContainer.appendChild(urlSpan);

        if (bookmark.snapshot) {
            const img = document.createElement('img');
            img.src = bookmark.snapshot;
            img.alt = 'Bookmark snapshot';
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
            ipcRenderer.send('url-load', bookmark.url);
            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.setAttribute('id', 'deleteItemBtn');
        deleteBtn.classList.add('button', 'popup__btn');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            popupElements.close();
            showBookmarkDeletedPopup(bookmark.url);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelItemBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            popupElements.close();
            requestAnimationFrame(async () => {
                const scenarioId = getBookmarksScenarioId(
                    bookmarksList.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < bookmarksList.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
            });
        };

        const popupElements = createPopup({
            name: 'itemAction',
            customContent: snapshotContainer,
            classes: ['popup--itemAction', 'border', 'fadeInUp'],
            buttons: [visitBtn, deleteBtn, cancelBtn]
        });

        await updateScenarioId(32, buttons, ViewNames.BOOKMARKS);
    } catch (error) {
        console.error('Error opening bookmark action popup:', error.message);
    }
}

function attachEventListeners() {
    const bookmarksOverlay = document.getElementById('bookmarks');
    console.log('Attaching event listeners to bookmarks overlay:', bookmarksOverlay);
    if (!bookmarksOverlay) return;

    // Ensure only one global listener is attached
    if (bookmarksOverlay.dataset.listenerAttached === 'true') return;
    bookmarksOverlay.dataset.listenerAttached = 'true';

    bookmarksOverlay.addEventListener('click', async (event) => {
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
                        const bookmarkIndex = currentPage * pageSize + pageIndex;
                        const bookmark = bookmarksList[bookmarkIndex];
                        if (bookmark) {
                            showItemActionPopup(bookmark);
                        }
                    }
                }
                if (buttonId === 'cancelBtn') {
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
                }
                else if (buttonId === 'addBtn') {
                    // Only adds the bookmark if the url does not already exist in the bookmarks array
                    let isAdded = await ipcRenderer.invoke('bookmark-add');
                    if (!isAdded) {
                        // Creates a pop-up message to indicate that the bookmark already exists
                        showBookmarkExistsPopup();
                        return;
                    }

                    // Creates a short pop-up message to indicate that the bookmark has been added then closes the overlay
                    showBookmarkAddedPopup();
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