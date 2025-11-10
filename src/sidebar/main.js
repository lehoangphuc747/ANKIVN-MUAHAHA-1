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
      setupNoteSearch(noteSearchInput);
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

// Setup note search với autocomplete
function setupNoteSearch(inputElement) {
  const container = inputElement.closest('.autocomplete-container');
  const suggestionsContainer = container?.querySelector('.suggestions-container');
  if (!suggestionsContainer) return;

  let searchTimeout = null;
  let activeSuggestionIndex = -1;

  const searchNotes = async (query) => {
    if (!query || query.trim().length < 2) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.style.display = 'none';
      return;
    }

    try {
      // Tìm kiếm note bằng query
      const noteIds = await invoke('findNotes', { query: query });
      if (!Array.isArray(noteIds) || noteIds.length === 0) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
        return;
      }

      // Lấy thông tin của các note (giới hạn 20 note đầu tiên)
      const limitedNoteIds = noteIds.slice(0, 20);
      const notesInfo = await invoke('notesInfo', { notes: limitedNoteIds });
      
      suggestionsContainer.innerHTML = '';
      activeSuggestionIndex = -1;

      notesInfo.forEach((note, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.dataset.noteId = note.noteId;
        
        // Hiển thị preview của note (lấy field đầu tiên có nội dung)
        const firstField = Object.values(note.fields || {})[0];
        const preview = firstField?.value ? 
          (firstField.value.replace(/<[^>]*>/g, '').substring(0, 50) + '...') : 
          `Note ID: ${note.noteId}`;
        
        div.textContent = preview;
        div.title = `Note ID: ${note.noteId}`;
        suggestionsContainer.appendChild(div);
      });

      suggestionsContainer.style.display = notesInfo.length > 0 ? 'block' : 'none';
    } catch (error) {
      console.error('[AnkiVN] Error searching notes:', error);
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.style.display = 'none';
    }
  };

  inputElement.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchNotes(query), 300); // Debounce 300ms
  });

  inputElement.addEventListener('focus', (e) => {
    const query = e.target.value.trim();
    if (query.length >= 2) {
      searchNotes(query);
    }
  });

  // Keyboard navigation
  inputElement.addEventListener('keydown', (e) => {
    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
    if (suggestionsContainer.style.display === 'none' || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
      items.forEach((item, i) => item.classList.toggle('active', i === activeSuggestionIndex));
      if (items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
      items.forEach((item, i) => item.classList.toggle('active', i === activeSuggestionIndex));
      if (items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex > -1 && items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].click();
      }
    } else if (e.key === 'Escape') {
      suggestionsContainer.style.display = 'none';
    }
  });

  // Click handler
  suggestionsContainer.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    const target = e.target.closest('.suggestion-item');
    if (target && target.dataset.noteId) {
      const noteId = parseInt(target.dataset.noteId);
      await loadNote(noteId);
      suggestionsContainer.style.display = 'none';
      inputElement.value = '';
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (e.target !== inputElement && !container.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
    }
  });
}

// Load note và điền vào fields
async function loadNote(noteId) {
  try {
    showStatus('Đang tải note...');
    
    const notesInfo = await invoke('notesInfo', { notes: [noteId] });
    if (!notesInfo || notesInfo.length === 0) {
      throw new Error('Không tìm thấy note');
    }

    const note = notesInfo[0];
    const modelName = note.modelName;
    const fields = note.fields || {};
    const tags = note.tags || [];

    // Set deck và model
    const deckInput = document.getElementById('deck-search');
    const modelInput = document.getElementById('model-search');
    
    if (deckInput) {
      // Lấy deck từ note (có thể cần gọi getDecksOfNotes)
      try {
        const cardIds = await invoke('findCards', { query: `nid:${noteId}` });
        if (cardIds && cardIds.length > 0) {
          const cardInfo = await invoke('cardsInfo', { cards: [cardIds[0]] });
          if (cardInfo && cardInfo.length > 0 && cardInfo[0].deckName) {
            deckInput.value = cardInfo[0].deckName;
          }
        }
      } catch (e) {
        console.warn('[AnkiVN] Could not get deck for note:', e);
      }
    }

    if (modelInput) {
      modelInput.value = modelName;
      await createFieldsForModel(modelName);
    }

    // Đợi một chút để fields được tạo
    await new Promise(resolve => setTimeout(resolve, 100));

    // Điền fields
    Object.keys(fields).forEach(fieldName => {
      const fieldDiv = document.querySelector(`.field-input-div[data-field="${fieldName}"]`);
      if (fieldDiv && fields[fieldName]) {
        fieldDiv.innerHTML = fields[fieldName].value || '';
        fieldDiv.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Điền tags
    const tagsInput = document.getElementById('tags-input');
    if (tagsInput && tags.length > 0) {
      tagsInput.value = tags.join(' ');
    }

    // Lưu noteId hiện tại
    currentNoteId = noteId;
    updateAddButtonText(true);

    showStatus(`Đã tải note (ID: ${noteId})`);
  } catch (error) {
    showStatus(`Lỗi khi tải note: ${error.message}`, true);
    console.error('[AnkiVN] Error loading note:', error);
  }
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
