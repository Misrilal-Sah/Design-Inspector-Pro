// Design Inspector Pro - Content Script (v2)
(function () {
  'use strict';
  if (window.__DIP_LOADED__) return;
  window.__DIP_LOADED__ = true;

  // ===== STATE =====
  let isActive = false;
  let isLocked = false;
  let currentMode = 'full';
  let hoveredElement = null;
  let lockedElement = null;
  let lastElement = null;
  let lastCursorX = 0;
  let lastCursorY = 0;
  let selectedElement = null;

  // ===== DOM =====
  let inspectOverlay = null;
  let highlightOverlay = null;
  let elementTag = null;
  let dimensionsLabel = null;
  let panelHost = null;
  let shadowRoot = null;
  let panelEl = null;
  let toastEl = null;

  // Zoom lens state (color mode)
  let screenshotCanvas = null;
  let screenshotDpr = 1;
  let lensHost = null;
  let lensRoot = null;
  let lensCanvas = null;
  let lensCtx = null;
  let lensInfoEl = null;
  let cursorPixelColor = null;
  let scrollRecaptureTimer = null;

  // ===== UTILITIES =====
  function throttle(fn, ms) {
    let last = 0, raf = null;
    return function (...args) {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, args); }
    };
  }

  function parseRGB(str) {
    if (!str) return null;
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }

  function rgbToHex(c) {
    if (!c) return '';
    return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function rgbToHSL(c) {
    if (!c) return '';
    let r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  function formatColor(cssVal) {
    const c = parseRGB(cssVal);
    if (!c || (c.r === 0 && c.g === 0 && c.b === 0 && c.a === 0)) return null;
    return { raw: cssVal, hex: rgbToHex(c), rgb: cssVal, hsl: rgbToHSL(c) };
  }

  function isTransparent(cssVal) {
    if (!cssVal || cssVal === 'transparent' || cssVal === 'rgba(0, 0, 0, 0)') return true;
    const c = parseRGB(cssVal);
    return c && c.a === 0;
  }

  // Walk up the DOM to find the effective visible background color
  function getEffectiveBackground(el) {
    // Use pixel sampling from screenshot for accurate visual background
    if (screenshotCanvas) {
      try {
        const rect = el.getBoundingClientRect();
        const cx = Math.round((rect.left + rect.width / 2) * screenshotDpr);
        const cy = Math.round((rect.top + rect.height / 2) * screenshotDpr);
        if (cx >= 0 && cx < screenshotCanvas.width && cy >= 0 && cy < screenshotCanvas.height) {
          const p = screenshotCanvas.getContext('2d').getImageData(cx, cy, 1, 1).data;
          return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
        }
      } catch (e) { /* fall through to DOM walk */ }
    }
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const bg = getComputedStyle(cur).backgroundColor;
      if (!isTransparent(bg)) return bg;
      cur = cur.parentElement;
    }
    return 'rgb(255, 255, 255)';
  }

  function getCSSSelector(el) {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 3) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(`#${cur.id}`); break; }
      if (cur.classList.length) sel += '.' + [...cur.classList].slice(0, 2).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(c => c.tagName === cur.tagName);
        if (siblings.length > 1) sel += `:nth-child(${[...parent.children].indexOf(cur) + 1})`;
      }
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function escH(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cleanFont(f) {
    return f.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).slice(0, 2).join(', ');
  }

  function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s; }

  // ===== ELEMENT ANALYSIS =====
  function analyzeElement(el) {
    const cs = getComputedStyle(el);
    const colors = [];
    const colorProps = [
      ['Text', 'color'], ['Background', 'backgroundColor'],
      ['Border Top', 'borderTopColor'], ['Border Right', 'borderRightColor'],
      ['Border Bottom', 'borderBottomColor'], ['Border Left', 'borderLeftColor'],
      ['Outline', 'outlineColor']
    ];
    colorProps.forEach(([label, prop]) => {
      const val = cs[prop];
      if (!isTransparent(val)) { const f = formatColor(val); if (f) colors.push({ label, ...f }); }
    });
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      const m = cs.boxShadow.match(/rgba?\([^)]+\)/);
      if (m) { const f = formatColor(m[0]); if (f) colors.push({ label: 'Shadow', ...f }); }
    }
    if (el instanceof SVGElement) {
      ['fill', 'stroke'].forEach(p => {
        const v = cs[p]; if (v && v !== 'none') { const f = formatColor(v); if (f) colors.push({ label: p.charAt(0).toUpperCase() + p.slice(1), ...f }); }
      });
    }

    const seenHex = new Set();
    const uniqueColors = colors.filter(c => { if (seenHex.has(c.hex)) return false; seenHex.add(c.hex); return true; });

    return {
      metadata: { tag: el.tagName.toLowerCase(), id: el.id || '', classes: [...el.classList].join(' '), selector: getCSSSelector(el) },
      typography: {
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform, textDecoration: cs.textDecorationLine || cs.textDecoration,
        textAlign: cs.textAlign, color: cs.color
      },
      colors: uniqueColors,
      layout: {
        width: cs.width, height: cs.height, display: cs.display, position: cs.position,
        flexDirection: cs.flexDirection, justifyContent: cs.justifyContent, alignItems: cs.alignItems,
        flexWrap: cs.flexWrap, gap: cs.gap,
        gridTemplateColumns: cs.gridTemplateColumns, gridTemplateRows: cs.gridTemplateRows,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
        overflow: cs.overflow
      },
      borders: {
        borderWidth: cs.borderWidth, borderStyle: cs.borderStyle,
        borderRadius: cs.borderRadius, boxShadow: cs.boxShadow, opacity: cs.opacity
      }
    };
  }

  // ===== UI CREATION =====
  function ensureUI() {
    if (!highlightOverlay) {
      highlightOverlay = document.createElement('div'); highlightOverlay.id = 'dip-highlight-overlay'; document.documentElement.appendChild(highlightOverlay);
      elementTag = document.createElement('div'); elementTag.id = 'dip-element-tag'; document.documentElement.appendChild(elementTag);
      dimensionsLabel = document.createElement('div'); dimensionsLabel.id = 'dip-dimensions'; document.documentElement.appendChild(dimensionsLabel);
      toastEl = document.createElement('div'); toastEl.id = 'dip-toast'; document.documentElement.appendChild(toastEl);
    }
    if (!panelHost) { createPanel(); }
    if (!lensHost) { createLens(); }
    if (!inspectOverlay) { createInspectOverlay(); }
  }

  function createInspectOverlay() {
    inspectOverlay = document.createElement('div');
    inspectOverlay.id = 'dip-inspect-overlay';
    document.documentElement.appendChild(inspectOverlay);
    inspectOverlay.addEventListener('mousemove', throttle(onMouseMove, 16));
    inspectOverlay.addEventListener('click', onOverlayClick);
    inspectOverlay.addEventListener('wheel', function () {
      inspectOverlay.style.pointerEvents = 'none';
      requestAnimationFrame(() => { if (inspectOverlay) inspectOverlay.style.pointerEvents = ''; });
    }, { passive: true });
  }

  function createPanel() {
    panelHost = document.createElement('div');
    panelHost.id = 'dip-panel-host';
    document.documentElement.appendChild(panelHost);
    shadowRoot = panelHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = getPanelStyles();
    shadowRoot.appendChild(style);
    panelEl = document.createElement('div');
    panelEl.className = 'dip-panel';
    shadowRoot.appendChild(panelEl);
  }

  function getPanelStyles() {
    return `
      *{margin:0;padding:0;box-sizing:border-box}
      .dip-panel{width:290px;max-height:420px;overflow-y:auto;overflow-x:hidden;background:rgba(10,14,23,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#e2e8f0;animation:dipFadeIn .2s ease}
      @keyframes dipFadeIn{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .dip-panel::-webkit-scrollbar{width:4px}.dip-panel::-webkit-scrollbar-track{background:transparent}.dip-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      .dip-header{padding:10px 12px 8px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:6px;flex-wrap:wrap;position:relative}
      .dip-tag{font-family:'SF Mono',Consolas,monospace;font-size:11px;font-weight:700;color:#818cf8}
      .dip-id{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:#f59e0b}
      .dip-classes{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
      .dip-close-btn{position:absolute;top:6px;right:8px;width:22px;height:22px;border:1px solid rgba(255,255,255,0.1);background:rgba(239,68,68,0.15);color:#f87171;border-radius:6px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;line-height:1}
      .dip-close-btn:hover{background:rgba(239,68,68,0.3);border-color:rgba(239,68,68,0.4)}
      .dip-locked-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;border-radius:4px;font-size:9px;font-weight:600;letter-spacing:.5px}
      .dip-section{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04)}
      .dip-section:last-child{border-bottom:none}
      .dip-section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;margin-bottom:6px;display:flex;align-items:center;gap:5px}
      .dip-section-title::before{content:'';width:3px;height:10px;border-radius:2px}
      .dip-section[data-s="colors"] .dip-section-title::before{background:#f472b6}
      .dip-section[data-s="typo"] .dip-section-title::before{background:#60a5fa}
      .dip-section[data-s="layout"] .dip-section-title::before{background:#34d399}
      .dip-section[data-s="borders"] .dip-section-title::before{background:#fbbf24}
      .dip-section[data-s="meta"] .dip-section-title::before{background:#a78bfa}
      .dip-prop{display:flex;align-items:center;padding:2px 0;gap:6px;min-height:22px}
      .dip-prop-label{font-size:10px;color:#64748b;min-width:60px;flex-shrink:0}
      .dip-prop-value{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:#cbd5e1;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;padding:1px 4px;border-radius:3px;transition:background .15s}
      .dip-prop-value:hover{background:rgba(99,102,241,0.15);color:#a78bfa}
      .dip-color-row{display:flex;align-items:center;gap:6px;padding:3px 0}
      .dip-color-label{font-size:10px;color:#64748b;min-width:50px}
      .dip-color-swatch{width:16px;height:16px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);flex-shrink:0}
      .dip-color-hex{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:#cbd5e1;cursor:pointer;padding:1px 4px;border-radius:3px;transition:background .15s}
      .dip-color-hex:hover{background:rgba(99,102,241,0.15);color:#a78bfa}
      .dip-color-extra{font-size:9px;color:#475569;cursor:pointer;padding:1px 3px;border-radius:3px;transition:background .15s}
      .dip-color-extra:hover{background:rgba(99,102,241,0.15);color:#94a3b8}
      .dip-copied{background:rgba(16,185,129,0.2)!important;color:#10b981!important}
      .dip-hint{padding:6px 12px;font-size:10px;color:#475569;text-align:center;border-top:1px solid rgba(255,255,255,0.04)}
    `;
  }

  // ===== PANEL RENDERING =====
  function renderPanel(data, locked) {
    if (!panelEl) return;
    let html = '';
    html += `<div class="dip-header">
      <span class="dip-tag">&lt;${data.metadata.tag}&gt;</span>
      ${data.metadata.id ? `<span class="dip-id">#${data.metadata.id}</span>` : ''}
      ${data.metadata.classes ? `<span class="dip-classes">.${escH(data.metadata.classes.replace(/ /g, '.'))}</span>` : ''}
      ${locked ? '<span class="dip-locked-badge">📌 Locked</span>' : ''}
      ${locked ? '<button class="dip-close-btn" id="dipCloseBtn" title="Unlock">×</button>' : ''}
    </div>`;

    // Colors
    if ((currentMode === 'full' || currentMode === 'color') && data.colors.length) {
      html += `<div class="dip-section" data-s="colors"><div class="dip-section-title">Colors</div>
        ${data.colors.map(c => `<div class="dip-color-row">
          <span class="dip-color-label">${c.label}</span>
          <span class="dip-color-swatch" style="background:${c.hex}"></span>
          <span class="dip-color-hex" data-copy="${c.hex}">${c.hex}</span>
          <span class="dip-color-extra" data-copy="${c.rgb}" title="${c.rgb}">rgb</span>
          <span class="dip-color-extra" data-copy="${c.hsl}" title="${c.hsl}">hsl</span>
        </div>`).join('')}</div>`;
    }

    // Typography
    if (currentMode === 'full' || currentMode === 'font') {
      const t = data.typography;
      html += `<div class="dip-section" data-s="typo"><div class="dip-section-title">Typography</div>
        ${mkProp('Font', cleanFont(t.fontFamily))}${mkProp('Size', t.fontSize)}${mkProp('Weight', t.fontWeight)}
        ${mkProp('Height', t.lineHeight)}${mkProp('Spacing', t.letterSpacing)}
        ${t.textTransform !== 'none' ? mkProp('Transform', t.textTransform) : ''}${mkProp('Align', t.textAlign)}</div>`;
    }

    // Layout
    if (currentMode === 'full' || currentMode === 'css') {
      const l = data.layout;
      html += `<div class="dip-section" data-s="layout"><div class="dip-section-title">Layout</div>
        ${mkProp('Size', `${l.width} × ${l.height}`)}${mkProp('Display', l.display)}
        ${l.position !== 'static' ? mkProp('Position', l.position) : ''}
        ${l.display.includes('flex') ? mkProp('Direction', l.flexDirection) : ''}
        ${l.display.includes('flex') ? mkProp('Justify', l.justifyContent) : ''}
        ${l.display.includes('flex') ? mkProp('Align', l.alignItems) : ''}
        ${l.display.includes('grid') ? mkProp('Columns', l.gridTemplateColumns) : ''}
        ${l.gap && l.gap !== 'normal' ? mkProp('Gap', l.gap) : ''}
        ${mkProp('Padding', l.padding)}${mkProp('Margin', l.margin)}</div>`;
    }

    // Borders
    if (currentMode === 'full' || currentMode === 'css') {
      const b = data.borders;
      const hasBorder = b.borderStyle !== 'none' && b.borderWidth !== '0px';
      const hasShadow = b.boxShadow !== 'none';
      const hasRadius = b.borderRadius !== '0px';
      if (hasBorder || hasShadow || hasRadius || b.opacity !== '1') {
        html += `<div class="dip-section" data-s="borders"><div class="dip-section-title">Borders & Effects</div>
          ${hasRadius ? mkProp('Radius', b.borderRadius) : ''}${hasBorder ? mkProp('Border', b.borderWidth) : ''}
          ${hasShadow ? mkProp('Shadow', truncate(b.boxShadow, 40)) : ''}${b.opacity !== '1' ? mkProp('Opacity', b.opacity) : ''}</div>`;
      }
    }

    // Metadata
    html += `<div class="dip-section" data-s="meta"><div class="dip-section-title">Element</div>
      ${mkProp('Selector', truncate(data.metadata.selector, 40))}</div>`;

    // Hint
    if (!locked) {
      html += `<div class="dip-hint">Click element to lock panel • Esc to exit</div>`;
    } else {
      html += `<div class="dip-hint">Click outside or × to unlock • Esc to exit</div>`;
    }

    panelEl.innerHTML = html;

    // Copy handlers
    panelEl.querySelectorAll('[data-copy]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(el.dataset.copy)
          .then(() => {
            showToast(`Copied: ${el.dataset.copy}`);
            el.classList.add('dip-copied');
            setTimeout(() => el.classList.remove('dip-copied'), 800);
          })
          .catch(() => showToast('Copy failed'));
      });
    });

    // Close button
    if (locked) {
      const closeBtn = panelEl.querySelector('#dipCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); unlockPanel(); });
    }
  }

  function mkProp(label, value) {
    if (!value || value === 'normal' || value === 'none') return '';
    return `<div class="dip-prop"><span class="dip-prop-label">${label}</span><span class="dip-prop-value" data-copy="${escH(value)}" title="${escH(value)}">${escH(value)}</span></div>`;
  }

  // ===== TOAST =====
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('dip-show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('dip-show'), 1800);
  }

  // ===== MOUSE HANDLING (on overlay) =====
  function onMouseMove(e) {
    if (!isActive || isLocked) return;
    lastCursorX = e.clientX;
    lastCursorY = e.clientY;
    const hideEls = [inspectOverlay, highlightOverlay, panelHost, elementTag, dimensionsLabel];
    if (lensHost) hideEls.push(lensHost);
    hideEls.forEach(el => { if (el) el.style.setProperty('display', 'none', 'important'); });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    hideEls.forEach(el => { if (el) el.style.setProperty('display', 'block', 'important'); });

    if (!el || el === document.body || el === document.documentElement || el === toastEl) {
      hideInspectUI();
      if (lensHost) lensHost.style.setProperty('display', 'none', 'important');
      lastElement = null; return;
    }
    const isNewElement = (el !== lastElement);
    if (isNewElement) {
      lastElement = el; hoveredElement = el; selectedElement = el;
      updateHighlight(el);
    }
    // Color mode: show zoom lens instead of panel
    if (currentMode === 'color' && screenshotCanvas && lensHost) {
      cursorPixelColor = updateLensView(e.clientX, e.clientY);
      positionLens(e.clientX, e.clientY);
      panelHost.style.setProperty('display', 'none', 'important');
    } else {
      // Always render fresh data for each new element
      if (isNewElement || !panelEl.innerHTML) renderPanel(analyzeElement(el), false);
      positionPanel(e.clientX, e.clientY);
      if (lensHost) lensHost.style.setProperty('display', 'none', 'important');
    }
  }

  function onOverlayClick(e) {
    if (!isActive) return;
    e.preventDefault();
    e.stopPropagation();
    // Color mode: pick pixel color AND lock the panel
    if (currentMode === 'color' && cursorPixelColor) {
      navigator.clipboard.writeText(cursorPixelColor)
        .then(() => {
          showToast('Copied: ' + cursorPixelColor);
        })
        .catch(() => showToast('Copy failed'));
      saveToColorHistory(cursorPixelColor);
      // Lock the panel with element info (like other modes)
      if (isLocked) { unlockPanel(); }
      else if (hoveredElement) { lockColorPanel(hoveredElement, cursorPixelColor, e.clientX, e.clientY); }
      return;
    }
    if (isLocked) { unlockPanel(); }
    else if (hoveredElement) { lockPanel(hoveredElement); }
  }

  // ===== HIGHLIGHT =====
  function updateHighlight(el) {
    const rect = el.getBoundingClientRect();
    const s = highlightOverlay.style;
    s.setProperty('display', 'block', 'important');
    s.setProperty('top', rect.top + 'px', 'important');
    s.setProperty('left', rect.left + 'px', 'important');
    s.setProperty('width', rect.width + 'px', 'important');
    s.setProperty('height', rect.height + 'px', 'important');

    const tag = el.tagName.toLowerCase();
    elementTag.textContent = `${tag}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 1).join('.') : ''}`;
    elementTag.style.setProperty('display', 'block', 'important');
    elementTag.style.setProperty('top', Math.max(0, rect.top - 20) + 'px', 'important');
    elementTag.style.setProperty('left', rect.left + 'px', 'important');

    dimensionsLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    dimensionsLabel.style.setProperty('display', 'block', 'important');
    dimensionsLabel.style.setProperty('top', (rect.bottom + 2) + 'px', 'important');
    dimensionsLabel.style.setProperty('left', rect.left + 'px', 'important');
  }

  function hideInspectUI() {
    [highlightOverlay, panelHost, elementTag, dimensionsLabel].forEach(el => {
      if (el) el.style.setProperty('display', 'none', 'important');
    });
  }

  // ===== PANEL POSITIONING =====
  function positionPanel(x, y) {
    const pw = 290, margin = 16;
    const ph = panelEl ? panelEl.offsetHeight || 300 : 300;
    let left = x + margin, top = y + margin;
    if (left + pw > window.innerWidth) left = x - pw - margin;
    if (top + ph > window.innerHeight) top = y - ph - margin;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    panelHost.style.setProperty('left', left + 'px', 'important');
    panelHost.style.setProperty('top', top + 'px', 'important');
    panelHost.style.setProperty('display', 'block', 'important');
  }

  // ===== LOCK / UNLOCK =====
  function lockPanel(el) {
    isLocked = true;
    lockedElement = el;
    selectedElement = el;
    highlightOverlay.classList.add('dip-locked');
    panelHost.classList.add('dip-locked');
    renderPanel(analyzeElement(el), true);
    updateHighlight(el);
    startLockedScrollListener();
  }

  function lockColorPanel(el, pickedHex, clickX, clickY) {
    isLocked = true;
    lockedElement = el;
    selectedElement = el;
    // Hide zoom lens, show info panel instead
    if (lensHost) lensHost.style.setProperty('display', 'none', 'important');
    highlightOverlay.classList.add('dip-locked');
    panelHost.classList.add('dip-locked');
    renderPanel(analyzeElement(el), true);
    updateHighlight(el);
    // Position panel beside the click point (same as other modes)
    positionPanel(clickX, clickY);
    startLockedScrollListener();
  }

  function unlockPanel() {
    isLocked = false;
    lockedElement = null;
    lastElement = null;
    highlightOverlay.classList.remove('dip-locked');
    panelHost.classList.remove('dip-locked');
    hideInspectUI();
    stopLockedScrollListener();
  }

  // ===== SCROLL TRACKING FOR LOCKED PANEL =====
  let lockedScrollHandler = null;

  function startLockedScrollListener() {
    stopLockedScrollListener();
    lockedScrollHandler = () => {
      if (!isLocked || !lockedElement) return;
      // Reposition highlight, tag, and dimensions to follow the element
      updateHighlight(lockedElement);
      // Reposition panel next to the element
      const rect = lockedElement.getBoundingClientRect();
      positionPanel(rect.right, rect.top);
    };
    window.addEventListener('scroll', lockedScrollHandler, true);
  }

  function stopLockedScrollListener() {
    if (lockedScrollHandler) {
      window.removeEventListener('scroll', lockedScrollHandler, true);
      lockedScrollHandler = null;
    }
  }

  // ===== ACTIVATE / DEACTIVATE =====
  async function activate(mode) {
    try {
      if (isActive) return;
      isActive = true;
      isLocked = false;
      currentMode = mode || 'full';
      lastElement = null;
      cursorPixelColor = null;
      ensureUI();
      inspectOverlay.style.setProperty('display', 'block', 'important');
      document.addEventListener('keydown', onKeyDown, true);
      // Capture screenshot for pixel-accurate Visual BG in all modes + zoom lens in color mode
      await captureScreenshot();
      startScrollRecapture();
    } catch (e) { console.error('DIP activate error:', e); }
  }

  function deactivate() {
    isActive = false;
    isLocked = false;
    lastElement = null;
    hoveredElement = null;
    cursorPixelColor = null;
    document.removeEventListener('keydown', onKeyDown, true);
    if (inspectOverlay) inspectOverlay.style.setProperty('display', 'none', 'important');
    hideInspectUI();
    if (highlightOverlay) highlightOverlay.classList.remove('dip-locked');
    if (panelHost) panelHost.classList.remove('dip-locked');
    if (lensHost) lensHost.style.setProperty('display', 'none', 'important');
    stopScrollRecapture();
    stopLockedScrollListener();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (isLocked) { unlockPanel(); }
      else if (isActive) { deactivate(); chrome.runtime.sendMessage({ type: 'DEACTIVATED' }); }
    }
  }

  // ===== ZOOM LENS (COLOR MODE) =====
  async function captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.dataUrl) { resolve(); return; }
        const img = new Image();
        img.onload = () => {
          screenshotCanvas = document.createElement('canvas');
          screenshotCanvas.width = img.width;
          screenshotCanvas.height = img.height;
          screenshotCanvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
          screenshotDpr = img.width / window.innerWidth;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = resp.dataUrl;
      });
    });
  }

  function startScrollRecapture() {
    stopScrollRecapture();
    const handler = () => {
      clearTimeout(scrollRecaptureTimer);
      scrollRecaptureTimer = setTimeout(() => {
        if (isActive && currentMode === 'color') captureScreenshot();
      }, 200);
    };
    window.__dipScrollHandler = handler;
    window.addEventListener('scroll', handler, true);
  }

  function stopScrollRecapture() {
    if (window.__dipScrollHandler) {
      window.removeEventListener('scroll', window.__dipScrollHandler, true);
      window.__dipScrollHandler = null;
    }
    clearTimeout(scrollRecaptureTimer);
  }

  function createLens() {
    lensHost = document.createElement('div');
    lensHost.id = 'dip-lens-host';
    lensHost.style.cssText = 'position:fixed!important;z-index:2147483647!important;pointer-events:none!important;display:none!important;';
    document.documentElement.appendChild(lensHost);
    lensRoot = lensHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      .lens-wrap{background:rgba(10,14,23,0.97);border:2px solid rgba(99,102,241,0.6);border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.6);animation:lensIn .15s ease;width:154px}
      @keyframes lensIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
      canvas{display:block;width:154px;height:154px;image-rendering:pixelated}
      .info{display:flex;align-items:center;gap:8px;padding:7px 10px;border-top:1px solid rgba(255,255,255,0.08)}
      .swatch{width:26px;height:26px;border-radius:6px;border:2px solid rgba(255,255,255,0.15);flex-shrink:0}
      .txt .hex{font-family:'SF Mono',Consolas,monospace;font-size:13px;font-weight:700;color:#e2e8f0}
      .txt .rgb{font-family:'SF Mono',Consolas,monospace;font-size:9px;color:#64748b;margin-top:1px}
      .hint{font-size:9px;color:#475569;text-align:center;padding:3px 0 5px;letter-spacing:.3px}
    `;
    lensRoot.appendChild(style);
    const wrap = document.createElement('div'); wrap.className = 'lens-wrap';
    lensCanvas = document.createElement('canvas'); lensCanvas.width = 154; lensCanvas.height = 154;
    wrap.appendChild(lensCanvas);
    lensCtx = lensCanvas.getContext('2d');
    lensInfoEl = document.createElement('div'); lensInfoEl.className = 'info';
    lensInfoEl.innerHTML = '<div class="swatch"></div><div class="txt"><div class="hex">#000000</div><div class="rgb">rgb(0, 0, 0)</div></div>';
    wrap.appendChild(lensInfoEl);
    const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Click to copy color';
    wrap.appendChild(hint);
    lensRoot.appendChild(wrap);
  }

  function updateLensView(x, y) {
    if (!screenshotCanvas || !lensCtx) return null;
    const LENS = 154, GRID = 11, CELL = LENS / GRID;
    const px = Math.round(x * screenshotDpr), py = Math.round(y * screenshotDpr);
    const half = Math.floor(GRID / 2);
    lensCtx.clearRect(0, 0, LENS, LENS);
    lensCtx.imageSmoothingEnabled = false;
    const srcCtx = screenshotCanvas.getContext('2d');
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const sx = px - half + i, sy = py - half + j;
        if (sx >= 0 && sx < screenshotCanvas.width && sy >= 0 && sy < screenshotCanvas.height) {
          const p = srcCtx.getImageData(sx, sy, 1, 1).data;
          lensCtx.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`;
        } else { lensCtx.fillStyle = '#1a1a2e'; }
        lensCtx.fillRect(Math.floor(i * CELL), Math.floor(j * CELL), Math.ceil(CELL), Math.ceil(CELL));
      }
    }
    lensCtx.strokeStyle = 'rgba(255,255,255,0.06)'; lensCtx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      const pos = Math.round(i * CELL);
      lensCtx.beginPath(); lensCtx.moveTo(pos, 0); lensCtx.lineTo(pos, LENS); lensCtx.stroke();
      lensCtx.beginPath(); lensCtx.moveTo(0, pos); lensCtx.lineTo(LENS, pos); lensCtx.stroke();
    }
    const cx = Math.floor(half * CELL), cy = Math.floor(half * CELL);
    lensCtx.strokeStyle = '#ffffff'; lensCtx.lineWidth = 2;
    lensCtx.strokeRect(cx, cy, Math.ceil(CELL), Math.ceil(CELL));
    if (px >= 0 && px < screenshotCanvas.width && py >= 0 && py < screenshotCanvas.height) {
      const cp = srcCtx.getImageData(px, py, 1, 1).data;
      const color = { r: cp[0], g: cp[1], b: cp[2] };
      const hex = rgbToHex(color);
      lensInfoEl.querySelector('.swatch').style.background = hex;
      lensInfoEl.querySelector('.hex').textContent = hex;
      lensInfoEl.querySelector('.rgb').textContent = `rgb(${color.r}, ${color.g}, ${color.b})`;
      return hex;
    }
    return null;
  }

  function positionLens(x, y) {
    const w = 158, h = 210, m = 20;
    let left = x + m, top = y - h / 2;
    if (left + w > window.innerWidth) left = x - w - m;
    if (top + h > window.innerHeight) top = window.innerHeight - h - 4;
    if (top < 4) top = 4;
    lensHost.style.setProperty('left', left + 'px', 'important');
    lensHost.style.setProperty('top', top + 'px', 'important');
    lensHost.style.setProperty('display', 'block', 'important');
  }

  function saveToColorHistory(hex) {
    chrome.storage.local.get(['dipColorHistory'], (data) => {
      let history = data.dipColorHistory || [];
      history = history.filter(h => h !== hex);
      history.unshift(hex);
      if (history.length > 20) history.pop();
      chrome.storage.local.set({ dipColorHistory: history });
    });
  }

  // ===== PAGE SCANNING =====
  function extractColorPalette() {
    const colorMap = new Map();
    const props = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
    document.querySelectorAll('*').forEach(el => {
      try {
        const cs = getComputedStyle(el);
        props.forEach(p => { const v = cs[p]; if (!isTransparent(v)) { const f = formatColor(v); if (f && !colorMap.has(f.hex)) colorMap.set(f.hex, f); } });
        if (cs.boxShadow && cs.boxShadow !== 'none') {
          const m = cs.boxShadow.match(/rgba?\([^)]+\)/g);
          if (m) m.forEach(v => { const f = formatColor(v); if (f && !colorMap.has(f.hex)) colorMap.set(f.hex, f); });
        }
      } catch (e) {}
    });
    return [...colorMap.values()];
  }

  function analyzeFontUsage() {
    const fonts = {};
    document.querySelectorAll('*').forEach(el => {
      try {
        const cs = getComputedStyle(el);
        const family = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
        if (!fonts[family]) fonts[family] = { family, sizes: new Set(), weights: new Set(), count: 0 };
        fonts[family].sizes.add(cs.fontSize);
        fonts[family].weights.add(cs.fontWeight);
        fonts[family].count++;
      } catch (e) {}
    });
    return Object.values(fonts).map(f => ({ family: f.family, sizes: [...f.sizes].sort(), weights: [...f.weights].sort(), count: f.count })).sort((a, b) => b.count - a.count);
  }

  function extractSpacing() {
    const spacings = new Set();
    const props = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap'];
    document.querySelectorAll('*').forEach(el => {
      try {
        const cs = getComputedStyle(el);
        props.forEach(p => { const v = cs[p]; if (v && v !== '0px' && v !== 'normal' && v !== 'auto') spacings.add(v); });
      } catch (e) {}
    });
    return [...spacings].sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  // ===== EXPORT =====
  function exportCSS() {
    const el = selectedElement;
    if (!el) return 'No element selected.\nActivate inspector and click an element first.';
    const cs = getComputedStyle(el);
    const sel = el.id ? `#${el.id}` : el.classList.length ? `.${[...el.classList].join('.')}` : el.tagName.toLowerCase();
    const pairs = [
      ['display', cs.display], ['position', cs.position], ['width', cs.width], ['height', cs.height],
      ['padding', `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`],
      ['margin', `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`],
      ['font-family', cs.fontFamily], ['font-size', cs.fontSize], ['font-weight', cs.fontWeight],
      ['line-height', cs.lineHeight], ['color', cs.color], ['background-color', cs.backgroundColor],
      ['border', `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`],
      ['border-radius', cs.borderRadius], ['box-shadow', cs.boxShadow], ['opacity', cs.opacity]
    ];
    let out = `${sel} {\n`;
    pairs.forEach(([k, v]) => {
      if (v && v !== 'none' && v !== 'normal' && v !== 'static' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)' && v !== '0px 0px 0px 0px' && v !== '1') out += `  ${k}: ${v};\n`;
    });
    return out + '}';
  }

  function exportJSON() {
    if (!selectedElement) return JSON.stringify({ error: 'No element selected' }, null, 2);
    return JSON.stringify(analyzeElement(selectedElement), null, 2);
  }

  function exportTokens() {
    if (!selectedElement) return JSON.stringify({ error: 'No element selected' }, null, 2);
    const cs = getComputedStyle(selectedElement);
    return JSON.stringify({
      color: { text: cs.color, background: cs.backgroundColor, border: cs.borderTopColor },
      typography: { family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, lineHeight: cs.lineHeight },
      spacing: { padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`, margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}` },
      border: { width: cs.borderTopWidth, radius: cs.borderRadius, shadow: cs.boxShadow }
    }, null, 2);
  }

  // ===== MESSAGE HANDLER =====
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      switch (msg.type) {
        case 'ACTIVATE': activate(msg.mode); sendResponse({ ok: true }); break;
        case 'DEACTIVATE': deactivate(); sendResponse({ ok: true }); break;
        case 'GET_STATE': sendResponse({ isActive, mode: currentMode }); break;
        case 'SET_MODE':
          currentMode = msg.mode;
          // Always keep screenshot for Visual BG accuracy; color mode also uses zoom lens
          if (isActive) {
            captureScreenshot().then(() => {
              // Re-render panel after screenshot is ready (for accurate Visual BG)
              if (currentMode !== 'color') {
                if (lensHost) lensHost.style.setProperty('display', 'none', 'important');
                const targetEl = isLocked ? lockedElement : hoveredElement;
                if (targetEl) {
                  renderPanel(analyzeElement(targetEl), isLocked);
                  if (isLocked) {
                    updateHighlight(targetEl);
                    positionPanel(lastCursorX, lastCursorY);
                  }
                }
              }
            });
          } else {
            if (currentMode !== 'color' && lensHost) lensHost.style.setProperty('display', 'none', 'important');
          }
          // Immediate re-render with current data (before screenshot finishes)
          if (currentMode !== 'color') {
            if (lensHost) lensHost.style.setProperty('display', 'none', 'important');
            const targetEl = isLocked ? lockedElement : hoveredElement;
            if (targetEl) {
              renderPanel(analyzeElement(targetEl), isLocked);
              if (isLocked) {
                updateHighlight(targetEl);
                positionPanel(lastCursorX, lastCursorY);
              }
            }
          }
          sendResponse({ ok: true }); break;
        case 'SCAN_COLORS': sendResponse({ colors: extractColorPalette() }); break;
        case 'SCAN_FONTS': sendResponse({ fonts: analyzeFontUsage() }); break;
        case 'EXPORT':
          sendResponse({ output: msg.format === 'json' ? exportJSON() : msg.format === 'tokens' ? exportTokens() : exportCSS() }); break;
        case 'GENERATE_SYSTEM':
          sendResponse({ system: { colors: extractColorPalette(), fonts: analyzeFontUsage(), spacing: extractSpacing() } }); break;
        default: sendResponse({ ok: false });
      }
    } catch (e) { console.error('DIP message error:', e); sendResponse({ error: e.message }); }
    return true;
  });
})();
