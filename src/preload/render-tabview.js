const { ipcRenderer } = require("electron");

ipcRenderer.on('interactiveElements-get', async (event) => {
    try {
        const clickableSelectors = [
            'button', 'a:not([tabindex="-1"])', 'textarea', 'input', 'select', 'date', 'video', 'audio',
            '[role="button"]', '[role="link"]',
            '[role="checkbox"]', '[role="textbox"]', '[role="radio"]', '[role="option"]', '[role="tab"]',
            '[role="menu"]', '[role="switch"]', '[role="slider"]', '[role="combobox"]', '[aria-selected]'
        ];

        let elementIframeMap = new Map(); // Track each element's iframe (or null if top-level)

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

        const serializedElements = visibleElements.map(el => serialiseElement(el, elementIframeMap.get(el)));
        ipcRenderer.send('interactiveElements-response', serializedElements);

        // setInterval(checkAllInteractiveElementPositions, 4000);
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

            if (!elementInDom) {
                console.warn(`Element with boggleId ${element.boggleId} not found in the DOM.`);
                return;
            }

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

ipcRenderer.on('elementsInDom-removeBoggleId', (event) => {
    try {
        // Remove boggle IDs from top-level elements
        const elementsInDom = document.querySelectorAll('[data-boggle-id], [data-scrollable-boggle-id]');
        elementsInDom.forEach((elementInDom) => {
            elementInDom.removeAttribute('data-boggle-id');
            elementInDom.removeAttribute('data-scrollable-boggle-id');
        });

        // Remove boggle IDs from same-origin iframes
        const iframes = Array.from(document.querySelectorAll('iframe[src]:not([src="about:blank"])'));
        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (!iframeDoc) continue;

                const iframeElements = iframeDoc.querySelectorAll('[data-boggle-id], [data-scrollable-boggle-id]');
                iframeElements.forEach((elementInDom) => {
                    elementInDom.removeAttribute('data-boggle-id');
                    elementInDom.removeAttribute('data-scrollable-boggle-id');
                });
            } catch (err) {
                console.warn('Skipping iframe during removeBoggleId due to cross-origin restriction:', iframe.src);
            }
        }
    } catch (error) {
        console.error('Error in elementsInDom-removeBoggleId handler:', error);
    }
});

ipcRenderer.on('scrollableElements-get', async (event) => {
    try {
        const scrollableElements = [];
        let scrollableElementsIframeMap = new Map(); // Track each scrollable element in iframe

        let allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
            scrollableElementsIframeMap.set(el, null);
        }

        const iframes = Array.from(document.querySelectorAll('iframe[src]:not([src="about:blank"])'));

        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    const scrollableIframeElements = Array.from(iframeDoc.querySelectorAll('*'));
                    for (const el of scrollableIframeElements) {
                        allElements.push(el);
                        scrollableElementsIframeMap.set(el, iframe);
                    }
                }
            } catch (err) {
                console.warn('Skipping iframe due to cross-origin restriction:', iframe.src);
            }
        }

        let scrollableId = 1;
        allElements.forEach((element) => {
            const isHtml = element.tagName.toLowerCase() == 'html';
            const isBody = element.tagName.toLowerCase() == 'body';

            const style = window.getComputedStyle(element);
            if (isHtml || isBody) {
                if (element.scrollHeight > element.clientHeight) {
                    // Only adding html to the scrollable elements. If there is no html we add the body as a fallback
                    if (isBody && scrollableElements.some(el => el.tagName.toLowerCase() === 'html')) {
                        return;
                    }
                    else if (isHtml && scrollableElements.some(el => el.tagName.toLowerCase() === 'body')) {
                        scrollableElements.push(element);
                        element.setAttribute('data-scrollable-boggle-id', scrollableId++);
                        scrollableElements = scrollableElements.filter(el => el.tagName.toLowerCase() !== 'body');
                        return;
                    }
                    else {
                        scrollableElements.push(element);
                        element.setAttribute('data-scrollable-boggle-id', scrollableId++);
                    }
                }
            } else
                // Getting any internal element within the page
                if (
                    element.scrollHeight > element.clientHeight &&
                    (style.overflowY === 'scroll' || style.overflowY === 'auto') &&
                    style.overflowY !== 'visible' &&
                    style.visibility !== 'hidden'
                ) {
                    scrollableElements.push(element);
                    element.setAttribute('data-scrollable-boggle-id', scrollableId++);
                }
        });
        console.log('Scrollable Elements:', scrollableElements);

        const visibleScrollableElements = filterVisibleElements(scrollableElements, true);
        const serializedElements = visibleScrollableElements.map(el => serialiseElement(el, scrollableElementsIframeMap.get(el)));
        ipcRenderer.send('scrollableElements-response', serializedElements);
    }
    catch (error) {
        console.error('Error in scrollableElements-get handler:', error);
    }
});

ipcRenderer.on('body-animate-fadeInUp', (event) => {
    stretchBodyFromBottomCenter();
});

