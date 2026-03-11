# Design Inspector Pro

A powerful Chrome extension for designers and developers to inspect, analyze, and extract visual properties from any webpage — colors, typography, layout, spacing, and more.

---

## ✨ Features

### 🔍 Inspector Modes

| Mode | Description |
|------|-------------|
| **Color** | Pixel-accurate color picker with zoom lens. Click any pixel to copy its exact hex color. |
| **Font** | Inspect typography - font family, size, weight, line-height, letter-spacing, and alignment. |
| **CSS** | View layout & styling - display, position, flexbox/grid properties, padding, margin, borders. |
| **Full** | All properties at once - colors, typography, layout, borders, and element metadata. |

### 🎨 Color Picker (Zoom Lens)

- **11×11 pixel grid** magnification for precise color picking
- Real-time hex and RGB display as you hover
- **Click to copy** the exact pixel color to clipboard
- Automatically saves picked colors to **Color History**

### 🎯 Element Inspection

- **Hover** over any element to see its properties in real-time
- **Click** to lock the panel in place (works in all modes including Color)
- Locked panels **follow the element** on scroll
- Press **Esc** to unlock or stop inspecting
- Element highlight with tag name, classes, and dimensions overlay

### 🧩 Palette Scanner

- Extracts **all unique colors** used on the current page
- Click any swatch to copy its hex value
- Clean grid layout with hover labels

### 🔤 Font Analyzer

- Detects all font families used on the page
- Shows usage count, sizes, and weights per font
- Sorted by frequency of use

### 📦 CSS Export

- Export selected element styles in **CSS**, **JSON**, or **Design Tokens** format
- One-click copy to clipboard

### 🏗️ Design System Generator

- Auto-generates a design system from the current page
- Extracts color palette, typography families, and spacing scale

### 🕐 Color History

- Persistent history of all picked colors (up to 20)
- Quick-access **history icon** in the header bar
- Click any history swatch to copy
- Clear history button

### 🌓 Theme Support

- **Dark mode** (default) and **Light mode**
- Toggle via the sun/moon icon in the header
- Theme preference is saved across sessions

### - Minimize / Maximize

- Compact minimized view showing just the title and expand button
- State is saved across sessions

---

## 📁 Project Structure

```
Chrome Extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── background/
│   └── background.js          # Service worker (tab capture, badge)
├── content/
│   ├── content.js             # Core inspection logic (injected into pages)
│   └── content.css            # Overlay & highlight styles
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup interactions & state management
│   └── popup.css              # Popup styles (dark/light themes)
├── icons/
│   └── icon.png               # Extension icon
└── README.md
```

---

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `Chrome Extension` folder
6. The extension icon appears in your toolbar - click it to open

---

## 🎮 Usage

1. Click the **Design Inspector Pro** icon in your Chrome toolbar
2. Select an inspection **mode** (Color, Font, CSS, or Full)
3. Click **Start Inspecting**
4. **Hover** over elements to see their properties
5. **Click** an element to lock the panel in place
6. Press **Esc** to unlock or stop inspecting

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Unlock panel / Stop inspecting |

---

## 🔒 Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access the current tab for element inspection |
| `clipboardWrite` | Copy colors and styles to clipboard |
| `storage` | Save theme preference, minimized state, and color history |

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension
- Vanilla JavaScript (no frameworks)
- Shadow DOM for isolated panel rendering
- Canvas API for pixel-accurate color picking
- Chrome Storage API for persistent state

---

## 📄 License

MIT License — free for personal and commercial use.
