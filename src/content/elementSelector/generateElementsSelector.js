import findSelector from '@/lib/findSelector';
import { generateXPath } from '../utils';
import { getShadowRoot } from './shadowDomUtils';

/**
 * Safely gets a root element for the finder library.
 * The finder library expects an Element, not a ShadowRoot.
 * @param {Document|ShadowRoot|Element} root - The root
 * @returns {Element} A valid root element for finder
 */
function getSafeFinderRoot(root) {
  if (!root) return document.body;

  // If it's the document, use body
  if (root === document) return document.body;

  // If it's a ShadowRoot, we can't use it directly - finder doesn't support ShadowRoot
  // Instead, we'll use null to let finder use default behavior
  if (root instanceof ShadowRoot) {
    return null; // Will cause finder to use default traversal
  }

  // If it's already an Element, use it
  if (root instanceof Element) return root;

  return document.body;
}

/**
 * Generates a CSS selector path through shadow DOM boundaries.
 * Uses >>> syntax to indicate shadow boundary crossing.
 * Example: "div.host >>> span.inner >>> button.target"
 *
 * @param {Element} element - The target element
 * @param {Array} shadowPath - Array of {element, root, depth} from getDeepElementAtPoint
 * @param {Object} selectorOptions - Options for the finder library
 * @returns {string} The shadow-piercing selector
 */
function generateShadowPiercingSelector(element, shadowPath, selectorOptions) {
  try {
    if (!shadowPath || shadowPath.length <= 1) {
      // Not in shadow DOM, use regular selector
      return findSelector(element, selectorOptions);
    }

    const selectorParts = [];

    // Build selector for each shadow boundary
    for (let i = 0; i < shadowPath.length; i += 1) {
      const pathEntry = shadowPath[i];
      const isLast = i === shadowPath.length - 1;

      if (isLast) {
        // For the deepest element, generate its selector
        // Don't pass ShadowRoot as root - finder doesn't support it
        const opts = { ...selectorOptions };
        const safeRoot = getSafeFinderRoot(pathEntry.root);
        if (safeRoot) {
          opts.root = safeRoot;
        }

        try {
          selectorParts.push(findSelector(pathEntry.element, opts));
        } catch (e) {
          // Fallback to tag + classes if finder fails
          const el = pathEntry.element;
          let fallback = el.tagName.toLowerCase();
          if (el.id) fallback = `#${el.id}`;
          else if (el.className && typeof el.className === 'string') {
            fallback += `.${el.className.trim().split(/\s+/).join('.')}`;
          }
          selectorParts.push(fallback);
        }
      } else {
        // For shadow hosts, generate selector relative to their parent context
        const shadowRoot = getShadowRoot(pathEntry.element);
        if (shadowRoot) {
          // This element is a shadow host - include it in the path
          const opts = { ...selectorOptions };
          const safeRoot = getSafeFinderRoot(pathEntry.root);
          if (safeRoot) {
            opts.root = safeRoot;
          }

          try {
            selectorParts.push(findSelector(pathEntry.element, opts));
          } catch (e) {
            // Fallback
            const el = pathEntry.element;
            let fallback = el.tagName.toLowerCase();
            if (el.id) fallback = `#${el.id}`;
            selectorParts.push(fallback);
          }
        }
      }
    }

    // Join with >>> to indicate shadow boundary crossing
    return selectorParts.join(' >>> ');
  } catch (error) {
    console.error('Error generating shadow-piercing selector:', error);
    // Fallback to simple tag selector
    return element.tagName?.toLowerCase() || '*';
  }
}

/**
 * Generates an XPath through shadow DOM boundaries.
 * Note: XPath cannot natively pierce shadow DOM, so we generate a marker format.
 *
 * @param {Element} element - The target element
 * @param {Array} shadowPath - Array of {element, root, depth} from getDeepElementAtPoint
 * @returns {string} The XPath with shadow markers
 */
