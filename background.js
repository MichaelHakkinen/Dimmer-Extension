/**
 * Dimmer Dark Mode - Background Service Worker
 * Manages defaults, context menus, keyboard shortcuts, and badge state
 */

const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'smart',
  brightness: 90,
  contrast: 95,
  sepia: 0,
  grayscale: 0,
  activationMode: 'always',
  scheduleStart: '19:00',
  scheduleEnd: '07:00',
  siteListMode: 'blacklist',
  excludedSites: []
};

// Set initial defaults on install
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
    chrome.storage.local.set({ ...DEFAULT_CONFIG, ...items }, () => {
      updateAllTabsBadge();
    });
  });

  // Create context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'dimmer-toggle-site',
      title: 'Dimmer: Toggle dark mode for this site',
      contexts: ['page', 'action']
    });
    chrome.contextMenus.create({
      id: 'dimmer-toggle-global',
      title: 'Dimmer: Toggle global dark mode',
      contexts: ['action']
    });
  });
});

/**
 * Clean domain helper
 */
function getCleanHostname(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

/**
 * Update the extension badge for a specific tab
 */
function updateTabBadge(tabId, url) {
  const domain = getCleanHostname(url);
  chrome.storage.local.get(DEFAULT_CONFIG, (config) => {
    if (!config.enabled) {
      chrome.action.setBadgeText({ tabId, text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#64748b' });
      return;
    }

    if (!domain) {
      chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    const list = Array.isArray(config.excludedSites) ? config.excludedSites : [];
    const isDomainInList = list.some(item => {
      const clean = item.toLowerCase().trim().replace(/^www\./, '');
      return domain === clean || domain.endsWith('.' + clean);
    });

    const isActive = config.siteListMode === 'blacklist' ? !isDomainInList : isDomainInList;

    if (isActive) {
      chrome.action.setBadgeText({ tabId, text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#0ea5e9' });
    } else {
      chrome.action.setBadgeText({ tabId, text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' });
    }
  });
}

/**
 * Update badges on all current active tabs
 */
function updateAllTabsBadge() {
  chrome.tabs.query({ active: true }, (tabs) => {
    if (!tabs) return;
    tabs.forEach(tab => {
      if (tab.id && tab.url) {
        updateTabBadge(tab.id, tab.url);
      }
    });
  });
}

// Watch tab switching and navigation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    updateTabBadge(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

// Watch storage updates to refresh badges
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    updateAllTabsBadge();
  }
});

/**
 * Toggle site exclusion
 */
function toggleSite(url) {
  const domain = getCleanHostname(url);
  if (!domain) return;

  chrome.storage.local.get(DEFAULT_CONFIG, (config) => {
    let list = Array.isArray(config.excludedSites) ? [...config.excludedSites] : [];
    const cleanList = list.map(s => s.toLowerCase().trim().replace(/^www\./, ''));
    const index = cleanList.indexOf(domain);

    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(domain);
    }

    chrome.storage.local.set({ excludedSites: list }, () => {
      updateAllTabsBadge();
    });
  });
}

/**
 * Toggle global dark mode state
 */
function toggleGlobal() {
  chrome.storage.local.get(['enabled'], (result) => {
    const newState = !(result.enabled !== false);
    chrome.storage.local.set({ enabled: newState }, () => {
      updateAllTabsBadge();
    });
  });
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'dimmer-toggle-site' && tab && tab.url) {
    toggleSite(tab.url);
  } else if (info.menuItemId === 'dimmer-toggle-global') {
    toggleGlobal();
  }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-global') {
    toggleGlobal();
  } else if (command === 'toggle-site') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        toggleSite(tabs[0].url);
      }
    });
  }
});

