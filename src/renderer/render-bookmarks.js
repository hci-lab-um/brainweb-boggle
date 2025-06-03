const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon, createPopup } = require('../utils/utilityFunctions');

let buttons = [];
let bookmarks = [];     
const pageSize = 4;     // This is the maximum number of bookmarks that can be displayed at once in a page
let currentPage = 0;    // Current page index

// POSSIBLE CODE DUPLICATION WITH KEYBOARD KEYS!!!!!!!
ipcRenderer.on('bookmarks-loaded', async (event, overlayData, isReload = false) => {
    try {
        ({ bookmarks } = overlayData);
        buttons = document.querySelectorAll('button');

        /**
         * This is used to update the current page and display the last page of the bookmarks if the current page is the last page
         * 
         * bookmarks.length % pageSize === 0 : This checks if each page has exactly 4 bookmarks (after the deletion of the bookmark).
         * isReload == true : We only want to update the current page if we are reloading the bookmarks overlay.
         * Math.ceil((bookmarks.length + 1)/ pageSize) - 1 : We add 1 to bookmarks.length to identify if the user was on the last 
         * page before the deletion occurred.
         */
        if (bookmarks.length % pageSize === 0 && isReload && currentPage === Math.ceil((bookmarks.length + 1)/ pageSize) - 1) {
            // Sets currentPage to the new last page.
            currentPage = (bookmarks.length / pageSize) - 1;
        }

        initialiseBookmarksOverlay();

        // Obtaining the scenarioId based on the number of bookmarks and pagination state
        const scenarioId = getBookmarksScenarioId(
            bookmarks.length,
            false,
            bookmarks.length > pageSize
        );
        // Updating the scenarioId for the bookmarks overlay
        await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
    } catch (error) {
        console.error('Error in bookmarks-loaded handler:', error);
    }
});

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
                    bookmarkButton.setAttribute('id', `${idSuffix}BookmarkBtn`);
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

            const createNavigationButton = (direction) => {
                const button = document.createElement('button');
                button.classList.add('button', 'button__triangle', `button__triangle--${direction}`);

                if (!document.getElementById('firstArrowKeyBtn')) {
                    button.setAttribute('id', 'firstArrowKeyBtn');
                } else if (!document.getElementById('secondArrowKeyBtn')) {
                    button.setAttribute('id', 'secondArrowKeyBtn');
                }

                button.addEventListener('click', async () => {
                    // Update current page based on the direction
                    currentPage += direction === 'left' ? -1 : 1;

                    await stopManager();
                    renderPage();

                    // Waiting for the page to render all the buttons before updating the scenarioId 
                    // (IMP requestAnimationFrame remains in the event loop)
                    requestAnimationFrame(async () => {
                        const scenarioId = getBookmarksScenarioId(
                            bookmarks.length,
                            currentPage > 0, // hasLeftArrow
                            (currentPage + 1) * pageSize < bookmarks.length // hasRightArrow
                        );
                        // Now you can use scenarioId to update scenario, e.g.:
                        await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
                    });
                });
                console.log(`Created ${direction} navigation button with ID: ${button.id}`);
                return button;
            };

            const renderPage = () => {
                const totalPages = Math.ceil(bookmarks.length / pageSize);

                bookmarksContainer.innerHTML = '';
                bookmarksAndArrowsContainer.innerHTML = '';

                // Calculate start and end indices for the current page
                const start = currentPage * pageSize;
                const end = Math.min(start + pageSize, bookmarks.length);

                // Add left navigation button                    
                if (currentPage > 0) {
                    const leftArrow = createNavigationButton('left');
                    bookmarksAndArrowsContainer.insertBefore(leftArrow, bookmarksAndArrowsContainer.firstChild);
                }

                // Add bookmarks for the current page
                for (let i = start; i < end; i++) {
                    const pageIndex = i - start; // Index within the current page
                    const bookmarkElement = createBookmark(bookmarks[i], pageIndex);
                    bookmarksContainer.appendChild(bookmarkElement);
                    bookmarksAndArrowsContainer.appendChild(bookmarksContainer);
                }

                // Add right navigation button                    
                if (end < bookmarks.length) {
                    const rightArrow = createNavigationButton('right');
                    bookmarksAndArrowsContainer.appendChild(rightArrow);
                }

                // Add pagination indicators
                if (bookmarks.length > pageSize) {
                    const paginationContainer = document.querySelector('.pagination__container');
                    paginationContainer.innerHTML = '';

                    for (let i = 0; i < totalPages; i++) {
                        const pageIndicator = document.createElement('div');
                        pageIndicator.classList.add('pagination__indicator');

                        if (i === currentPage) {
                            pageIndicator.classList.add('pagination__indicator--active');
                        }

                        paginationContainer.appendChild(pageIndicator);
                    }
                }
            };

            if (bookmarks.length === 0) {
                displayNoBookmarksMessage();
            }
            else {
                renderPage();
            }

            buttons = document.querySelectorAll('button');
            attachEventListeners();
        }
    } catch (error) {
        console.error('Error initialising bookmarks overlay:', error);
    }
}

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

