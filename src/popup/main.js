// src/popup/main.js
import { invoke } from '../api/anki-connect.js';
import { setupAutocomplete } from '../ui/autocomplete.js';
import { showStatus } from '../ui/status.js';
import { createFieldsForModel, toggleFieldCollapse } from '../ui/fields.js';
import { applyFormat, addCloze } from '../features/formatter.js';
import { loadPresets, saveCurrentPreset, deleteCurrentPreset, applyPreset } from '../features/presets.js';
import { generateRandomId, escapeHTML } from '../utils/helpers.js';
import { HEADER_COLLAPSE_KEY, LAST_USED_DECK_KEY, LAST_USED_MODEL_KEY } from '../utils/storage.js';

// --- Globals ---
export let activeElement = null;
export let currentClozeIndex = 1;
export let modelFieldsCache = {};

export function setActiveElement(el) { activeElement = el; }
export function incrementClozeIndex() { currentClozeIndex++; }
export function resetClozeIndex() { currentClozeIndex = 1; }

document.addEventListener("DOMContentLoaded", async () => {
  console.log("AnkiVN Sidebar DOMContentLoaded - Refactored v2.0.0");

  const deckInput = document.getElementById("deck-search");
  const modelInput = document.getElementById("model-search");
  const tagsInput = document.getElementById("tags-input");
  const addNoteBtn = document.getElementById("add-note-btn");
  const openSettingsLink = document.getElementById("open-settings-link");
  const toggleHeaderBtn = document.getElementById('toggle-header-btn');

  // --- Header Collapse Logic ---
  const setHeaderCollapsed = (isCollapsed) => {
    document.body.classList.toggle('header-collapsed', isCollapsed);
    toggleHeaderBtn.textContent = isCollapsed ? '🔽' : '🔼';
    toggleHeaderBtn.title = isCollapsed ? 'Hiện' : 'Ẩn';
  };

  toggleHeaderBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isCollapsed = document.body.classList.contains('header-collapsed');
    setHeaderCollapsed(!isCollapsed);
    chrome.storage.local.set({ [HEADER_COLLAPSE_KEY]: !isCollapsed });
  });

  chrome.storage.local.get(HEADER_COLLAPSE_KEY, (result) => {
    setHeaderCollapsed(result[HEADER_COLLAPSE_KEY] || false);
  });

  // --- Preset Logic ---
  document.getElementById('preset-select').addEventListener('change', (e) => applyPreset(e.target.value));
  document.getElementById('save-preset-btn').addEventListener('click', saveCurrentPreset);
  document.getElementById('delete-preset-btn').addEventListener('click', deleteCurrentPreset);

  // --- Tải dữ liệu ban đầu ---
  try {
    const [deckNames, modelNames, tagNames] = await Promise.all([
      invoke("deckNames"),
      invoke("modelNames"),
      invoke("getTags"),
      loadPresets()
    ]);

    if (!Array.isArray(deckNames) || !Array.isArray(modelNames) || !Array.isArray(tagNames)) {
      throw new Error("Dữ liệu trả về từ Anki-Connect không hợp lệ.");
    }

    setupAutocomplete(deckInput.closest('.autocomplete-container'), deckInput, deckNames);
    setupAutocomplete(modelInput.closest('.autocomplete-container'), modelInput, modelNames, (model) => createFieldsForModel(model));

    const tagDatalist = document.getElementById("tags-datalist");
    tagDatalist.innerHTML = "";
    tagNames.forEach(tag => {
      tagDatalist.innerHTML += `<option value="${tag}">`;
    });

    const lastUsed = await chrome.storage.local.get([LAST_USED_DECK_KEY, LAST_USED_MODEL_KEY]);
    if (lastUsed[LAST_USED_DECK_KEY]) deckInput.value = lastUsed[LAST_USED_DECK_KEY];
    if (lastUsed[LAST_USED_MODEL_KEY]) {
      modelInput.value = lastUsed[LAST_USED_MODEL_KEY];
      await createFieldsForModel(modelInput.value);
    }
  } catch (error) {
    showStatus(`Lỗi kết nối Anki-Connect: ${error.message}.`, true);
  }

  // --- Gán sự kiện ---
  openSettingsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: "openOptionsPage" });
  });

  addNoteBtn.addEventListener("click", () => addNoteToAnki());

  // Format toolbar listeners
  document.getElementById('format-bold').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('bold'); });
  document.getElementById('format-italic').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('italic'); });
  document.getElementById('format-underline').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('underline'); });
  document.getElementById('format-remove').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('removeFormat'); });
  
  // Cloze buttons
  document.getElementById('format-cloze-1').addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(1); });
  document.getElementById('format-cloze-2').addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(2); });
  document.getElementById('format-cloze-3').addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(3); });
  document.getElementById('format-cloze-next').addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(); });

  // Color pickers and inputs
  const foreColorPicker = document.getElementById('forecolor-picker');
  const foreColorHexInput = document.getElementById('forecolor-hex-input');
  const backColorPicker = document.getElementById('backcolor-picker');
  const backColorHexInput = document.getElementById('backcolor-hex-input');
  const applyForeColorBtn = document.getElementById('apply-forecolor-btn');
  const applyBackColorBtn = document.getElementById('apply-backcolor-btn');

  foreColorPicker.addEventListener('input', (e) => { 
    foreColorHexInput.value = e.target.value; 
  });
  backColorPicker.addEventListener('input', (e) => { 
    backColorHexInput.value = e.target.value; 
  });
  
  foreColorHexInput.addEventListener('input', (e) => { 
    const value = e.target.value; 
    if (/^#[0-9A-F]{6}$/i.test(value)) { 
      foreColorPicker.value = value; 
    } 
  });
  backColorHexInput.addEventListener('input', (e) => { 
    const value = e.target.value; 
    if (/^#[0-9A-F]{6}$/i.test(value)) { 
      backColorPicker.value = value; 
    } 
  });

  applyForeColorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    applyFormat('foreColor', foreColorHexInput.value);
  });
  applyBackColorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    applyFormat('backColor', backColorHexInput.value);
  });


  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!activeElement || !activeElement.isContentEditable) return;
    if (e.ctrlKey) {
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); applyFormat('bold'); }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); applyFormat('italic'); }
      if (e.key.toLowerCase() === 'u') { e.preventDefault(); applyFormat('underline'); }
      if (e.shiftKey) {
        if (e.key.toLowerCase() === 'c') { e.preventDefault(); addCloze(); }
        if (e.key === '1') { e.preventDefault(); addCloze(1); }
        if (e.key === '2') { e.preventDefault(); addCloze(2); }
        if (e.key === '3') { e.preventDefault(); addCloze(3); }
      }
    }
  });

  // Lắng nghe từ context menu
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
    }
  });
});

