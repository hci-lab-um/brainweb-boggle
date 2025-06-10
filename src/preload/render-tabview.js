const { ipcRenderer } = require("electron");

ipcRenderer.on('interactiveElements-get', async (event) => {
    try {
        const clickableSelectors = [
            'button', 'a:not([tabindex="-1"])', 'textarea', 'input', 'select', 'date', 'video', 'audio',
            '[role="button"]', '[role="link"]',
            '[role="checkbox"]', '[role="textbox"]', '[role="radio"]', '[role="option"]', '[role="tab"]',
            '[role="menu"]', '[role="switch"]', '[role="slider"]', '[role="combobox"]', '[aria-selected]'
        ];

        const elementIframeMap = new Map(); // Track each element's iframe (or null if top-level)

        // Top-level elements
        let allElements = Array.from(document.querySelectorAll(clickableSelectors.join(', ')));
        for (const el of allElements) {
            elementIframeMap.set(el, null);
        }

        // Handle same-origin iframes
        const iframes = Array.from(document.querySelectorAll('iframe[src]:not([src="about:blank"])'));

        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    const iframeElements = Array.from(iframeDoc.querySelectorAll(clickableSelectors.join(', ')));
                    for (const el of iframeElements) {
                        allElements.push(el);
                        elementIframeMap.set(el, iframe);
                    }
                }
            } catch (err) {
                console.warn('Skipping iframe due to cross-origin restriction:', iframe.src);
            }
        }

        // Filter only visible ones
        const visibleElements = filterVisibleElements(allElements);

        // Add boggle IDs
        visibleElements.forEach((el, idx) => {
            el.setAttribute('data-boggle-id', idx + 1);
        });

        console.log('visibleElements: ', visibleElements);

        const serializedElements = visibleElements.map(el => serializeElement(el, elementIframeMap.get(el)));
        ipcRenderer.send('interactiveElements-response', serializedElements);
    } catch (error) {
        console.error('Error in interactiveElements-get handler:', error);
    }
});

ipcRenderer.on('interactiveElements-addHighlight', (event, elements) => {
    try {
        elements.forEach((element) => {
            let elementInDom = null;

            if (element.inIframe && element.iframeBounds) {
                // Handle iframe elements
                const iframes = Array.from(document.querySelectorAll('iframe[src]:not([src="about:blank"])'));

                // Find iframe matching the coordinates
                const matchingIframe = iframes.find(iframe => {
                    const rect = iframe.getBoundingClientRect();
                    return rect.x === element.iframeBounds.x &&
                           rect.y === element.iframeBounds.y &&
                           rect.width === element.iframeBounds.width &&
                           rect.height === element.iframeBounds.height;
                });

                if (matchingIframe) {
                    try {
                        const iframeDoc = matchingIframe.contentDocument || matchingIframe.contentWindow.document;
                        if (iframeDoc) {
                            elementInDom = iframeDoc.querySelector(`[data-boggle-id="${element.boggleId}"]`);
                        }
                    } catch (err) {
                        console.warn('Cannot access iframe due to cross-origin restriction:', err);
                    }
                }
            } else {
                // Top-level element
                elementInDom = document.querySelector(`[data-boggle-id="${element.boggleId}"]`);
            }

            if (!elementInDom) return;

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
        // Remove highlights from top-level elements
        const elementsInDom = document.querySelectorAll('[data-boggle-id]');
        elementsInDom.forEach((elementInDom) => {
            elementInDom.style.backgroundColor = elementInDom.getAttribute('data-original-bg') || '';
            elementInDom.style.boxShadow = elementInDom.getAttribute('data-original-shadow') || '';
            elementInDom.removeAttribute('data-original-bg');
            elementInDom.removeAttribute('data-original-shadow');
        });

        // Remove highlights from same-origin iframes
        const iframes = Array.from(document.querySelectorAll('iframe[src]:not([src="about:blank"])'));
        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (!iframeDoc) continue;

                const iframeElements = iframeDoc.querySelectorAll('[data-boggle-id]');
                iframeElements.forEach((elementInDom) => {
                    elementInDom.style.backgroundColor = elementInDom.getAttribute('data-original-bg') || '';
                    elementInDom.style.boxShadow = elementInDom.getAttribute('data-original-shadow') || '';
                    elementInDom.removeAttribute('data-original-bg');
                    elementInDom.removeAttribute('data-original-shadow');
                });
            } catch (err) {
                console.warn('Skipping iframe during removeHighlight due to cross-origin restriction:', iframe.src);
            }
        }
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

function serializeElement(element, iframe) {
    try {
        const rect = element.getBoundingClientRect();
        let x = rect.x;
        let y = rect.y;

        let iframeBounds = null;

        if (iframe) {
            const iframeRect = iframe.getBoundingClientRect();
            iframeBounds = {
                x: iframeRect.x,
                y: iframeRect.y,
                width: iframeRect.width,
                height: iframeRect.height
            };

            // Shift x and y relative to the main document
            x += iframeRect.x;
            y += iframeRect.y;
        }

        return {
            id: element.id,
            boggleId: element.getAttribute('data-boggle-id'),
            value: element.value,
            title: element.title,
            tagName: element.tagName,
            type: element.getAttribute('type'),
            role: element.getAttribute('role'),
            x, // adjusted if in iframe
            y,
            width: rect.width,
            height: rect.height,
            inIframe: !!iframe,
            iframeBounds
        };
    } catch (error) {
        console.error(`Error serializing element: ${error.message}`);
        return null;
    }
}
