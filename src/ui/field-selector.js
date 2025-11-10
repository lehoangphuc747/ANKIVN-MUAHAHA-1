// src/ui/field-selector.js
import { invoke } from '../api/anki-connect.js';
import { showStatus } from './status.js';
import { createFieldsForModel, toggleFieldCollapse } from './fields.js';
import { escapeHTML } from '../utils/helpers.js';
import { setActiveElement } from '../sidebar/main.js';

async function insertContentIntoField(targetDiv, content, sourceInfo, sourceTargetField, url) {
  const currentContent = targetDiv.innerHTML.trim();
  
  let shouldAddSource = sourceInfo && (!sourceTargetField || sourceTargetField === 'SAME');
  if (shouldAddSource && url) {
    const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
    const urlToCheck = urlMatch ? urlMatch[0] : url;
    if (currentContent.includes(urlToCheck)) {
      shouldAddSource = false;
    }
  }
  
  const needsLineBreak = currentContent.length > 0;
  const contentToInsert = shouldAddSource && !sourceTargetField
    ? (needsLineBreak ? '<br>' : '') + content + sourceInfo
    : (needsLineBreak ? '<br>' : '') + content;
  
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
    console.warn('[Field Selector] execCommand failed, using innerHTML:', e);
    targetDiv.innerHTML = (needsLineBreak ? targetDiv.innerHTML + contentToInsert : contentToInsert);
  }
  
  targetDiv.dispatchEvent(new Event('input', { bubbles: true }));
  
  if (sourceTargetField && sourceTargetField !== 'SAME' && sourceInfo && url) {
    const sourceTargetDiv = document.querySelector(`.field-input-div[data-field="${sourceTargetField}"]`);
    if (sourceTargetDiv) {
      const sourceCurrentContent = sourceTargetDiv.innerHTML.trim();
      const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
      const urlToCheck = urlMatch ? urlMatch[0] : url;
      
      if (sourceCurrentContent.includes(urlToCheck)) {
        return;
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

export async function showFieldSelector(text, fields, url, title, modelName = null) {
  let fieldTypes = {};
  let filteredFields = fields;
  
  if (modelName) {
    try {
      const modelFields = await invoke('modelFields', { modelName: modelName });
      console.log('[AnkiVN Sidebar] Field Selector - Model fields info:', modelFields);
      
      if (modelFields && Array.isArray(modelFields)) {
        modelFields.forEach(field => {
          if (field.name && field.type) {
            fieldTypes[field.name] = field.type;
          }
        });
        
        filteredFields = fields.filter(fieldName => {
          const fieldType = fieldTypes[fieldName];
          const isDroplist = fieldType === 'droplist' || fieldType === 'select';
          return !isDroplist;
        });
        
        console.log('[AnkiVN Sidebar] Field Selector - Filtered fields (excluding droplist):', {
          originalFields: fields,
          filteredFields: filteredFields,
          fieldTypes: fieldTypes
        });
      }
    } catch (error) {
      console.warn('[AnkiVN Sidebar] Field Selector - Could not get field types:', error);
      filteredFields = fields;
    }
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'field-selector-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  
  const fieldListHTML = filteredFields.length > 0
    ? filteredFields.map(fieldName => `
        <div class="field-selector-item" data-field="${escapeHTML(fieldName)}" style="
          padding: 12px;
          margin-bottom: 8px;
          border: 2px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #fff;
        ">
          ${escapeHTML(fieldName)}
        </div>
      `).join('')
    : '<div style="padding: 12px; text-align: center; color: #999;">Không có field nào khả dụng</div>';
  
  modal.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 12px;">Chọn field để thêm text</h3>
    <div style="margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 0.9em;">
      <strong>Text đã chọn:</strong><br>
      ${escapeHTML(text.substring(0, 100))}${text.length > 100 ? '...' : ''}
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Chọn field:</label>
      <div id="alt-selection-field-list" style="max-height: 300px; overflow-y: auto;">
        ${fieldListHTML}
      </div>
    </div>
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="alt-selection-cancel" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;">Hủy</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  let selectedField = null;
  const cancelBtn = modal.querySelector('#alt-selection-cancel');
  const fieldItems = modal.querySelectorAll('.field-selector-item');
  
  console.log('[AnkiVN Sidebar] Field Selector - Modal created:', {
    cancelBtn: !!cancelBtn,
    fieldItemsCount: fieldItems.length,
    filteredFields: filteredFields,
    originalFieldsCount: fields.length,
    modelName: modelName,
    textLength: text.length
  });
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (overlay && overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    });
  }
  
  fieldItems.forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      fieldItems.forEach(i => {
        i.style.borderColor = '#ddd';
        i.style.background = '#fff';
        i.style.color = '';
      });
      
      item.style.borderColor = '#3498db';
      item.style.background = '#e8f4f8';
      item.style.color = '#2980b9';
      
      selectedField = item.dataset.field;
      console.log('[AnkiVN Sidebar] Field Selector - Field selected:', selectedField);
      
      if (!selectedField) {
        showStatus('Vui lòng chọn field', true);
        return;
      }
      
      const currentModel = document.getElementById('model-search')?.value;
      if (modelName && currentModel !== modelName) {
        console.log('[AnkiVN Sidebar] Field Selector - Loading model:', modelName);
        document.getElementById('model-search').value = modelName;
        await createFieldsForModel(modelName);
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[AnkiVN Sidebar] Field Selector - Model loaded');
      }
      
      let targetDiv = document.querySelector(`.field-input-div[data-field="${selectedField}"]`);
      if (!targetDiv) {
        console.log('[AnkiVN Sidebar] Field Selector - Field not found, waiting 300ms...');
        await new Promise(resolve => setTimeout(resolve, 300));
        targetDiv = document.querySelector(`.field-input-div[data-field="${selectedField}"]`);
      }
      
      if (!targetDiv) {
        showStatus(`Không tìm thấy field "${selectedField}"`, true);
        return;
      }
      
      try {
        setActiveElement(targetDiv);
        targetDiv.focus();
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const contentWithSource = escapeHTML(text);
        let sourceInfo = '';
        if (url && title) {
          const escapedUrl = escapeHTML(url);
          const escapedTitle = escapeHTML(title);
          sourceInfo = `<small style="color: #888; font-style: italic;">Nguồn: <a href="${escapedUrl}" target="_blank">${escapedTitle}</a></small>`;
        }
        
        const currentModel = document.getElementById('model-search')?.value || modelName;
        let sourceFieldSetting = null;
        if (currentModel) {
          const defaultsKey = `contextMenuDefaults_${currentModel}`;
          const defaultsData = await chrome.storage.local.get(defaultsKey);
          const defaults = defaultsData[defaultsKey] || {};
          sourceFieldSetting = defaults['altSelectionSource'] || null;
        }
        
        const shouldAddSourceToSameField = sourceFieldSetting === 'SAME' || sourceFieldSetting === null || sourceFieldSetting === '';
        const sourceTargetField = (!shouldAddSourceToSameField && sourceFieldSetting) ? sourceFieldSetting : null;
        
        await insertContentIntoField(targetDiv, contentWithSource, sourceInfo, sourceTargetField, url);
        
        const fieldGroup = targetDiv.closest(".field-group");
        if (fieldGroup && fieldGroup.classList.contains("collapsed")) {
          toggleFieldCollapse(fieldGroup.querySelector('.field-header'));
        }
        
        setTimeout(() => {
          targetDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
        let sourceWasAdded = false;
        if (sourceTargetField && sourceInfo && url) {
          const sourceTargetDiv = document.querySelector(`.field-input-div[data-field="${sourceTargetField}"]`);
          if (sourceTargetDiv) {
            const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
            const urlToCheck = urlMatch ? urlMatch[0] : url;
            sourceWasAdded = sourceTargetDiv.innerHTML.includes(urlToCheck);
          }
        }
        
        const statusMessage = sourceTargetField && sourceWasAdded
          ? `Đã thêm vào field "${selectedField}" và nguồn vào "${sourceTargetField}"`
          : `Đã thêm vào field "${selectedField}"`;
        showStatus(statusMessage);
        
        chrome.runtime.sendMessage({
          action: 'clearAltSelectionTracking'
        }).catch(() => {});
        
        if (overlay && overlay.parentNode) {
          document.body.removeChild(overlay);
          console.log('[AnkiVN Sidebar] Field Selector - Modal closed');
        }
      } catch (error) {
        console.error('[AnkiVN Sidebar] Field Selector - Error:', error);
        showStatus(`Lỗi: ${error.message}`, true);
        
        if (overlay && overlay.parentNode) {
          document.body.removeChild(overlay);
        }
      }
    });
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      console.log('[AnkiVN Sidebar] Field Selector - Overlay background clicked, closing');
      if (overlay && overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    }
  });
  
  modal.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

