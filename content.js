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

  // Invert-based modes would turn an already-dark site light, so they are skipped there
  const INVERT_MODES = ['smart', 'oled'];
  const DIMMER_CLASSES = [
    'dimmer-preloading',
    'dimmer-active',
    'dimmer-mode-smart',
    'dimmer-mode-oled',
    'dimmer-mode-night',
    'dimmer-mode-deep',
    'dimmer-font-smoothing',
    'dimmer-font-bold-medium',
    'dimmer-font-bold-high'
  ];
  let pageIsNativelyDark = false;

  function parseColor(str) {
    const m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function luminance({ r, g, b }) {
    const lin = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  /**
   * Detect whether the site already renders a dark theme on its own.
   * Dimmer's classes are removed for the measurement so our own overrides
   * don't skew the result, then restored synchronously (no repaint happens).
   */
  function detectNativeDark() {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return false;

    const saved = DIMMER_CLASSES.filter(c => root.classList.contains(c));
    root.classList.remove(...saved);

    let bg = null;
    for (const el of [body, root]) {
      const c = parseColor(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.5) { bg = c; break; }
    }
    const textColor = parseColor(getComputedStyle(body).color);
    const scheme = getComputedStyle(root).colorScheme || '';

    root.classList.add(...saved);

    if (bg) return luminance(bg) < 0.2;
    // Transparent page: the canvas is dark only if the page opted into a dark color-scheme
    // and its text is light
    return /dark/.test(scheme) && !!textColor && luminance(textColor) > 0.5;
  }

  function refreshNativeDark() {
    const isDark = detectNativeDark();
    if (isDark !== pageIsNativelyDark) {
      pageIsNativelyDark = isDark;
      applyTheme(currentConfig);
    }
  }

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

    // Remove preloading guard and existing mode classes
    root.classList.remove(...DIMMER_CLASSES);

    if (isActive) {
      const mode = config.mode || 'smart';
      root.classList.add('dimmer-active');
      // Site is already dark: inverting it would make it light again, so leave it as-is
      if (!(pageIsNativelyDark && INVERT_MODES.includes(mode))) {
        root.classList.add(`dimmer-mode-${mode}`);
      }

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

  /**
   * Transparent diagrams/screenshots are usually drawn for a white page: their
   * edges are smoothed against white and look like jagged halos on dark.
   * Large images get a white backing (via CSS class) so they look as intended.
   * Small images (icons, short logos) stay transparent.
   */
  const SOLID_BG_MIN_SIZE = 120;

  function markImage(img) {
    if (!(img instanceof HTMLImageElement) || !img.complete || !img.naturalWidth) return;
    const rect = img.getBoundingClientRect();
    const w = rect.width || img.naturalWidth;
    const h = rect.height || img.naturalHeight;
    img.classList.toggle('dimmer-solid-bg', w >= SOLID_BG_MIN_SIZE && h >= SOLID_BG_MIN_SIZE);
  }

  // Image load events don't bubble, so listen in the capture phase (covers lazy-loaded images)
  document.addEventListener('load', (e) => markImage(e.target), true);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(markImage);
  }, { once: true });

  /**
   * Many sites draw avatars and thumbnails as CSS background images set in a
   * stylesheet, which CSS selectors can't see. Find them via computed style
   * and tag them so the stylesheet flips them back like regular images.
   */
  const BG_IMAGE_CLASS = 'dimmer-bg-image';
  const BG_MIN_SIZE = 12;          // smaller than this is decoration, not a picture
  const BG_MAX_DESCENDANTS = 40;   // more than this is a page/section wrapper with a texture
  const SKIP_TAGS = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META',
    'IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'IFRAME', 'EMBED', 'OBJECT', 'SVG', 'svg']);

  function hasPictureBackground(el) {
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none' || !bg.includes('url(')) return false;
    // SVG backgrounds are almost always icons, which should stay inverted to match the text
    const urls = bg.match(/url\([^)]*\)/g) || [];
    return urls.some(u => !/(data:image\/svg|\.svg)/i.test(u));
  }

  function markBackground(el) {
    if (!(el instanceof Element) || SKIP_TAGS.has(el.tagName)) return;
    let isPicture = false;
    if (hasPictureBackground(el)) {
      const rect = el.getBoundingClientRect();
      isPicture = rect.width >= BG_MIN_SIZE && rect.height >= BG_MIN_SIZE &&
        el.getElementsByTagName('*').length <= BG_MAX_DESCENDANTS;
    }
    if (isPicture !== el.classList.contains(BG_IMAGE_CLASS)) {
      el.classList.toggle(BG_IMAGE_CLASS, isPicture);
    }
  }

  // Elements are checked in small batches during idle time so big pages don't stall
  const bgQueue = new Set();
  let bgScheduled = false;
  const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 50));

  function queueBackgroundCheck(el) {
    bgQueue.add(el);
    if (!bgScheduled) {
      bgScheduled = true;
      idle(processBackgroundQueue);
    }
  }

  function processBackgroundQueue(deadline) {
    const it = bgQueue.values();
    while (bgQueue.size && deadline.timeRemaining() > 1) {
      const el = it.next().value;
      bgQueue.delete(el);
      if (el.isConnected) markBackground(el);
    }
    bgScheduled = false;
    if (bgQueue.size) {
      bgScheduled = true;
      idle(processBackgroundQueue);
    }
  }

  function queueSubtree(node) {
    if (!(node instanceof Element)) return;
    queueBackgroundCheck(node);
    for (const el of node.getElementsByTagName('*')) queueBackgroundCheck(el);
  }

  const bgObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(queueSubtree);
      } else if (m.target !== document.documentElement) {
        queueBackgroundCheck(m.target);
      }
    }
  });

  function startBackgroundScan() {
    if (document.body) queueSubtree(document.body);
    bgObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBackgroundScan, { once: true });
  } else {
    startBackgroundScan();
  }
  // Stylesheets that finish loading late can add background images after the first pass
  window.addEventListener('load', () => {
    if (document.body) queueSubtree(document.body);
  }, { once: true });

  // Check for native dark themes once the page has styled itself
  // (again on load and shortly after, for sites that switch theme via JS)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshNativeDark, { once: true });
  } else {
    refreshNativeDark();
  }
  window.addEventListener('load', () => {
    refreshNativeDark();
    setTimeout(refreshNativeDark, 1500);
  }, { once: true });

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
      // The site may switch its own theme with the OS, so re-detect too
      pageIsNativelyDark = detectNativeDark();
      applyTheme(currentConfig);
    });
  }
})();

