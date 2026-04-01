<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:0d0d1a,30:1a0a4a,60:4a2090,85:7c3aed,100:9f67fa&height=260&section=header&text=Design%20Inspector%20Pro&fontSize=52&fontColor=ffffff&animation=twinkling&fontAlignY=44&desc=Pixel-perfect%20colors%20%C2%B7%20decode%20typography%20%C2%B7%20extract%20CSS%20%E2%80%94%20all%20without%20leaving%20the%20page&descAlignY=65&descSize=15&descColor=ddd6fe" alt="Design Inspector Pro" />

<img src="https://res.cloudinary.com/ddrlxvnsh/image/upload/v1775080116/icon_jkqk1k.png" width="88" height="88" alt="Design Inspector Pro" />

<br/><br/>

<a href="manifest.json"><img src="https://img.shields.io/badge/Version-3.3.1-6c63ff?style=flat-square&labelColor=0d0d1a" alt="Version"/></a>
&nbsp;
<a href="manifest.json"><img src="https://img.shields.io/badge/Manifest-V3-4ade80?style=flat-square&labelColor=0d0d1a" alt="Manifest V3"/></a>
&nbsp;
<a href="#-license"><img src="https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square&labelColor=0d0d1a" alt="MIT License"/></a>
&nbsp;
<a href="https://developer.chrome.com/docs/extensions/"><img src="https://img.shields.io/badge/Chrome-Extension-ef4444?style=flat-square&logo=googlechrome&logoColor=white&labelColor=0d0d1a" alt="Chrome Extension"/></a>
&nbsp;
<img src="https://img.shields.io/badge/Vanilla_JS-Zero_Dependencies-facc15?style=flat-square&logo=javascript&logoColor=black&labelColor=0d0d1a" alt="Vanilla JS"/>

<br/><br/>

</div>

---

## ◈ What It Does

Design Inspector Pro injects a real-time inspection panel directly into any webpage. Switch modes to examine colors at pixel level, decode element typography, dissect layout and CSS, or pull everything at once — then export it all in the format you want.

---

## ◈ Five Tabs, One Purpose

```
┌───────────┬───────────┬───────────┬───────────┬───────────┐
│ Inspector │  Palette  │   Fonts   │  Export   │  System   │
└───────────┴───────────┴───────────┴───────────┴───────────┘
```

| Tab | What You Get |
|-----|-------------|
| **Inspector** | Real-time element properties with 4 inspection modes |
| **Palette** | Full-page color extraction with copyable swatches |
| **Fonts** | All typefaces ranked by usage with size & weight data |
| **Export** | Dump element styles as CSS, JSON, or Design Tokens |
| **System** | Auto-generated design system — colors, type, spacing |

---

## ◈ Inspection Modes

<table>
<tr>
<td width="25%" align="center">

### 🎨 Color
Pixel-accurate zoom lens · 11×11 grid magnification · Hex + RGB + HSL · Click to copy · Auto-saves to history

</td>
<td width="25%" align="center">

### 🔤 Font
Font family · Size · Weight · Line-height · Letter-spacing · Text alignment

</td>
<td width="25%" align="center">

### `</>` CSS
Display · Position · Flexbox/Grid · Padding · Margin · Border · Box-shadow

</td>
<td width="25%" align="center">

### ⬡ Full
Everything combined — colors, typography, layout, borders, element metadata in one panel

</td>
</tr>
</table>

---

## ◈ Feature Highlights

### 🔬 Pixel-Perfect Color Picker
The zoom lens renders an **11×11 magnified pixel grid** around your cursor. Hover to preview live hex and RGB values. Click to copy the exact color and append it to your persistent history.

### 🎯 Smart Element Locking
Hover to preview — click to lock. The inspection panel **follows the element on scroll** so context is never lost. Hit `Esc` to release.

### 🧩 Full-Page Palette Scanner
Crawls every element on the page and extracts all unique colors into a clean, copyable swatch grid — every color the page uses, laid out at a glance.

### 🏗️ Design System Generator
One click produces a complete design system snapshot: color palette, type scale, and spacing scale — extracted directly from the live page.

### 🕐 Color History
Picked colors are saved automatically (up to 20). Access them anytime via the clock icon in the header. Click any swatch to copy, or wipe the slate clean in one tap.

### 📤 Multi-Format CSS Export
Export any element's computed styles as:
- **CSS** — drop-in stylesheet declarations  
- **JSON** — structured property map  
- **Design Tokens** — W3C-style token format

### 🌓 Dark / Light Theme
Ships in dark mode. Toggle with the sun/moon icon — preference persists across sessions.

---

## ◈ Installation

```bash
# 1 — Clone or download
git clone https://github.com/your-username/design-inspector-pro.git

# 2 — Load in Chrome
# Navigate to chrome://extensions/
# Enable "Developer mode" (top-right toggle)
# Click "Load unpacked" → select the project folder
```

> The extension icon will appear in your toolbar immediately after loading.

---

## ◈ How to Use

```
① Click the Design Inspector Pro icon in your Chrome toolbar
② Pick a mode  →  Color · Font · CSS · Full
③ Hit "Start Inspecting"
④ Hover any element to preview its properties live
⑤ Click to lock the panel  |  Esc to release
```

### Keyboard Shortcut

| Key | Action |
|-----|--------|
| `Esc` | Unlock panel / stop inspecting |

---

## ◈ Project Structure

```
Design Inspector Pro/
├── manifest.json              ← Extension manifest (MV3)
├── background/
│   └── background.js          ← Service worker
├── content/
│   ├── content.js             ← Core inspection engine (injected)
│   └── content.css            ← Overlay & highlight styles
├── popup/
│   ├── popup.html             ← Extension popup shell
│   ├── popup.js               ← State management & tab logic
│   └── popup.css              ← Dark / light theme styles
└── icons/
    └── icon.png               ← Extension icon
```

---

## ◈ Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Inspect the current page's DOM and styles |
| `clipboardWrite` | Copy colors and CSS to clipboard |
| `storage` | Persist theme, minimize state, and color history |

---

## ◈ Tech Stack

| Layer | Details |
|-------|---------|
| **Platform** | Chrome Extension — Manifest V3 |
| **Logic** | Vanilla JavaScript · Zero dependencies · Zero frameworks |
| **Isolation** | Shadow DOM — panel never conflicts with host page styles |
| **Color Engine** | Canvas API · `getImageData` for sub-pixel accuracy |
| **Persistence** | Chrome Storage API |

---

## ◈ License

**MIT** — free for personal and commercial use.

---

<div align="center">



<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:9f67fa,15:7c3aed,40:4a2090,70:1a0a4a,100:0d0d1a&height=140&section=footer&animation=twinkling&reversal=true" alt="" />

</div>
