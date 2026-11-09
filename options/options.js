/**
 * Dimmer Dark Mode - Options Page Script
 * Handles settings persistence, domain lists, import/export, and shortcuts
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
    excludedSites: [],
    fontBold: 'none',
    fontSmoothing: true,
    smoothTransition: true
  };

  let currentConfig = { ...DEFAULT_CONFIG };

  // UI Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const panel = document.getElementById(`tab-${targetTab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // UI Elements
  const modeRadios = document.querySelectorAll('input[name="optMode"]');
  const activationRadios = document.querySelectorAll('input[name="optActivation"]');
  const schedStart = document.getElementById('optSchedStart');
  const schedEnd = document.getElementById('optSchedEnd');
  const optScheduleRow = document.getElementById('optScheduleRow');
  const optTransition = document.getElementById('optTransition');

  const listModeRadios = document.querySelectorAll('input[name="optListMode"]');
  const optSitesCount = document.getElementById('optSitesCount');
  const optNewDomain = document.getElementById('optNewDomain');
  const optAddDomainBtn = document.getElementById('optAddDomainBtn');
  const optSearchDomain = document.getElementById('optSearchDomain');
  const optDomainList = document.getElementById('optDomainList');
  const clearAllSitesBtn = document.getElementById('clearAllSitesBtn');

  const optFontBold = document.getElementById('optFontBold');
  const optFontSmoothing = document.getElementById('optFontSmoothing');

  const openShortcutsBtn = document.getElementById('openShortcutsBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFileInput');
  const importStatus = document.getElementById('importStatus');
  const resetAllBtn = document.getElementById('resetAllBtn');
  const toast = document.getElementById('toast');

  let toastTimeout = null;
  function showToast(msg = 'Preferences saved') {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  function renderUI() {
    // Mode
    modeRadios.forEach(r => {
      r.checked = (r.value === currentConfig.mode);
    });

    // Activation
    activationRadios.forEach(r => {
      r.checked = (r.value === currentConfig.activationMode);
    });
    optScheduleRow.style.display = (currentConfig.activationMode === 'schedule') ? 'flex' : 'none';
    schedStart.value = currentConfig.scheduleStart || '19:00';
    schedEnd.value = currentConfig.scheduleEnd || '07:00';

    // Transition
    optTransition.checked = currentConfig.smoothTransition !== false;

    // List mode
    listModeRadios.forEach(r => {
      r.checked = (r.value === (currentConfig.siteListMode || 'blacklist'));
    });

    // Typography
    optFontBold.value = currentConfig.fontBold || 'none';
    optFontSmoothing.checked = currentConfig.fontSmoothing !== false;

    // Domains
    renderDomainList();
  }

  function renderDomainList() {
    const list = Array.isArray(currentConfig.excludedSites) ? currentConfig.excludedSites : [];
    optSitesCount.textContent = list.length;
    optDomainList.innerHTML = '';

    const filterText = (optSearchDomain.value || '').toLowerCase().trim();
    const filtered = list.filter(site => site.toLowerCase().includes(filterText));

    if (filtered.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'domain-empty';
      empty.textContent = list.length === 0 ? 'No domains in list' : 'No matching domains found';
      optDomainList.appendChild(empty);
      return;
    }

    filtered.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'domain-item';

      const span = document.createElement('span');
      span.textContent = domain;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-domain';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = `Remove ${domain}`;
      removeBtn.addEventListener('click', () => {
        removeDomain(domain);
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      optDomainList.appendChild(li);
    });
  }

  function saveConfig(updatedProps) {
    currentConfig = { ...currentConfig, ...updatedProps };
    chrome.storage.local.set(currentConfig, () => {
      renderUI();
      showToast('Settings updated');
    });
  }

  function addDomain(domain) {
    const clean = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!clean) return;

    let list = Array.isArray(currentConfig.excludedSites) ? [...currentConfig.excludedSites] : [];
    if (!list.includes(clean)) {
      list.push(clean);
      saveConfig({ excludedSites: list });
    }
  }

  function removeDomain(domain) {
    let list = Array.isArray(currentConfig.excludedSites) ? [...currentConfig.excludedSites] : [];
    list = list.filter(s => s.toLowerCase() !== domain.toLowerCase());
    saveConfig({ excludedSites: list });
  }

  // Event Listeners
  modeRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) saveConfig({ mode: r.value });
    });
  });

  activationRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) saveConfig({ activationMode: r.value });
    });
  });

  schedStart.addEventListener('change', () => {
    saveConfig({ scheduleStart: schedStart.value });
  });

  schedEnd.addEventListener('change', () => {
    saveConfig({ scheduleEnd: schedEnd.value });
  });

  optTransition.addEventListener('change', () => {
    saveConfig({ smoothTransition: optTransition.checked });
  });

  listModeRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) saveConfig({ siteListMode: r.value });
    });
  });

  optFontBold.addEventListener('change', () => {
    saveConfig({ fontBold: optFontBold.value });
  });

  optFontSmoothing.addEventListener('change', () => {
    saveConfig({ fontSmoothing: optFontSmoothing.checked });
  });

  optAddDomainBtn.addEventListener('click', () => {
    if (optNewDomain.value) {
      addDomain(optNewDomain.value);
      optNewDomain.value = '';
    }
  });

  optNewDomain.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && optNewDomain.value) {
      addDomain(optNewDomain.value);
      optNewDomain.value = '';
    }
  });

  optSearchDomain.addEventListener('input', () => {
    renderDomainList();
  });

  clearAllSitesBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all configured domains?')) {
      saveConfig({ excludedSites: [] });
    }
  });

  // Chrome Shortcuts Manager link
  openShortcutsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Export Settings
  exportBtn.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `dimmer-settings-${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
    showToast('Configuration exported');
  });

  // Import Settings
  importBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        chrome.storage.local.set(imported, () => {
          currentConfig = { ...DEFAULT_CONFIG, ...imported };
          renderUI();
          importStatus.textContent = 'Import successful!';
          showToast('Settings imported successfully');
          setTimeout(() => { importStatus.textContent = ''; }, 3000);
        });
      } catch (err) {
        importStatus.textContent = 'Invalid JSON file';
        setTimeout(() => { importStatus.textContent = ''; }, 3000);
      }
    };
    reader.readAsText(file);
  });

  // Reset to Defaults
  resetAllBtn.addEventListener('click', () => {
    if (confirm('Reset all Dimmer settings to factory defaults?')) {
      chrome.storage.local.clear(() => {
        chrome.storage.local.set(DEFAULT_CONFIG, () => {
          currentConfig = { ...DEFAULT_CONFIG };
          renderUI();
          showToast('All settings reset to default');
        });
      });
    }
  });

  // Initialize
  chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
    currentConfig = { ...DEFAULT_CONFIG, ...items };
    renderUI();
  });
});

