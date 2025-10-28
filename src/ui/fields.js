// src/ui/fields.js
import { invoke } from '../api/anki-connect.js';
import { updateMediaPreview } from '../features/media-preview.js';
import { setActiveElement, modelFieldsCache } from '../popup/main.js';

export async function createFieldsForModel(modelName) {
  const fieldsContainer = document.getElementById("fields-container");
  if (!modelName) {
    fieldsContainer.innerHTML = "";
    return;
  }
  fieldsContainer.innerHTML = '<p>Đang tải fields...</p>';

  try {
    const fieldNames = await invoke("modelFieldNames", { modelName });
    if (!Array.isArray(fieldNames)) throw new Error("Could not get field names.");
    modelFieldsCache[modelName] = fieldNames;

    chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", modelName, fields: fieldNames });

    const settings = await chrome.storage.local.get([`collapsedFields_${modelName}`, `hiddenFields_${modelName}`]);
    const collapsedFields = settings[`collapsedFields_${modelName}`] || {};
    const hiddenFields = settings[`hiddenFields_${modelName}`] || {};

    fieldsContainer.innerHTML = "";
    fieldNames.forEach(fieldName => {
      if (hiddenFields[fieldName]) return;

      const isCollapsed = collapsedFields[fieldName] || false;
      const fieldGroup = document.createElement("div");
      fieldGroup.className = `field-group ${isCollapsed ? "collapsed" : ""}`;
      fieldGroup.dataset.field = fieldName;
      fieldGroup.dataset.model = modelName;

      const fieldHeader = document.createElement("div");
      fieldHeader.className = "field-header";
      fieldHeader.addEventListener("click", (e) => toggleFieldCollapse(e.currentTarget));
      fieldHeader.innerHTML = `
        <span class="collapse-toggle">${isCollapsed ? "▶" : "🔽"}</span>
        <label class="field-label" style="opacity: ${isCollapsed ? 0.7 : 1}">${fieldName}</label>
      `;

      const inputArea = document.createElement('div');
      inputArea.className = 'field-input-area';

      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'field-input-div form-control';
      fieldDiv.contentEditable = 'true';
      fieldDiv.dataset.field = fieldName;
      fieldDiv.setAttribute('data-placeholder', `Nhập ${fieldName}...`);
      fieldDiv.addEventListener('input', handleInputEvent);
      fieldDiv.addEventListener('focus', (e) => setActiveElement(e.target));
      fieldDiv.addEventListener('blur', () => setActiveElement(null));

      const mediaPreviewContainer = document.createElement('div');
      mediaPreviewContainer.className = 'media-preview-container';

      inputArea.appendChild(fieldDiv);
      inputArea.appendChild(mediaPreviewContainer);
      fieldGroup.appendChild(fieldHeader);
      fieldGroup.appendChild(inputArea);
      fieldsContainer.appendChild(fieldGroup);
      
      updateMediaPreview(fieldDiv.innerHTML, mediaPreviewContainer);
    });
  } catch (error) {
    fieldsContainer.innerHTML = `<div class="status-message error">Lỗi tải fields: ${error.message}</div>`;
  }
}

export function toggleFieldCollapse(fieldHeader) {
  const fieldGroup = fieldHeader.closest('.field-group');
  if (!fieldGroup) return;

  const isCollapsed = fieldGroup.classList.toggle("collapsed");
  const { model, field } = fieldGroup.dataset;
  
  fieldHeader.querySelector(".collapse-toggle").textContent = isCollapsed ? "▶" : "🔽";
  fieldHeader.querySelector(".field-label").style.opacity = isCollapsed ? "0.7" : "1";

  if (model && field) {
    const key = `collapsedFields_${model}`;
    chrome.storage.local.get(key, (result) => {
      const collapsed = result[key] || {};
      collapsed[field] = isCollapsed;
      chrome.storage.local.set({ [key]: collapsed });
    });
  }
}

function handleInputEvent(e) {
  const div = e.target;
  const fieldGroup = div.closest('.field-group');
  if (!fieldGroup) return;
  const previewContainer = fieldGroup.querySelector('.media-preview-container');
  if (previewContainer) {
    updateMediaPreview(div.innerHTML, previewContainer);
  }
}