// Design Inspector Pro - Popup Script (v2)

document.addEventListener('DOMContentLoaded', () => {
  // ===== STATE =====
  let isActive = false;
  let currentMode = 'full';
  let exportFormat = 'css';
  let isDark = true;
  let isMinimized = false;

  // ===== ELEMENTS =====
  const fullView = document.getElementById('fullView');
  const minimizedView = document.getElementById('minimizedView');
  const activateBtn = document.getElementById('activateBtn');
  const btnText = activateBtn.querySelector('.btn-text');
  const playIcon = activateBtn.querySelector('.btn-icon.play');
  const stopIcon = activateBtn.querySelector('.btn-icon.stop');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  const modeCards = document.querySelectorAll('.mode-card');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const scanColorsBtn = document.getElementById('scanColors');
  const scanFontsBtn = document.getElementById('scanFonts');
  const exportBtn = document.getElementById('exportBtn');
  const copyExportBtn = document.getElementById('copyExport');
  const generateSystemBtn = document.getElementById('generateSystem');
  const formatBtns = document.querySelectorAll('.format-btn');
  const exportOutput = document.getElementById('exportOutput');
  const paletteGrid = document.getElementById('paletteGrid');
  const fontList = document.getElementById('fontList');
  const systemOutput = document.getElementById('systemOutput');
  const themeToggle = document.getElementById('themeToggle');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const expandBtn = document.getElementById('expandBtn');
  const iconSun = themeToggle.querySelector('.icon-sun');
  const iconMoon = themeToggle.querySelector('.icon-moon');

  // ===== INIT: Load saved state =====
  chrome.storage.local.get(['dipTheme', 'dipMinimized'], (data) => {
    if (data.dipTheme === 'light') { isDark = false; applyTheme(); }
    if (data.dipMinimized) { isMinimized = true; applyMinimize(); }
  });

  // Color history elements
  const colorHistorySection = document.getElementById('colorHistorySection');
  const historyGrid = document.getElementById('historyGrid');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const historyBtn = document.getElementById('historyBtn');
  loadColorHistory();

  // ===== HISTORY BUTTON (header shortcut) =====
  historyBtn.addEventListener('click', () => {
    // Switch to Palette tab
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));
    const paletteTab = document.querySelector('[data-tab="palette"]');
    paletteTab.classList.add('active');
    document.getElementById('tab-palette').classList.add('active');
    // Load and scroll to history
    loadColorHistory();
    setTimeout(() => {
      if (colorHistorySection) colorHistorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  // ===== THEME TOGGLE =====
  themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    applyTheme();
    chrome.storage.local.set({ dipTheme: isDark ? 'dark' : 'light' });
  });

  function applyTheme() {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (isDark) {
      iconSun.style.display = 'block';
      iconMoon.style.display = 'none';
    } else {
      iconSun.style.display = 'none';
      iconMoon.style.display = 'block';
    }
  }

  // ===== MINIMIZE / MAXIMIZE =====
  minimizeBtn.addEventListener('click', () => {
    isMinimized = true;
    applyMinimize();
    chrome.storage.local.set({ dipMinimized: true });
  });

  expandBtn.addEventListener('click', () => {
    isMinimized = false;
    applyMinimize();
    chrome.storage.local.set({ dipMinimized: false });
  });

  function applyMinimize() {
    if (isMinimized) {
      fullView.style.display = 'none';
      minimizedView.style.display = 'flex';
    } else {
      fullView.style.display = 'block';
      minimizedView.style.display = 'none';
    }
  }

  // ===== TAB SWITCHING =====
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
      // Reload history when switching to palette tab
      if (target === 'palette') loadColorHistory();
    });
  });

  // ===== MODE SELECTION =====
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      currentMode = card.dataset.mode;
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      if (isActive) sendToContent({ type: 'SET_MODE', mode: currentMode });
    });
  });

  // ===== ACTIVATE / DEACTIVATE =====
  activateBtn.addEventListener('click', () => {
    isActive = !isActive;
    updateActivateUI();
    sendToContent({ type: isActive ? 'ACTIVATE' : 'DEACTIVATE', mode: currentMode });
    chrome.runtime.sendMessage({ type: isActive ? 'ACTIVATED' : 'DEACTIVATED' });
  });

  function updateActivateUI() {
    if (isActive) {
      activateBtn.classList.add('active');
      btnText.textContent = 'Stop Inspecting';
      playIcon.style.display = 'none';
      stopIcon.style.display = 'inline';
      statusDot.classList.add('active');
      statusText.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      activateBtn.classList.remove('active');
      btnText.textContent = 'Start Inspecting';
      playIcon.style.display = 'inline';
      stopIcon.style.display = 'none';
      statusDot.classList.remove('active');
      statusText.classList.remove('active');
      statusText.textContent = 'Inactive';
    }
  }

  // ===== FORMAT SELECTION =====
  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      exportFormat = btn.dataset.format;
      formatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ===== SCAN COLORS =====
  scanColorsBtn.addEventListener('click', () => {
    setBtnLoading(scanColorsBtn, 'Scanning...');
    sendToContent({ type: 'SCAN_COLORS' }, (response) => {
      resetBtn(scanColorsBtn, 'Scan Page', '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>');
      if (response && response.colors) renderPalette(response.colors);
    });
  });

  // ===== SCAN FONTS =====
  scanFontsBtn.addEventListener('click', () => {
    setBtnLoading(scanFontsBtn, 'Scanning...');
    sendToContent({ type: 'SCAN_FONTS' }, (response) => {
      resetBtn(scanFontsBtn, 'Scan Page', '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>');
      if (response && response.fonts) renderFonts(response.fonts);
    });
  });

  // ===== EXPORT =====
  exportBtn.addEventListener('click', () => {
    sendToContent({ type: 'EXPORT', format: exportFormat }, (response) => {
      if (response && response.output) {
        exportOutput.textContent = response.output;
        exportOutput.classList.add('has-content');
        copyExportBtn.style.display = 'flex';
      }
    });
  });

  copyExportBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(exportOutput.textContent).then(() => showToast('Copied to clipboard!'));
  });

  // ===== GENERATE DESIGN SYSTEM =====
  generateSystemBtn.addEventListener('click', () => {
    setBtnLoading(generateSystemBtn, 'Generating...');
    sendToContent({ type: 'GENERATE_SYSTEM' }, (response) => {
      resetBtn(generateSystemBtn, 'Generate', '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
      if (response && response.system) renderDesignSystem(response.system);
    });
  });

  // ===== RENDER PALETTE =====
  function renderPalette(colors) {
    if (!colors.length) {
      paletteGrid.innerHTML = '<div class="empty-state"><p>No colors found on this page</p></div>';
      paletteGrid.classList.remove('has-colors');
      return;
    }
    paletteGrid.classList.add('has-colors');
    paletteGrid.innerHTML = colors.map(c =>
      `<div class="color-swatch" style="background:${c.hex}" data-hex="${c.hex}" data-copy="${c.hex}" title="${c.hex}"></div>`
    ).join('');
    paletteGrid.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        navigator.clipboard.writeText(swatch.dataset.copy).then(() => {
          swatch.classList.add('copied');
          showToast(`Copied ${swatch.dataset.copy}`);
          setTimeout(() => swatch.classList.remove('copied'), 1500);
        });
      });
    });
  }

  // ===== RENDER FONTS =====
  function renderFonts(fonts) {
    if (!fonts.length) {
      fontList.innerHTML = '<div class="empty-state"><p>No fonts detected</p></div>';
      return;
    }
    fontList.innerHTML = fonts.map((f, i) => `
      <div class="font-item" style="animation-delay:${i * 0.05}s">
        <div class="font-family-name">
          ${escapeHTML(f.family)}
          <span class="font-count">${f.count} uses</span>
        </div>
        <div class="font-meta">
          ${f.sizes.map(s => `<span class="font-tag">${s}</span>`).join('')}
          ${f.weights.map(w => `<span class="font-tag">w${w}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  // ===== RENDER DESIGN SYSTEM =====
  function renderDesignSystem(system) {
    let html = '';
    if (system.colors && system.colors.length) {
      html += `<div class="system-section">
        <div class="system-section-title">Colors (${system.colors.length})</div>
        <div class="system-colors">${system.colors.slice(0, 30).map(c =>
        `<div class="system-color" style="background:${c.hex}" title="${c.hex}" data-copy="${c.hex}"></div>`
      ).join('')}</div></div>`;
    }
    if (system.fonts && system.fonts.length) {
      html += `<div class="system-section">
        <div class="system-section-title">Typography (${system.fonts.length} families)</div>
        <div class="system-fonts">${system.fonts.slice(0, 10).map(f =>
        `<span class="system-tag">${escapeHTML(f.family)}</span>`
      ).join('')}</div></div>`;
    }
    if (system.spacing && system.spacing.length) {
      html += `<div class="system-section">
        <div class="system-section-title">Spacing Scale (${system.spacing.length})</div>
        <div class="system-spacing">${system.spacing.slice(0, 20).map(s =>
        `<span class="system-tag">${s}</span>`
      ).join('')}</div></div>`;
    }
    if (!html) html = '<div class="empty-state"><p>No design system data found</p></div>';
    systemOutput.innerHTML = html;
    systemOutput.querySelectorAll('.system-color').forEach(el => {
      el.addEventListener('click', () => {
        navigator.clipboard.writeText(el.dataset.copy).then(() => showToast(`Copied ${el.dataset.copy}`));
      });
    });
  }

  // ===== COLOR HISTORY =====
  function loadColorHistory() {
    chrome.storage.local.get(['dipColorHistory'], (data) => {
      const history = data.dipColorHistory || [];
      // Update badge dot on header history button
      if (historyBtn) {
        if (history.length) historyBtn.classList.add('has-history');
        else historyBtn.classList.remove('has-history');
      }
      if (!history.length) {
        colorHistorySection.style.display = 'none';
        return;
      }
      colorHistorySection.style.display = 'block';
      historyGrid.innerHTML = history.map(hex =>
        `<div class="history-swatch" style="background:${hex}" data-hex="${hex}"><span class="hs-hex">${hex}</span></div>`
      ).join('');
      historyGrid.querySelectorAll('.history-swatch').forEach(s => {
        s.addEventListener('click', () => {
          navigator.clipboard.writeText(s.dataset.hex).then(() => {
            s.classList.add('copied');
            s.querySelector('.hs-hex').textContent = 'Copied!';
            showToast('Copied ' + s.dataset.hex);
            setTimeout(() => {
              s.classList.remove('copied');
              s.querySelector('.hs-hex').textContent = s.dataset.hex;
            }, 1500);
          });
        });
      });
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.set({ dipColorHistory: [] });
    colorHistorySection.style.display = 'none';
    showToast('Color history cleared');
  });

  // ===== HELPERS =====
  function sendToContent(msg, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          if (chrome.runtime.lastError) console.warn('DIP:', chrome.runtime.lastError.message);
          if (callback) callback(response || {});
        });
      }
    });
  }

  function setBtnLoading(btn, text) {
    btn.classList.add('loading');
    btn.textContent = text;
  }

  function resetBtn(btn, text, svgPath) {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svgPath}</svg> ${text}`;
  }

  function showToast(message) {
    let toast = document.querySelector('.popup-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'popup-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== LISTEN FOR DEACTIVATION FROM CONTENT =====
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DEACTIVATED') {
      isActive = false;
      updateActivateUI();
    }
  });
});