function generateShadowXPath(element, shadowPath) {
  if (!shadowPath || shadowPath.length <= 1) {
    return generateXPath(element);
  }

  const xpathParts = [];

  for (let i = 0; i < shadowPath.length; i += 1) {
    const pathEntry = shadowPath[i];
    const isLast = i === shadowPath.length - 1;

    if (isLast) {
      // For the deepest element within its shadow root
      xpathParts.push(generateXPath(pathEntry.element, pathEntry.root));
    } else {
      const shadowRoot = getShadowRoot(pathEntry.element);
      if (shadowRoot) {
        // This element is a shadow host
        xpathParts.push(generateXPath(pathEntry.element, pathEntry.root));
      }
    }
  }

  // Use />> as shadow boundary marker for XPath
  return xpathParts.filter(Boolean).join(' />> ');
}

export default function ({
  list,
  target,
  selectorType,
  frameElement,
  hoveredElements,
  selectorSettings,
  shadowPath,
  inShadowDom,
}) {
  let selector = '';

  const selectorOptions = selectorSettings || {};
  const [selectedElement] = hoveredElements;
  const finderOptions = { ...selectorOptions };
  let documentCtx = document;

  if (frameElement) {
    documentCtx = frameElement.contentDocument.body;
    finderOptions.root = documentCtx;
  }

  // Handle shadow DOM elements with >>> syntax
  if (inShadowDom && shadowPath && shadowPath.length > 1) {
    if (list) {
      // For list selection in shadow DOM, we need special handling
      const isInList = target.closest('[automa-el-list]');

      if (isInList) {
        const childSelector = findSelector(target, {
          root: isInList,
          ...selectorOptions,
          idName: () => false,
        });
        const listSelector = isInList.getAttribute('automa-el-list');
        selector = `${listSelector} ${childSelector}`;
      } else {
        // Generate shadow-aware list selector
        const shadowSelector = generateShadowPiercingSelector(
          selectedElement.parentElement,
          shadowPath.slice(0, -1).concat([
            {
              element: selectedElement.parentElement,
              root: shadowPath[shadowPath.length - 1].root,
            },
          ]),
          finderOptions
        );
        selector = `${shadowSelector} > ${selectedElement.tagName.toLowerCase()}`;

        // Mark list elements
        const targetRoot = shadowPath[shadowPath.length - 1].root;
        const prevSelectedList =
          targetRoot.querySelectorAll('[automa-el-list]');
        prevSelectedList.forEach((el) => {
          el.removeAttribute('automa-el-list');
        });

        hoveredElements.forEach((el) => {
          el.setAttribute('automa-el-list', selector);
        });
      }
    } else {
      // Generate shadow-piercing selector
      selector =
        selectorType === 'css'
          ? generateShadowPiercingSelector(
              selectedElement,
              shadowPath,
              finderOptions
            )
          : generateShadowXPath(selectedElement, shadowPath);
    }
  } else if (list) {
    const isInList = target.closest('[automa-el-list]');

    if (isInList) {
      const childSelector = findSelector(target, {
        root: isInList,
        ...selectorOptions,
        idName: () => false,
      });
      const listSelector = isInList.getAttribute('automa-el-list');

      selector = `${listSelector} ${childSelector}`;
    } else {
      const parentSelector = findSelector(
        selectedElement.parentElement,
        finderOptions
      );
      selector = `${parentSelector} > ${selectedElement.tagName.toLowerCase()}`;

      const prevSelectedList = documentCtx.querySelectorAll('[automa-el-list]');
      prevSelectedList.forEach((el) => {
        el.removeAttribute('automa-el-list');
      });

      hoveredElements.forEach((el) => {
        el.setAttribute('automa-el-list', selector);
      });
    }
  } else {
    selector =
      selectorType === 'css'
        ? findSelector(selectedElement, finderOptions)
        : generateXPath(selectedElement);
  }

  return selector;
}

// Export helper functions for external use
export { generateShadowPiercingSelector, generateShadowXPath };