function showBookmarkExistsPopup() {
    try {
        createPopup({
            message: 'Bookmark already exists',
            icon: createMaterialIcon('m', 'warning'),
            classes: ['border', 'fadeInUp'],
            timeout: 2000
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
            classes: ['border', 'fadeInUp'],
            timeout: 2000,
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
            classes: ['border', 'fadeInUp'],
            timeout: 2000,
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
            classes: ['border', 'fadeInUp'],
            timeout: 2000,
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
            popupElements.overlay.remove();
            popupElements.popup.remove();
            bookmarks = [];
            ipcRenderer.send('bookmarks-deleteAll');
            showDeleteAllSuccessPopup();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelDeleteBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            popupElements.overlay.remove();
            popupElements.popup.remove();
            requestAnimationFrame(async () => {
                const scenarioId = getBookmarksScenarioId(
                    bookmarks.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < bookmarks.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
            });
        };

        const popupElements = createPopup({
            message: 'Delete all bookmarks?',
            // icon: createMaterialIcon('m', 'delete_forever'),
            classes: ['popup--deleteAllConfirmation', 'border', 'fadeInUp'],
            buttons: [confirmBtn, cancelBtn]
        });

        await updateScenarioId(31, buttons, ViewNames.BOOKMARKS);
    } catch (error) {
        console.error('Error opening delete all confirmation popup:', error.message);
    }
}

async function showBookmarkActionPopup(bookmark) {
    try {
        // Custom content: snapshot, title, url
        const snapshotContainer = document.createElement('div');
        snapshotContainer.classList.add('popup__snapshotContainer');

        const popupTitle = document.createElement('span');
        popupTitle.classList.add('popup__message', 'popup__message--bookmarkAction');
        popupTitle.textContent = bookmark.title;
        snapshotContainer.appendChild(popupTitle);

        const urlSpan = document.createElement('span');
        urlSpan.classList.add('popup__url', 'popup__url--bookmarkAction');
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
        visitBtn.setAttribute('id', 'visitBookmarkBtn');
        visitBtn.classList.add('button', 'popup__btn');
        visitBtn.textContent = 'Visit';
        visitBtn.onclick = () => {
            popupElements.overlay.remove();
            popupElements.popup.remove();
            ipcRenderer.send('url-load', bookmark.url);
            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.setAttribute('id', 'deleteBookmarkBtn');
        deleteBtn.classList.add('button', 'popup__btn');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            popupElements.overlay.remove();
            popupElements.popup.remove();
            showBookmarkDeletedPopup(bookmark.url);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('id', 'cancelBookmarkBtn');
        cancelBtn.classList.add('button', 'popup__btn', 'accent');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            popupElements.overlay.remove();
            popupElements.popup.remove();
            requestAnimationFrame(async () => {
                const scenarioId = getBookmarksScenarioId(
                    bookmarks.length,
                    currentPage > 0,
                    (currentPage + 1) * pageSize < bookmarks.length
                );
                await updateScenarioId(scenarioId, buttons, ViewNames.BOOKMARKS);
            });
        };

        const popupElements = createPopup({
            name: 'bookmarkAction',
            customContent: snapshotContainer,
            classes: ['popup--bookmarkAction', 'border', 'fadeInUp'],
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

                if (buttonId.includes('BookmarkBtn')) {
                    const idMap = {
                        firstBookmarkBtn: 0,
                        secondBookmarkBtn: 1,
                        thirdBookmarkBtn: 2,
                        fourthBookmarkBtn: 3
                    };
                    const pageIndex = idMap[buttonId];
                    if (pageIndex !== undefined) {
                        const bookmarkIndex = currentPage * pageSize + pageIndex;
                        const bookmark = bookmarks[bookmarkIndex];
                        if (bookmark) {
                            showBookmarkActionPopup(bookmark);
                        }
                    }
                }
                if (buttonId === 'cancelBtn') {
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
                }
                else if (buttonId === 'addBookmarkBtn') {
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