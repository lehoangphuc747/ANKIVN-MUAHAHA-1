// src/ui/fields.js
import { invoke } from '../api/anki-connect.js';
import { updateMediaPreview } from '../features/media-preview.js';
import { setActiveElement, modelFieldsCache } from '../sidebar/main.js';
import { handleMediaFile, handleMediaUrl } from '../features/media-handler.js';

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

    const settingsKeys = [
        `collapsedFields_${modelName}`, 
        `hiddenFields_${modelName}`,
        `fieldOrder_${modelName}`
    ];
    const settings = await chrome.storage.local.get(settingsKeys);
    const collapsedFields = settings[settingsKeys[0]] || {};
    const hiddenFields = settings[settingsKeys[1]] || {};
    const savedOrder = settings[settingsKeys[2]];

    // Sort fields based on saved order, robustly handling added/removed fields
    let orderedFieldNames = fieldNames;
    if (savedOrder) {
        orderedFieldNames = [...new Set([...savedOrder, ...fieldNames])].filter(f => fieldNames.includes(f));
    }

    fieldsContainer.innerHTML = "";
    orderedFieldNames.forEach(fieldName => {
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
        <span class="collapse-toggle">${isCollapsed ? "▶" : "▼"}</span>
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
      fieldDiv.addEventListener('focus', (e) => {
        setActiveElement(e.target);
        // Clear keepActive flag when field gets focus again
        delete e.target.dataset.keepActive;
        // Update source view button state
        if (typeof window.updateSourceViewButtonState === 'function') {
          window.updateSourceViewButtonState();
        }
      });
      fieldDiv.addEventListener('blur', (e) => {
        // Don't clear activeElement if keepActive flag is set (dropdown is open)
        if (!e.target.dataset.keepActive) {
          setActiveElement(null);
        }
      });

      // --- DRAG & DROP LOGIC ---
      fieldDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fieldDiv.classList.add('drag-over');
      });

      fieldDiv.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fieldDiv.classList.remove('drag-over');
      });

      fieldDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        fieldDiv.classList.remove('drag-over');

        const dt = e.dataTransfer;

        // 1. Handle local files first
        if (dt.files && dt.files.length > 0) {
          handleMediaFile(dt.files[0], fieldDiv);
          return;
        }

        // 2. Handle images dragged from web pages (HTML content)
        if (dt.types.includes('text/html')) {
          const html = dt.getData('text/html');
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const imgElement = doc.querySelector('img');
          if (imgElement && imgElement.src) {
            await handleMediaUrl(imgElement.src, fieldDiv);
            return;
          }
        }

        // 3. Fallback to URI list (for image URLs dragged from address bar, etc.)
        if (dt.types.includes('text/uri-list')) {
            const url = dt.getData('text/uri-list');
            if (url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url.split('?')[0])) {
                await handleMediaUrl(url, fieldDiv);
                return;
            }
        }
      });

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
  
  fieldHeader.querySelector(".collapse-toggle").textContent = isCollapsed ? "▶" : "▼";
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