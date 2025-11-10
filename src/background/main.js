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
  } else if (message.action === "altSelectionDetected") {
    console.log('[AnkiVN Background] Received altSelectionDetected message:', {
      textLength: message.text?.length,
      url: message.url,
      title: message.title
    });
    // Forward to popup if it's open, or store for when popup opens
    handleAltSelection(message.text, message.url, message.title);
  } else if (message.action === "clearBadge") {
    chrome.action.setBadgeText({ text: '' });
  } else if (message.action === "clearAltSelectionTracking") {
    // Clear duplicate tracking to allow new selections
    lastProcessedSelection = null;
    lastProcessTime = 0;
    console.log('[AnkiVN Background] Alt selection tracking cleared');
  }
  return true; // Keep message channel open for async response
});

// Track processed selections to avoid duplicates
let lastProcessedSelection = null;
let lastProcessTime = 0;

async function handleAltSelection(text, url, title) {
  console.log('[AnkiVN Background] handleAltSelection called:', {
    textLength: text?.length,
    textPreview: text?.substring(0, 50),
    url: url,
    title: title
  });
  
  // Create selection hash for duplicate detection
  // Use full text length + hash for better duplicate detection
  let textHash = 0;
  if (text && text.length > 0) {
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      textHash = ((textHash << 5) - textHash) + char;
      textHash = textHash & textHash; // Convert to 32-bit integer
    }
  }
  const selectionHash = `${text?.length || 0}|${textHash}|${url}`;
  const now = Date.now();
  
  // Debounce: don't process if processed within last 500ms (reduced from 1s)
  if (now - lastProcessTime < 500) {
    console.log('[AnkiVN Background] Debouncing - too soon after last process');
    return;
  }
  
  // Duplicate check: don't process if same selection (exact match)
  if (lastProcessedSelection === selectionHash) {
    console.log('[AnkiVN Background] Duplicate selection detected (exact match), skipping');
    return;
  }
  
  console.log('[AnkiVN Background] Selection hash:', {
    current: selectionHash,
    last: lastProcessedSelection,
    isDuplicate: lastProcessedSelection === selectionHash
  });
  
  // Update tracking
  lastProcessedSelection = selectionHash;
  lastProcessTime = now;
  
  try {
    // Get last selected model and fields
    const data = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
    const modelName = data.lastSelectedModel;
    const fields = data.lastModelFields || [];
    
    console.log('[AnkiVN Background] Model and fields:', {
      modelName: modelName,
      fieldsCount: fields.length,
      fields: fields
    });
    
    if (!modelName || fields.length === 0) {
      console.log('[AnkiVN Background] No model selected, storing pending selection');
      // No model selected, store the text for when user selects a model
      await chrome.storage.local.set({ 
        pendingAltSelectionText: text,
        pendingAltSelectionUrl: url,
        pendingAltSelectionTitle: title
      });
      // Show notification or badge to indicate pending selection
      chrome.action.setBadgeText({ text: '1' });
      chrome.action.setBadgeBackgroundColor({ color: '#3498db' });
      console.log('[AnkiVN Background] Pending selection stored, badge set');
      return;
    }
    
    // Get default field for Alt+selection from settings
    const defaultsKey = `contextMenuDefaults_${modelName}`;
    console.log('[AnkiVN Background] Looking for defaults key:', defaultsKey);
    const defaultsData = await chrome.storage.local.get(defaultsKey);
    const defaults = defaultsData[defaultsKey] || {};
    const defaultField = defaults['altSelection'] || null;
    const sourceField = defaults['altSelectionSource'] || null; // Field for source info (can be "SAME", field name, or null)
    
    // Log detailed defaults object
    console.log('[AnkiVN Background] Default field for altSelection:', {
      defaultsKey: defaultsKey,
      defaults: defaults,
      defaultsKeys: Object.keys(defaults),
      defaultsValues: Object.values(defaults),
      altSelectionValue: defaults['altSelection'],
      defaultField: defaultField
    });
    
    // Also log the full storage data for debugging
    console.log('[AnkiVN Background] Full defaultsData from storage:', defaultsData);
    
    // Store pending selection (don't open side panel automatically - requires user gesture)
    const pendingData = {
      field: defaultField,
      sourceField: sourceField, // Add source field to data
      content: text,
      fields: fields,
      modelName: modelName,
      url: url,
      title: title
    };
    
    console.log('[AnkiVN Background] Storing pendingAltSelection:', pendingData);
    await chrome.storage.local.set({ 
      pendingAltSelection: pendingData
    });
    
    // Show badge to indicate pending selection
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#3498db' });
    console.log('[AnkiVN Background] Badge set');
    
    // Try to send message to popup if it's already open
    console.log('[AnkiVN Background] Attempting to send message to popup');
    chrome.runtime.sendMessage({
      action: 'fillFieldFromAltSelection',
      field: defaultField,
      sourceField: sourceField, // Add source field to message
      content: text,
      fields: fields,
      modelName: modelName,
      url: url,
      title: title
    }).then(() => {
      console.log('[AnkiVN Background] Message sent to popup successfully');
    }).catch(err => {
      // Popup is not open, that's fine - it will be handled when popup opens
      console.log('[AnkiVN Background] Popup not open, message will be handled when popup opens:', err.message);
    });
  } catch (error) {
    console.error('[AnkiVN Background] Error handling Alt selection:', error);
    console.error('[AnkiVN Background] Error stack:', error.stack);
  }
}

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
  // Clear badge when user opens side panel (user gesture)
  chrome.action.setBadgeText({ text: '' });
});