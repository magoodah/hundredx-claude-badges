/**
 * HundredX AI Response Enhancement - DEBUG VERSION
 * - Detects Claude responses and injects HundredX-powered responses alongside
 * - Creates side-by-side experience with matching styling
 * - Uses real HundredX API for commercial query enhancement
 */
(() => {
  const API_BASE_URL = 'http://localhost:3000';
  const LOGO_URL = chrome.runtime.getURL("HundredX+Logo+-+Blue+Registered-640w.webp");
  
  // Track processed responses to avoid duplicates
  const processedResponses = new WeakSet();

  // Debug logging
  function debugLog(message, data = null) {
    console.log(`🔍 HundredX DEBUG: ${message}`, data || '');
  }

  // API client
  class HundredXAPI {
    async processQuery(query) {
      debugLog('Making API call with query:', query);
      try {
        const response = await fetch(`${API_BASE_URL}/api/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        debugLog('API response received:', result);
        return result;
      } catch (error) {
        debugLog('API call failed:', error);
        return {
          answer: "Unable to reach HundredX service. Please check that the mock API server is running on localhost:3000.",
          sources: [],
          metadata: { error: error.message },
          success: false,
          error: error.message
        };
      }
    }

    async healthCheck() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        return response.ok;
      } catch {
        return false;
      }
    }
  }

  const api = new HundredXAPI();

  // Extract query from Claude's conversation context - UPDATED
  function extractQueryFromContext(responseElement) {
    debugLog('Attempting to extract query from context');
    
    // Method 1: Look for the user query with the selector you provided
    const userQueryElements = document.querySelectorAll('.whitespace-pre-wrap.break-words');
    debugLog('Found .whitespace-pre-wrap.break-words elements:', userQueryElements.length);
    
    if (userQueryElements.length > 0) {
      // Get the most recent user query (last one that's not our response)
      for (let i = userQueryElements.length - 1; i >= 0; i--) {
        const element = userQueryElements[i];
        const text = element.textContent?.trim();
        debugLog(`Checking element ${i}:`, text);
        
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
      debugLog(`Depth ${depth}, element:`, currentElement.tagName, currentElement.className);
      
      // Look for siblings that might contain user messages
      const siblings = Array.from(currentElement.parentNode?.children || []);
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        const userQuery = sibling.querySelector('.whitespace-pre-wrap.break-words');
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
    const allUserInputs = Array.from(document.querySelectorAll('.whitespace-pre-wrap.break-words'));
    debugLog('All user inputs found:', allUserInputs.map(el => el.textContent?.trim()));
    
    if (allUserInputs.length > 0) {
      const lastInput = allUserInputs[allUserInputs.length - 1];
      const text = lastInput.textContent?.trim();
      if (text && text.length > 3) {
        debugLog('Found query via method 3:', text);
        return text;
      }
    }

    debugLog('❌ Could not extract query from context');
    return null;
  }

  // Create HundredX response panel
  function createHundredXPanel() {
    debugLog('Creating HundredX panel');
    const panel = document.createElement('div');
    panel.className = 'hx-response-panel';
     // DEBUG: Make it visible
     // DEBUG: Give it size
    
    const header = document.createElement('div');
    header.className = 'hx-response-header';
    
    const logo = document.createElement('img');
    logo.src = LOGO_URL;
    logo.alt = 'HundredX';
    logo.className = 'hx-response-logo';
    
    const title = document.createElement('h4');
    title.className = 'hx-response-title';
    title.textContent = 'Human Verified Insights';
    
    header.appendChild(logo);
    header.appendChild(title);
    
    const content = document.createElement('div');
    content.className = 'hx-response-content';
    content.innerHTML = '<div class="hx-response-loading">🔄 Analyzing query with HundredX data...</div>';
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    debugLog('HundredX panel created');
    return panel;
  }

  // Format HundredX response content
  function formatHundredXContent(apiResponse) {
    debugLog('Formatting HundredX content:', apiResponse);
    
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

    // Convert markdown-like formatting to HTML and add HX attribution styling
    let formattedContent = apiResponse.answer
      .replace(/\*\*\[HX\]\*\*/g, '<span class="hx-attribution">[HX]</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap in paragraphs if not already formatted
    if (!formattedContent.includes('<p>')) {
      formattedContent = `<p>${formattedContent}</p>`;
    }

    // Add sources if available
    let sourcesContent = '';
    if (apiResponse.sources && apiResponse.sources.length > 0) {
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

    // Look for signs of substantial content
    const hasMultipleParagraphs = text.split('\n\n').length > 2;
    const hasDetailedInfo = /\d+%|\$[\d,]+|[\d,]+\s+(million|billion|responses|reviews)/i.test(text);
    const hasStructuredContent = /^(#|##|\*\*|1\.|•)/m.test(text);

    const isSubstantial = hasMultipleParagraphs || hasDetailedInfo || hasStructuredContent;
    debugLog('Response substantiality check:', {
      length: text.length,
      hasMultipleParagraphs,
      hasDetailedInfo,
      hasStructuredContent,
      isSubstantial
    });

    return isSubstantial;
  }

  // Process a Claude response and add HundredX panel
  async function processClaudeResponse(responseElement) {
    debugLog('Processing Claude response:', responseElement);
    
    if (processedResponses.has(responseElement)) {
      debugLog('❌ Response already processed, skipping');
      return;
    }
    processedResponses.add(responseElement);

    // Check if this is a substantial response worth augmenting
    if (!isSubstantialResponse(responseElement)) {
      debugLog('❌ Response not substantial enough, skipping');
      return;
    }

    // Extract the user query
    const query = extractQueryFromContext(responseElement);
    if (!query) {
      debugLog('❌ Could not extract query from context');
      return;
    }

    debugLog('✅ Extracted query:', query);

    // Check if this looks like a commercial query before creating the panel
    const isCommercial = /best|compare|vs|versus|top|which|better|good|recommend|price|quality|service|value|store|brand/i.test(query);
    debugLog('Is commercial query?', isCommercial);
    
    if (!isCommercial) {
      debugLog('❌ Query does not appear commercial, skipping');
      return;
    }

    // Create container for side-by-side layout
    const container = document.createElement('div');
    container.className = 'hx-response-container';

    // Move Claude's response into the container
    const parent = responseElement.parentNode;
    debugLog('Moving Claude response to container, parent:', parent);
    parent.insertBefore(container, responseElement);
    container.appendChild(responseElement);

    // Add HundredX panel
    const hxPanel = createHundredXPanel();
    container.appendChild(hxPanel);

    // Make API call to get HundredX response
    try {
      const apiResponse = await api.processQuery(query);
      const contentDiv = hxPanel.querySelector('.hx-response-content');
      contentDiv.innerHTML = formatHundredXContent(apiResponse);
      debugLog('✅ HundredX panel created and populated');
    } catch (error) {
      debugLog('❌ Error loading HundredX insights:', error);
      const contentDiv = hxPanel.querySelector('.hx-response-content');
      contentDiv.innerHTML = `<div class="hx-response-error">
        Error loading HundredX insights: ${error.message}
      </div>`;
    }
  }

  // Find Claude response containers - UPDATED
  function findClaudeResponses() {
    debugLog('Looking for Claude responses...');
    
    // Try your specific selector first
    const primarySelector = "div[class='grid-cols-1 grid gap-2.5 [&_>_*]:min-w-0 standard-markdown']";
    const primaryElements = document.querySelectorAll(primarySelector);
    debugLog(`Found ${primaryElements.length} elements with primary selector`);
    
    // Also try other common Claude selectors
    const fallbackSelectors = [
      '[data-cy="message-text"]',
      'article',
      '.prose',
      '.markdown',
      '[data-testid*="message"]'
    ];

    const responses = new Set();
    
    // Add primary selector results
    primaryElements.forEach(element => {
      if (!processedResponses.has(element) && 
          !element.closest('.hx-response-panel') &&
          !element.querySelector('.hx-response-panel')) {
        
        const text = element.textContent?.trim();
        debugLog('Primary selector element text:', text?.substring(0, 100) + '...');
        if (text && text.length > 50) {
          responses.add(element);
          debugLog('✅ Added element from primary selector');
        }
      }
    });
    
    // Try fallback selectors if we didn't find anything
    if (responses.size === 0) {
      debugLog('No primary elements found, trying fallback selectors...');
      fallbackSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        debugLog(`Found ${elements.length} elements with selector: ${selector}`);
        
        elements.forEach(element => {
          if (!processedResponses.has(element) && 
              !element.closest('.hx-response-panel') &&
              !element.querySelector('.hx-response-panel')) {
            
            const text = element.textContent?.trim();
            if (text && text.length > 50) {
              responses.add(element);
              debugLog(`✅ Added element from fallback selector: ${selector}`);
            }
          }
        });
      });
    }

    debugLog(`Total responses found: ${responses.size}`);
    return Array.from(responses);
  }

  // Process all unprocessed Claude responses
  async function processAllResponses() {
    debugLog('🔄 Processing all responses...');
    const responses = findClaudeResponses();
    debugLog(`Found ${responses.length} responses to process`);
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      debugLog(`Processing response ${i + 1}/${responses.length}`);
      await processClaudeResponse(response);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    debugLog('✅ Finished processing all responses');
  }

  // Set up DOM observation for new responses
  function setupObserver() {
    debugLog('Setting up DOM observer...');
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
        debugLog('🔄 New content detected, processing after delay...');
        // Debounce to avoid processing while Claude is still typing
        await new Promise(resolve => setTimeout(resolve, 1000));
        await processAllResponses();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    debugLog('✅ DOM observer set up');
    return observer;
  }

  // Initialize the extension
  async function init() {
    debugLog('🚀 Initializing HundredX extension...');
    debugLog('Current URL:', window.location.href);

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