/**
 * Shadow DOM Utilities
 * Provides functions for traversing and interacting with Shadow DOM elements.
 */

/**
 * Gets the shadow root of an element, handling cross-browser differences.
 * Works with both open and closed shadow roots (in Chrome extensions).
 * @param {Element} element - The element to get the shadow root from
 * @returns {ShadowRoot|null} The shadow root or null if none exists
 */
export function getShadowRoot(element) {
  if (!element || element === document) return null;

  // Try standard open shadow root first
  if (element.shadowRoot) {
    return element.shadowRoot;
  }

  // For Chrome extensions, use chrome.dom API for closed shadow roots
  if (typeof BROWSER_TYPE !== 'undefined' && BROWSER_TYPE === 'firefox') {
    return element.openOrClosedShadowRoot || null;
  }

  // Chrome extension context
  if (typeof chrome !== 'undefined' && chrome.dom?.openOrClosedShadowRoot) {
    try {
      return chrome.dom.openOrClosedShadowRoot(element);
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Checks if an element is inside a Shadow DOM.
 * @param {Element} element - The element to check
 * @returns {boolean} True if the element is inside a Shadow DOM
 */
export function isShadowElement(element) {
  if (!element) return false;

  let parent = element.parentNode;
  while (parent) {
    if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE && parent.host) {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}

/**
 * Gets the shadow host chain for an element (from innermost to outermost).
 * @param {Element} element - The target element
 * @returns {Array<{element: Element, shadowHost: Element|null, root: Document|ShadowRoot}>}
 */
export function getElementShadowPath(element) {
  if (!element) return [];

  const path = [];
  let current = element;
  let currentRoot = element.getRootNode();

  // Build path from element to document root
  while (current) {
    const shadowHost =
      currentRoot instanceof ShadowRoot ? currentRoot.host : null;

    path.push({
      element: current,
      shadowHost,
      root: currentRoot,
    });

    if (shadowHost) {
      current = shadowHost;
      currentRoot = shadowHost.getRootNode();
    } else {
      break;
    }
  }

  return path.reverse(); // Return from outermost to innermost
}

/**
 * Gets element(s) at a point, recursively traversing through Shadow DOMs.
 * Skips overlay elements (automa-selector-overlay and automa-element-selector containers).
 * @param {number} clientX - The X coordinate
 * @param {number} clientY - The Y coordinate
 * @param {Document|ShadowRoot} root - The root to start from
 * @param {boolean} skipOverlay - Whether to skip automa overlay elements (default: true)
 * @returns {Array<{element: Element, root: Document|ShadowRoot, depth: number}>}
 */
/**
 * Checks if an element is an automa overlay element that should be skipped.
 * @param {Element} element - The element to check
 * @returns {boolean} True if the element is an automa overlay
 */
function isAutomaOverlay(element) {
  if (!element) return false;

  // Check for overlay ID
  if (element.id === 'automa-selector-overlay') return true;

  // Check for automa container classes
  if (element.classList?.contains('automa-element-selector')) return true;
  if (element.classList?.contains('automa-element-highlighter')) return true;

  // Check for app-container with automa class
  if (
    element.id === 'app-container' &&
    element.classList?.contains('automa-element-selector')
  ) {
    return true;
  }

  return false;
}

export function getDeepElementAtPoint(
  clientX,
  clientY,
  root = document,
  skipOverlay = true
) {
  const elements = [];
  let currentRoot = root;
  let depth = 0;
  const MAX_DEPTH = 20; // Prevent infinite loops in pathological cases
  const visited = new Set(); // Track visited elements to prevent cycles

  while (currentRoot && depth < MAX_DEPTH) {
    let el = null;

    // Use elementsFromPoint to get all elements at this point
    // This allows us to skip overlay elements
    try {
      if (currentRoot.elementsFromPoint) {
        const allElements = currentRoot.elementsFromPoint(clientX, clientY);

        // Find the first non-overlay element
        // Find the first non-overlay element
        el = allElements.find(
          (candidate) => !(skipOverlay && isAutomaOverlay(candidate))
        );
      } else {
        // Fallback for ShadowRoots that might not have elementsFromPoint
        el = currentRoot.elementFromPoint(clientX, clientY);
        if (skipOverlay && el && isAutomaOverlay(el)) {
          el = null;
        }
      }
    } catch (e) {
      console.warn('Error in elementFromPoint:', e);
      break;
    }

    if (!el) break;

    // Check for cycles
    if (visited.has(el)) {
      console.warn('Cycle detected in shadow DOM traversal');
      break;
    }
    visited.add(el);

    elements.push({
      element: el,
      root: currentRoot,
      depth,
      inShadowDom: depth > 0,
    });

    // Check if this element has a shadow root to traverse into
    try {
      const shadowRoot = getShadowRoot(el);
      if (shadowRoot && shadowRoot !== currentRoot) {
        currentRoot = shadowRoot;
        depth += 1;
      } else {
        break;
      }
    } catch (e) {
      console.warn('Error getting shadow root:', e);
      break;
    }
  }

  return elements;
}

/**
 * Gets the deepest element at a point, traversing through all Shadow DOMs.
 * @param {number} clientX - The X coordinate
 * @param {number} clientY - The Y coordinate
 * @param {Document|ShadowRoot} root - The root to start from
 * @returns {{element: Element, path: Array, inShadowDom: boolean}|null}
 */
export function getDeepestElementAtPoint(clientX, clientY, root = document) {
  const elements = getDeepElementAtPoint(clientX, clientY, root);
  if (elements.length === 0) return null;

  const deepest = elements[elements.length - 1];
  return {
    element: deepest.element,
    path: elements,
    inShadowDom: deepest.depth > 0,
  };
}

/**
 * Finds the parent element, crossing shadow boundaries if needed.
 * @param {Element} element - The element to find the parent of
 * @returns {Element|null} The parent element or shadow host
 */
export function findParentOrHost(element) {
  if (!element) return null;

  const parent = element.parentNode;
  if (!parent) return null;

  // If parent is a shadow root, return the host
  if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE && parent.host) {
    return parent.host;
  }

  return parent;
}

/**
 * Collects all elements within a root, including those in shadow DOMs.
 * @param {Document|ShadowRoot} root - The root to collect from
 * @param {string} selector - Optional selector to filter elements
 * @returns {Element[]} Array of all elements
 */
export function collectAllShadowElements(root = document, selector = null) {
  const allElements = [];

  const findAllElements = (nodes) => {
    for (const el of nodes) {
      allElements.push(el);

      const shadowRoot = getShadowRoot(el);
      if (shadowRoot) {
        findAllElements(shadowRoot.querySelectorAll('*'));
      }
    }
  };

  // Check if root itself has a shadow root
  if (root !== document) {
    const rootShadowRoot = getShadowRoot(root);
    if (rootShadowRoot) {
      findAllElements(rootShadowRoot.querySelectorAll('*'));
    }
  }

  findAllElements(root.querySelectorAll('*'));

  return selector
    ? allElements.filter((el) => el.matches(selector))
    : allElements;
}
