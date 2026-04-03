// Design Inspector Pro - Background Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Screenshot capture for zoom lens color picker
  if (message.type === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // async response
  }

  if (message.type === 'DEACTIVATED') {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  }

  if (message.type === 'ACTIVATED') {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  }

  return false;
});

chrome.action.setBadgeText({ text: '' });
