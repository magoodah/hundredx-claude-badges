// HundredX Extension Popup Logic

const API_BASE_URL = 'https://pulse.ngrok.pizza';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// DOM Elements
let extensionEnabledToggle;
let narrativeStyleSelect;
let webSearchToggle;
let saveButton;
let statusMessage;
let healthDot;
let healthText;
let healthCheckInterval;

// Default settings
const DEFAULT_SETTINGS = {
  extensionEnabled: true,
  narrativeStyle: 'default',
  webSearchEnabled: false
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('HundredX popup loaded');

  // Get DOM elements
  extensionEnabledToggle = document.getElementById('extensionEnabled');
  narrativeStyleSelect = document.getElementById('narrativeStyle');
  webSearchToggle = document.getElementById('webSearch');
  saveButton = document.getElementById('saveSettings');
  statusMessage = document.getElementById('statusMessage');
  healthDot = document.getElementById('healthDot');
  healthText = document.getElementById('healthText');

  // Load saved settings
  await loadSettings();

  // Load narrative styles from API (placeholder for now)
  await loadNarrativeStyles();

  // Start health check
  checkHealth();
  healthCheckInterval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);

  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  extensionEnabledToggle.addEventListener('change', () => {
    hideStatusMessage();
    // Update UI state when master toggle changes
    updateFormState();
  });
  narrativeStyleSelect.addEventListener('change', () => hideStatusMessage());
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
    const settings = result.hxSettings || DEFAULT_SETTINGS;

    console.log('Loaded settings:', settings);

    // Apply settings to UI
    extensionEnabledToggle.checked = settings.extensionEnabled !== undefined ? settings.extensionEnabled : DEFAULT_SETTINGS.extensionEnabled;
    narrativeStyleSelect.value = settings.narrativeStyle || DEFAULT_SETTINGS.narrativeStyle;
    webSearchToggle.checked = settings.webSearchEnabled || DEFAULT_SETTINGS.webSearchEnabled;
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
      narrativeStyle: narrativeStyleSelect.value,
      webSearchEnabled: webSearchToggle.checked
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
async function loadNarrativeStyles() {
  try {
    // TODO: Replace with actual API endpoint when provided
    // For now, use placeholder options
    const narrativeStyles = [
      { value: 'default', label: 'Default' },
      { value: 'detailed', label: 'Detailed Analysis' },
      { value: 'concise', label: 'Concise Summary' },
      { value: 'comparative', label: 'Comparative' }
    ];

    // Populate dropdown
    narrativeStyleSelect.innerHTML = '';
    narrativeStyles.forEach(style => {
      const option = document.createElement('option');
      option.value = style.value;
      option.textContent = style.label;
      narrativeStyleSelect.appendChild(option);
    });

    // Restore selected value
    const result = await chrome.storage.sync.get(['hxSettings']);
    const settings = result.hxSettings || DEFAULT_SETTINGS;
    narrativeStyleSelect.value = settings.narrativeStyle || DEFAULT_SETTINGS.narrativeStyle;

  } catch (error) {
    console.error('Error loading narrative styles:', error);
    narrativeStyleSelect.innerHTML = '<option value="default">Default</option>';
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
  narrativeStyleSelect.disabled = !isEnabled;
  webSearchToggle.disabled = !isEnabled;

  // Visual feedback
  if (!isEnabled) {
    narrativeStyleSelect.style.opacity = '0.5';
    webSearchToggle.parentElement.parentElement.style.opacity = '0.5';
  } else {
    narrativeStyleSelect.style.opacity = '1';
    webSearchToggle.parentElement.parentElement.style.opacity = '1';
  }
}
