// src/sidebar/main.js
import { invoke } from '../api/anki-connect.js';
import { setupAutocomplete } from '../ui/autocomplete.js';
import { showStatus } from '../ui/status.js';
import { createFieldsForModel, toggleFieldCollapse } from '../ui/fields.js';
import { applyFormat, addCloze } from '../features/formatter.js';
import { loadPresets, saveCurrentPreset, deleteCurrentPreset, applyPreset } from '../features/presets.js';
import { generateRandomId, escapeHTML } from '../utils/helpers.js';
import { HEADER_COLLAPSE_KEY, LAST_USED_DECK_KEY, LAST_USED_MODEL_KEY } from '../utils/storage.js';
import { setupColorPickers } from '../features/color-picker.js';
import { setupSourceView } from '../features/source-view.js';
import { setupAltSelection } from '../features/alt-selection.js';
import { setupNoteSearch, loadNote as loadNoteFromModule } from '../features/note-loader.js';

// --- Globals ---
export let activeElement = null;
export let currentClozeIndex = 1;
export let modelFieldsCache = {};
export let savedSelection = null; // Store selection when interacting with dropdown
export let sourceViewState = new Map(); // Track source view state per field: Map<fieldElement, {isSourceView: boolean, sourceTextarea: HTMLElement}>
export let currentNoteId = null; // Lưu noteId hiện tại đang edit

export function setActiveElement(el) { 
  activeElement = el;
  console.log('[setActiveElement] Set to:', el ? `${el.tagName}.${el.className}` : null);
  
  // Update source view button state when activeElement changes
  if (typeof window.updateSourceViewButtonState === 'function') {
    window.updateSourceViewButtonState();
  }
}
export function incrementClozeIndex() { currentClozeIndex++; }
export function resetClozeIndex() { currentClozeIndex = 1; }

// Save selection before dropdown interaction
export function saveSelection() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    // Only save if selection is in a contentEditable field
    if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE || 
        range.commonAncestorContainer.closest('.field-input-div')) {
      savedSelection = range.cloneRange();
      console.log('[saveSelection] Saved selection:', savedSelection.toString());
      return true;
    }
  }
  console.log('[saveSelection] No valid selection to save');
  return false;
}

