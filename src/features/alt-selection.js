// src/features/alt-selection.js
import { invoke } from '../api/anki-connect.js';
import { showStatus } from '../ui/status.js';
import { createFieldsForModel, toggleFieldCollapse } from '../ui/fields.js';
import { escapeHTML } from '../utils/helpers.js';
import { activeElement, setActiveElement } from '../sidebar/main.js';
import { showFieldSelector } from '../ui/field-selector.js';

export function setupAltSelection() {
  // Listen for messages from context menu
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "fillFieldFromContextMenu") {
      const { field, content, contentType } = message;
      const targetDiv = document.querySelector(`.field-input-div[data-field="${field}"]`);
      if (targetDiv) {
        const contentToInsert = contentType === 'image' ? `<img src="${content}">` : escapeHTML(content);
        targetDiv.focus();
        document.execCommand('insertHTML', false, contentToInsert);
        targetDiv.dispatchEvent(new Event('input', { bubbles: true }));
        const fieldGroup = targetDiv.closest(".field-group");
        if (fieldGroup?.classList.contains("collapsed")) {
          toggleFieldCollapse(fieldGroup.querySelector('.field-header'));
        }
      }
    } else if (message.action === "fillFieldFromAltSelection") {
      console.log('[AnkiVN Sidebar] Received fillFieldFromAltSelection message:', {
        field: message.field,
        contentLength: message.content?.length,
        fieldsCount: message.fields?.length,
        modelName: message.modelName,
        url: message.url,
        title: message.title
      });
      handleAltSelection(message);
    }
  });
  
  // Check for pending Alt selection when sidebar loads
  console.log('[AnkiVN Sidebar] Checking for pending Alt selection on load');
  chrome.storage.local.get(['pendingAltSelection', 'pendingAltSelectionText', 'pendingAltSelectionUrl', 'pendingAltSelectionTitle']).then(async (data) => {
    console.log('[AnkiVN Sidebar] Pending selection data:', {
      hasPendingAltSelection: !!data.pendingAltSelection,
      hasPendingAltSelectionText: !!data.pendingAltSelectionText,
      pendingData: data.pendingAltSelection
    });
    
    if (data.pendingAltSelection) {
      console.log('[AnkiVN Sidebar] Found pendingAltSelection, processing...');
      handleAltSelection(data.pendingAltSelection);
      await chrome.storage.local.remove(['pendingAltSelection']);
      chrome.runtime.sendMessage({ action: 'clearBadge' }).catch(() => {});
    } else if (data.pendingAltSelectionText) {
      console.log('[AnkiVN Sidebar] Found pendingAltSelectionText, checking for model...');
      const modelData = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
      console.log('[AnkiVN Sidebar] Model data:', modelData);
      
      if (modelData.lastSelectedModel && modelData.lastModelFields && modelData.lastModelFields.length > 0) {
        console.log('[AnkiVN Sidebar] Model found, processing pending selection');
        const defaultsKey = `contextMenuDefaults_${modelData.lastSelectedModel}`;
        const defaultsData = await chrome.storage.local.get(defaultsKey);
        const defaults = defaultsData[defaultsKey] || {};
        const defaultField = defaults['altSelection'] || null;
        const sourceField = defaults['altSelectionSource'] || null;
        
        console.log('[AnkiVN Sidebar] Default field from settings:', {
          defaultsKey: defaultsKey,
          defaults: defaults,
          defaultField: defaultField,
          sourceField: sourceField
        });
        
        handleAltSelection({
          field: defaultField,
          sourceField: sourceField,
          content: data.pendingAltSelectionText,
          fields: modelData.lastModelFields,
          modelName: modelData.lastSelectedModel,
          url: data.pendingAltSelectionUrl || '',
          title: data.pendingAltSelectionTitle || ''
        });
      } else {
        console.log('[AnkiVN Sidebar] No model found yet, cannot process pending selection');
      }
      await chrome.storage.local.remove(['pendingAltSelectionText', 'pendingAltSelectionUrl', 'pendingAltSelectionTitle']);
      chrome.runtime.sendMessage({ action: 'clearBadge' }).catch(() => {});
    } else {
      console.log('[AnkiVN Sidebar] No pending Alt selection found');
    }
  });
}

