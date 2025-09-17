/**
 * HundredX AI Response Enhancement - DEBUG VERSION
 * - Detects Claude responses and injects HundredX-powered responses alongside
 * - Creates side-by-side experience with matching styling
 * - Uses real HundredX API for commercial query enhancement
 */
(() => {
  const API_BASE_URL = 'https://pulse.ngrok.pizza';
  const LOGO_URL = chrome.runtime.getURL("HundredX+Logo+-+Blue+Registered-640w.webp");
  
  // Track processed responses to avoid duplicates
  const processedResponses = new WeakSet();
  
  // Track processed query contexts to prevent duplicate API calls
  const processedQueryContexts = new Set();
  
  // Cache for API responses to avoid duplicate calls and enable parallel processing
  const queryCache = new Map(); // Map<query, {promise, result, timestamp}>
  
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
    debugLog('⚡ Processing query early (parallel with Claude):', query);
    
    // Check if this looks like a commercial query
    const isCommercial = /best|compare|vs|versus|top|which|better|good|recommend|price|quality|service|value|store|brand/i.test(query);
    if (!isCommercial) {
      debugLog('❌ Not a commercial query, skipping early processing');
      return null;
    }

    // Check if already in cache or being processed
    if (queryCache.has(query)) {
      debugLog('🔄 Query already being processed or cached');
      return queryCache.get(query);
    }

    // Start API call immediately
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
      this.timeout = 15000; // 15 second timeout
      this.maxRetries = 2;
    }

    async processQuery(query, retryCount = 0) {
      const apiUrl = `${API_BASE_URL}/api/answer`;
      debugLog(`🌐 API CALL: ${apiUrl}`, query, `(attempt ${retryCount + 1})`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
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
    
    const logo = document.createElement('img');
    logo.src = LOGO_URL;
    logo.alt = 'HundredX';
    logo.className = 'hx-response-logo';
    
    const title = document.createElement('h4');
    title.className = 'hx-response-title';
    title.textContent = 'Powered by Actual Human Reviews';
    
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
    
    header.appendChild(logo);
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

    // Create unique context to prevent duplicate panels for same query+response
    const queryContext = createQueryContext(query, responseElement);
    if (processedQueryContexts.has(queryContext)) {
      debugLog('❌ Query context already processed, skipping panel creation:', queryContext);
      return;
    }
    processedQueryContexts.add(queryContext);
    debugLog('✅ New query context, creating panel:', queryContext);

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
    
    debugLog('🔴 PANEL ADDED TO DOM - should be visible now!');
    debugLog('🔴 Container parent:', container.parentElement ? 'has parent' : 'no parent');
    debugLog('🔴 Panel parent:', hxPanel.parentElement ? 'has parent' : 'no parent');
    debugLog('🔴 Panel in DOM:', document.contains(hxPanel) ? 'YES' : 'NO');

    // Trigger entrance animation
    requestAnimationFrame(() => {
      hxPanel.classList.add('hx-animate-in');
      debugLog('🎬 Panel entrance animation triggered');
    });

    // Get HundredX response from cache or make new API call
    setTimeout(async () => {
      try {
        let apiResponse;
        
        // Check if we have cached result from early processing
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
    }, 100); // Small delay to ensure panel is fully rendered

    // Set global references for retry functionality
    currentQuery = query;
    currentPanel = hxPanel;
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

  // Set up input monitoring for early query processing
  function setupInputMonitoring() {
    debugLog('🎯 Setting up input monitoring for early processing...');
    
    // Find Claude's input field
    const findInputField = () => {
      const selectors = [
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="message"]', 
        'textarea[data-testid*="input"]',
        'textarea[contenteditable="true"]',
        '.ProseMirror',
        '[data-testid="chat-input"]',
        'textarea',
        'div[contenteditable="true"]'
      ];
      
      debugLog('🔍 Searching for input field...');
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          debugLog('✅ Found input field with selector:', selector);
          debugLog('📝 Input field details:', {
            tagName: element.tagName,
            placeholder: element.placeholder,
            className: element.className,
            id: element.id
          });
          return element;
        } else {
          debugLog('❌ No match for selector:', selector);
        }
      }
      debugLog('🚨 NO INPUT FIELD FOUND! Available textareas/inputs:');
      const allInputs = document.querySelectorAll('textarea, input[type="text"], div[contenteditable="true"]');
      allInputs.forEach((input, index) => {
        debugLog(`  ${index}: ${input.tagName} - class: "${input.className}" - placeholder: "${input.placeholder}" - id: "${input.id}"`);
      });
      return null;
    };

    const setupInputListener = () => {
      const inputField = findInputField();
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
          debugLog('🚀 User submitted query, starting early processing:', query.trim());
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
      
      debugLog('✅ Input monitoring set up');
    };

    // Also try to monitor submit buttons as backup
    const setupButtonListener = () => {
      debugLog('🔍 Setting up button listener as backup...');
      const buttonSelectors = [
        'button[type="submit"]',
        'button[data-testid*="send"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        '[data-testid="send-button"]'
      ];
      
      for (const selector of buttonSelectors) {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
          debugLog('🎯 Found submit button:', selector);
          button.addEventListener('click', (event) => {
            debugLog('🎯 Submit button clicked!');
            const inputField = findInputField();
            if (inputField) {
              const query = inputField.value || inputField.textContent || '';
              if (query.trim().length > 10) {
                debugLog('🚀 Button click: starting early processing:', query.trim());
                processQueryEarly(query.trim());
              }
            }
          });
        });
      }
    };

    setupInputListener();
    setupButtonListener();
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
    console.log('🚨🚨🚨 HUNDREDX EXTENSION LOADING 🚨🚨🚨');
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