async function addNoteToAnki() {
  const deckName = document.getElementById("deck-search").value;
  const modelName = document.getElementById("model-search").value;
  const tags = document.getElementById("tags-input").value.split(/[\s,]+/).filter(Boolean);

  if (!deckName || !modelName) {
    showStatus("Vui lòng chọn Deck và Note Type", true);
    return;
  }

  try {
    const fields = {};
    let hasContent = false;
    const settings = await chrome.storage.local.get([`hiddenFields_${modelName}`, `randomIdField_${modelName}`, `stickyFields_${modelName}`]);
    const hiddenFields = settings[`hiddenFields_${modelName}`] || {};
    const randomIdField = settings[`randomIdField_${modelName}`];
    const stickyFields = settings[`stickyFields_${modelName}`] || {};

    let fieldNames = modelFieldsCache[modelName];
    if (!fieldNames) {
      fieldNames = await invoke("modelFieldNames", { modelName });
      modelFieldsCache[modelName] = fieldNames;
    }

    fieldNames.forEach(fieldName => {
      if (hiddenFields[fieldName]) {
        fields[fieldName] = "";
        return;
      }
      const fieldDiv = document.querySelector(`.field-input-div[data-field="${fieldName}"]`);
      if (fieldDiv) {
        const content = fieldDiv.innerHTML;
        fields[fieldName] = content;
        if (fieldDiv.textContent.trim() || fieldDiv.querySelector('img, audio, video')) {
          hasContent = true;
        }
      }
    });

    if (randomIdField && !fields[randomIdField]?.trim()) {
        fields[randomIdField] = generateRandomId();
        hasContent = true;
    }

    if (!hasContent) {
      showStatus("Vui lòng nhập nội dung cho ít nhất một field", true);
      return;
    }

    const result = await invoke("addNote", { note: { deckName, modelName, fields, tags } });
    if (!result) throw new Error("Không thể thêm note (ID trả về là null).");

    showStatus(`Note đã được thêm (ID: ${result})`);
    await chrome.storage.local.set({ [LAST_USED_DECK_KEY]: deckName, [LAST_USED_MODEL_KEY]: modelName });

    document.querySelectorAll(".field-input-div").forEach(div => {
      if (!stickyFields[div.dataset.field]) {
        div.innerHTML = '';
        div.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    resetClozeIndex();
    if (!stickyFields['Tags']) document.getElementById('tags-input').value = '';
  } catch (error) {
    showStatus(`Lỗi khi thêm note: ${error.message}`, true);
  }
}