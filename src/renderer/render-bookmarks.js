const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');

let buttons = [];
let bookmarks = [];

ipcRenderer.on('mainWindow-loaded', async (event, overlayData) => {
    try {
        ({ bookmarks } = overlayData);

        buttons = document.querySelectorAll('button');

        initialiseBookmarksOverlay();
    } catch (error) {
        console.error('Error in mainWindow-loaded handler:', error);
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
                    bookmarkButton.className = 'bookmark-button';
                    bookmarkButton.textContent = bookmark.title;

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

                buttons = document.querySelectorAll('button');
                attachEventListeners();
            };

            if (bookmarks.length === 0) {
                displayNoBookmarksMessage();
                return;
            }

            renderPage();
        }
    } catch (error) {
        console.error('Error initialising bookmarks overlay:', error);
    }
}

// bookmarkButton.addEventListener('click', () => {
//     ipcRenderer.send('open-bookmark', bookmark.url);
//     stopManager();
// });

// -------------------------------------------

// button.addEventListener('click', async () => {
//     // Update current page based on the direction
//     currentPage += direction === 'left' ? -1 : 1;

//     await stopManager();
//     renderPage();

//     // Waiting for the page to render all the buttons before updating the scenarioId 
//     // (IMP requestAnimationFrame remains in the event loop)
//     requestAnimationFrame(async () => {
//         if (currentPage === 0) {
//             await updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
//         } else if (currentPage === 1) {
//             await updateScenarioId(91, buttons, ViewNames.KEYBOARD_KEYS);
//         } else if (currentPage === 2) {
//             await updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
//         }
//     });
// });

function attachEventListeners() {
    
}
