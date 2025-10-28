// src/background/main.js
import { updateContextMenu, handleContextMenuClick } from './context-menu.js';

// --- Listeners ---
chrome.runtime.onInstalled.addListener(() => {
  console.log("AnkiVN Extension Installed/Updated.");
  updateContextMenu([]);
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
    updateContextMenu(data.lastModelFields || [], data.lastSelectedModel);
  } catch (error) {
    updateContextMenu([]);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateFieldsForContextMenu") {
    updateContextMenu(message.fields || [], message.modelName);
    chrome.storage.local.set({
      lastSelectedModel: message.modelName,
      lastModelFields: message.fields
    }).catch(err => console.error("Error saving last fields:", err));
  } else if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
  }
  return true; // Keep message channel open for async response
});

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});