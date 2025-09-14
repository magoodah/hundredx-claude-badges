/**
 * HundredX GO Scores — Content Script
 * - Observes Claude/Perplexity chat results
 * - Detects brand names and injects inline badges + hover tooltips
 * - Click opens a polished side panel with richer insights & comparisons
 */
(() => {
  const BRAND_DATA_URL = chrome.runtime.getURL("brands.json");
  const LOGO_URL = chrome.runtime.getURL("HundredX+Logo+-+Blue+Registered-640w.webp");

  // Style isolation using Shadow DOM for panel to avoid clobbering host page
  let shadowHost = null;
  let shadowRoot = null;
  let panelContainer = null;
  let panelVisible = false;

  // Cache brand data
  let BRAND_MAP = {};
  let BRAND_REGEX = null;

  // Track processed containers to avoid duplicate headers
  const processedContainers = new WeakSet();

  async function loadBrandData() {
    const res = await fetch(BRAND_DATA_URL);
    const data = await res.json();
    BRAND_MAP = data.brands || {};
    const escaped = Object.keys(BRAND_MAP)
      .map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);
    if (escaped.length) {
      BRAND_REGEX = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
    }
  }

  // Create branding header
  function createBrandingHeader() {
    const header = document.createElement('div');
    header.className = 'hx-go-branding-header';
    header.innerHTML = `
      <img src="${LOGO_URL}" alt="HundredX" class="hx-go-branding-logo">
      <span class="hx-go-branding-text">Human verified recommendations</span>
    `;
    return header;
  }

  // Identify plausible result containers for Claude / Perplexity
  function getResultRoots() {
    // Primary selector for the specific Claude div requested
    const primarySelector = "div[class='grid-cols-1 grid gap-2.5 [&_>_*]:min-w-0 standard-markdown']";
    
    // Fallback selectors for other contexts (Perplexity, other Claude layouts)
    const fallbackSelectors = [
      '[data-cy="message-text"]',
      'article',
      '.prose',
      '.markdown',
      '[data-testid*="message"], [class*="message"] pre ~ div, [class*="markdown"]'
    ];
    
    const nodes = new Set();
    
    // First try the primary selector
    const primaryNodes = document.querySelectorAll(primarySelector);
    if (primaryNodes.length > 0) {
      primaryNodes.forEach(n => nodes.add(n));
    } else {
      // Fall back to other selectors if primary not found
      fallbackSelectors.forEach(sel => document.querySelectorAll(sel).forEach(n => nodes.add(n)));
    }
    
    return Array.from(nodes);
  }

  // Inject branding header at top of container
  function injectBrandingHeader(container) {
    if (processedContainers.has(container)) return;
    
    // Only add header if there are brand mentions in this container
    const text = container.innerText || container.textContent || '';
    if (!BRAND_REGEX || !BRAND_REGEX.test(text)) return;
    
    const header = createBrandingHeader();
    container.insertBefore(header, container.firstChild);
    processedContainers.add(container);
  }

  // Inject shadow host (for side panel)
  function ensureShadowPanel() {
    if (shadowHost) return;
    shadowHost = document.createElement('div');
    shadowHost.id = 'hx-go-shadow-host';
    shadowHost.style.all = 'initial'; // minimize inheritance/leaks
    shadowHost.style.position = 'fixed';
    shadowHost.style.top = '0';
    shadowHost.style.right = '0';
    shadowHost.style.width = '0';
    shadowHost.style.height = '0';
    shadowHost.style.zIndex = '2147483647'; // above everything
    document.documentElement.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    panelContainer = document.createElement('div');
    panelContainer.className = 'hx-go-panel-container';
    shadowRoot.appendChild(panelContainer);

    // Load panel HTML template
    fetch(chrome.runtime.getURL('panel.html'))
      .then(r => r.text())
      .then(html => {
        panelContainer.innerHTML = html;
        wirePanel();
      });
  }

  // Open/Close panel API
  function openPanel(payload) {
    ensureShadowPanel();
    const panel = shadowRoot.querySelector('.hx-go-panel');
    const overlay = shadowRoot.querySelector('.hx-go-overlay');
    if (!panel || !overlay) return;

    // Set content
    renderPanelContent(payload);

    overlay.style.display = 'block';
    requestAnimationFrame(() => {
      overlay.classList.add('hx-open');
      panel.classList.add('hx-open');
      panelVisible = true;
    });
  }

  function closePanel() {
    const panel = shadowRoot.querySelector('.hx-go-panel');
    const overlay = shadowRoot.querySelector('.hx-go-overlay');
    if (!panel || !overlay) return;
    overlay.classList.remove('hx-open');
    panel.classList.remove('hx-open');
    setTimeout(() => {
      overlay.style.display = 'none';
      panelVisible = false;
    }, 180);
  }

  function wirePanel() {
    const closeBtn = shadowRoot.querySelector('.hx-go-close');
    const overlay = shadowRoot.querySelector('.hx-go-overlay');
    closeBtn?.addEventListener('click', closePanel);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });
    // Esc to close
    document.addEventListener('keydown', (e) => {
      if (panelVisible && e.key === 'Escape') closePanel();
    }, true);
  }

  function renderPanelContent({ brands }) {
    const body = shadowRoot.querySelector('.hx-go-body');
    if (!body) return;
    body.innerHTML = '';

    if (!brands || !brands.length) {
      body.innerHTML = '<div class="hx-go-empty">No brands detected.</div>';
      return;
    }

    // If two or more brands, show comparison first
    if (brands.length >= 2) {
      const [a, b] = brands;
      const cmp = document.createElement('div');
      cmp.className = 'hx-go-compare';
      cmp.innerHTML = `
        <div class="hx-go-compare-row">
          <div class="hx-go-compare-cell hx-muted">Brand</div>
          <div class="hx-go-compare-cell">${a.name}</div>
          <div class="hx-go-compare-cell">${b.name}</div>
        </div>
        <div class="hx-go-compare-row">
          <div class="hx-go-compare-cell hx-muted">GO Score</div>
          <div class="hx-go-compare-cell">${a.score}</div>
          <div class="hx-go-compare-cell">${b.score}</div>
        </div>
        <div class="hx-go-compare-row">
          <div class="hx-go-compare-cell hx-muted">Reviews</div>
          <div class="hx-go-compare-cell">${a.reviews.toLocaleString()}</div>
          <div class="hx-go-compare-cell">${b.reviews.toLocaleString()}</div>
        </div>
      `;
      body.appendChild(cmp);
    }

    // List cards
    brands.forEach(b => {
      const card = document.createElement('div');
      card.className = 'hx-go-card';
      card.innerHTML = `
        <div class="hx-go-card-header">
          <div class="hx-go-badge-large" aria-label="GO Score ${b.score}" role="img">GO ${b.score}</div>
          <div class="hx-go-title">${b.name}</div>
        </div>
        <div class="hx-go-meta">Based on ${b.reviews.toLocaleString()} reviews by verified users</div>
        <ul class="hx-go-pros-cons">
          ${(b.pros || []).slice(0,3).map(p => `<li class="pro">${p}</li>`).join("")}
          ${(b.cons || []).slice(0,2).map(c => `<li class="con">${c}</li>`).join("")}
        </ul>
      `;
      body.appendChild(card);
    });
  }

  // Create a badge element
  function createBadge(brandName) {
    const meta = BRAND_MAP[brandName.toLowerCase()];
    if (!meta) return null;
    const badge = document.createElement('span');
    badge.className = 'hx-go-badge';
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('role', 'button');
    badge.setAttribute('aria-label', `HundredX GO Score ${meta.score} for ${brandName}. Click for details.`);
    badge.textContent = `GO ${meta.score}`;

    const tooltip = document.createElement('span');
    tooltip.className = 'hx-go-tooltip';
    tooltip.textContent = `Based on ${meta.reviews.toLocaleString()} reviews by verified users`;
    badge.appendChild(tooltip);

    badge.addEventListener('click', () => {
      const brandsInView = getDetectedBrandsNearby(badge);
      openPanel({ brands: brandsInView });
    });
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        badge.click();
      }
    });
    return badge;
  }

  // Simple detector: read surrounding text container for other brands to craft a comparison
  function getDetectedBrandsNearby(el) {
    // Updated to include the new specific selector
    const container = el.closest("div[class='grid-cols-1 grid gap-2.5 [&_>_*]:min-w-0 standard-markdown'], [data-cy='message-text'], article, .prose, .markdown, [data-testid*='message']") || document.body;
    const text = container.innerText || container.textContent || '';
    const found = new Map();
    text.replace(BRAND_REGEX, (m) => {
      const key = m.toLowerCase();
      if (BRAND_MAP[key]) found.set(key, BRAND_MAP[key]);
      return m;
    });
    return Array.from(found.entries()).slice(0, 4).map(([k, v]) => ({
      name: v.display || k,
      score: v.score,
      reviews: v.reviews,
      pros: v.pros || [],
      cons: v.cons || []
    }));
  }

  // Inject badges into text nodes by wrapping brand mentions
  function annotateNode(node) {
    if (!BRAND_REGEX) return;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.nodeValue;
    if (!text || !BRAND_REGEX.test(text)) return;

    const parent = node.parentNode;
    if (!parent || parent.classList?.contains('hx-go-processed')) return;

    BRAND_REGEX.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = BRAND_REGEX.exec(text)) !== null) {
      const brand = match[0];
      const before = text.slice(lastIndex, match.index);
      if (before) frag.appendChild(document.createTextNode(before));

      const wrap = document.createElement('span');
      wrap.className = 'hx-go-brand-wrap hx-go-processed';
      wrap.textContent = brand;

      const badge = createBadge(brand);
      if (badge) wrap.appendChild(document.createTextNode(' '));
      if (badge) wrap.appendChild(badge);

      frag.appendChild(wrap);
      lastIndex = BRAND_REGEX.lastIndex;
    }
    const after = text.slice(lastIndex);
    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, node);
  }

  function walkAndAnnotate(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Avoid code blocks, inputs, scripts, styles
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const blacklist = ['CODE','PRE','SCRIPT','STYLE','TEXTAREA','INPUT'];
        if (blacklist.includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest('.hx-go-panel, .hx-go-brand-wrap, .hx-go-branding-header')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(annotateNode);
  }

  function processAll() {
    const roots = getResultRoots();
    roots.forEach(root => {
      // First inject branding header if needed
      injectBrandingHeader(root);
      // Then process text for badges
      walkAndAnnotate(root);
    });
  }

  function setupObserver() {
    const target = document.body;
    if (!target) return;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Debounce a little for large render batches
              requestAnimationFrame(processAll);
            }
          });
        } else if (m.type === 'characterData') {
          requestAnimationFrame(processAll);
        }
      }
    });
    mo.observe(target, { subtree: true, childList: true, characterData: true });
  }

  // Init
  (async function init() {
    await loadBrandData();
    ensureShadowPanel();
    processAll();
    setupObserver();
    // Re-run on route changes (SPAs)
    window.addEventListener('popstate', processAll);
    window.addEventListener('hashchange', processAll);
  })();
})();