ipcRenderer.on('navigate-back', (event) => {
    try {
        console.log('Navigating back');
        window.history.back();
    } catch (error) {
        console.error('Error navigating back:', error);
    }
});

ipcRenderer.on('navigate-forward', (event) => {
    try {
        console.log('Navigating forward');
        window.history.forward();
    } catch (error) {
        console.error('Error navigating forward:', error);
    }
});

ipcRenderer.on('scrollableElement-scroll', (event, { scrollableBoggleId, top, behavior }) => {
    try {
        let domElementToScroll = null;

        // First check top-level elements
        domElementToScroll = document.querySelector(`[data-scrollable-boggle-id="${scrollableBoggleId}"]`);

        // If not found in top-level, check same-origin iframes
        if (!domElementToScroll) {
            const iframes = Array.from(document.querySelectorAll('iframe[src]:not([src="about:blank"])'));

            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) {
                        domElementToScroll = iframeDoc.querySelector(`[data-scrollable-boggle-id="${scrollableBoggleId}"]`);
                        if (domElementToScroll) {
                            break; // Found it, exit the loop
                        }
                    }
                } catch (err) {
                    console.warn('Skipping iframe during scroll due to cross-origin restriction:', iframe.src);
                }
            }
        }

        if (!domElementToScroll) {
            console.warn(`Scrollable element with boggleId ${scrollableBoggleId} not found in the DOM.`);
            return;
        }

        console.log(`Scrolling element ${domElementToScroll} with boggleId ${scrollableBoggleId}`);
        domElementToScroll.scrollBy({ top, behavior });
    } catch (error) {
        console.error('Error in scrollableElement-scroll handler:', error);
    }
});

ipcRenderer.on('videoAudioElement-handle', (event, action, elementBoggleId) => {
    let element = document.querySelector(`[data-boggle-id="${elementBoggleId}"]`);

    if (element) {
        switch (action) {
            case "play-pause":
                console.log(element.paused);
                element.paused = element.paused ? element.play() : element.pause();
                break;
            case "mute-unmute":
                element.muted = !element.muted;
                break;
            case "seek-forward":
                element.currentTime += 10; // Seek forward by 10 seconds
                break;
            case "seek-backward":
                element.currentTime -= 10; // Seek backward by 10 seconds
                break;
        }
    }
});

ipcRenderer.on('rangeElement-setValue', (event, value, elementBoggleId) => {
    let element = document.querySelector(`[data-boggle-id="${elementBoggleId}"]`);

    if (element) {
        element.value = value;
    }
});

// ipcRenderer.on('selectElement-setValue', (event, value, parentElementId) => {
//     let parentElement = document.querySelector(`[data-boggle-id="${parentElementId}"]`) || document.getElementById(parentElementId);

//     if (parentElement) {
//         parentElement.value = value;

//         // Ensure the correct option is selected if setting value alone doesn’t work
//         const optionToSelect = Array.from(parentElement.options).find(opt => opt.value === value);
//         if (optionToSelect) {
//             optionToSelect.selected = true;
//         }

//         // Trigger change event to make sure it's registered
//         parentElement.dispatchEvent(new Event('change', { bubbles: true }));
//     } else {
//         logger.warn(`Parent element with boggleId ${parentElementId} not found in the DOM.`);
//     }
// });

