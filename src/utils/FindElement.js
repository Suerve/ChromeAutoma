import Sizzle from 'sizzle';
import {
  querySelectorAllDeep,
  querySelectorDeep,
} from '@/lib/query-selector-shadow-dom';

// Add a custom "Sizzle" pseudo-class selector
// ":contains": element content will be selected as long as it contains text
// ":equal" : element content must be exactly the same as text to be selected
// Example: p.description:equal("cat")
Sizzle.selectors.pseudos.equal = Sizzle.selectors.createPseudo(function (text) {
  return function (elem) {
    const elemText = elem.textContent || elem.innerText || '';
    return elemText.trim() === text;
  };
});

const specialSelectors = [':contains', ':header', ':parent', ':equal'];
const specialSelectorsRegex = new RegExp(specialSelectors.join('|'));

/**
 * Gets the shadow root of an element, handling cross-browser differences.
 * @param {Element} element - The element to get the shadow root from
 * @returns {ShadowRoot|null} The shadow root or null
 */
function getShadowRoot(element) {
  if (!element || element === document) return null;

  if (element.shadowRoot) {
    return element.shadowRoot;
  }

  // For Chrome extensions, use chrome.dom API for closed shadow roots
  if (typeof BROWSER_TYPE !== 'undefined' && BROWSER_TYPE === 'firefox') {
    return element.openOrClosedShadowRoot || null;
  }

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
 * Executes a shadow-piercing selector using >>> syntax.
 * Example: "div.host >>> span.inner >>> button.target"
 *
 * @param {string} selector - The shadow-piercing selector
 * @param {boolean} multiple - Whether to return multiple elements
 * @param {Document|Element} documentCtx - The document context
 * @returns {Element|Element[]|null} The found element(s)
 */
function queryShadowPiercing(
  selector,
  multiple = false,
  documentCtx = document
) {
  // Split by >>> to get each segment
  const parts = selector.split('>>>').map((s) => s.trim());

  if (parts.length === 1) {
    // No shadow piercing, use regular selector
    return multiple
      ? documentCtx.querySelectorAll(parts[0])
      : documentCtx.querySelector(parts[0]);
  }

  let currentRoots = [documentCtx];
  let currentElements = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    const nextElements = [];

    for (const root of currentRoots) {
      try {
        const found = root.querySelectorAll(part);
        nextElements.push(...found);
      } catch (e) {
        console.warn(`Failed to query "${part}" in root:`, e);
      }
    }

    if (nextElements.length === 0) {
      return multiple ? [] : null;
    }

    if (isLast) {
      // Last segment - return the found elements
      currentElements = nextElements;
    } else {
      // Not last - these should be shadow hosts, get their shadow roots
      currentRoots = [];
      for (const el of nextElements) {
        const shadowRoot = getShadowRoot(el);
        if (shadowRoot) {
          currentRoots.push(shadowRoot);
        } else {
          // If no shadow root, treat the element itself as a context
          // This handles cases where >>> is used but element has no shadow
          currentRoots.push(el);
        }
      }

      if (currentRoots.length === 0) {
        return multiple ? [] : null;
      }
    }
  }

  return multiple ? currentElements : currentElements[0] || null;
}

/**
 * Evaluates an XPath expression.
 * @param {string} xpath - The XPath expression
 * @param {boolean} multiple - Whether to return multiple elements
 * @param {Document|Element} context - The context for evaluation
 * @returns {Element|Element[]|null} The found element(s)
 */
function evaluateXPath(xpath, multiple, context = document) {
  const resultType = multiple
    ? XPathResult.ORDERED_NODE_ITERATOR_TYPE
    : XPathResult.FIRST_ORDERED_NODE_TYPE;

  let result = null;
  const ownerDoc = context.ownerDocument || context;

  try {
    const elements = ownerDoc.evaluate(xpath, context, null, resultType, null);

    if (multiple) {
      result = [];
      let element = elements.iterateNext();

      while (element) {
        result.push(element);
        element = elements.iterateNext();
      }
    } else {
      result = elements.singleNodeValue;
    }
  } catch (e) {
    console.warn(`Failed to evaluate XPath "${xpath}":`, e);
    return multiple ? [] : null;
  }

  return result;
}

/**
 * Executes a shadow-piercing XPath using />> syntax.
 * Example: "//div[@class='host'] />> //span[@class='inner']"
 *
 * @param {string} selector - The shadow-piercing XPath
 * @param {boolean} multiple - Whether to return multiple elements
 * @param {Document} documentCtx - The document context
 * @returns {Element|Element[]|null} The found element(s)
 */
function queryShadowPiercingXPath(
  selector,
  multiple = false,
  documentCtx = document
) {
  const parts = selector.split('/>>').map((s) => s.trim());

  if (parts.length === 1) {
    // No shadow piercing, use regular XPath
    return evaluateXPath(parts[0], multiple, documentCtx);
  }

  let currentRoots = [documentCtx];
  let currentElements = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    const nextElements = [];

    for (const root of currentRoots) {
      const found = evaluateXPath(part, true, root);
      if (found) {
        nextElements.push(...found);
      }
    }

    if (nextElements.length === 0) {
      return multiple ? [] : null;
    }

    if (isLast) {
      currentElements = nextElements;
    } else {
      currentRoots = [];
      for (const el of nextElements) {
        const shadowRoot = getShadowRoot(el);
        if (shadowRoot) {
          currentRoots.push(shadowRoot);
        } else {
          currentRoots.push(el);
        }
      }

      if (currentRoots.length === 0) {
        return multiple ? [] : null;
      }
    }
  }

  return multiple ? currentElements : currentElements[0] || null;
}

class FindElement {
  static cssSelector(data, documentCtx = document) {
    const selector = data.markEl
      ? `${data.selector.trim()}:not([${data.blockIdAttr}])`
      : data.selector;

    // Handle shadow-piercing selector (>>>)
    if (selector.includes('>>>')) {
      return queryShadowPiercing(selector, data.multiple, documentCtx);
    }

    if (specialSelectorsRegex.test(selector)) {
      // Fix Sizzle incorrect context in iframe, passed as context of iframe
      const elements = Sizzle(selector, documentCtx);
      if (!elements) return null;

      return data.multiple ? elements : elements[0];
    }

    // Handle >> syntax for deep shadow queries (legacy)
    if (selector.includes('>>')) {
      const newSelector = selector.replaceAll('>>', '');

      return data.multiple
        ? querySelectorAllDeep(newSelector)
        : querySelectorDeep(newSelector);
    }

    if (data.multiple) {
      const elements = documentCtx.querySelectorAll(selector);

      if (elements.length === 0) return null;

      return elements;
    }

    return documentCtx.querySelector(selector);
  }

  static xpath(data, documentCtx = document) {
    // Handle shadow-piercing XPath (/>>)
    if (data.selector.includes('/>>')) {
      return queryShadowPiercingXPath(
        data.selector,
        data.multiple,
        documentCtx
      );
    }

    const resultType = data.multiple
      ? XPathResult.ORDERED_NODE_ITERATOR_TYPE
      : XPathResult.FIRST_ORDERED_NODE_TYPE;

    let result = null;
    const elements = documentCtx.evaluate(
      data.selector,
      documentCtx,
      null,
      resultType,
      null
    );

    if (data.multiple) {
      result = [];
      let element = elements.iterateNext();

      while (element) {
        result.push(element);

        element = elements.iterateNext();
      }
    } else {
      result = elements.singleNodeValue;
    }

    return result;
  }
}

export default FindElement;

// Export helper functions for testing and external use
export { queryShadowPiercing, queryShadowPiercingXPath, getShadowRoot };
