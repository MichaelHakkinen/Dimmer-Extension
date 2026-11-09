/**
 * Dimmer Dark Mode - Popup Script
 * Coordinates UI with storage and updates the active tab in real time
 */

document.addEventListener('DOMContentLoaded', () => {
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

  let currentConfig = { ...DEFAULT_CONFIG };
  let currentDomain = null;

  // UI Elements
  const masterToggle = document.getElementById('masterToggle');
  const siteCard = document.getElementById('siteCard');
  const siteDomain = document.getElementById('siteDomain');
  const siteStatus = document.getElementById('siteStatus');
  const siteToggle = document.getElementById('siteToggle');
  const siteToggleLabel = document.getElementById('siteToggleLabel');

  const themeBtns = document.querySelectorAll('.theme-btn');
  const resetSlidersBtn = document.getElementById('resetSlidersBtn');

  const sliderBrightness = document.getElementById('sliderBrightness');
  const valBrightness = document.getElementById('valBrightness');
  const sliderContrast = document.getElementById('sliderContrast');
  const valContrast = document.getElementById('valContrast');
  const sliderSepia = document.getElementById('sliderSepia');
  const valSepia = document.getElementById('valSepia');
  const sliderGrayscale = document.getElementById('sliderGrayscale');
  const valGrayscale = document.getElementById('valGrayscale');

  const activationRadios = document.querySelectorAll('input[name="activationMode"]');
  const scheduleInputs = document.getElementById('scheduleInputs');
  const schedStart = document.getElementById('schedStart');
  const schedEnd = document.getElementById('schedEnd');

  const excludedCount = document.getElementById('excludedCount');
  const excludedList = document.getElementById('excludedList');
  const manualSiteInput = document.getElementById('manualSiteInput');
  const manualAddSiteBtn = document.getElementById('manualAddSiteBtn');

  /**
   * Helper: extract clean domain from url
   */
  function extractHostname(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if current site is excluded
   */
  function isSiteExcluded(domain, list) {
    if (!domain || !Array.isArray(list)) return false;
    return list.some(item => {
      const clean = item.toLowerCase().trim().replace(/^www\./, '');
      return domain === clean || domain.endsWith('.' + clean);
    });
  }

  /**
   * Update UI state to reflect currentConfig
   */
  function updateUI() {
    masterToggle.checked = currentConfig.enabled !== false;

    // Active theme mode
    themeBtns.forEach(btn => {
      if (btn.dataset.mode === currentConfig.mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Sliders
    sliderBrightness.value = currentConfig.brightness ?? 90;
    valBrightness.textContent = `${sliderBrightness.value}%`;

    sliderContrast.value = currentConfig.contrast ?? 95;
    valContrast.textContent = `${sliderContrast.value}%`;

    sliderSepia.value = currentConfig.sepia ?? 0;
    valSepia.textContent = `${sliderSepia.value}%`;

    sliderGrayscale.value = currentConfig.grayscale ?? 0;
    valGrayscale.textContent = `${sliderGrayscale.value}%`;

    // Activation mode
    activationRadios.forEach(r => {
      r.checked = (r.value === currentConfig.activationMode);
    });
    scheduleInputs.style.display = (currentConfig.activationMode === 'schedule') ? 'flex' : 'none';
    schedStart.value = currentConfig.scheduleStart || '19:00';
    schedEnd.value = currentConfig.scheduleEnd || '07:00';

    // Current Site Card
    if (currentDomain) {
      siteDomain.textContent = currentDomain;
      const excluded = isSiteExcluded(currentDomain, currentConfig.excludedSites);
      const isSiteActive = currentConfig.enabled && !excluded;

      siteToggle.checked = !excluded;
      siteToggle.disabled = !currentConfig.enabled;

      if (!currentConfig.enabled) {
        siteStatus.textContent = 'Dimmer is paused globally';
        siteStatus.className = 'site-status disabled';
        siteToggleLabel.textContent = 'Paused';
        siteCard.classList.add('site-disabled');
      } else if (isSiteActive) {
        siteStatus.textContent = 'Dark Mode Active';
        siteStatus.className = 'site-status';
        siteToggleLabel.textContent = 'Active';
        siteCard.classList.remove('site-disabled');
      } else {
        siteStatus.textContent = 'Excluded on this site';
        siteStatus.className = 'site-status disabled';
        siteToggleLabel.textContent = 'Disabled';
        siteCard.classList.add('site-disabled');
      }
    } else {
      siteDomain.textContent = 'System / Restricted Page';
      siteStatus.textContent = 'Cannot modify internal browser tabs';
      siteStatus.className = 'site-status disabled';
      siteToggle.checked = false;
      siteToggle.disabled = true;
      siteToggleLabel.textContent = 'N/A';
      siteCard.classList.add('site-disabled');
    }

    // Excluded sites list
    renderExcludedList();
  }

  /**
   * Render excluded sites in accordion
   */
  function renderExcludedList() {
    const list = Array.isArray(currentConfig.excludedSites) ? currentConfig.excludedSites : [];
    excludedCount.textContent = list.length;
    excludedList.innerHTML = '';

    if (list.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-msg';
      emptyMsg.textContent = 'No excluded websites yet';
      excludedList.appendChild(emptyMsg);
      return;
    }

    list.forEach(site => {
      const li = document.createElement('li');
      li.className = 'excluded-item';

      const span = document.createElement('span');
      span.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-site';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = `Remove ${site} from exclusion`;
      removeBtn.addEventListener('click', () => {
        removeExcludedSite(site);
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      excludedList.appendChild(li);
    });
  }

  /**
   * Save configuration to chrome storage and broadcast
   */
  function saveConfig(updatedProps) {
    currentConfig = { ...currentConfig, ...updatedProps };
    chrome.storage.local.set(currentConfig, () => {
      updateUI();
      broadcastToActiveTab();
    });
  }

  /**
   * Send direct update to current tab
   */
  function broadcastToActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'UPDATE_CONFIG',
          config: currentConfig
        }).catch(() => {
          // Tab might not be a valid target or content script not ready
        });
      }
    });
  }

  /**
   * Remove a site from exclusion list
   */
  function removeExcludedSite(site) {
    let list = Array.isArray(currentConfig.excludedSites) ? [...currentConfig.excludedSites] : [];
    list = list.filter(s => s.toLowerCase() !== site.toLowerCase());
    saveConfig({ excludedSites: list });
  }

  /**
   * Add a site to exclusion list
   */
  function addExcludedSite(site) {
    const clean = site.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!clean) return;

    let list = Array.isArray(currentConfig.excludedSites) ? [...currentConfig.excludedSites] : [];
    if (!list.includes(clean)) {
      list.push(clean);
      saveConfig({ excludedSites: list });
    }
  }

  // ==========================================
  // Event Listeners
  // ==========================================

  // Settings page shortcut
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Master switch
  masterToggle.addEventListener('change', () => {
    saveConfig({ enabled: masterToggle.checked });
  });

  // Current Site Switch
  siteToggle.addEventListener('change', () => {
    if (!currentDomain) return;
    let list = Array.isArray(currentConfig.excludedSites) ? [...currentConfig.excludedSites] : [];
    const isExcluded = isSiteExcluded(currentDomain, list);

    if (siteToggle.checked) {
      // User wants it ACTIVE on this site -> remove from excluded
      list = list.filter(item => {
        const clean = item.toLowerCase().trim().replace(/^www\./, '');
        return currentDomain !== clean && !currentDomain.endsWith('.' + clean);
      });
    } else {
      // User wants it DISABLED on this site -> add to excluded
      if (!isExcluded) {
        list.push(currentDomain);
      }
    }
    saveConfig({ excludedSites: list });
  });

  // Theme modes
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      saveConfig({ mode });
    });
  });

  // Sliders
  sliderBrightness.addEventListener('input', (e) => {
    valBrightness.textContent = `${e.target.value}%`;
    saveConfig({ brightness: Number(e.target.value) });
  });

  sliderContrast.addEventListener('input', (e) => {
    valContrast.textContent = `${e.target.value}%`;
    saveConfig({ contrast: Number(e.target.value) });
  });

  sliderSepia.addEventListener('input', (e) => {
    valSepia.textContent = `${e.target.value}%`;
    saveConfig({ sepia: Number(e.target.value) });
  });

  sliderGrayscale.addEventListener('input', (e) => {
    valGrayscale.textContent = `${e.target.value}%`;
    saveConfig({ grayscale: Number(e.target.value) });
  });

  // Reset sliders
  resetSlidersBtn.addEventListener('click', () => {
    saveConfig({
      brightness: DEFAULT_CONFIG.brightness,
      contrast: DEFAULT_CONFIG.contrast,
      sepia: DEFAULT_CONFIG.sepia,
      grayscale: DEFAULT_CONFIG.grayscale
    });
  });

  // Automation radio buttons
  activationRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        saveConfig({ activationMode: radio.value });
      }
    });
  });

  schedStart.addEventListener('change', () => {
    saveConfig({ scheduleStart: schedStart.value });
  });

  schedEnd.addEventListener('change', () => {
    saveConfig({ scheduleEnd: schedEnd.value });
  });

  // Add site manually
  manualAddSiteBtn.addEventListener('click', () => {
    if (manualSiteInput.value) {
      addExcludedSite(manualSiteInput.value);
      manualSiteInput.value = '';
    }
  });

  manualSiteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && manualSiteInput.value) {
      addExcludedSite(manualSiteInput.value);
      manualSiteInput.value = '';
    }
  });

  // ==========================================
  // Initialization
  // ==========================================
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      currentDomain = extractHostname(tabs[0].url);
    }

    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
      currentConfig = { ...DEFAULT_CONFIG, ...items };
      updateUI();
    });
  });
});