// Restore saved selection
export function restoreSelection() {
  if (savedSelection && activeElement) {
    try {
      // Verify the saved selection is still within activeElement
      const container = savedSelection.commonAncestorContainer;
      const isInField = activeElement.contains(container) || 
                        container === activeElement ||
                        (container.nodeType === Node.TEXT_NODE && activeElement.contains(container.parentElement));
      
      if (isInField) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedSelection);
        console.log('[restoreSelection] Restored selection:', selection.toString());
        return true;
      } else {
        console.log('[restoreSelection] Saved selection is no longer valid');
        savedSelection = null;
      }
    } catch (e) {
      console.warn('[restoreSelection] Failed to restore:', e);
      savedSelection = null;
    }
  }
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("AnkiVN Sidebar DOMContentLoaded - Refactored v2.0.0");

  const deckInput = document.getElementById("deck-search");
  const modelInput = document.getElementById("model-search");
  const noteSearchInput = document.getElementById("note-search");
  const tagsInput = document.getElementById("tags-input");
  const addNoteBtn = document.getElementById("add-note-btn");
  const openSettingsLink = document.getElementById("open-settings-link");
  const toggleHeaderBtn = document.getElementById('toggle-header-btn');

  // Check if essential elements exist
  if (!deckInput || !modelInput || !addNoteBtn || !openSettingsLink || !toggleHeaderBtn) {
    console.error('[AnkiVN] Missing essential DOM elements:', {
      deckInput: !!deckInput,
      modelInput: !!modelInput,
      addNoteBtn: !!addNoteBtn,
      openSettingsLink: !!openSettingsLink,
      toggleHeaderBtn: !!toggleHeaderBtn
    });
    showStatus('Lỗi: Không tìm thấy các phần tử cần thiết trong DOM', true);
    return;
  }

  // --- Header Collapse Logic ---
  const setHeaderCollapsed = (isCollapsed) => {
    document.body.classList.toggle('header-collapsed', isCollapsed);
    if (toggleHeaderBtn) {
      toggleHeaderBtn.textContent = isCollapsed ? '▼' : '▶';
      toggleHeaderBtn.title = isCollapsed ? 'Hiện' : 'Ẩn';
    }
  };

  if (toggleHeaderBtn) {
    toggleHeaderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isCollapsed = document.body.classList.contains('header-collapsed');
      setHeaderCollapsed(!isCollapsed);
      chrome.storage.local.set({ [HEADER_COLLAPSE_KEY]: !isCollapsed });
    });
  }

  chrome.storage.local.get(HEADER_COLLAPSE_KEY, (result) => {
    setHeaderCollapsed(result[HEADER_COLLAPSE_KEY] || false);
  });

  // --- Preset Logic ---
  const presetSelect = document.getElementById('preset-select');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');
  
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => applyPreset(e.target.value));
  }
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', saveCurrentPreset);
  }
  if (deletePresetBtn) {
    deletePresetBtn.addEventListener('click', deleteCurrentPreset);
  }

  // --- Gán sự kiện TRƯỚC khi load dữ liệu để đảm bảo các nút luôn hoạt động ---
  if (openSettingsLink) {
    openSettingsLink.addEventListener("click", async (e) => {
      e.preventDefault();
      // Mở settings.html trong tab mới
      console.log('[AnkiVN] Opening settings page in new tab');
      try {
        await chrome.runtime.openOptionsPage();
      } catch (error) {
        console.error('[AnkiVN] Failed to open options page:', error);
        // Fallback: mở bằng window.open nếu chrome.runtime.openOptionsPage không hoạt động
        const settingsUrl = chrome.runtime.getURL('ui/settings.html');
        window.open(settingsUrl, '_blank');
      }
    });
  }

  if (addNoteBtn) {
    addNoteBtn.addEventListener("click", () => addNoteToAnki());
  }

  // Lắng nghe thay đổi feature toggles từ settings
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.featureToggles) {
      applyFeatureToggles();
    }
  });

  // --- Tải dữ liệu ban đầu ---
  try {
    // Load feature toggles trước
    await applyFeatureToggles();

    const [deckNames, modelNames, tagNames] = await Promise.all([
      invoke("deckNames"),
      invoke("modelNames"),
      invoke("getTags"),
      loadPresets()
    ]);

    if (!Array.isArray(deckNames) || !Array.isArray(modelNames) || !Array.isArray(tagNames)) {
      throw new Error("Dữ liệu trả về từ Anki-Connect không hợp lệ.");
    }

    // Setup autocomplete với kiểm tra null
    const deckContainer = deckInput?.closest('.autocomplete-container');
    const modelContainer = modelInput?.closest('.autocomplete-container');
    
    if (deckContainer && deckInput) {
      setupAutocomplete(deckContainer, deckInput, deckNames);
    }
    if (modelContainer && modelInput) {
      setupAutocomplete(modelContainer, modelInput, modelNames, (model) => {
        // Reset currentNoteId khi model thay đổi
        currentNoteId = null;
        updateAddButtonText(false);
        createFieldsForModel(model);
      });
    }

    // Setup note search autocomplete
    if (noteSearchInput) {
      setupNoteSearch(noteSearchInput, async (noteId) => {
        await loadNote(noteId);
      });
    }

    // Chỉ load tags nếu feature được bật
    const featureToggles = await chrome.storage.local.get(['featureToggles']);
    const isTagsEnabled = featureToggles.featureToggles?.tags !== false;
    
    if (isTagsEnabled) {
      const tagDatalist = document.getElementById("tags-datalist");
      if (tagDatalist) {
        tagDatalist.innerHTML = "";
        tagNames.forEach(tag => {
          tagDatalist.innerHTML += `<option value="${tag}">`;
        });
      }
    }

    const lastUsed = await chrome.storage.local.get([LAST_USED_DECK_KEY, LAST_USED_MODEL_KEY]);
    if (lastUsed[LAST_USED_DECK_KEY] && deckInput) {
      deckInput.value = lastUsed[LAST_USED_DECK_KEY];
    }
    if (lastUsed[LAST_USED_MODEL_KEY] && modelInput) {
      modelInput.value = lastUsed[LAST_USED_MODEL_KEY];
      await createFieldsForModel(modelInput.value);
    }
  } catch (error) {
    console.error('[AnkiVN] Error loading initial data:', error);
    showStatus(`Lỗi kết nối Anki-Connect: ${error.message}.`, true);
  }

  // Format toolbar listeners
  document.getElementById('format-bold')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('bold'); });
  document.getElementById('format-italic')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('italic'); });
  document.getElementById('format-underline')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('underline'); });
  document.getElementById('format-remove')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('removeFormat'); });
  
  // Cloze button (C123 - cycles through cloze numbers)
  document.getElementById('format-cloze-next')?.addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(); });

  // Setup source view
  setupSourceView();

  // Setup color pickers
  setupColorPickers();

  // Setup alt selection handling
  setupAltSelection();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!activeElement || !activeElement.isContentEditable) return;
    if (e.ctrlKey) {
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); applyFormat('bold'); }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); applyFormat('italic'); }
      if (e.key.toLowerCase() === 'u') { e.preventDefault(); applyFormat('underline'); }
      if (e.shiftKey) {
        if (e.key.toLowerCase() === 'c') { e.preventDefault(); addCloze(); }
      }
    }
  });
});

