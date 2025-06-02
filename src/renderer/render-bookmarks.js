const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon } = require('../utils/utilityFunctions');

let buttons = [];
let bookmarks = [];

ipcRenderer.on('bookmarks-loaded', async (event, overlayData) => {
    try {
        ({ bookmarks } = overlayData);

        buttons = document.querySelectorAll('button');

        initialiseBookmarksOverlay();
        // attachEventListeners();
    } catch (error) {
        console.error('Error in bookmarks-loaded handler:', error);
    }
});

function initialiseBookmarksOverlay() {
    try {
        const bookmarksAndArrowsContainer = document.getElementById('bookmarksAndArrowsContainer');
        const bookmarksContainer = document.getElementById('bookmarksOnlyContainer');

        if (bookmarksAndArrowsContainer && bookmarksContainer) {
            const pageSize = 4;     // The number of bookmarks to display per page
            let currentPage = 0;    // Current page index

            const displayNoBookmarksMessage = () => {
                const noBookmarksMessage = document.createElement('div');
                noBookmarksMessage.classList.add('noBookmarksMessage');
                noBookmarksMessage.innerHTML = 'No bookmarks found';

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
                        // if (currentPage === 0) {
                        //     await updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
                        // } else if (currentPage === 1) {
                        //     await updateScenarioId(91, buttons, ViewNames.KEYBOARD_KEYS);
                        // } else if (currentPage === 2) {
                        //     await updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
                        // }
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

                // if (buttonId.includes('BookmarkBtn')) {
                //     const bookmarkIndex = parseInt(buttonId.charAt(0), 10) - 1; // Extract index from button ID
                //     const bookmark = bookmarks[bookmarkIndex];

                //     if (bookmark) {
                //         await ipcRenderer.invoke('open-bookmark', bookmark.url);
                //     }
                // }
                if (buttonId === 'cancelBtn') {
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
                }
                else if (buttonId === 'addBtn') {
                    ipcRenderer.send('bookmark-add');

                    // Creates a short pop-up message to indicate that the bookmark has been added then closes the overlay
                    try {
                        // Create and display the overlay
                        const overlay = document.createElement("div");
                        overlay.classList.add("overlay");

                        // Create and display the settings popup
                        const popup = document.createElement("div");
                        popup.classList.add("popup", "border", "fadeInUp");

                        const popupMessage = document.createElement("span");
                        popupMessage.classList.add("popup__message");
                        popupMessage.textContent = "Bookmark added successfully";
                        popup.appendChild(popupMessage);

                        popup.innerHTML += createMaterialIcon('m', 'bookmark_added');

                        document.body.appendChild(overlay);
                        document.body.appendChild(popup);

                        setTimeout(() => {
                            overlay.remove();
                            popup.remove();
                            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.BOOKMARKS);
                            ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        }, 2000);
                    } catch (error) {
                        console.error('Error opening settings overlay:', error.message);
                    }
                }

            }, CssConstants.SELECTION_ANIMATION_DURATION);

        } catch (error) {
            console.error('Error in button click handler:', error);
        }
    });
}