async function insertContentIntoField(targetDiv, content, sourceInfo, sourceTargetField) {
  const currentContent = targetDiv.innerHTML.trim();
  
  let shouldAddSource = sourceInfo && (!sourceTargetField || sourceTargetField === 'SAME');
  if (shouldAddSource && sourceInfo) {
    const urlMatch = sourceInfo.match(/https?:\/\/[^\s<>"]+/);
    if (urlMatch) {
      const urlToCheck = urlMatch[0];
      if (currentContent.includes(urlToCheck)) {
        shouldAddSource = false;
      }
    }
  }
  
  const contentToInsert = shouldAddSource && !sourceTargetField
    ? (currentContent ? '<br>' : '') + content + sourceInfo
    : (currentContent ? '<br>' : '') + content;
  
  const selection = window.getSelection();
  const range = document.createRange();
  if (targetDiv.childNodes.length > 0) {
    const lastNode = targetDiv.childNodes[targetDiv.childNodes.length - 1];
    if (lastNode.nodeType === Node.TEXT_NODE) {
      range.setStart(lastNode, lastNode.textContent.length);
      range.setEnd(lastNode, lastNode.textContent.length);
    } else {
      range.setStartAfter(lastNode);
      range.setEndAfter(lastNode);
    }
  } else {
    range.setStart(targetDiv, 0);
    range.setEnd(targetDiv, 0);
  }
  selection.removeAllRanges();
  selection.addRange(range);
  
  try {
    const success = document.execCommand('insertHTML', false, contentToInsert);
    if (!success) {
      throw new Error('execCommand returned false');
    }
  } catch (e) {
    console.warn('[insertContentIntoField] execCommand failed, using innerHTML:', e);
    if (currentContent) {
      targetDiv.innerHTML += '<br>' + content + (shouldAddSource && !sourceTargetField ? sourceInfo : '');
    } else {
      targetDiv.innerHTML = content + (shouldAddSource && !sourceTargetField ? sourceInfo : '');
    }
  }
  
  targetDiv.dispatchEvent(new Event('input', { bubbles: true }));
  
  if (sourceTargetField && sourceTargetField !== 'SAME' && sourceInfo) {
    const sourceTargetDiv = document.querySelector(`.field-input-div[data-field="${sourceTargetField}"]`);
    if (sourceTargetDiv) {
      const sourceCurrentContent = sourceTargetDiv.innerHTML.trim();
      const urlMatch = sourceInfo.match(/https?:\/\/[^\s<>"]+/);
      if (urlMatch) {
        const urlToCheck = urlMatch[0];
        if (sourceCurrentContent.includes(urlToCheck)) {
          return;
        }
      }
      
      const sourceToInsert = sourceCurrentContent ? '<br>' + sourceInfo : sourceInfo;
      const sourceSelection = window.getSelection();
      const sourceRange = document.createRange();
      if (sourceTargetDiv.childNodes.length > 0) {
        const lastNode = sourceTargetDiv.childNodes[sourceTargetDiv.childNodes.length - 1];
        if (lastNode.nodeType === Node.TEXT_NODE) {
          sourceRange.setStart(lastNode, lastNode.textContent.length);
          sourceRange.setEnd(lastNode, lastNode.textContent.length);
        } else {
          sourceRange.setStartAfter(lastNode);
          sourceRange.setEndAfter(lastNode);
        }
      } else {
        sourceRange.setStart(sourceTargetDiv, 0);
        sourceRange.setEnd(sourceTargetDiv, 0);
      }
      sourceSelection.removeAllRanges();
      sourceSelection.addRange(sourceRange);
      
      try {
        const success = document.execCommand('insertHTML', false, sourceToInsert);
        if (!success) {
          if (sourceCurrentContent) {
            sourceTargetDiv.innerHTML += '<br>' + sourceInfo;
          } else {
            sourceTargetDiv.innerHTML = sourceInfo;
          }
        }
        sourceTargetDiv.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        if (sourceCurrentContent) {
          sourceTargetDiv.innerHTML += '<br>' + sourceInfo;
        } else {
          sourceTargetDiv.innerHTML = sourceInfo;
        }
        sourceTargetDiv.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
}

async function handleAltSelection(data) {
  const { field: defaultField, sourceField, content, fields, modelName, url, title } = data;
  
  console.log('[AnkiVN Sidebar] handleAltSelection - Processing Alt selection:', {
    defaultField: defaultField,
    modelName: modelName,
    fieldsCount: fields?.length,
    fields: fields,
    hasContent: !!content,
    contentLength: content?.length,
    url: url,
    title: title
  });
  
  const currentModel = document.getElementById('model-search')?.value;
  console.log('[AnkiVN Sidebar] handleAltSelection - Model check:', {
    currentModel: currentModel,
    targetModel: modelName,
    match: currentModel === modelName
  });
  
  if (currentModel !== modelName) {
    console.log('[AnkiVN Sidebar] Model mismatch, loading fields for:', modelName);
    document.getElementById('model-search').value = modelName;
    await createFieldsForModel(modelName);
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('[AnkiVN Sidebar] Fields loaded after model change');
  } else {
    const existingFields = document.querySelectorAll('.field-input-div');
    console.log('[AnkiVN Sidebar] Existing fields count:', existingFields.length);
    if (existingFields.length === 0) {
      console.log('[AnkiVN Sidebar] No fields rendered, loading fields for:', modelName);
      await createFieldsForModel(modelName);
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('[AnkiVN Sidebar] Fields loaded');
    } else {
      console.log('[AnkiVN Sidebar] Fields already rendered:', Array.from(existingFields).map(f => f.dataset.field));
    }
  }
  
  if (defaultField) {
    console.log('[AnkiVN Sidebar] Default field set:', defaultField);
    console.log('[AnkiVN Sidebar] All available fields:', Array.from(document.querySelectorAll('.field-input-div')).map(f => f.dataset.field));
    
    let targetDiv = document.querySelector(`.field-input-div[data-field="${defaultField}"]`);
    console.log('[AnkiVN Sidebar] First attempt to find field:', {
      defaultField: defaultField,
      found: !!targetDiv
    });
    
    if (!targetDiv) {
      console.log('[AnkiVN Sidebar] Field not found, waiting 300ms and retrying...');
      await new Promise(resolve => setTimeout(resolve, 300));
      targetDiv = document.querySelector(`.field-input-div[data-field="${defaultField}"]`);
      console.log('[AnkiVN Sidebar] Second attempt to find field:', {
        defaultField: defaultField,
        found: !!targetDiv
      });
    }
    
    if (targetDiv) {
      console.log('[AnkiVN Sidebar] Found target field, inserting content:', {
        field: defaultField,
        fieldElement: targetDiv,
        currentContentLength: targetDiv.innerHTML.length
      });
      try {
        setActiveElement(targetDiv);
        targetDiv.focus();
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const contentWithSource = escapeHTML(content);
        let sourceInfo = '';
        if (url && title) {
          const escapedUrl = escapeHTML(url);
          const escapedTitle = escapeHTML(title);
          sourceInfo = `<small style="color: #888; font-style: italic;">Nguồn: <a href="${escapedUrl}" target="_blank">${escapedTitle}</a></small>`;
        }
        
        const shouldAddSourceToSameField = sourceField === 'SAME' || sourceField === null || sourceField === '';
        const sourceTargetField = (!shouldAddSourceToSameField && sourceField) ? sourceField : null;
        
        await insertContentIntoField(targetDiv, contentWithSource, sourceInfo, sourceTargetField);
        
        const fieldGroup = targetDiv.closest(".field-group");
        if (fieldGroup && fieldGroup.classList.contains("collapsed")) {
          toggleFieldCollapse(fieldGroup.querySelector('.field-header'));
        }
        
        targetDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        const statusMessage = sourceTargetField 
          ? `Đã thêm vào field "${defaultField}" và nguồn vào "${sourceTargetField}"`
          : `Đã thêm vào field "${defaultField}"`;
        showStatus(statusMessage);
        console.log('[AnkiVN Sidebar] Content inserted successfully:', {
          field: defaultField,
          sourceField: sourceTargetField,
          newContentLength: targetDiv.innerHTML.length
        });
        
        chrome.runtime.sendMessage({
          action: 'clearAltSelectionTracking'
        }).catch(() => {});
        
        return;
      } catch (error) {
        console.error('[AnkiVN Sidebar] Error inserting into default field:', error);
        console.error('[AnkiVN Sidebar] Error stack:', error.stack);
      }
    } else {
      console.warn('[AnkiVN Sidebar] Default field not found in DOM:', defaultField);
    }
  } else {
    console.log('[AnkiVN Sidebar] No default field set, showing field selector');
  }
  
  console.log('[AnkiVN Sidebar] Showing field selector modal');
  showFieldSelector(content, fields, url, title, modelName);
}

