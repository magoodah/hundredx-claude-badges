// HundredX Extension Popup Logic

const API_BASE_URL = 'https://pulse.ngrok.pizza';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// DOM Elements
let extensionEnabledToggle;
let templateSelect;
let webSearchToggle;
let saveButton;
let statusMessage;
let healthDot;
let healthText;
let healthCheckInterval;

// Templates data
let availableTemplates = [];
let defaultTemplateId = null;

// Default settings
const DEFAULT_SETTINGS = {
  extensionEnabled: true,
  template_id: null, // Will be set from API default
  enable_web_search: false
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('HundredX popup loaded');

  // Get DOM elements
  extensionEnabledToggle = document.getElementById('extensionEnabled');
  templateSelect = document.getElementById('templateSelect');
  webSearchToggle = document.getElementById('webSearch');
  saveButton = document.getElementById('saveSettings');
  statusMessage = document.getElementById('statusMessage');
  healthDot = document.getElementById('healthDot');
  healthText = document.getElementById('healthText');

  // Load templates from API first
  await loadTemplates();

  // Load saved settings
  await loadSettings();

  // Start health check
  checkHealth();
  healthCheckInterval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);

  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  extensionEnabledToggle.addEventListener('change', () => {
    hideStatusMessage();
    updateFormState();
  });
  templateSelect.addEventListener('change', () => {
    hideStatusMessage();
    onTemplateChange();
  });
  webSearchToggle.addEventListener('change', () => hideStatusMessage());

  // Initialize form state
  updateFormState();
});

// Clean up interval when popup closes
window.addEventListener('unload', () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
});

// Load settings from Chrome storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['hxSettings']);
    const settings = result.hxSettings || {};

    console.log('Loaded settings:', settings);

    // Apply settings to UI with backward compatibility
    extensionEnabledToggle.checked = settings.extensionEnabled !== undefined ? settings.extensionEnabled : DEFAULT_SETTINGS.extensionEnabled;

    // Use template_id if available, otherwise use default from API
    const templateId = settings.template_id || defaultTemplateId || DEFAULT_SETTINGS.template_id;
    templateSelect.value = templateId;

    // Use enable_web_search if available, otherwise fallback to old field name for backward compatibility
    const webSearchEnabled = settings.enable_web_search !== undefined
      ? settings.enable_web_search
      : (settings.webSearchEnabled !== undefined ? settings.webSearchEnabled : DEFAULT_SETTINGS.enable_web_search);
    webSearchToggle.checked = webSearchEnabled;

    // Update web search toggle state based on selected template
    onTemplateChange();
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatusMessage('Failed to load settings', 'error');
  }
}

// Save settings to Chrome storage
async function saveSettings() {
  try {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const settings = {
      extensionEnabled: extensionEnabledToggle.checked,
      template_id: templateSelect.value,
      enable_web_search: webSearchToggle.checked
    };

    await chrome.storage.sync.set({ hxSettings: settings });

    console.log('Settings saved:', settings);
    showStatusMessage('Settings saved successfully!', 'success');

    // Reset button after delay
    setTimeout(() => {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Settings';
    }, 1000);

  } catch (error) {
    console.error('Error saving settings:', error);
    showStatusMessage('Failed to save settings', 'error');
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
}

// Load narrative styles (placeholder - will be replaced with API call)
// Load templates from API
async function loadTemplates() {
  try {
    console.log('Fetching templates from API...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/api/templates`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Templates loaded:', data);

    availableTemplates = data.templates || [];
    defaultTemplateId = data.default || null;

    // Update DEFAULT_SETTINGS with API default
    if (defaultTemplateId) {
      DEFAULT_SETTINGS.template_id = defaultTemplateId;
    }

    // Populate dropdown
    templateSelect.innerHTML = '';
    if (availableTemplates.length === 0) {
      templateSelect.innerHTML = '<option value="">No templates available</option>';
      showStatusMessage('No templates available from API', 'error');
      return;
    }

    availableTemplates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      option.title = template.description;
      templateSelect.appendChild(option);
    });

    console.log(`✅ Loaded ${availableTemplates.length} templates`);

  } catch (error) {
    console.error('Error loading templates:', error);

    // Fallback to hardcoded defaults
    templateSelect.innerHTML = '<option value="">Failed to load templates</option>';
    showStatusMessage('Failed to load templates from API', 'error');

    // Use fallback templates
    availableTemplates = [
      {
        id: '3_tier_consumer_friendly_locked_v3',
        name: 'Consumer-Friendly Narrative',
        description: 'Consumer-friendly narrative response',
        supports_web_search: true
      }
    ];
    defaultTemplateId = '3_tier_consumer_friendly_locked_v3';
    DEFAULT_SETTINGS.template_id = defaultTemplateId;

    templateSelect.innerHTML = `<option value="${defaultTemplateId}">Consumer-Friendly Narrative (Fallback)</option>`;
  }
}

// Handle template selection change
function onTemplateChange() {
  const selectedTemplateId = templateSelect.value;
  const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId);

  if (!selectedTemplate) {
    console.warn('Selected template not found:', selectedTemplateId);
    return;
  }

  console.log('Template changed to:', selectedTemplate.name);

  // Update web search toggle based on template support
  if (selectedTemplate.supports_web_search) {
    webSearchToggle.disabled = false;
    webSearchToggle.parentElement.parentElement.style.opacity = '1';
    webSearchToggle.parentElement.parentElement.title = '';
  } else {
    webSearchToggle.disabled = true;
    webSearchToggle.checked = false;
    webSearchToggle.parentElement.parentElement.style.opacity = '0.5';
    webSearchToggle.parentElement.parentElement.title = 'This template does not support web search';
  }
}

// Check API health
async function checkHealth() {
  try {
    healthDot.className = 'health-dot checking';
    healthText.textContent = 'Checking API...';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/api/health`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      healthDot.className = 'health-dot healthy';
      healthText.textContent = 'API Connected';
      console.log('Health check passed:', data);
    } else {
      healthDot.className = 'health-dot unhealthy';
      healthText.textContent = 'API Error';
      console.warn('Health check failed with status:', response.status);
    }
  } catch (error) {
    healthDot.className = 'health-dot unhealthy';
    healthText.textContent = 'API Offline';
    console.error('Health check error:', error);
  }
}

// Show status message
function showStatusMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      hideStatusMessage();
    }, 3000);
  }
}

// Hide status message
function hideStatusMessage() {
  statusMessage.className = 'status-message hidden';
}

// Update form state based on master toggle
function updateFormState() {
  const isEnabled = extensionEnabledToggle.checked;

  // Disable/enable other settings when extension is off
  templateSelect.disabled = !isEnabled;

  // Visual feedback
  if (!isEnabled) {
    templateSelect.style.opacity = '0.5';
    webSearchToggle.disabled = true;
    webSearchToggle.parentElement.parentElement.style.opacity = '0.5';
  } else {
    templateSelect.style.opacity = '1';
    // Let onTemplateChange handle web search toggle state based on template
    onTemplateChange();
  }
}