// Áp dụng feature toggles để ẩn/hiện các chức năng
async function applyFeatureToggles() {
  try {
    const stored = await chrome.storage.local.get(['featureToggles']);
    const featureToggles = stored.featureToggles || { tags: true, toolbar: true }; // Mặc định bật Tags và Toolbar
    
    // Ẩn/hiện Tags
    const tagsInput = document.getElementById('tags-input');
    if (tagsInput) {
      const tagsContainer = tagsInput.closest('.form-group');
      if (tagsContainer) {
        tagsContainer.style.display = featureToggles.tags !== false ? 'block' : 'none';
      }
    }
    
    // Ẩn/hiện Formatting Toolbar
    const toolbarWrapper = document.getElementById('sticky-toolbar-wrapper');
    if (toolbarWrapper) {
      toolbarWrapper.style.display = featureToggles.toolbar !== false ? '' : 'none';
    }
  } catch (error) {
    console.error('[AnkiVN] Error applying feature toggles:', error);
  }
}

// Load note và điền vào fields (wrapper để tích hợp với sidebar logic)
async function loadNote(noteId) {
  await loadNoteFromModule(noteId, (loadedNoteId) => {
    // Lưu noteId hiện tại và cập nhật button text
    currentNoteId = loadedNoteId;
    updateAddButtonText(true);
  });
}

// Cập nhật text của nút "Thêm" / "Lưu thay đổi"
function updateAddButtonText(isEditing = false) {
  const addNoteBtn = document.getElementById('add-note-btn');
  if (addNoteBtn) {
    addNoteBtn.textContent = isEditing ? 'Lưu thay đổi' : 'Thêm';
  }
}

async function addNoteToAnki() {
  const deckName = document.getElementById("deck-search").value;
  const modelName = document.getElementById("model-search").value;
  
  // Lấy tags nếu feature được bật, nếu không thì để mảng rỗng
  const featureToggles = await chrome.storage.local.get(['featureToggles']);
  const isTagsEnabled = featureToggles.featureToggles?.tags !== false;
  const tags = isTagsEnabled && document.getElementById("tags-input") 
    ? document.getElementById("tags-input").value.split(/[\s,]+/).filter(Boolean)
    : [];

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

    // Nếu đang edit note, gọi updateNoteFields
    if (currentNoteId) {
      const result = await invoke("updateNoteFields", { 
        note: { 
          id: currentNoteId, 
          fields: fields 
        } 
      });
      if (!result) throw new Error("Không thể cập nhật note.");

      // Cập nhật tags (thay thế toàn bộ tags)
      // Lấy tags hiện tại của note
      const currentNoteInfo = await invoke('notesInfo', { notes: [currentNoteId] });
      if (currentNoteInfo && currentNoteInfo.length > 0) {
        const currentTags = currentNoteInfo[0].tags || [];
        const newTags = tags;
        
        // Xóa tags cũ không còn trong danh sách mới
        const tagsToRemove = currentTags.filter(tag => !newTags.includes(tag));
        if (tagsToRemove.length > 0) {
          await invoke("removeTags", { notes: [currentNoteId], tags: tagsToRemove.join(' ') });
        }
        
        // Thêm tags mới
        const tagsToAdd = newTags.filter(tag => !currentTags.includes(tag));
        if (tagsToAdd.length > 0) {
          await invoke("addTags", { notes: [currentNoteId], tags: tagsToAdd.join(' ') });
        }
      } else if (tags.length > 0) {
        // Nếu không lấy được tags hiện tại, chỉ thêm tags mới
        await invoke("addTags", { notes: [currentNoteId], tags: tags.join(' ') });
      }

      showStatus(`Note đã được cập nhật (ID: ${currentNoteId})`);
      
      // Reset currentNoteId và button text
      currentNoteId = null;
      updateAddButtonText(false);
      
      // Không clear fields sau khi update (giữ nguyên để user có thể tiếp tục chỉnh sửa nếu muốn)
    } else {
      // Thêm note mới
      const result = await invoke("addNote", { note: { deckName, modelName, fields, tags } });
      if (!result) throw new Error("Không thể thêm note (ID trả về là null).");

      showStatus(`Note đã được thêm (ID: ${result})`);
      
      // Clear fields sau khi thêm note mới (trừ sticky fields)
      document.querySelectorAll(".field-input-div").forEach(div => {
        if (!stickyFields[div.dataset.field]) {
          div.innerHTML = '';
          div.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      resetClozeIndex();
      // Chỉ xóa tags input nếu feature được bật và không phải sticky
      if (isTagsEnabled && !stickyFields['Tags'] && document.getElementById('tags-input')) {
        document.getElementById('tags-input').value = '';
      }
    }

    await chrome.storage.local.set({ [LAST_USED_DECK_KEY]: deckName, [LAST_USED_MODEL_KEY]: modelName });
  } catch (error) {
    showStatus(`Lỗi khi ${currentNoteId ? 'cập nhật' : 'thêm'} note: ${error.message}`, true);
  }
}
