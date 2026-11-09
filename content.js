/**
 * Dimmer Dark Mode - Content Script
 * Executes at document_start for instant zero-flicker dark mode application
 */

(function () {
  'use strict';

  // Prevent multiple executions in the same frame
  if (window.__DIMMER_INITIALIZED__) return;
  window.__DIMMER_INITIALIZED__ = true;

  // Default configuration
  const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'smart', // 'smart', 'oled', 'night', 'deep'
    brightness: 90,
    contrast: 95,
    sepia: 0,
    grayscale: 0,
    activationMode: 'always', // 'always', 'system', 'schedule'
    scheduleStart: '19:00',
    scheduleEnd: '07:00',
    siteListMode: 'blacklist', // 'blacklist' (invert all except excluded), 'whitelist' (invert only included)
    excludedSites: []
  };

  let currentConfig = { ...DEFAULT_CONFIG };
  const currentHostname = window.location.hostname.toLowerCase().replace(/^www\./, '');

  // Fast anti-flicker guard before settings load
  if (document.documentElement) {
    document.documentElement.classList.add('dimmer-preloading');
  }

  /**
   * Determine if the current site should have dark mode active based on rules
   */
  function shouldBeActive(config) {
    if (!config.enabled) return false;

    // Check activation mode (Schedule / System theme)
    if (config.activationMode === 'system') {
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!isSystemDark) return false;
    } else if (config.activationMode === 'schedule') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = (config.scheduleStart || '19:00').split(':').map(Number);
      const [endH, endM] = (config.scheduleEnd || '07:00').split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      let inSchedule = false;
      if (startMinutes > endMinutes) {
        // Overnight schedule, e.g. 19:00 to 07:00
        inSchedule = (currentMinutes >= startMinutes || currentMinutes < endMinutes);
      } else {
        inSchedule = (currentMinutes >= startMinutes && currentMinutes < endMinutes);
      }
      if (!inSchedule) return false;
    }

    // Check domain whitelist/blacklist
    const list = Array.isArray(config.excludedSites) ? config.excludedSites : [];
    const isDomainInList = list.some(item => {
      const cleanItem = item.toLowerCase().trim().replace(/^www\./, '');
      return currentHostname === cleanItem || currentHostname.endsWith('.' + cleanItem);
    });

    if (config.siteListMode === 'blacklist') {
      // Invert everywhere EXCEPT sites in list
      return !isDomainInList;
    } else {
      // Invert ONLY sites in list
      return isDomainInList;
    }
  }

  /**
   * Apply Dark Mode styles and classes to the DOM
   */
  function applyTheme(config) {
    const root = document.documentElement;
    if (!root) return;

    const isActive = shouldBeActive(config);

    // Remove preloading guard
    root.classList.remove('dimmer-preloading');

    // Remove existing mode classes
    root.classList.remove(
      'dimmer-active', 
      'dimmer-mode-smart', 
      'dimmer-mode-oled', 
      'dimmer-mode-night', 
      'dimmer-mode-deep',
      'dimmer-font-smoothing',
      'dimmer-font-bold-medium',
      'dimmer-font-bold-high'
    );

    if (isActive) {
      root.classList.add('dimmer-active');
      root.classList.add(`dimmer-mode-${config.mode || 'smart'}`);

      if (config.fontSmoothing !== false) {
        root.classList.add('dimmer-font-smoothing');
      }

      if (config.fontBold === 'medium') {
        root.classList.add('dimmer-font-bold-medium');
      } else if (config.fontBold === 'high') {
        root.classList.add('dimmer-font-bold-high');
      }

      // Set CSS variables for custom adjustments
      root.style.setProperty('--dimmer-brightness', `${config.brightness ?? 90}%`);
      root.style.setProperty('--dimmer-contrast', `${config.contrast ?? 95}%`);
      root.style.setProperty('--dimmer-sepia', `${config.sepia ?? 0}%`);
      root.style.setProperty('--dimmer-grayscale', `${config.grayscale ?? 0}%`);
    } else {
      root.style.removeProperty('--dimmer-brightness');
      root.style.removeProperty('--dimmer-contrast');
      root.style.removeProperty('--dimmer-sepia');
      root.style.removeProperty('--dimmer-grayscale');
    }
  }

  /**
   * Load configuration from chrome storage
   */
  function loadConfigAndApply() {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
      if (chrome.runtime.lastError) {
        console.warn('[Dimmer] Storage error:', chrome.runtime.lastError);
        document.documentElement?.classList.remove('dimmer-preloading');
        return;
      }
      currentConfig = { ...DEFAULT_CONFIG, ...items };
      applyTheme(currentConfig);
    });
  }

  // Initial load
  loadConfigAndApply();

  // Listen for storage changes in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      for (const key in changes) {
        currentConfig[key] = changes[key].newValue;
      }
      applyTheme(currentConfig);
    }
  });

  // Listen for direct messages from popup or background service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PING') {
      sendResponse({ status: 'OK', active: document.documentElement.classList.contains('dimmer-active') });
    } else if (message.action === 'GET_STATUS') {
      sendResponse({
        hostname: currentHostname,
        isActive: document.documentElement.classList.contains('dimmer-active'),
        config: currentConfig
      });
    } else if (message.action === 'UPDATE_CONFIG') {
      currentConfig = { ...currentConfig, ...message.config };
      applyTheme(currentConfig);
      sendResponse({ success: true });
    }
    return true;
  });

  // System color scheme change listener
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentConfig.activationMode === 'system') {
        applyTheme(currentConfig);
      }
    });
  }
})();

