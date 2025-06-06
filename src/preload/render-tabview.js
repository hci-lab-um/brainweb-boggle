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
        visibleElements.forEach((el, idx) => {
            el.setAttribute('data-boggle-id', idx + 1);
        });
        console.log('visibleElements: ', visibleElements);

        const serializedElements = visibleElements.map(serializeElement); //creating an element object for each element in the array
        ipcRenderer.send('interactiveElements-response', serializedElements);
    } catch (error) {
        console.error('Error in interactiveElements-get handler:', error);
    }
});

ipcRenderer.on('interactiveElements-addHighlight', (event, elements) => {
    try {
        elements.forEach((element) => {
            const elementInDom = document.querySelector(`[data-boggle-id="${element.boggleId}"]`);

            // Store original styles in data attributes if not already stored
            if (!elementInDom.hasAttribute('data-original-bg')) {
                elementInDom.setAttribute('data-original-bg', elementInDom.style.backgroundColor || '');
            }
            if (!elementInDom.hasAttribute('data-original-shadow')) {
                elementInDom.setAttribute('data-original-shadow', elementInDom.style.boxShadow || '');
            }

            elementInDom.style.backgroundColor = 'rgba(183, 255, 0, 0.50)';
            elementInDom.style.boxShadow = 'rgba(0, 0, 0, 0.8) 0px 0px 0px 2px inset';
        });
    } catch (error) {
        console.error('Error in interactiveElements-addHighlight handler:', error);
    }
});

ipcRenderer.on('interactiveElements-removeHighlight', (event) => {
    try {
        const elementsInDom = document.querySelectorAll('[data-boggle-id]');

        elementsInDom.forEach((elementInDom) => {

            // Restore original styles
            elementInDom.style.backgroundColor = elementInDom.getAttribute('data-original-bg') || '';
            elementInDom.style.boxShadow = elementInDom.getAttribute('data-original-shadow') || '';
            // Clean up data attributes
            elementInDom.removeAttribute('data-original-bg');
            elementInDom.removeAttribute('data-original-shadow');
        });
    } catch (error) {
        console.error('Error in interactiveElements-removeHighlight handler:', error);
    }
});

ipcRenderer.on('body-animate-fadeInUp', (event) => {
    stretchBodyFromBottomCenter();
});

function stretchBodyFromBottomCenter(duration = 500) {
    const body = document.body;
    body.style.overflow = 'hidden'; // prevents scrolling during animation

    // Initial transform settings
    body.style.transformOrigin = 'bottom center';
    body.style.transform = 'scale(0, 0)';
    body.style.opacity = '0';

    const fps = 60;
    const interval = 1000 / fps;
    const steps = Math.ceil(duration / interval);

    let currentStep = 0;

    const intervalId = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;

        // Ease-out (cubic)
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        body.style.transform = `scale(${easedProgress}, ${easedProgress})`;
        body.style.opacity = `${easedProgress}`;

        if (currentStep >= steps) {
            clearInterval(intervalId);
            
            // Cleans up styles
            body.style.transform = '';
            body.style.opacity = '';
            body.style.transformOrigin = '';
            body.style.overflow = '';
        }
    }, interval);
}

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
            boggleId: element.getAttribute('data-boggle-id'),
            value: element.value,
            title: element.title,
            tagName: element.tagName,
            type: element.getAttribute('type'),
            role: element.getAttribute('role'),
            x: element.getBoundingClientRect().x,
            y: element.getBoundingClientRect().y,
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
        }
    } catch (error) {
        console.error(`Error serializing element: ${error.message}`);
    }
}