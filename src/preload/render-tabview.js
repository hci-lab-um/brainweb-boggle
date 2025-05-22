const { ipcRenderer } = require("electron");

ipcRenderer.on('interactiveElements-get', async (event) => {
    try {
        const clickableSelectors = [
            'button', 'a:not([tabindex="-1"])', 'textarea', 'input', 'select', 'date', 'video', 'audio',
            '[role="button"]', '[role="link"]',
            '[role="checkbox"]', '[role="textbox"]', '[role="radio"]', '[role="option"]', '[role="tab"]',
            '[role="menu"]', '[role="switch"]', '[role="slider"]', '[role="combobox"]', 'iframe[src]:not([src="about:blank"])', '[aria-selected]'
        ];
        const clickableElements = Array.from(document.querySelectorAll(clickableSelectors.join(', ')));
        const visibleElements = filterVisibleElements(clickableElements);
        const serializedElements = visibleElements.map(serializeElement); //creating an element object for each element in the array
        ipcRenderer.send('interactiveElements-response', serializedElements);
    } catch (error) {
        console.error('Error in interactiveElements-get handler:', error);
    }
});


function filterVisibleElements(elements) {
    try {
        return elements.filter(element => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
                style &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                element.offsetWidth > 0 &&
                element.offsetHeight > 0 &&
                //Checking if element is, at least partly, within the viewport
                (
                    rect.x <= (window.innerWidth || document.documentElement.clientWidth) &&
                    rect.x + rect.width >= 0 &&
                    rect.y <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.y + rect.height >= 0

                ) &&
                element.disabled !== true
            );
        });
    } catch (error) {
        console.error(`Error filtering visible elements: ${error.message}`);
    }
}

function serializeElement(element) {
    try {
        return {
            id: element.id,
            title: element.title,
            tagName: element.tagName,
            x: element.getBoundingClientRect().x,
            y: element.getBoundingClientRect().y,
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
        }
    } catch (error) {
        console.error(`Error serializing element: ${error.message}`);
    }
}