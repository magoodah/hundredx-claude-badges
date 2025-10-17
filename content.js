/**
 * HundredX AI Response Enhancement
 * - Detects AI assistant responses (Claude, Gemini, Perplexity, Meta.ai) and injects HundredX-powered insights
 * - Creates side-by-side experience with matching styling
 * - Uses real HundredX API for commercial query enhancement
 * - Vendor-agnostic architecture using Adapter Pattern
 */
(() => {
  //const API_BASE_URL = 'http://localhost:3000'; // Mock API server
  const API_BASE_URL = 'https://pulse.ngrok.pizza'; // Production API (commented out for testing)
  const LOGO_URL = chrome.runtime.getURL("HundredX+Logo+-+Blue+Registered-640w.webp");

  // ============================================================================
  // VENDOR CONFIGURATIONS
  // ============================================================================

  const VENDOR_CONFIGS = {
    claude: {
      name: 'Claude',
      hostnames: ['claude.ai'],

      selectors: {
        responses: {
          primary: "div[class='grid-cols-1 grid gap-2.5 [&_>_*]:min-w-0 standard-markdown']",
          fallbacks: [
            '[data-cy="message-text"]',
            'article',
            '.prose',
            '.markdown',
            '[data-testid*="message"]'
          ]
        },
        inputs: [
          'textarea[placeholder*="Message"]',
          'textarea[placeholder*="message"]',
          'textarea[data-testid*="input"]',
          'textarea[contenteditable="true"]',
          '.ProseMirror',
          '[data-testid="chat-input"]',
          'textarea',
          'div[contenteditable="true"]'
        ],
        buttons: [
          'button[type="submit"]',
          'button[data-testid*="send"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="send"]',
          '[data-testid="send-button"]'
        ],
        userQueries: [
          '.whitespace-pre-wrap.break-words'
        ]
      },

      timing: {
        processingDelay: 100,
        debounceDelay: 1000,
        minResponseLength: 200
      }
    },

    gemini: {
      name: 'Gemini',
      hostnames: ['gemini.google.com'],

      selectors: {
        responses: {
          primary: 'model-response',
          fallbacks: [
            'message-content.model-response-text',
            '.conversation-container .response-container',
            '.markdown.markdown-main-panel'
          ]
        },
        inputs: [
          'div[contenteditable="true"][role="textbox"]',
          'textarea[placeholder*="prompt"]',
          'textarea[placeholder*="Enter"]',
          '.ql-editor[contenteditable="true"]',
          'div[contenteditable="true"]'
        ],
        buttons: [
          'button[aria-label="Send message"]',
          'button[aria-label*="Send"]',
          'button[type="submit"]'
        ],
        userQueries: [
          'user-query',
          '.user-query-bubble-with-background',
          'user-query-content'
        ]
      },

      timing: {
        processingDelay: 150,  // Angular needs slightly more time
        debounceDelay: 1500,   // More conservative for Angular reactivity
        minResponseLength: 200
      }
    },

    perplexity: {
      name: 'Perplexity',
      hostnames: ['perplexity.ai'],

      selectors: {
        responses: {
          primary: 'div.max-w-threadContentWidth',
          fallbacks: [
            'p.my-2',
            'ul.marker\\:text-quiet',
            'div.prose',
            '.markdown'
          ]
        },
        inputs: [
          '#ask-input',
          'div[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"][id*="input"]',
          'div[contenteditable="true"]'
        ],
        buttons: [
          '[data-testid="submit-button"]',
          'button[aria-label="Submit"]',
          'button[type="submit"]'
        ],
        userQueries: [
          '[data-testid^="thread-title-"]'
        ]
      },

      timing: {
        processingDelay: 100,
        debounceDelay: 1000,
        minResponseLength: 200
      }
    },

    meta: {
      name: 'Meta',
      hostnames: ['meta.ai'],

      selectors: {
        responses: {
          primary: 'div.x78zum5.xdt5ytf.x1na6gtj.xsag5q8.x18yw6bp.xh8yej3',
          fallbacks: [
            // Meta.ai uses obfuscated classes - rely on heuristic instead
            // Removed overly generic selectors that match UI elements
          ]
        },
        inputs: [
          'div[role="textbox"][aria-label*="Ask"]',
          'div[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"]'
        ],
        buttons: [
          'button[aria-label*="Send"]',
          'button[type="submit"]'
        ],
        userQueries: [
          'span.x1lliihq',
          'span[class*="x1lliihq"]'
        ]
      },

      timing: {
        processingDelay: 150,  // React needs slightly more time
        debounceDelay: 1500,   // More conservative for React reactivity
        minResponseLength: 200  // Lowered to catch shorter but valid responses
      }
    }
  };

  // ============================================================================
  // VENDOR ADAPTER CLASSES
  // ============================================================================

  /**
   * Base class for vendor-specific adapters
   * Provides common functionality and defines interface for vendor-specific implementations
   */
  class VendorAdapter {
    constructor(config) {
      this.config = config;
      this.name = config.name;
    }

    /**
     * Find all response containers on the page
     * Uses primary selector first, then falls back to alternatives
     */
    findResponseContainers() {
      debugLog(`Looking for ${this.name} responses...`);
      const responses = new Set();

      // Try primary selector
      const primaryElements = document.querySelectorAll(this.config.selectors.responses.primary);
      debugLog(`Found ${primaryElements.length} elements with primary selector`);

      primaryElements.forEach(element => {
        if (!processedResponses.has(element) && this.validateResponse(element)) {
          const text = element.textContent?.trim();
          if (text && text.length > this.config.timing.minResponseLength) {
            responses.add(element);
            debugLog('✅ Added element from primary selector');
          }
        }
      });

      // Try fallback selectors if needed
      if (responses.size === 0) {
        debugLog('No primary elements found, trying fallback selectors...');
        this.config.selectors.responses.fallbacks.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          debugLog(`Found ${elements.length} elements with selector: ${selector}`);

          elements.forEach(element => {
            if (!processedResponses.has(element) && this.validateResponse(element)) {
              const text = element.textContent?.trim();
              if (text && text.length > this.config.timing.minResponseLength) {
                responses.add(element);
                debugLog(`✅ Added element from fallback selector: ${selector}`);
              }
            }
          });
        });
      }

      debugLog(`Total ${this.name} responses found: ${responses.size}`);
      return Array.from(responses);
    }

    /**
     * Find the chat input field
     */
    findInputField() {
      debugLog(`🔍 Searching for ${this.name} input field...`);
      for (const selector of this.config.selectors.inputs) {
        const element = document.querySelector(selector);
        if (element) {
          debugLog(`✅ Found ${this.name} input field with selector:`, selector);
          debugLog('📝 Input field details:', {
            tagName: element.tagName,
            placeholder: element.placeholder,
            className: element.className,
            id: element.id
          });
          return element;
        }
      }
      debugLog(`❌ No ${this.name} input field found`);
      return null;
    }

    /**
     * Find submit buttons
     */
    findSubmitButtons() {
      const buttons = [];
      for (const selector of this.config.selectors.buttons) {
        const elements = document.querySelectorAll(selector);
        buttons.push(...elements);
      }
      return buttons;
    }

    /**
     * Validate if a response element should be processed
     * Can be overridden by vendor-specific adapters
     */
    validateResponse(element) {
      // Don't process if element is inside or contains our panel
      if (element.closest('.hx-response-panel')) {
        return false;
      }
      if (element.querySelector('.hx-response-panel')) {
        return false;
      }

      // Don't process if element is inside our container (prevents reprocessing after injection)
      if (element.closest('.hx-response-container')) {
        return false;
      }

      return true;
    }

    /**
     * Extract user query from context - MUST be implemented by subclasses
     */
    extractQuery(responseElement) {
      throw new Error(`${this.name}Adapter must implement extractQuery()`);
    }

    /**
     * Inject HundredX panel into DOM - can be overridden for vendor-specific needs
     */
    injectPanel(responseElement, panel) {
      // Default implementation: wrap response and panel in container
      const container = document.createElement('div');
      container.className = 'hx-response-container';
      // Add vendor-specific class for targeted styling
      container.classList.add(`hx-vendor-${this.name.toLowerCase()}`);

      const parent = responseElement.parentNode;
      debugLog(`Injecting panel for ${this.name}, parent:`, parent);
      parent.insertBefore(container, responseElement);
      container.appendChild(responseElement);
      container.appendChild(panel);

      return container;
    }

    /**
     * Get timing configuration
     */
    getTimingConfig() {
      return this.config.timing;
    }
  }

  /**
   * Claude-specific adapter
   */
  class ClaudeAdapter extends VendorAdapter {
    extractQuery(responseElement) {
      debugLog('Attempting to extract query from Claude context');

      // Method 1: Look for user query elements
      const userQueryElements = document.querySelectorAll(this.config.selectors.userQueries.join(', '));
      debugLog('Found user query elements:', userQueryElements.length);

      if (userQueryElements.length > 0) {
        // Get the most recent user query (last one that's not our response)
        for (let i = userQueryElements.length - 1; i >= 0; i--) {
          const element = userQueryElements[i];
          const text = element.textContent?.trim();

          // Make sure this isn't inside our own panel
          if (!element.closest('.hx-response-panel') && text && text.length > 3) {
            debugLog('Found query via method 1:', text);
            return text;
          }
        }
      }

      // Method 2: Walk up from the response to find conversation structure
      debugLog('Trying method 2: walking up DOM tree');
      let currentElement = responseElement;
      let depth = 0;

      while (currentElement && depth < 10) {
        // Look for siblings that might contain user messages
        const siblings = Array.from(currentElement.parentNode?.children || []);
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i];
          const userQuery = sibling.querySelector(this.config.selectors.userQueries.join(', '));
          if (userQuery && userQuery !== responseElement) {
            const text = userQuery.textContent?.trim();
            if (text && text.length > 3) {
              debugLog('Found query via method 2:', text);
              return text;
            }
          }
        }

        currentElement = currentElement.parentNode;
        depth++;
      }

      // Method 3: Just grab the most recent user input from anywhere on the page
      debugLog('Trying method 3: most recent user input');
      const allUserInputs = Array.from(document.querySelectorAll(this.config.selectors.userQueries.join(', ')));

      if (allUserInputs.length > 0) {
        const lastInput = allUserInputs[allUserInputs.length - 1];
        const text = lastInput.textContent?.trim();
        if (text && text.length > 3) {
          debugLog('Found query via method 3:', text);
          return text;
        }
      }

      debugLog('❌ Could not extract query from Claude context');
      return null;
    }
  }

  /**
   * Gemini-specific adapter
   */
  class GeminiAdapter extends VendorAdapter {
    validateResponse(element) {
      // Call parent validation first (includes container checks)
      if (!super.validateResponse(element)) {
        return false;
      }

      // Gemini-specific: avoid inline sources carousel
      if (element.closest('sources-carousel-inline')) {
        debugLog('Skipping Gemini inline sources');
        return false;
      }

      // Verify Gemini custom elements are fully rendered
      if (element.tagName === 'MODEL-RESPONSE') {
        const messageContent = element.querySelector('message-content.model-response-text');
        if (!messageContent) {
          debugLog('Gemini model-response not fully rendered yet');
          return false;
        }

        const markdown = messageContent.querySelector('.markdown');
        if (!markdown) {
          debugLog('Gemini markdown container not ready yet');
          return false;
        }
      }

      return true;
    }

    extractQuery(responseElement) {
      debugLog('Attempting to extract query from Gemini context');

      // Gemini has a clear conversation-container structure
      // Each conversation turn has both user-query and model-response as siblings

      // Method 1: Find the conversation container and get the user-query
      const conversationContainer = responseElement.closest('.conversation-container');
      if (conversationContainer) {
        const userQuery = conversationContainer.querySelector('user-query');
        if (userQuery) {
          const text = userQuery.textContent?.trim();
          if (text && text.length > 3) {
            debugLog('Found Gemini query via conversation-container:', text);
            return text;
          }
        }
      }

      // Method 2: Try to find any user-query element
      const userQuerySelectors = this.config.selectors.userQueries.join(', ');
      const userQueryElements = document.querySelectorAll(userQuerySelectors);

      if (userQueryElements.length > 0) {
        // Get the most recent one
        for (let i = userQueryElements.length - 1; i >= 0; i--) {
          const element = userQueryElements[i];
          const text = element.textContent?.trim();
          if (text && text.length > 3) {
            debugLog('Found Gemini query via user-query element:', text);
            return text;
          }
        }
      }

      debugLog('❌ Could not extract query from Gemini context');
      return null;
    }

    injectPanel(responseElement, panel) {
      // For Gemini, we need to be careful with Angular's custom elements
      // Find the actual model-response element (responseElement might be a child)

      const conversationContainer = responseElement.closest('.conversation-container');
      if (!conversationContainer) {
        debugLog('⚠️ No conversation-container found, using fallback');
        return super.injectPanel(responseElement, panel);
      }

      // Find the model-response element - it might be the responseElement itself or its parent
      let modelResponse = responseElement.closest('model-response') || responseElement;

      // If responseElement is not a model-response or inside one, search for it
      if (modelResponse.tagName !== 'MODEL-RESPONSE') {
        modelResponse = conversationContainer.querySelector('model-response');
        if (!modelResponse) {
          debugLog('⚠️ No model-response found, using fallback');
          return super.injectPanel(responseElement, panel);
        }
      }

      debugLog('Injecting panel into Gemini conversation-container');

      // Create wrapper for side-by-side layout
      const container = document.createElement('div');
      container.className = 'hx-response-container';
      // Add vendor-specific class for targeted styling
      container.classList.add(`hx-vendor-${this.name.toLowerCase()}`);

      // Insert container after model-response
      modelResponse.after(container);

      // Move model-response into container (safe because it's still in same parent context)
      container.appendChild(modelResponse);
      container.appendChild(panel);

      debugLog('✅ Gemini panel injected successfully');
      return container;
    }
  }

  /**
   * Perplexity-specific adapter
   */
  class PerplexityAdapter extends VendorAdapter {
    extractQuery(responseElement) {
      debugLog('Attempting to extract query from Perplexity context');

      // Method 1: Try to find thread title elements (from sidebar or page)
      const threadTitleElements = document.querySelectorAll('[data-testid^="thread-title-"]');
      if (threadTitleElements.length > 0) {
        // Get the most recent/active one (usually the first or last depending on UI)
        for (let i = 0; i < threadTitleElements.length; i++) {
          const element = threadTitleElements[i];
          const text = element.textContent?.trim();
          if (text && text.length > 3 && !element.closest('.hx-response-panel')) {
            debugLog('Found Perplexity query via thread-title:', text);
            return text;
          }
        }
      }

      // Method 2: Look for any query display elements using generic selectors
      const userQuerySelectors = this.config.selectors.userQueries.join(', ');
      const userQueryElements = document.querySelectorAll(userQuerySelectors);

      if (userQueryElements.length > 0) {
        for (let i = userQueryElements.length - 1; i >= 0; i--) {
          const element = userQueryElements[i];
          const text = element.textContent?.trim();
          if (text && text.length > 3 && !element.closest('.hx-response-panel')) {
            debugLog('Found Perplexity query via user query element:', text);
            return text;
          }
        }
      }

      // Method 3: Try to extract from page title or URL
      const pageTitle = document.title;
      if (pageTitle && pageTitle !== 'Perplexity' && pageTitle.length > 3) {
        debugLog('Found Perplexity query via page title:', pageTitle);
        return pageTitle;
      }

      debugLog('❌ Could not extract query from Perplexity context');
      return null;
    }

    validateResponse(element) {
      // Call parent validation first
      if (!super.validateResponse(element)) {
        return false;
      }

      // Perplexity-specific: skip elements that are too small (likely fragments)
      const text = element.textContent?.trim();
      if (!text || text.length < 50) {
        debugLog('Skipping Perplexity element - too short');
        return false;
      }

      // Skip citation elements
      if (element.classList.contains('citation') || element.closest('.citation')) {
        debugLog('Skipping Perplexity citation element');
        return false;
      }

      return true;
    }
  }

  /**
   * Meta.ai-specific adapter
   */
  class MetaAdapter extends VendorAdapter {
    extractQuery(responseElement) {
      debugLog('Attempting to extract query from Meta.ai context');

      // Common UI text patterns to reject
      const uiTextPatterns = [
        /^new chat$/i,
        /^settings$/i,
        /^help$/i,
        /^log\s*in$/i,
        /^sign\s*up$/i,
        /^menu$/i
      ];

      // Method 1: Try to find query in heading/span elements using Meta's class patterns
      const querySpans = document.querySelectorAll(this.config.selectors.userQueries.join(', '));
      if (querySpans.length > 0) {
        // Get the most recent query (usually first visible one)
        for (let i = 0; i < querySpans.length; i++) {
          const element = querySpans[i];
          const text = element.textContent?.trim();

          // Skip UI text
          if (text && uiTextPatterns.some(pattern => pattern.test(text))) {
            continue;
          }

          // Ensure it's a reasonable query length and not part of our panel
          if (text && text.length > 10 && text.length < 500 && !element.closest('.hx-response-panel')) {
            debugLog('Found Meta.ai query via span element:', text);
            return text;
          }
        }
      }

      // Method 2: Look for page title
      const pageTitle = document.title;
      if (pageTitle && pageTitle !== 'Meta AI' && pageTitle.length > 3 && !pageTitle.includes('|')) {
        debugLog('Found Meta.ai query via page title:', pageTitle);
        return pageTitle;
      }

      // Method 3: Walk up from response to find conversation structure
      debugLog('Trying method 3: walking up DOM tree');
      let currentElement = responseElement;
      let depth = 0;

      while (currentElement && depth < 15) {
        // Look for siblings that might contain user query text
        const siblings = Array.from(currentElement.parentNode?.children || []);
        for (const sibling of siblings) {
          // Look for elements with potential query text (not the response itself)
          if (sibling !== responseElement && sibling !== currentElement) {
            const text = sibling.textContent?.trim();
            if (text && text.length > 10 && text.length < 500 &&
                !text.includes('Wegovy and Zepbound are') && // avoid response text
                !sibling.closest('.hx-response-panel')) {
              debugLog('Found Meta.ai query via sibling:', text);
              return text;
            }
          }
        }

        currentElement = currentElement.parentNode;
        depth++;
      }

      debugLog('❌ Could not extract query from Meta.ai context');
      return null;
    }

    validateResponse(element) {
      // Call parent validation first
      if (!super.validateResponse(element)) {
        return false;
      }

      // Meta-specific: skip elements that are too small (likely fragments)
      const text = element.textContent?.trim();
      if (!text || text.length < 200) {
        debugLog('Skipping Meta.ai element - too short (< 200 chars)');
        return false;
      }

      // Check for response-like content (has some punctuation and structure)
      // More lenient than before to handle streaming responses
      const hasPunctuation = /[.!?]/.test(text);
      const hasMultipleWords = text.split(/\s+/).length > 20;

      if (!hasPunctuation || !hasMultipleWords) {
        debugLog('Skipping Meta.ai element - not enough content structure');
        return false;
      }

      // Skip input containers - check if this element contains the contenteditable input
      const hasInput = element.querySelector('div[contenteditable="true"]') ||
                      element.querySelector('textarea[contenteditable="true"]');
      if (hasInput) {
        debugLog('Skipping Meta.ai element - contains input field');
        return false;
      }

      // Skip if this element IS the input or very close to it
      const isInputArea = element.matches('[contenteditable="true"]') ||
                         element.closest('[role="textbox"]') === element;
      if (isInputArea) {
        debugLog('Skipping Meta.ai element - is input area');
        return false;
      }

      // Skip user query displays - they match userQuery selectors
      const userQuerySelectors = this.config.selectors.userQueries.join(', ');
      if (element.matches(userQuerySelectors) || element.querySelector(userQuerySelectors)) {
        // Check if the matching element is the bulk of the content
        const queryEl = element.matches(userQuerySelectors) ? element : element.querySelector(userQuerySelectors);
        const queryTextLength = queryEl?.textContent?.trim().length || 0;
        // If the query element contains most of the text, this is likely a query display
        if (queryTextLength > text.length * 0.7) {
          debugLog('Skipping Meta.ai user query display element');
          return false;
        }
      }

      // Skip containers that include the input area
      // Only skip if the element itself is small (likely the input bar)
      if (element.querySelector('button[aria-label*="Send"]')) {
        // If the element is short, it's probably the input bar itself
        if (text.length < 1000) {
          debugLog('Skipping Meta.ai input/button container');
          return false;
        }
        // If it's long, it might be a valid response that happens to have
        // the input bar as a sibling in a common parent - allow it
      }

      // Skip navigation/sidebar elements
      if (element.closest('[role="navigation"]') || element.closest('nav')) {
        debugLog('Skipping Meta.ai navigation element');
        return false;
      }

      return true;
    }

    injectPanel(responseElement, panel) {
      debugLog('Injecting panel for Meta.ai with alignment fix');

      // Meta.ai structure often includes user query at top of responseElement
      // Check if this element contains a query heading
      const querySpan = responseElement.querySelector(this.config.selectors.userQueries.join(', '));

      if (querySpan) {
        debugLog('Detected user query within response element, finding actual response content');

        // Find the actual response content (usually a sibling after the query)
        // Look for div children that are NOT the query container
        const children = Array.from(responseElement.children);
        const queryParent = querySpan.closest('div');

        // Find first substantial content div that's not the query
        for (const child of children) {
          if (child !== queryParent && child.textContent.length > 100) {
            debugLog('Found actual response content child:', child);

            // Wrap just the response content + panel
            const container = document.createElement('div');
            container.className = 'hx-response-container';
            container.classList.add(`hx-vendor-${this.name.toLowerCase()}`);

            // Insert container before the content child
            child.parentNode.insertBefore(container, child);
            container.appendChild(child);
            container.appendChild(panel);

            debugLog('✅ Meta.ai panel injected aligned with response content');
            return container;
          }
        }
      }

      // Fallback: use default injection if no query detected
      debugLog('No query detected, using standard injection');
      const container = document.createElement('div');
      container.className = 'hx-response-container';
      container.classList.add(`hx-vendor-${this.name.toLowerCase()}`);

      const parent = responseElement.parentNode;
      parent.insertBefore(container, responseElement);
      container.appendChild(responseElement);
      container.appendChild(panel);

      debugLog('✅ Meta.ai panel injected with standard method');
      return container;
    }

    findResponseContainers() {
      debugLog(`Looking for ${this.name} responses...`);
      const responses = new Set();

      // Skip if we're on landing page with no conversation yet
      // Check for presence of actual conversation indicators
      const bodyTextLength = document.body.textContent.length;
      const hasConversation = bodyTextLength > 3000; // Landing page is shorter
      if (!hasConversation) {
        debugLog(`Skipping - appears to be landing page (body text: ${bodyTextLength} chars)`);
        return [];
      }

      // Try base class logic first (primary + fallbacks)
      const baseResponses = super.findResponseContainers();
      baseResponses.forEach(r => responses.add(r));

      if (responses.size > 0) {
        debugLog(`✅ Found ${responses.size} responses using standard selectors`);
        return Array.from(responses);
      }

      // If standard selectors failed, use heuristic approach
      // Meta.ai uses Facebook's obfuscated classes which change frequently
      debugLog('Standard selectors failed, using heuristic approach...');

      const allDivs = document.querySelectorAll('div');
      const candidates = [];

      allDivs.forEach(div => {
        // Skip HundredX extension elements (FAB, panels, etc.)
        if (div.classList.toString().includes('hx-') || div.closest('[class*="hx-"]')) {
          return;
        }

        const text = div.textContent?.trim();
        if (!text || text.length < this.config.timing.minResponseLength) return;

        // Calculate a "response score" based on characteristics
        let score = 0;
        const childDivCount = div.querySelectorAll('div').length;
        const directChildren = div.children.length;

        // Good indicators of a response container:
        if (text.length > 300 && text.length < 15000) score += 2;
        if (childDivCount > 2 && childDivCount < 50) score += 1;
        if (directChildren > 1 && directChildren < 15) score += 1;

        // Has paragraph-like content (punctuation and spacing)
        const hasPunctuation = /[.!?]/.test(text);
        const wordCount = text.split(/\s+/).length;
        if (hasPunctuation && wordCount > 20) score += 2;

        // Not the whole page
        if (childDivCount < 100) score += 1;

        if (score >= 3 && !processedResponses.has(div) && this.validateResponse(div)) {
          candidates.push({ div, score, textLength: text.length });
        }
      });

      // Sort by score (descending), then by text length (descending)
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.textLength - a.textLength;
      });

      // Deduplicate: remove nested elements
      // Keep higher-scoring parents, exclude children that are inside them
      const deduplicated = [];
      for (const candidate of candidates) {
        const isNested = deduplicated.some(existing =>
          existing.div.contains(candidate.div) || candidate.div.contains(existing.div)
        );

        if (!isNested) {
          deduplicated.push(candidate);
        } else {
          debugLog('⏭️ Skipping nested candidate');
        }

        // For Meta.ai, limit to 1 response since it shows one at a time
        // Other vendors might show multiple responses in a conversation view
        const maxResponses = 1;
        if (deduplicated.length >= maxResponses) break;
      }

      // Add deduplicated responses
      deduplicated.forEach(({ div, score, textLength }) => {
        responses.add(div);
        debugLog(`✅ Added element via heuristic (score: ${score}, text length: ${textLength})`);
      });

      debugLog(`Total ${this.name} responses found: ${responses.size}`);
      return Array.from(responses);
    }
  }

  // ============================================================================
  // VENDOR DETECTION & FACTORY
  // ============================================================================

  /**
   * Detect current vendor based on hostname
   */
  function detectCurrentVendor() {
    const hostname = window.location.hostname;
    debugLog('Detecting vendor for hostname:', hostname);

    for (const [key, config] of Object.entries(VENDOR_CONFIGS)) {
      if (config.hostnames.some(h => hostname.includes(h))) {
        debugLog(`✅ Detected vendor: ${config.name}`);
        return key;
      }
    }

    debugLog('❌ Unknown vendor:', hostname);
    return null;
  }

  /**
   * Create the appropriate vendor adapter
   */
  function createVendorAdapter() {
    const vendorKey = detectCurrentVendor();
    if (!vendorKey) {
      debugLog('❌ No vendor adapter available for this site');
      return null;
    }

    const config = VENDOR_CONFIGS[vendorKey];

    switch (vendorKey) {
      case 'claude':
        return new ClaudeAdapter(config);
      case 'gemini':
        return new GeminiAdapter(config);
      case 'perplexity':
        return new PerplexityAdapter(config);
      case 'meta':
        return new MetaAdapter(config);
      default:
        debugLog('⚠️ Unknown vendor key:', vendorKey);
        return null;
    }
  }

  // Initialize vendor adapter
  const vendorAdapter = createVendorAdapter();
  if (!vendorAdapter) {
    console.warn('HundredX: Not running on a supported AI assistant site');
    return; // Exit early if not on supported site
  }
  debugLog(`🚀 Initialized ${vendorAdapter.name} adapter`);

  // Track processed responses to avoid duplicates
  const processedResponses = new WeakSet();

  // Track processed query contexts to prevent duplicate API calls
  const processedQueryContexts = new Set();

  // Cache for API responses to avoid duplicate calls and enable parallel processing
  const queryCache = new Map(); // Map<query, {promise, result, timestamp}>

  // Demo mode state (loaded from chrome.storage)
  let isDemoModeEnabled = false;
  
  // Clean up old contexts and cache periodically to prevent memory buildup
  setInterval(() => {
    if (processedQueryContexts.size > 50) {
      debugLog('🧹 Cleaning up old query contexts');
      processedQueryContexts.clear();
    }
    
    // Clean up cache entries older than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [query, data] of queryCache.entries()) {
      if (data.timestamp < fiveMinutesAgo) {
        queryCache.delete(query);
      }
    }
  }, 60000); // Clean every minute

  // Debug logging
  function debugLog(message, data = null) {
    console.log(`🔍 HundredX DEBUG: ${message}`, data || '');
  }

  // Create unique context identifier for query + response to prevent duplicates
  function createQueryContext(query, responseElement) {
    // Use query + response length + element position as unique identifier
    const responseText = responseElement.textContent?.trim() || '';
    const responseLength = responseText.length;
    const elementId = responseElement.getAttribute('data-testid') || 
                     responseElement.className || 
                     'unknown';
    
    return `${query}|${responseLength}|${elementId}`;
  }

  // Process query immediately when user submits (parallel with Claude)
  async function processQueryEarly(query) {
    debugLog('⚡ Processing query early:', `"${query}"`);
    debugLog('⚡ Query length:', query.length);

    // Check if extension is enabled
    const settings = await api.getSettings();
    if (!settings.extensionEnabled) {
      debugLog('❌ Extension is disabled, skipping early processing');
      return null;
    }

    // Check if already in cache or being processed
    if (queryCache.has(query)) {
      debugLog('🔄 Query already being processed or cached');
      return queryCache.get(query);
    }

    // DEMO MODE INTERCEPT: Check if query matches a demo question
    if (isDemoModeEnabled) {
      debugLog('🎬 Demo mode is enabled, checking for match...');
      debugLog('🔍 Query to match:', `"${query}"`);
      debugLog('🔍 Query length:', query.length);
      debugLog('🔍 Query normalized:', `"${normalizeString(query)}"`);

      const demoQuestion = findDemoQuestion(query);
      if (demoQuestion) {
        debugLog('🎬 Demo mode: Using pre-loaded response for:', demoQuestion.id);

        // Create resolved promise with demo response
        const demoPromise = Promise.resolve(demoQuestion.response);
        const cacheEntry = {
          promise: demoPromise,
          result: demoQuestion.response,
          timestamp: Date.now()
        };

        queryCache.set(query, cacheEntry);
        debugLog('✅ Demo response ready:', demoQuestion.id);
        debugLog('✅ Demo response cached with key:', `"${query}"`);
        debugLog('✅ Cache now has', queryCache.size, 'entries');
        return cacheEntry;
      } else {
        debugLog('🎬 Demo mode active but no match found, falling back to API');
        debugLog('🔍 Available demo questions:');
        if (typeof DEMO_QUESTIONS !== 'undefined') {
          DEMO_QUESTIONS.forEach(q => {
            const similarity = stringSimilarity(query, q.question);
            debugLog(`   - ${q.id}: "${q.question}" (similarity: ${Math.round(similarity * 100)}%)`);
          });
        } else {
          debugLog('❌ DEMO_QUESTIONS not loaded!');
        }
      }
    }

    // Normal flow: Start API call immediately
    const apiPromise = api.processQuery(query);
    const cacheEntry = {
      promise: apiPromise,
      result: null,
      timestamp: Date.now()
    };

    queryCache.set(query, cacheEntry);
    debugLog('✅ Started early API call for query:', query);

    try {
      const result = await apiPromise;
      cacheEntry.result = result;
      debugLog('✅ Early API call completed:', query);
      return cacheEntry;
    } catch (error) {
      debugLog('❌ Early API call failed:', error);
      cacheEntry.result = {
        success: false,
        _errorType: 'generic',
        error: error.message,
        _retryable: true
      };
      return cacheEntry;
    }
  }

  // API client with enhanced error handling
  class HundredXAPI {
    constructor() {
      this.timeout = 1200000; // 20 minute timeout (API can take 15+ minutes)
      this.maxRetries = 2;
      this.defaultSettings = {
        extensionEnabled: true,
        template_id: '3_tier_consumer_friendly_locked_v3', // API default
        enable_web_search: false
      };
    }

    // Get user settings from Chrome storage
    async getSettings() {
      try {
        const result = await chrome.storage.sync.get(['hxSettings']);
        return result.hxSettings || this.defaultSettings;
      } catch (error) {
        debugLog('⚠️ Error loading settings, using defaults:', error);
        return this.defaultSettings;
      }
    }

    async processQuery(query, retryCount = 0) {
      const apiUrl = `${API_BASE_URL}/api/answer`;
      debugLog(`🌐 API CALL: ${apiUrl}`, query, `(attempt ${retryCount + 1})`);

      try {
        // Load user settings from storage
        const settings = await this.getSettings();
        debugLog('📋 Using settings:', settings);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // Prepare request body with settings (backward compatible)
        const requestBody = {
          query,
          template_id: settings.template_id || settings.narrativeStyle || this.defaultSettings.template_id,
          enable_web_search: settings.enable_web_search !== undefined
            ? settings.enable_web_search
            : (settings.webSearchEnabled !== undefined ? settings.webSearchEnabled : this.defaultSettings.enable_web_search)
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        debugLog(`📡 API RESPONSE: Status ${response.status} from ${response.url}`);

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status >= 500) {
            throw new Error('SERVER_ERROR');
          } else if (response.status === 404) {
            throw new Error('ENDPOINT_NOT_FOUND');
          } else {
            throw new Error(`HTTP_${response.status}`);
          }
        }

        const result = await response.json();
        debugLog('✅ API RESPONSE DATA:', result);
        debugLog('🔍 Data Source Check:', result.answer?.includes('[HX]') ? 'LIVE API' : 'POSSIBLE MOCK');
        return { ...result, _errorType: null };

      } catch (error) {
        debugLog('API call failed:', error);
        
        // Determine error type for better user messaging
        let errorType = 'generic';
        let errorMessage = error.message;

        if (error.name === 'AbortError') {
          errorType = 'timeout';
          errorMessage = 'Request timed out';
        } else if (error.message === 'SERVER_ERROR') {
          errorType = 'server';
          errorMessage = 'Server error occurred';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorType = 'network';
          errorMessage = 'Network connection failed';
        }

        // Retry logic for certain error types
        if ((errorType === 'timeout' || errorType === 'network') && retryCount < this.maxRetries) {
          debugLog(`Retrying API call (${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return this.processQuery(query, retryCount + 1);
        }

        return {
          answer: this.getErrorMessage(errorType),
          sources: [],
          metadata: { error: errorMessage, errorType },
          success: false,
          error: errorMessage,
          _errorType: errorType,
          _retryable: errorType === 'timeout' || errorType === 'network' || errorType === 'server'
        };
      }
    }

    getErrorMessage(errorType) {
      const messages = {
        'network': 'Unable to connect to HundredX insights. Please check your internet connection.',
        'timeout': 'HundredX insights are taking longer than expected to load.',
        'server': 'HundredX service is temporarily unavailable. Please try again in a moment.',
        'generic': 'Unable to load HundredX insights at this time.'
      };
      return messages[errorType] || messages.generic;
    }

    async healthCheck() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
      } catch {
        return false;
      }
    }
  }

  const api = new HundredXAPI();

  // Global references for retry functionality
  let currentQuery = null;
  let currentPanel = null;

  // Global retry/dismiss functions (defined once, used by all panels)
  window.hxRetry = async () => {
    if (!currentPanel || !currentQuery) {
      debugLog('❌ No panel or query available for retry');
      return;
    }

    debugLog('🔄 Retrying HundredX API call');
    const retryButton = currentPanel.querySelector('.hx-retry-button');
    const statusIndicator = currentPanel.querySelector('.hx-status-indicator');
    
    if (retryButton) {
      retryButton.classList.add('loading');
      retryButton.innerHTML = '<span class="hx-spinner"></span> Retrying...';
    }
    
    if (statusIndicator) {
      statusIndicator.className = 'hx-status-indicator loading';
    }
    
    // Progressive Disclosure: Show loading text again during retry
    const contentDiv = currentPanel.querySelector('.hx-response-content');
    const headerLoading = currentPanel.querySelector('.hx-header-loading');
    
    contentDiv.innerHTML = '';
    if (headerLoading) {
      headerLoading.style.display = 'flex';
    }
    
    // Function to update panel content based on API response
    const updatePanelContent = (panel, apiResponse) => {
      const contentDiv = panel.querySelector('.hx-response-content');
      const statusIndicator = panel.querySelector('.hx-status-indicator');
      const headerLoading = panel.querySelector('.hx-header-loading');
      
      // Progressive Disclosure: Hide loading text, keep status dot
      if (headerLoading) {
        headerLoading.style.display = 'none';
      }
      
      if (apiResponse.success && !apiResponse._errorType) {
        // Success case
        contentDiv.innerHTML = formatHundredXContent(apiResponse);
        if (statusIndicator) {
          statusIndicator.className = 'hx-status-indicator';
        }
        debugLog('✅ HundredX panel updated with success content');
      } else {
        // Error case  
        const errorType = apiResponse._errorType || 'generic';
        const retryable = apiResponse._retryable || false;
        
        contentDiv.innerHTML = createErrorContent(errorType, apiResponse.error, retryable);
        if (statusIndicator) {
          statusIndicator.className = 'hx-status-indicator error';
        }
        debugLog('❌ HundredX panel updated with error content:', errorType);
      }
      
      // Trigger content animation
      setTimeout(() => {
        panel.classList.add('hx-content-loaded');
        debugLog('🎬 Content animation triggered');
      }, 300);
    };
    
    // Make API call
    try {
      const apiResponse = await api.processQuery(currentQuery);
      updatePanelContent(currentPanel, apiResponse);
    } catch (error) {
      debugLog('❌ Retry failed:', error);
      updatePanelContent(currentPanel, {
        success: false,
        _errorType: 'generic',
        error: 'Retry failed: ' + error.message,
        _retryable: true
      });
    }
  };
  
  window.hxDismiss = () => {
    if (!currentPanel) {
      debugLog('❌ No panel available for dismiss');
      return;
    }

    debugLog('❌ Dismissing HundredX panel');
    const container = currentPanel.closest('.hx-response-container');
    if (container) {
      container.style.opacity = '0';
      container.style.transform = 'translateY(-10px)';
      setTimeout(() => container.remove(), 300);
    }
  };

  // Function to update panel content based on API response
  function updatePanelContent(panel, apiResponse) {
    const contentDiv = panel.querySelector('.hx-response-content');
    const statusIndicator = panel.querySelector('.hx-status-indicator');
    const headerLoading = panel.querySelector('.hx-header-loading');
    
    // Progressive Disclosure: Hide loading text, keep status dot
    if (headerLoading) {
      headerLoading.style.display = 'none';
    }
    
    if (apiResponse.success && !apiResponse._errorType) {
      // Success case
      contentDiv.innerHTML = formatHundredXContent(apiResponse);
      if (statusIndicator) {
        statusIndicator.className = 'hx-status-indicator';
      }
      debugLog('✅ HundredX panel updated with success content');
    } else {
      // Error case  
      const errorType = apiResponse._errorType || 'generic';
      const retryable = apiResponse._retryable || false;
      
      contentDiv.innerHTML = createErrorContent(errorType, apiResponse.error, retryable);
      if (statusIndicator) {
        statusIndicator.className = 'hx-status-indicator error';
      }
      debugLog('❌ HundredX panel updated with error content:', errorType);
    }
    
    // Trigger content animation
    setTimeout(() => {
      panel.classList.add('hx-content-loaded');
      debugLog('🎬 Content animation triggered');
    }, 300);
  }

  // Extract query using vendor adapter
  function extractQueryFromContext(responseElement) {
    if (!vendorAdapter) {
      debugLog('❌ No vendor adapter available');
      return null;
    }
    return vendorAdapter.extractQuery(responseElement);
  }

  // Create simple loading content
  function createLoadingContent() {
    debugLog('🔄 Creating simple loading content');
    const loadingHTML = `
      <div class="hx-loading-container">
        <div class="hx-spinner"></div>
        <div class="hx-loading-text">Loading HundredX insights...</div>
      </div>
    `;
    debugLog('✅ Loading HTML created:', loadingHTML.length + ' characters');
    return loadingHTML;
  }

  // Create enhanced error content
  function createErrorContent(errorType, message, retryCallback = null) {
    const errorMessages = {
      'network': {
        title: 'Connection Issue',
        message: 'Unable to reach HundredX insights. Check your connection and try again.',
        icon: '🌐'
      },
      'timeout': {
        title: 'Request Timeout',
        message: 'HundredX is taking longer than usual to respond. Please try again.',
        icon: '⏱️'
      },
      'server': {
        title: 'Service Unavailable',
        message: 'HundredX insights are temporarily unavailable. We\'ll be back shortly.',
        icon: '🔧'
      },
      'generic': {
        title: 'Something went wrong',
        message: message || 'Unable to load HundredX insights at this time.',
        icon: '⚠️'
      }
    };

    const error = errorMessages[errorType] || errorMessages.generic;
    
    return `
      <div class="hx-error-container">
        <span class="hx-error-icon">${error.icon}</span>
        <div class="hx-error-title">${error.title}</div>
        <div class="hx-error-message">${error.message}</div>
        <div class="hx-error-actions">
          ${retryCallback ? `
            <button class="hx-retry-button" onclick="window.hxRetry()">
              <span class="retry-text">Try Again</span>
            </button>
          ` : ''}
          <button class="hx-dismiss-button" onclick="window.hxDismiss()">
            Dismiss
          </button>
        </div>
      </div>
    `;
  }

  // Create HundredX response panel
  function createHundredXPanel() {
    debugLog('Creating HundredX panel');
    const panel = document.createElement('div');
    panel.className = 'hx-response-panel';
    
    const header = document.createElement('div');
    header.className = 'hx-response-header';
    
    const title = document.createElement('h4');
    title.className = 'hx-response-title';
    title.innerHTML = '<img src="' + LOGO_URL + '" alt="HundredX" style="height: 14px; vertical-align: baseline; margin-left: 4px; display: inline-block; position: relative; top: 1px;">';
    title.style.whiteSpace = 'nowrap';
    
    // Create grouped status area (loading + status dot)
    const statusArea = document.createElement('div');
    statusArea.className = 'hx-status-area';
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'hx-header-loading';
    loadingIndicator.innerHTML = `
      <div class="hx-header-spinner"></div>
      <span class="hx-header-loading-text">Loading insights...</span>
    `;
    
    // Create status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'hx-status-indicator loading';
    
    statusArea.appendChild(loadingIndicator);
    statusArea.appendChild(statusIndicator);
    
    header.appendChild(title);
    header.appendChild(statusArea);
    
    const content = document.createElement('div');
    content.className = 'hx-response-content';
    // Start with empty content - loading indicator is now in header
    content.innerHTML = '';
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    debugLog('🎯 Header loading indicator added to panel');
    debugLog('🎯 Panel classes:', panel.className);
    debugLog('📍 Panel parent:', panel.parentElement ? 'has parent' : 'no parent yet');
    debugLog('HundredX panel created with header loading indicator');
    return panel;
  }

  // Format HundredX response content using Marked.js
  function formatHundredXContent(apiResponse) {
    debugLog('Formatting HundredX content with Marked.js:', apiResponse);
    
    if (!apiResponse.success) {
      return `<div class="hx-response-error">
        ${apiResponse.answer}
      </div>`;
    }

    if (!apiResponse.metadata.enriched) {
      return `<div style="color: #64748b; font-style: italic; padding: 8px;">
        ${apiResponse.answer}
      </div>`;
    }

    // First, handle HX attribution tags before markdown processing
    let contentWithHXTags = apiResponse.answer
      .replace(/\*\*\[HX\]\*\*/g, '<span class="hx-attribution">[HX]</span>');

    // Use Marked.js to convert markdown to HTML
    let formattedContent;
    try {
      // Configure marked for safe rendering
      marked.setOptions({
        breaks: true,        // Convert line breaks to <br>
        gfm: true,          // GitHub flavored markdown
        sanitize: false,    // We trust our API content
        smartLists: true,   // Use smarter list behavior
        smartypants: false  // Don't convert quotes/dashes
      });

      // Custom renderer to open links in new tab
      marked.use({
        renderer: {
          link({href, title, text}) {
            const titleAttr = title ? ` title="${title}"` : '';
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
          }
        }
      });

      formattedContent = marked.parse(contentWithHXTags);
      debugLog('✅ Markdown converted successfully with Marked.js');
    } catch (error) {
      debugLog('❌ Marked.js error, falling back to plain text:', error);
      // Fallback to simple HTML escaping if Marked fails
      formattedContent = `<p>${contentWithHXTags.replace(/\n/g, '<br>')}</p>`;
    }

    // Add sources if available and not already included in answer
    let sourcesContent = '';
    const hasSourceInAnswer = formattedContent.toLowerCase().includes('source:');
    const hasValidSource = apiResponse.sources && 
                          apiResponse.sources.length > 0 && 
                          !apiResponse.sources[0].description.includes('0 customer feedback responses');
    
    if (hasValidSource && !hasSourceInAnswer) {
      sourcesContent = `
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(0, 138, 209, 0.1);">
          <p style="font-size: 12px; color: #64748b; margin: 4px 0;">
            <strong>Source:</strong> ${apiResponse.sources[0].description} (${apiResponse.sources[0].time_period || 'Recent data'})
          </p>
        </div>
      `;
    }

    return formattedContent + sourcesContent;
  }

  // Check if this is a substantial response (not just a preparatory message)
  function isSubstantialResponse(responseElement) {
    const text = responseElement.textContent?.trim();
    if (!text || text.length < 100) return false;

    // Skip preparatory messages like "I'll search for..." or "Let me..."
    const preparatoryPhrases = [
      /^I'll search for/i,
      /^Let me search/i,
      /^I'll look for/i,
      /^Let me look/i,
      /^I should search/i,
      /^Let me structure/i,
      /^I'll gather/i,
      /^Let me gather/i
    ];

    for (const phrase of preparatoryPhrases) {
      if (phrase.test(text)) {
        debugLog('❌ Skipping preparatory message:', text.substring(0, 50) + '...');
        return false;
      }
    }

    // Much more lenient substantiality check - if it's long enough and not preparatory, it's substantial
    const isSubstantial = text.length >= 200; // Simple length check
    
    debugLog('Response substantiality check:', {
      length: text.length,
      isSubstantial
    });

    return isSubstantial;
  }

  // Process an AI response and add HundredX panel (vendor-agnostic)
  async function processResponse(responseElement) {
    if (!vendorAdapter) {
      debugLog('❌ No vendor adapter available');
      return;
    }

    debugLog(`Processing ${vendorAdapter.name} response:`, responseElement);

    // Check if extension is enabled
    const settings = await api.getSettings();
    if (!settings.extensionEnabled) {
      debugLog('❌ Extension is disabled, skipping processing');
      return;
    }

    if (processedResponses.has(responseElement)) {
      debugLog('❌ Response already processed, skipping', {
        elementTag: responseElement.tagName,
        textPreview: responseElement.textContent?.trim().substring(0, 100)
      });
      return;
    }
    processedResponses.add(responseElement);
    debugLog('✅ Response marked as processed', {
      elementTag: responseElement.tagName,
      textPreview: responseElement.textContent?.trim().substring(0, 100)
    });

    // Check if this is a substantial response worth augmenting
    if (!isSubstantialResponse(responseElement)) {
      debugLog('❌ Response not substantial enough, skipping');
      return;
    }

    // Extract the user query using vendor adapter
    const query = extractQueryFromContext(responseElement);
    if (!query) {
      debugLog('❌ Could not extract query from context');
      return;
    }

    debugLog('✅ Extracted query:', `"${query}"`);
    debugLog('✅ Extracted query length:', query.length);

    // Create unique context to prevent duplicate panels for same query+response
    const queryContext = createQueryContext(query, responseElement);
    if (processedQueryContexts.has(queryContext)) {
      debugLog('❌ Query context already processed, skipping panel creation:', queryContext);
      return;
    }
    processedQueryContexts.add(queryContext);
    debugLog('✅ New query context, creating panel:', queryContext);

    // Create HundredX panel
    const hxPanel = createHundredXPanel();

    // Inject panel using vendor-specific strategy
    const container = vendorAdapter.injectPanel(responseElement, hxPanel);

    debugLog(`🔴 PANEL ADDED TO ${vendorAdapter.name} DOM - should be visible now!`);
    debugLog('🔴 Container parent:', container?.parentElement ? 'has parent' : 'no parent');
    debugLog('🔴 Panel parent:', hxPanel.parentElement ? 'has parent' : 'no parent');
    debugLog('🔴 Panel in DOM:', document.contains(hxPanel) ? 'YES' : 'NO');

    // Trigger entrance animation
    requestAnimationFrame(() => {
      hxPanel.classList.add('hx-animate-in');
      debugLog('🎬 Panel entrance animation triggered');
    });

    // Get timing configuration from vendor adapter
    const timing = vendorAdapter.getTimingConfig();

    // Get HundredX response from cache or make new API call
    setTimeout(async () => {
      try {
        let apiResponse;

        // Check if we have cached result from early processing
        debugLog('🔍 Checking cache for query:', `"${query}"`);
        debugLog('🔍 Cache has query?', queryCache.has(query));
        debugLog('🔍 Cache keys:', Array.from(queryCache.keys()));

        if (queryCache.has(query)) {
          debugLog('🎯 Using cached result from early processing:', query);
          const cacheEntry = queryCache.get(query);

          if (cacheEntry.result) {
            // Result already available
            apiResponse = cacheEntry.result;
            debugLog('✅ Using immediate cached result');
          } else {
            // Still processing, wait for it
            debugLog('⏳ Waiting for early processing to complete...');
            await cacheEntry.promise;
            apiResponse = cacheEntry.result;
            debugLog('✅ Early processing completed, using result');
          }
        } else {
          // No cache, make API call now (fallback)
          debugLog('🔄 No cached result, making API call now...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay for loading UI
          apiResponse = await api.processQuery(query);
          debugLog('✅ Direct API call completed');
        }

        updatePanelContent(hxPanel, apiResponse);
        debugLog('✅ HundredX panel created and populated');

      } catch (error) {
        debugLog('❌ Unexpected error in panel processing:', error);
        updatePanelContent(hxPanel, {
          success: false,
          _errorType: 'generic',
          error: error.message,
          _retryable: true
        });
      }
    }, timing.processingDelay);

    // Set global references for retry functionality
    currentQuery = query;
    currentPanel = hxPanel;
  }

  // Find AI response containers using vendor adapter
  function findResponses() {
    if (!vendorAdapter) {
      debugLog('❌ No vendor adapter available');
      return [];
    }
    return vendorAdapter.findResponseContainers();
  }

  // Process all unprocessed AI responses
  async function processAllResponses() {
    if (!vendorAdapter) {
      debugLog('❌ No vendor adapter available');
      return;
    }

    debugLog(`🔄 Processing all ${vendorAdapter.name} responses...`);
    const responses = findResponses();
    debugLog(`Found ${responses.length} responses to process`);

    const timing = vendorAdapter.getTimingConfig();

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      debugLog(`Processing response ${i + 1}/${responses.length}`);
      await processResponse(response);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, timing.processingDelay));
    }
    debugLog('✅ Finished processing all responses');
  }

  // Set up input monitoring for early query processing (vendor-agnostic)
  function setupInputMonitoring() {
    if (!vendorAdapter) {
      debugLog('❌ No vendor adapter available for input monitoring');
      return;
    }

    debugLog(`🎯 Setting up ${vendorAdapter.name} input monitoring for early processing...`);

    const setupInputListener = () => {
      const inputField = vendorAdapter.findInputField();
      if (!inputField) {
        debugLog('❌ Could not find input field, retrying...');
        setTimeout(setupInputListener, 1000);
        return;
      }

      // Listen for Enter key or form submission
      const handleSubmit = (event) => {
        debugLog('🎯 Input event detected:', {
          type: event.type,
          key: event.key,
          shiftKey: event.shiftKey,
          target: event.target.tagName
        });

        if (event.type === 'keydown' && event.key !== 'Enter') {
          debugLog('⏭️ Not Enter key, ignoring');
          return;
        }
        if (event.type === 'keydown' && event.shiftKey) {
          debugLog('⏭️ Shift+Enter detected, allowing new line');
          return; // Allow Shift+Enter for new lines
        }

        const query = inputField.value || inputField.textContent || '';
        debugLog('📝 Extracted query:', `"${query}" (length: ${query.length})`);

        if (query.trim().length > 10) {
          debugLog(`🚀 User submitted ${vendorAdapter.name} query, starting early processing:`, query.trim());
          processQueryEarly(query.trim());
        } else {
          debugLog('❌ Query too short, not processing');
        }
      };

      debugLog('🎧 Adding keydown listener to input field');
      inputField.addEventListener('keydown', handleSubmit);

      // Also listen for any form submissions
      const form = inputField.closest('form');
      if (form) {
        form.addEventListener('submit', handleSubmit);
      }

      debugLog(`✅ ${vendorAdapter.name} input monitoring set up`);
    };

    // Also try to monitor submit buttons as backup
    const setupButtonListener = () => {
      debugLog('🔍 Setting up button listener as backup...');
      const buttons = vendorAdapter.findSubmitButtons();

      buttons.forEach(button => {
        debugLog('🎯 Found submit button');
        button.addEventListener('click', (event) => {
          debugLog('🎯 Submit button clicked!');
          const inputField = vendorAdapter.findInputField();
          if (inputField) {
            const query = inputField.value || inputField.textContent || '';
            if (query.trim().length > 10) {
              debugLog(`🚀 Button click: starting ${vendorAdapter.name} early processing:`, query.trim());
              processQueryEarly(query.trim());
            }
          }
        });
      });
    };

    setupInputListener();
    setupButtonListener();
  }

  // Set up DOM observation for new responses (vendor-agnostic)
  function setupObserver() {
    if (!vendorAdapter) {
      debugLog('❌ No vendor adapter available for observer');
      return null;
    }

    debugLog(`Setting up ${vendorAdapter.name} DOM observer...`);
    const timing = vendorAdapter.getTimingConfig();

    const observer = new MutationObserver(async (mutations) => {
      debugLog(`Observer triggered with ${mutations.length} mutations`);
      let hasNewContent = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              const text = addedNode.textContent?.trim();
              if (text && text.length > 20) {
                debugLog('New content detected:', text.substring(0, 50) + '...');
                hasNewContent = true;
                break;
              }
            }
          }
        }
        if (hasNewContent) break;
      }

      if (hasNewContent) {
        debugLog(`🔄 New ${vendorAdapter.name} content detected, processing after delay...`);
        // Debounce to avoid processing while AI is still typing
        // Use vendor-specific debounce delay
        await new Promise(resolve => setTimeout(resolve, timing.debounceDelay));
        await processAllResponses();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    debugLog(`✅ ${vendorAdapter.name} DOM observer set up`);
    return observer;
  }

  // Load demo mode state from storage
  async function loadDemoMode() {
    try {
      const settings = await api.getSettings();
      isDemoModeEnabled = settings.demoMode || false;
      debugLog('📋 Demo mode loaded:', isDemoModeEnabled);
    } catch (error) {
      debugLog('❌ Error loading demo mode:', error);
      isDemoModeEnabled = false;
    }
  }

  // Normalize string for matching (lowercase, trim, collapse whitespace)
  function normalizeString(str) {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Calculate string similarity (0-1, where 1 is identical)
  function stringSimilarity(str1, str2) {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);

    // Exact match after normalization
    if (s1 === s2) return 1.0;

    // Simple character-based similarity
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    // Count matching characters
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) matches++;
    }

    return matches / longer.length;
  }

  // Match query against demo questions
  function findDemoQuestion(query) {
    if (!isDemoModeEnabled || !DEMO_QUESTIONS) {
      debugLog('🔍 findDemoQuestion: Demo mode disabled or no questions');
      return null;
    }

    const normalizedQuery = normalizeString(query);
    debugLog('🔍 findDemoQuestion: Searching for match');
    debugLog('   Query (raw):', `"${query}"`);
    debugLog('   Query (normalized):', `"${normalizedQuery}"`);

    // First pass: exact match
    for (const demoQ of DEMO_QUESTIONS) {
      const normalizedDemoQ = normalizeString(demoQ.question);
      debugLog(`   Checking exact match with ${demoQ.id}:`);
      debugLog(`      Demo Q (normalized): "${normalizedDemoQ}"`);
      debugLog(`      Match: ${normalizedDemoQ === normalizedQuery}`);

      if (normalizedDemoQ === normalizedQuery) {
        debugLog('🎯 Exact match found for demo question:', demoQ.id);
        return demoQ;
      }
    }

    // Second pass: fuzzy match (95% similarity threshold)
    debugLog('   No exact match, trying fuzzy match (95% threshold)...');
    for (const demoQ of DEMO_QUESTIONS) {
      const similarity = stringSimilarity(query, demoQ.question);
      debugLog(`   ${demoQ.id}: ${Math.round(similarity * 100)}% similar`);

      if (similarity >= 0.95) {
        debugLog(`🎯 Fuzzy match found for demo question: ${demoQ.id} (${Math.round(similarity * 100)}% similar)`);
        return demoQ;
      }
    }

    debugLog('❌ No demo question match found for:', query);
    return null;
  }

  // ============================================================================
  // DEMO MODE FAB (Floating Action Button)
  // ============================================================================

  let demoFAB = null;
  let demoFABPanel = null;

  // Create FAB HTML structure
  function createDemoFAB() {
    if (!DEMO_QUESTIONS || DEMO_QUESTIONS.length === 0) {
      debugLog('❌ No demo questions available');
      return null;
    }

    debugLog('🎬 Creating demo FAB');

    const fab = document.createElement('div');
    fab.className = 'hx-demo-fab';

    // Create button with HX logo
    const button = document.createElement('button');
    button.className = 'hx-demo-fab-button';

    // Get logo URL
    const logoUrl = chrome.runtime.getURL('icons/icon48.png');

    button.innerHTML = `
      <img src="${logoUrl}" alt="HundredX" class="hx-demo-fab-logo" />
      <span class="hx-demo-status-dot"></span>
    `;

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'hx-demo-panel';

    // Panel header
    const header = document.createElement('div');
    header.className = 'hx-demo-panel-header';
    header.innerHTML = `
      <span class="hx-demo-panel-title">Questions</span>
      <button class="hx-demo-panel-close">×</button>
    `;

    // Questions list
    const list = document.createElement('div');
    list.className = 'hx-demo-questions-list';

    // Add questions
    DEMO_QUESTIONS.forEach((q, index) => {
      const item = document.createElement('div');
      item.className = 'hx-demo-question-item';
      item.dataset.questionId = q.id;
      item.dataset.questionText = q.question;
      item.innerHTML = `
        <div class="hx-demo-question-number">${index + 1}</div>
        <div class="hx-demo-question-text">${q.question}</div>
      `;
      list.appendChild(item);
    });

    panel.appendChild(header);
    panel.appendChild(list);
    fab.appendChild(button);
    fab.appendChild(panel);

    // Event listeners
    button.addEventListener('click', toggleDemoPanel);
    header.querySelector('.hx-demo-panel-close').addEventListener('click', closeDemoPanel);

    // Question click handlers
    list.querySelectorAll('.hx-demo-question-item').forEach(item => {
      item.addEventListener('click', () => handleQuestionSelection(item));
    });

    debugLog('✅ Demo FAB created');
    return fab;
  }

  // Toggle demo panel open/close
  function toggleDemoPanel() {
    if (!demoFABPanel) return;
    demoFABPanel.classList.toggle('hx-demo-panel-open');
    debugLog('🎬 Demo panel toggled');
  }

  // Close demo panel
  function closeDemoPanel() {
    if (!demoFABPanel) return;
    demoFABPanel.classList.remove('hx-demo-panel-open');
    debugLog('🎬 Demo panel closed');
  }

  // Handle question selection
  async function handleQuestionSelection(item) {
    const questionText = item.dataset.questionText;
    const questionId = item.dataset.questionId;

    debugLog(`🎬 Question selected: ${questionId}`, questionText);

    // Close panel
    closeDemoPanel();

    // Find input field using vendor adapter
    const inputField = vendorAdapter.findInputField();
    if (!inputField) {
      debugLog('❌ Could not find input field');
      return;
    }

    debugLog('🔍 Input field details:', {
      tagName: inputField.tagName,
      contentEditable: inputField.getAttribute('contenteditable'),
      id: inputField.id,
      className: inputField.className,
      placeholder: inputField.placeholder
    });

    // Fill input field
    if (inputField.tagName === 'TEXTAREA') {
      debugLog('📝 Filling TEXTAREA');
      inputField.value = questionText;
      inputField.focus();
      // Trigger input event for frameworks
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputField.getAttribute('contenteditable') === 'true') {
      debugLog('📝 Filling contenteditable div');

      // Focus first
      inputField.focus();

      // Clear existing content
      inputField.innerHTML = '';

      // For frameworks (React/Angular/Vue), use execCommand to simulate typing
      // This triggers the framework's internal state management
      try {
        // Create a selection range scoped to the input field only
        const range = document.createRange();
        const sel = window.getSelection();

        // Select all content within the input field only (not the whole page)
        range.selectNodeContents(inputField);
        sel.removeAllRanges();
        sel.addRange(range);

        // Insert text using execCommand (works better with frameworks)
        document.execCommand('insertText', false, questionText);
        debugLog('✅ Used execCommand to insert text');
      } catch (e) {
        debugLog('⚠️ execCommand failed, trying direct manipulation:', e);

        // Fallback: direct manipulation
        const textNode = document.createTextNode(questionText);
        inputField.appendChild(textNode);

        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(textNode, questionText.length);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // Trigger events for React/Vue/Angular frameworks
      // NOTE: Don't include 'data' parameter in InputEvents as execCommand already inserted the text
      // Including data would cause frameworks to insert the text multiple times
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    debugLog('✅ Question filled. Current value:', inputField.textContent || inputField.value);

    // Start early processing BEFORE clicking submit
    // This caches the demo response so it's ready when the page processes the query
    debugLog('🚀 Starting early processing for demo question:', questionText);
    await processQueryEarly(questionText);

    // Wait 0.5 seconds so audience can see the question
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify text is still there after delay
    const currentValue = inputField.textContent || inputField.value || '';
    debugLog('🔍 Value after 0.5s delay:', currentValue);

    if (!currentValue || currentValue.trim() === '') {
      debugLog('❌ Input field was cleared! Refilling...');
      if (inputField.tagName === 'TEXTAREA') {
        inputField.value = questionText;
      } else {
        inputField.textContent = questionText;
      }
      debugLog('✅ Refilled. New value:', inputField.textContent || inputField.value);
    }

    // Find and click submit button
    const buttons = vendorAdapter.findSubmitButtons();
    debugLog('🔍 Found submit buttons:', buttons.length);
    if (buttons.length > 0) {
      debugLog('🔍 Submit button details:', {
        tagName: buttons[0].tagName,
        type: buttons[0].type,
        ariaLabel: buttons[0].getAttribute('aria-label'),
        disabled: buttons[0].disabled,
        className: buttons[0].className
      });
    }

    if (buttons.length > 0 && !buttons[0].disabled) {
      debugLog('🚀 Clicking submit button');
      buttons[0].click();
      debugLog('✅ Submit button clicked');
    } else if (buttons.length > 0 && buttons[0].disabled) {
      debugLog('⚠️ Submit button is disabled, waiting 100ms and retrying...');
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!buttons[0].disabled) {
        debugLog('🚀 Submit button now enabled, clicking');
        buttons[0].click();
      } else {
        debugLog('❌ Submit button still disabled after delay');
      }
    } else {
      debugLog('⚠️ No submit button found, trying Enter key');
      // Fallback: simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      inputField.dispatchEvent(enterEvent);
    }
  }

  // Inject FAB into page
  function injectDemoFAB() {
    if (demoFAB) {
      debugLog('⚠️ Demo FAB already exists');
      return;
    }

    demoFAB = createDemoFAB();
    if (!demoFAB) return;

    document.body.appendChild(demoFAB);
    demoFABPanel = demoFAB.querySelector('.hx-demo-panel');

    debugLog('✅ Demo FAB injected into page');

    // Monitor if FAB gets removed unexpectedly
    setTimeout(() => {
      if (demoFAB && !document.body.contains(demoFAB)) {
        debugLog('⚠️ WARNING: FAB was removed from DOM unexpectedly!');
        debugLog('🔄 Attempting to re-inject FAB...');
        demoFAB = null;
        demoFABPanel = null;
        injectDemoFAB();
      } else if (demoFAB) {
        debugLog('✅ FAB still in DOM after 2 seconds');
      }
    }, 2000);
  }

  // Remove FAB from page
  function removeDemoFAB() {
    if (demoFAB && demoFAB.parentNode) {
      demoFAB.parentNode.removeChild(demoFAB);
      demoFAB = null;
      demoFABPanel = null;
      debugLog('✅ Demo FAB removed from page');
    }
  }

  // Update FAB visibility based on demo mode state
  function updateDemoFABVisibility() {
    if (isDemoModeEnabled) {
      if (!demoFAB) {
        injectDemoFAB();
      }
    } else {
      removeDemoFAB();
    }
  }

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.hxSettings) {
      const newSettings = changes.hxSettings.newValue;
      const oldSettings = changes.hxSettings.oldValue;

      debugLog('⚙️ Settings changed:', { old: oldSettings, new: newSettings });

      // If extension was toggled off, clear query cache
      if (oldSettings?.extensionEnabled && !newSettings?.extensionEnabled) {
        debugLog('🔴 Extension disabled, clearing query cache');
        queryCache.clear();
      }

      // If extension was toggled back on
      if (!oldSettings?.extensionEnabled && newSettings?.extensionEnabled) {
        debugLog('🟢 Extension re-enabled');
      }

      // Update demo mode state
      if (newSettings?.demoMode !== oldSettings?.demoMode) {
        isDemoModeEnabled = newSettings?.demoMode || false;
        debugLog(`🎬 Demo mode ${isDemoModeEnabled ? 'enabled' : 'disabled'}`);
        updateDemoFABVisibility();
      }
    }
  });

  // Initialize the extension
  async function init() {
    console.log('🚨🚨🚨 HUNDREDX EXTENSION LOADING 🚨🚨🚨');
    debugLog('🚀 Initializing HundredX extension...');
    debugLog('Current URL:', window.location.href);

    // Load demo mode state
    await loadDemoMode();

    // Inject demo FAB if demo mode is enabled
    updateDemoFABVisibility();

    // Check API health
    const isHealthy = await api.healthCheck();
    debugLog('API health check:', isHealthy);
    if (!isHealthy) {
      console.warn('HundredX: API not available. Make sure mock server is running on localhost:3000');
    }

    // Process existing responses
    debugLog('Processing existing responses...');
    await processAllResponses();

    // Set up observer for new responses
    setupObserver();

    // Set up input monitoring for early query processing
    try {
      setupInputMonitoring();
      debugLog('✅ Input monitoring setup completed');
    } catch (error) {
      debugLog('❌ Error setting up input monitoring:', error);
    }

    debugLog('✅ HundredX extension initialized successfully');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    debugLog('DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    debugLog('DOM already loaded, initializing immediately...');
    init();
  }
})();