ipcRenderer.on('selectElement-setValue', (event, value, parentElementId) => {
  let parentElement = document.querySelector(`[data-boggle-id="${parentElementId}"]`) 
                   || document.getElementById(parentElementId);

  if (!parentElement) {
    console.warn(`Parent element with boggleId ${parentElementId} not found in the DOM.`);
    return;
  }

  // Handle native <select> elements
  if (parentElement.tagName === 'SELECT') {
    if (parentElement.multiple) {
      // Handle multiple select - value should be an array
      const valuesToSelect = Array.isArray(value) ? value : [value];
      
      // Clear all selections first
      Array.from(parentElement.options).forEach(opt => opt.selected = false);
      
      // Select the specified options
      valuesToSelect.forEach(val => {
        const optionToSelect = Array.from(parentElement.options).find(opt => opt.value === val);
        if (optionToSelect) {
          optionToSelect.selected = true;
        }
      });
    } else {
      // Handle single select
      parentElement.value = value;
      const optionToSelect = Array.from(parentElement.options).find(opt => opt.value === value);
      if (optionToSelect) {
        optionToSelect.selected = true;
      }
    }

    parentElement.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Fallback: Handle ARIA-based combobox/listbox
  const role = parentElement.getAttribute('role');
  if (role === 'listbox' || role === 'combobox') {
    const listboxId = parentElement.getAttribute('aria-controls');
    console.log(`Listbox ID for ${role}: ${listboxId}`);
    const listbox = listboxId ? document.getElementById(listboxId) : null;
    console.log(`Listbox found: ${!!listbox} for ID ${listboxId}`);

    if (!listbox) {
      console.warn(`Listbox with ID ${listboxId} not found for ${role}.`);
      return;
    }

    const options = Array.from(listbox.querySelectorAll('[role="option"]'));
    const isMultipleSelect = listbox.getAttribute('aria-multiselectable') === 'true';

    if (isMultipleSelect) {
      // Handle multiple selection for ARIA listbox
      const valuesToSelect = Array.isArray(value) ? value : [value];
      
      // Clear all selections first
      options.forEach(opt => opt.setAttribute('aria-selected', 'false'));
      
      // Select the specified options
      valuesToSelect.forEach(val => {
        const optionToSelect = options.find(opt => opt.textContent.trim() === val);
        if (optionToSelect) {
          optionToSelect.setAttribute('aria-selected', 'true');
        }
      });

      // For multiple select, update the combobox text to show selected count or values
      const selectedOptions = options.filter(opt => opt.getAttribute('aria-selected') === 'true');
      if (selectedOptions.length > 1) {
        parentElement.textContent = `${selectedOptions.length} items selected`;
      } else if (selectedOptions.length === 1) {
        parentElement.textContent = selectedOptions[0].textContent;
      } else {
        parentElement.textContent = '';
      }
    } else {
      // Handle single selection for ARIA combobox
      const optionToSelect = options.find(opt => opt.textContent.trim() === value);

      if (!optionToSelect) {
        console.warn(`Option with text "${value}" not found in combobox.`);
        return;
      }

      // Clear any previously selected options
      options.forEach(opt => opt.setAttribute('aria-selected', 'false'));

      // Set new selection
      optionToSelect.setAttribute('aria-selected', 'true');
      parentElement.setAttribute('aria-activedescendant', optionToSelect.id);
      parentElement.textContent = optionToSelect.textContent;
    }

    // Dispatch custom event
    parentElement.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    console.warn(`Element with ID ${parentElementId} is neither <select>, ARIA combobox, nor listbox.`);
  }
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

function filterVisibleElements(elements, areElementsScrollable = false) {
    try {
        return elements.filter(element => {
            // if the element is the html or body tag, we always consider it visible, unless it is inside an iframe
            if (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body') {
                if (element.ownerDocument !== document && areElementsScrollable) {
                    element = element.ownerDocument.defaultView.frameElement;
                } else {
                    return true;
                }
            }

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
                && !isElementFullyOccluded(element)
            );
        });
    } catch (error) {
        console.error(`Error filtering visible elements: ${error.message}`);
    }
}

// Returns true if the element is fully occluded (not visible at any point)
function isElementFullyOccluded(element) {
    try {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return true;

        // Sample points: center and four corners (with a small offset to avoid borders)
        let points = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2], // center
            [rect.left + 1, rect.top + 1], // top-left
            [rect.right - 1, rect.top + 1], // top-right
            [rect.left + 1, rect.bottom - 1], // bottom-left
            [rect.right - 1, rect.bottom - 1] // bottom-right
        ];

        // For elements inside iframes, check in the iframe's context
        let doc = element.ownerDocument;
        for (const [x, y] of points) {
            // Skip points outside the viewport
            if (x < 0 || y < 0 || x > (doc.defaultView.innerWidth) || y > (doc.defaultView.innerHeight)) continue;
            const elAtPoint = doc.elementFromPoint(x, y);
            if (elAtPoint === element || element.contains(elAtPoint)) {
                return false; // At least one point is visible
            }
        }
        return true; // All points are occluded
    } catch (error) {
        console.error('Error in isElementFullyOccluded:', error);
        return false;
    }
}

function serialiseElement(element, iframe) {
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
            scrollableBoggleId: element.getAttribute('data-scrollable-boggle-id'),
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
            iframeBounds,
            rangeObject: {
                min: element.getAttribute('min'),
                max: element.getAttribute('max'),
                step: element.getAttribute('step')
            },
            options: element.options ? Array.from(element.options).map(option => {
                return {
                    value: option.value,
                    selected: option.selected,
                    title: option.textContent,
                    parentElementId: element.dataset.boggleId,
                    type: 'option'
                };
            }) : getComboboxOptions(element),
            multiple: element.hasAttribute('multiple') || element.multiple,
        };
    } catch (error) {
        console.error(`Error serializing element: ${error.message}`);
        return null;
    }
}

function getComboboxOptions(comboboxElement) {
    if (!comboboxElement || comboboxElement.getAttribute("role") !== "combobox") return [];

    const listboxId = comboboxElement.getAttribute("aria-controls");
    if (!listboxId) return [];

    const listbox = document.getElementById(listboxId);
    if (!listbox || listbox.getAttribute("role") !== "listbox") return [];

    const options = listbox.querySelectorAll('[role="option"]');
    let optionsObject = Array.from(options).map(option => {
        return {
            value: option.textContent,
            selected: option.getAttribute('aria-selected') === 'true',
            title: option.textContent,
            parentElementId: comboboxElement.dataset.boggleId,
            type: 'option'
        };
    });
    console.log(`!!!!!!!!!!Combobox options for ${comboboxElement.id}:`, optionsObject);
    return optionsObject;
}