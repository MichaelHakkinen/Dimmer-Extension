# 🌙 Dimmer - Universal Dark Mode Chrome Extension (Manifest V3)

**Dimmer** is a fast, lightweight, and modern Chrome extension that transforms every website into a comfortable, sleek dark mode with intelligent media preservation and zero white flashes during navigation.

---

## ✨ Features

- **Universal Compatibility**: Works automatically across all websites (Google, Wikipedia, blogs, news sites, documentation, social media, web apps).
- **Zero White Flash**: Pre-renders dark background styles at `document_start` so you never get blinded by a white flicker during page loads.
- **4 Theme Engines**:
  - **✨ Smart Dark (Default)**: Inverts light surfaces into rich charcoal dark mode while preserving original colors of photos, videos, canvases, avatars, and icons.
  - **🌑 OLED Black**: Pure #000000 black background for maximum OLED battery savings and high contrast.
  - **🌙 Night Shift**: Retains site layout but dims brightness and introduces a warm sepia tone to filter out blue light at night.
  - **🎨 Charcoal**: Direct CSS color overrides for a native dark-mode stylesheet experience.
- **Display Tuning Sliders**:
  - **Brightness** (50% – 120%)
  - **Contrast** (60% – 140%)
  - **Warmth / Sepia** (0% – 100%)
  - **Grayscale** (0% – 100%)
  - Quick **Reset** button to restore defaults anytime.
- **Per-Site Exclusion & Whitelist**:
  - One-click toggle in the popup to enable or disable dark mode for the active website.
  - Excluded sites manager with instant remove and manual domain addition.
- **Automation Modes**:
  - **Always On**: Keeps dark mode active 24/7.
  - **Follow System Dark Mode**: Automatically turns ON when your OS is in dark mode (`prefers-color-scheme: dark`).
  - **Custom Schedule**: Activate dark mode automatically between designated hours (e.g., 7:00 PM to 7:00 AM).
- **Keyboard Shortcuts**:
  - <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>: Toggle dark mode globally on/off.
  - <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>: Toggle dark mode for the current website.
- **Context Menu Integration**: Right-click anywhere on any webpage to quickly toggle dark mode for that site.
- **Print Optimization**: Automatically restores normal white backgrounds when printing pages to avoid wasting ink.

---

## 🚀 How to Install & Load in Google Chrome

1. Open **Google Chrome**.
2. In the address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. In the folder picker dialog, select this folder:
   ```text
   C:\Users\a3875\OneDrive\Desktop\Dimmer Extension
   ```
6. Click **Select Folder**.
7. Pin **Dimmer** to your Chrome toolbar by clicking the puzzle piece icon (Extensions) in Chrome's top bar and clicking the pin icon next to Dimmer.

---

## 📂 Project Structure

```
Dimmer Extension/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Background service worker (shortcuts, menus, badges)
├── content.js                 # Content script injected at document_start
├── css/
│   └── content.css            # Dark mode styles, media preservation, dark scrollbars
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Glassmorphic dark popup stylesheet
│   └── popup.js               # Reactive popup logic and real-time tab sync
├── icons/
│   ├── icon16.png             # 16x16 toolbar icon
│   ├── icon32.png             # 32x32 icon
│   ├── icon48.png             # 48x48 icon
│   ├── icon128.png            # 128x128 store/management icon
│   └── icon.svg               # Vector SVG icon
├── test/
│   └── sample.html            # Test webpage to verify dark mode rendering
├── scripts/
│   └── generate_icons.js      # Self-contained Node.js icon generator
└── README.md                  # Documentation and user guide
```

---

## 🧪 Testing Your Extension

1. After loading the extension, open `test/sample.html` in Chrome (or navigate to any website like [wikipedia.org](https://wikipedia.org) or [google.com](https://google.com)).
2. Click the **Dimmer** icon in the Chrome toolbar.
3. Switch between **Smart Dark**, **OLED Black**, and **Night Shift**, and adjust the brightness and warmth sliders to your preference.
4. Try toggling off the current site or using the shortcut <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>.

