// src/popup/main.js
import { invoke } from '../api/anki-connect.js';
import { setupAutocomplete } from '../ui/autocomplete.js';
import { showStatus } from '../ui/status.js';
import { createFieldsForModel, toggleFieldCollapse } from '../ui/fields.js';
import { updateMediaPreview } from '../features/media-preview.js';
import { applyFormat, addCloze } from '../features/formatter.js';
import { loadPresets, saveCurrentPreset, deleteCurrentPreset, applyPreset } from '../features/presets.js';
import { generateRandomId, escapeHTML } from '../utils/helpers.js';
import { HEADER_COLLAPSE_KEY, LAST_USED_DECK_KEY, LAST_USED_MODEL_KEY, SAVED_FORECOLORS_KEY, SAVED_BACKCOLORS_KEY } from '../utils/storage.js';

// --- Globals ---
export let activeElement = null;
export let currentClozeIndex = 1;
export let modelFieldsCache = {};
export let savedSelection = null; // Store selection when interacting with dropdown
export let sourceViewState = new Map(); // Track source view state per field: Map<fieldElement, {isSourceView: boolean, sourceTextarea: HTMLElement}>

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
      toggleHeaderBtn.textContent = isCollapsed ? '🔽' : '🔼';
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
      setupAutocomplete(modelContainer, modelInput, modelNames, (model) => createFieldsForModel(model));
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
  document.getElementById('format-bold').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('bold'); });
  document.getElementById('format-italic').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('italic'); });
  document.getElementById('format-underline').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('underline'); });
  document.getElementById('format-remove').addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('removeFormat'); });
  
  // Cloze button (C123 - cycles through cloze numbers)
  document.getElementById('format-cloze-next').addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(); });

  // Source Code View toggle
  const toggleSourceViewBtn = document.getElementById('toggle-source-view');
  toggleSourceViewBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    toggleSourceCodeView();
  });
  
  // Function to toggle source code view
  function toggleSourceCodeView() {
    console.log('[AnkiVN Popup] toggleSourceCodeView called');
    console.log('[AnkiVN Popup] Current activeElement:', activeElement);
    
    // If no activeElement, check if any field is in source view
    let fieldDiv = activeElement;
    if (!fieldDiv || !fieldDiv.classList.contains('field-input-div')) {
      console.log('[AnkiVN Popup] No active field, checking for fields in source view...');
      // Find field that is currently in source view
      for (const [field, state] of sourceViewState.entries()) {
        if (state && state.isSourceView) {
          fieldDiv = field;
          console.log('[AnkiVN Popup] Found field in source view:', field.dataset.field);
          break;
        }
      }
    }
    
    if (!fieldDiv || !fieldDiv.classList.contains('field-input-div')) {
      console.log('[AnkiVN Popup] No active field and no field in source view, cannot toggle');
      showStatus('Vui lòng chọn một field để xem source code', true);
      return;
    }
    
    const fieldName = fieldDiv.dataset.field;
    console.log('[AnkiVN Popup] Toggling source view for field:', fieldName);
    
    // Check if currently in source view
    const state = sourceViewState.get(fieldDiv);
    const isCurrentlySourceView = state && state.isSourceView;
    
    // Ensure activeElement is set to fieldDiv
    if (activeElement !== fieldDiv) {
      setActiveElement(fieldDiv);
    }
    
    if (isCurrentlySourceView) {
      // Switch back to render view
      console.log('[AnkiVN Popup] Switching from source view to render view');
      const textarea = state.sourceTextarea;
      const htmlContent = textarea.value;
      
      console.log('[AnkiVN Popup] HTML content from textarea:', {
        length: htmlContent.length,
        preview: htmlContent.substring(0, 100)
      });
      
      // Apply HTML content to field
      fieldDiv.innerHTML = htmlContent;
      fieldDiv.contentEditable = 'true';
      fieldDiv.style.display = '';
      
      // Remove textarea
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
      
      // Update state
      sourceViewState.delete(fieldDiv);
      console.log('[AnkiVN Popup] Source view state deleted for field');
      
      // Clear keepActive flag
      delete fieldDiv.dataset.keepActive;
      console.log('[AnkiVN Popup] Cleared keepActive flag');
      
      // Focus field and trigger input event
      fieldDiv.focus();
      setActiveElement(fieldDiv); // Update activeElement (this will call updateSourceViewButtonState via setActiveElement)
      fieldDiv.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Update media preview
      const fieldGroup = fieldDiv.closest('.field-group');
      if (fieldGroup) {
        const previewContainer = fieldGroup.querySelector('.media-preview-container');
        if (previewContainer) {
          updateMediaPreview(fieldDiv.innerHTML, previewContainer);
          console.log('[AnkiVN Popup] Media preview updated');
        }
      }
      
      console.log('[AnkiVN Popup] Switched to render view, field innerHTML length:', fieldDiv.innerHTML.length);
      console.log('[AnkiVN Popup] Field innerHTML preview:', fieldDiv.innerHTML.substring(0, 200));
      showStatus('Đã chuyển sang chế độ hiển thị');
    } else {
      // Switch to source view
      console.log('[AnkiVN Popup] Switching from render view to source view');
      const htmlContent = fieldDiv.innerHTML;
      
      console.log('[AnkiVN Popup] Current HTML content:', {
        length: htmlContent.length,
        preview: htmlContent.substring(0, 100)
      });
      
      // Create textarea for source code
      const textarea = document.createElement('textarea');
      textarea.className = 'field-source-textarea';
      textarea.value = htmlContent;
      textarea.style.cssText = `
        width: 100%;
        min-height: 150px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        padding: 8px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: #f8f9fa;
        color: #2c3e50;
        resize: vertical;
        white-space: pre-wrap;
        word-wrap: break-word;
      `;
      
      // Hide field div
      fieldDiv.style.display = 'none';
      fieldDiv.contentEditable = 'false';
      
      // Set keepActive flag to prevent activeElement from being cleared
      fieldDiv.dataset.keepActive = 'true';
      console.log('[AnkiVN Popup] Set keepActive flag on field div');
      
      // Insert textarea in the same container as field div (field-input-area)
      const inputArea = fieldDiv.parentNode; // field-input-area
      if (inputArea && inputArea.classList.contains('field-input-area')) {
        inputArea.insertBefore(textarea, fieldDiv.nextSibling);
        console.log('[AnkiVN Popup] Textarea inserted into field-input-area');
      } else {
        // Fallback: insert after field div
        fieldDiv.parentNode.insertBefore(textarea, fieldDiv.nextSibling);
        console.log('[AnkiVN Popup] Textarea inserted after field div (fallback)');
      }
      
      // Update state
      sourceViewState.set(fieldDiv, {
        isSourceView: true,
        sourceTextarea: textarea
      });
      console.log('[AnkiVN Popup] Source view state set for field:', fieldName);
      
      // Add event listeners to textarea to maintain activeElement
      textarea.addEventListener('focus', () => {
        console.log('[AnkiVN Popup] Textarea focused, keeping activeElement as fieldDiv');
        // Keep activeElement as fieldDiv, don't change it
        if (activeElement !== fieldDiv) {
          setActiveElement(fieldDiv);
        }
      });
      
      textarea.addEventListener('blur', () => {
        console.log('[AnkiVN Popup] Textarea blurred, but keeping activeElement as fieldDiv');
        // Don't clear activeElement, keep it as fieldDiv
        // This allows toggle to work even when textarea loses focus
      });
      
      // Update button state (activeElement is still fieldDiv, so updateSourceViewButtonState will handle it)
      // But we need to manually update it here since the state has changed
      if (typeof window.updateSourceViewButtonState === 'function') {
        window.updateSourceViewButtonState();
      }
      console.log('[AnkiVN Popup] Button state updated: active (source view)');
      
      // Focus textarea (but don't change activeElement to textarea, keep it as fieldDiv)
      setTimeout(() => {
        textarea.focus();
        textarea.select();
        console.log('[AnkiVN Popup] Textarea focused and selected');
      }, 50);
      
      console.log('[AnkiVN Popup] Switched to source view, textarea value length:', textarea.value.length);
      console.log('[AnkiVN Popup] Textarea value preview:', textarea.value.substring(0, 200));
      showStatus('Đã chuyển sang chế độ Source Code');
    }
  }
  
  // Function to update source view button state
  function updateSourceViewButtonState() {
    console.log('[AnkiVN Popup] updateSourceViewButtonState called, activeElement:', activeElement);
    
    if (!activeElement || !activeElement.classList.contains('field-input-div')) {
      toggleSourceViewBtn.classList.remove('active');
      toggleSourceViewBtn.title = 'Xem/Chỉnh sửa Source Code';
      console.log('[AnkiVN Popup] No active field, button state: inactive');
      return;
    }
    
    const state = sourceViewState.get(activeElement);
    const isSourceView = state && state.isSourceView;
    
    console.log('[AnkiVN Popup] Source view state for field:', {
      field: activeElement.dataset.field,
      isSourceView: isSourceView,
      state: state
    });
    
    if (isSourceView) {
      toggleSourceViewBtn.classList.add('active');
      toggleSourceViewBtn.title = 'Chuyển về chế độ hiển thị';
      console.log('[AnkiVN Popup] Button state: active (source view)');
    } else {
      toggleSourceViewBtn.classList.remove('active');
      toggleSourceViewBtn.title = 'Xem/Chỉnh sửa Source Code';
      console.log('[AnkiVN Popup] Button state: inactive (render view)');
    }
  }
  
  // Export function to window so it can be called from fields.js
  window.updateSourceViewButtonState = updateSourceViewButtonState;
  
  // Update button state on initial load
  updateSourceViewButtonState();

  // Color pickers with dropdown
  const foreColorPicker = document.getElementById('forecolor-picker');
  const foreColorHexInput = document.getElementById('forecolor-hex-input');
  const foreColorSwatch = document.getElementById('forecolor-swatch');
  const foreColorBtn = document.getElementById('format-forecolor');
  const foreColorWrapper = foreColorBtn.closest('.color-picker-wrapper');
  const foreColorDropdown = document.getElementById('forecolor-dropdown');
  const applyForeColorBtn = document.getElementById('apply-forecolor-btn');

  const backColorPicker = document.getElementById('backcolor-picker');
  const backColorHexInput = document.getElementById('backcolor-hex-input');
  const backColorSwatch = document.getElementById('backcolor-swatch');
  const backColorBtn = document.getElementById('format-backcolor');
  const backColorWrapper = backColorBtn.closest('.color-picker-wrapper');
  const backColorDropdown = document.getElementById('backcolor-dropdown');
  const applyBackColorBtn = document.getElementById('apply-backcolor-btn');
  const savedForeColorsGrid = document.getElementById('saved-forecolors-grid');
  const savedBackColorsGrid = document.getElementById('saved-backcolors-grid');

  // Function to update color swatch
  function updateColorSwatch(swatch, color) {
    if (swatch && color) {
      swatch.style.backgroundColor = color;
      // Add border for light colors
      if (swatch === backColorSwatch || isLightColor(color)) {
        swatch.style.border = '1px solid #ccc';
      } else {
        swatch.style.border = '1.5px solid rgba(255, 255, 255, 0.95)';
      }
    }
  }

  // Function to check if color is light
  function isLightColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    // Calculate luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.7;
  }

  // Function to convert hex to rgb
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // Function to close all color dropdowns
  function closeAllColorDropdowns() {
    document.querySelectorAll('.color-picker-wrapper').forEach(wrapper => {
      wrapper.classList.remove('active');
      wrapper.querySelector('.color-btn').classList.remove('active');
    });
  }

  // Toggle dropdown on button click
  foreColorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent focus loss
    e.stopPropagation();
    // Save selection and activeElement before opening dropdown
    saveSelection();
    if (activeElement) {
      activeElement.dataset.keepActive = 'true';
      console.log('[Forecolor Button] Saved selection and set keepActive flag');
    }
    const isActive = foreColorWrapper.classList.contains('active');
    closeAllColorDropdowns();
    if (!isActive) {
      foreColorWrapper.classList.add('active');
      foreColorBtn.classList.add('active');
    }
  });

  backColorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent focus loss
    e.stopPropagation();
    // Save selection and activeElement before opening dropdown
    saveSelection();
    if (activeElement) {
      activeElement.dataset.keepActive = 'true';
      console.log('[Backcolor Button] Saved selection and set keepActive flag');
    }
    const isActive = backColorWrapper.classList.contains('active');
    closeAllColorDropdowns();
    if (!isActive) {
      backColorWrapper.classList.add('active');
      backColorBtn.classList.add('active');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-picker-wrapper')) {
      closeAllColorDropdowns();
      // Clear keepActive flags when dropdown closes
      document.querySelectorAll('.field-input-div[data-keep-active]').forEach(el => {
        delete el.dataset.keepActive;
        // If field is not focused, clear activeElement
        if (document.activeElement !== el) {
          setActiveElement(null);
        }
      });
    }
  });

  // Sync color picker and hex input
  foreColorPicker.addEventListener('input', (e) => { 
    const color = e.target.value.toUpperCase();
    foreColorHexInput.value = color;
    updateColorSwatch(foreColorSwatch, color);
  });

  backColorPicker.addEventListener('input', (e) => { 
    const color = e.target.value.toUpperCase();
    backColorHexInput.value = color;
    updateColorSwatch(backColorSwatch, color);
  });
  
  // Sync hex input with color picker
  foreColorHexInput.addEventListener('input', (e) => { 
    let value = e.target.value.toUpperCase();
    // Auto-add # if missing
    if (!value.startsWith('#')) {
      if (/^[0-9A-F]{6}$/i.test(value)) {
        value = '#' + value;
        foreColorHexInput.value = value;
      }
    }
    if (/^#[0-9A-F]{6}$/i.test(value)) { 
      foreColorPicker.value = value; 
      updateColorSwatch(foreColorSwatch, value);
    } 
  });

  backColorHexInput.addEventListener('input', (e) => { 
    let value = e.target.value.toUpperCase();
    // Auto-add # if missing
    if (!value.startsWith('#')) {
      if (/^[0-9A-F]{6}$/i.test(value)) {
        value = '#' + value;
        backColorHexInput.value = value;
      }
    }
    if (/^#[0-9A-F]{6}$/i.test(value)) { 
      backColorPicker.value = value; 
      updateColorSwatch(backColorSwatch, value);
    } 
  });

  // Apply forecolor
  applyForeColorBtn.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const color = foreColorHexInput.value || foreColorPicker.value;
    
    if (!color) {
      console.warn('[Apply Forecolor] No color value');
      return;
    }
    
    console.log('[Apply Forecolor] Starting apply, activeElement:', activeElement, 'savedSelection:', !!savedSelection);
    
    // Find and restore activeElement if lost
    if (!activeElement) {
      const fieldWithFlag = document.querySelector('.field-input-div[data-keep-active="true"]');
      if (fieldWithFlag) {
        console.log('[Apply Forecolor] Restoring activeElement from flag');
        setActiveElement(fieldWithFlag);
      }
    }
    
    if (!activeElement) {
      console.error('[Apply Forecolor] No activeElement found');
      showStatus("Vui lòng chọn một field trước", true);
      closeAllColorDropdowns();
      return;
    }
    
    // Focus and restore selection
    activeElement.focus();
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for focus
    
    // Restore selection
    if (savedSelection) {
      const restored = restoreSelection();
      if (!restored) {
        console.warn('[Apply Forecolor] Failed to restore selection');
      }
    }
    
    // Apply the color
    applyFormat('foreColor', color);
    updateColorSwatch(foreColorSwatch, color);
    
    // Save color to saved colors
    await saveColor(color, 'foreColor');
    
    closeAllColorDropdowns();
    
    // Clear flags
    if (activeElement) {
      delete activeElement.dataset.keepActive;
    }
    savedSelection = null;
    
    // Visual feedback
    foreColorBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      foreColorBtn.style.transform = '';
    }, 150);
  });

  // Apply backcolor
  applyBackColorBtn.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const color = backColorHexInput.value || backColorPicker.value;
    
    if (!color) {
      console.warn('[Apply Backcolor] No color value');
      return;
    }
    
    console.log('[Apply Backcolor] Starting apply, activeElement:', activeElement, 'savedSelection:', !!savedSelection);
    
    // Find and restore activeElement if lost
    if (!activeElement) {
      const fieldWithFlag = document.querySelector('.field-input-div[data-keep-active="true"]');
      if (fieldWithFlag) {
        console.log('[Apply Backcolor] Restoring activeElement from flag');
        setActiveElement(fieldWithFlag);
      }
    }
    
    if (!activeElement) {
      console.error('[Apply Backcolor] No activeElement found');
      showStatus("Vui lòng chọn một field trước", true);
      closeAllColorDropdowns();
      return;
    }
    
    // Focus and restore selection
    activeElement.focus();
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for focus
    
    // Restore selection
    if (savedSelection) {
      const restored = restoreSelection();
      if (!restored) {
        console.warn('[Apply Backcolor] Failed to restore selection');
      }
    }
    
    // Apply the color
    applyFormat('backColor', color);
    updateColorSwatch(backColorSwatch, color);
    
    // Save color to saved colors
    await saveColor(color, 'backColor');
    
    closeAllColorDropdowns();
    
    // Clear flags
    if (activeElement) {
      delete activeElement.dataset.keepActive;
    }
    savedSelection = null;
    
    // Visual feedback
    backColorBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      backColorBtn.style.transform = '';
    }, 150);
  });

  // Initialize swatches
  updateColorSwatch(foreColorSwatch, foreColorPicker.value);
  updateColorSwatch(backColorSwatch, backColorPicker.value);
  
  // Load and display saved colors
  await loadSavedColors();
  
  // Functions to manage saved colors
  async function loadSavedColors() {
    try {
      // Load forecolors
      const foreColorsData = await chrome.storage.local.get(SAVED_FORECOLORS_KEY);
      const foreColors = foreColorsData[SAVED_FORECOLORS_KEY] || [];
      renderSavedColors(savedForeColorsGrid, foreColors, 'foreColor');
      
      // Load backcolors
      const backColorsData = await chrome.storage.local.get(SAVED_BACKCOLORS_KEY);
      const backColors = backColorsData[SAVED_BACKCOLORS_KEY] || [];
      renderSavedColors(savedBackColorsGrid, backColors, 'backColor');
    } catch (e) {
      console.error('Error loading saved colors:', e);
    }
  }
  
  function renderSavedColors(grid, colors, type) {
    if (!grid) return;
    
    grid.innerHTML = '';
    if (colors.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'saved-colors-empty';
      emptyMsg.textContent = 'Chưa có màu nào';
      emptyMsg.style.cssText = 'grid-column: 1/-1; font-size: 0.75rem; color: var(--text-color-light); text-align: center; padding: 8px;';
      grid.appendChild(emptyMsg);
      return;
    }
    
    colors.forEach((color, index) => {
      const colorItem = document.createElement('div');
      colorItem.className = 'saved-color-item';
      colorItem.style.backgroundColor = color;
      colorItem.title = color;
      colorItem.dataset.color = color;
      
      // Add border for light colors
      if (type === 'backColor' || isLightColor(color)) {
        colorItem.style.border = '2px solid #ccc';
      }
      
      colorItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (type === 'foreColor') {
          foreColorPicker.value = color;
          foreColorHexInput.value = color.toUpperCase();
          updateColorSwatch(foreColorSwatch, color);
          // Apply immediately if we have activeElement and selection
          if (activeElement) {
            activeElement.focus();
            await new Promise(resolve => setTimeout(resolve, 50));
            if (savedSelection) {
              restoreSelection();
            } else {
              // Try to save current selection before applying
              saveSelection();
              if (savedSelection) {
                restoreSelection();
              }
            }
            applyFormat('foreColor', color);
            updateColorSwatch(foreColorSwatch, color);
          }
        } else {
          backColorPicker.value = color;
          backColorHexInput.value = color.toUpperCase();
          updateColorSwatch(backColorSwatch, color);
          // Apply immediately if we have activeElement and selection
          if (activeElement) {
            activeElement.focus();
            await new Promise(resolve => setTimeout(resolve, 50));
            if (savedSelection) {
              restoreSelection();
            } else {
              // Try to save current selection before applying
              saveSelection();
              if (savedSelection) {
                restoreSelection();
              }
            }
            applyFormat('backColor', color);
            updateColorSwatch(backColorSwatch, color);
          }
        }
        closeAllColorDropdowns();
      });
      
      grid.appendChild(colorItem);
    });
  }
  
  async function saveColor(color, type) {
    try {
      const key = type === 'foreColor' ? SAVED_FORECOLORS_KEY : SAVED_BACKCOLORS_KEY;
      const grid = type === 'foreColor' ? savedForeColorsGrid : savedBackColorsGrid;
      
      const data = await chrome.storage.local.get(key);
      let colors = data[key] || [];
      
      // Normalize color to uppercase
      const normalizedColor = color.toUpperCase();
      
      // Remove if already exists
      colors = colors.filter(c => c.toUpperCase() !== normalizedColor);
      
      // Add to beginning
      colors.unshift(normalizedColor);
      
      // Limit to 18 colors (3 rows x 6 columns)
      colors = colors.slice(0, 18);
      
      // Save
      await chrome.storage.local.set({ [key]: colors });
      
      // Reload display
      renderSavedColors(grid, colors, type);
    } catch (e) {
      console.error('Error saving color:', e);
    }
  }

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
    } else if (message.action === "fillFieldFromAltSelection") {
      console.log('[AnkiVN Popup] Received fillFieldFromAltSelection message:', {
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
  
  // Check for pending Alt selection when popup loads
  console.log('[AnkiVN Popup] Checking for pending Alt selection on load');
  chrome.storage.local.get(['pendingAltSelection', 'pendingAltSelectionText', 'pendingAltSelectionUrl', 'pendingAltSelectionTitle']).then(async (data) => {
    console.log('[AnkiVN Popup] Pending selection data:', {
      hasPendingAltSelection: !!data.pendingAltSelection,
      hasPendingAltSelectionText: !!data.pendingAltSelectionText,
      pendingData: data.pendingAltSelection
    });
    
    if (data.pendingAltSelection) {
      console.log('[AnkiVN Popup] Found pendingAltSelection, processing...');
      handleAltSelection(data.pendingAltSelection);
      await chrome.storage.local.remove(['pendingAltSelection']);
      // Clear badge via message to background (popup can't directly set badge)
      chrome.runtime.sendMessage({ action: 'clearBadge' }).catch(() => {});
    } else if (data.pendingAltSelectionText) {
      console.log('[AnkiVN Popup] Found pendingAltSelectionText, checking for model...');
      // Text was selected but no model was set
      // Check if we have a model now
      const modelData = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
      console.log('[AnkiVN Popup] Model data:', modelData);
      
      if (modelData.lastSelectedModel && modelData.lastModelFields && modelData.lastModelFields.length > 0) {
        console.log('[AnkiVN Popup] Model found, processing pending selection');
        // We have a model now, process the pending selection
        const defaultsKey = `contextMenuDefaults_${modelData.lastSelectedModel}`;
        const defaultsData = await chrome.storage.local.get(defaultsKey);
        const defaults = defaultsData[defaultsKey] || {};
        const defaultField = defaults['altSelection'] || null;
        const sourceField = defaults['altSelectionSource'] || null;
        
        console.log('[AnkiVN Popup] Default field from settings:', {
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
        console.log('[AnkiVN Popup] No model found yet, cannot process pending selection');
      }
      await chrome.storage.local.remove(['pendingAltSelectionText', 'pendingAltSelectionUrl', 'pendingAltSelectionTitle']);
      // Clear badge via message to background
      chrome.runtime.sendMessage({ action: 'clearBadge' }).catch(() => {});
    } else {
      console.log('[AnkiVN Popup] No pending Alt selection found');
    }
  });
  
  // Handle Alt selection - show field selector or use default
  async function handleAltSelection(data) {
    const { field: defaultField, sourceField, content, fields, modelName, url, title } = data;
    
    console.log('[AnkiVN Popup] handleAltSelection - Processing Alt selection:', {
      defaultField: defaultField,
      modelName: modelName,
      fieldsCount: fields?.length,
      fields: fields,
      hasContent: !!content,
      contentLength: content?.length,
      url: url,
      title: title
    });
    
    // Ensure fields are loaded for the model
    const currentModel = document.getElementById('model-search')?.value;
    console.log('[AnkiVN Popup] handleAltSelection - Model check:', {
      currentModel: currentModel,
      targetModel: modelName,
      match: currentModel === modelName
    });
    
    if (currentModel !== modelName) {
      console.log('[AnkiVN Popup] Model mismatch, loading fields for:', modelName);
      // Load the correct model
      document.getElementById('model-search').value = modelName;
      await createFieldsForModel(modelName);
      // Wait a bit for fields to render
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('[AnkiVN Popup] Fields loaded after model change');
    } else {
      // Check if fields are already rendered
      const existingFields = document.querySelectorAll('.field-input-div');
      console.log('[AnkiVN Popup] Existing fields count:', existingFields.length);
      if (existingFields.length === 0) {
        console.log('[AnkiVN Popup] No fields rendered, loading fields for:', modelName);
        await createFieldsForModel(modelName);
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[AnkiVN Popup] Fields loaded');
      } else {
        console.log('[AnkiVN Popup] Fields already rendered:', Array.from(existingFields).map(f => f.dataset.field));
      }
    }
    
    // If default field is set and exists, use it directly
    if (defaultField) {
      console.log('[AnkiVN Popup] Default field set:', defaultField);
      console.log('[AnkiVN Popup] All available fields:', Array.from(document.querySelectorAll('.field-input-div')).map(f => f.dataset.field));
      
      // Wait a bit more and retry finding the field
      let targetDiv = document.querySelector(`.field-input-div[data-field="${defaultField}"]`);
      console.log('[AnkiVN Popup] First attempt to find field:', {
        defaultField: defaultField,
        found: !!targetDiv
      });
      
      if (!targetDiv) {
        console.log('[AnkiVN Popup] Field not found, waiting 300ms and retrying...');
        await new Promise(resolve => setTimeout(resolve, 300));
        targetDiv = document.querySelector(`.field-input-div[data-field="${defaultField}"]`);
        console.log('[AnkiVN Popup] Second attempt to find field:', {
          defaultField: defaultField,
          found: !!targetDiv
        });
      }
      
      if (targetDiv) {
        console.log('[AnkiVN Popup] Found target field, inserting content:', {
          field: defaultField,
          fieldElement: targetDiv,
          currentContentLength: targetDiv.innerHTML.length
        });
        try {
          // Focus and set active element
          setActiveElement(targetDiv);
          targetDiv.focus();
          
          // Wait for focus
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Prepare content and source info
          const contentWithSource = escapeHTML(content);
          let sourceInfo = '';
          if (url && title) {
            const escapedUrl = escapeHTML(url);
            const escapedTitle = escapeHTML(title);
            sourceInfo = `<small style="color: #888; font-style: italic;">Nguồn: <a href="${escapedUrl}" target="_blank">${escapedTitle}</a></small>`;
          }
          
          // Determine if source should be added to same field or different field
          const shouldAddSourceToSameField = sourceField === 'SAME' || sourceField === null || sourceField === '';
          const sourceTargetField = (!shouldAddSourceToSameField && sourceField) ? sourceField : null;
          
          // Insert content into default field
          const currentContent = targetDiv.innerHTML.trim();
          
          // If source should be added to same field, check if URL already exists
          let shouldAddSource = shouldAddSourceToSameField && sourceInfo;
          if (shouldAddSource && url) {
            // Check if URL already exists in the field
            const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
            const urlToCheck = urlMatch ? urlMatch[0] : url;
            const urlAlreadyExists = currentContent.includes(urlToCheck);
            
            console.log('[AnkiVN Popup] Source URL check in same field:', {
              urlToCheck: urlToCheck,
              urlAlreadyExists: urlAlreadyExists,
              currentContentLength: currentContent.length
            });
            
            if (urlAlreadyExists) {
              console.log('[AnkiVN Popup] Source URL already exists in field, skipping source info');
              shouldAddSource = false;
            }
          }
          
          const contentToInsert = shouldAddSource
            ? (currentContent ? '<br>' : '') + contentWithSource + sourceInfo
            : (currentContent ? '<br>' : '') + contentWithSource;
          
          // Move cursor to end
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
            console.warn('[handleAltSelection] execCommand failed, using innerHTML:', e);
            // Fallback: use innerHTML
            if (currentContent) {
              targetDiv.innerHTML += '<br>' + contentWithSource + sourceInfo;
            } else {
              targetDiv.innerHTML = contentWithSource + sourceInfo;
            }
          }
          
          targetDiv.dispatchEvent(new Event('input', { bubbles: true }));
          
          // If source should go to a different field, insert it there
          if (sourceTargetField && sourceInfo && url) {
            const sourceTargetDiv = document.querySelector(`.field-input-div[data-field="${sourceTargetField}"]`);
            if (sourceTargetDiv) {
              console.log('[AnkiVN Popup] Checking if source URL already exists in field:', sourceTargetField);
              const sourceCurrentContent = sourceTargetDiv.innerHTML.trim();
              
              // Check if URL already exists in source field
              // Extract URL from sourceInfo (it's in format: <br><small>Nguồn: <a href="URL">Title</a></small>)
              const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
              const urlToCheck = urlMatch ? urlMatch[0] : url;
              
              // Check if source field already contains this URL
              const urlAlreadyExists = sourceCurrentContent.includes(urlToCheck);
              
              console.log('[AnkiVN Popup] Source URL check:', {
                urlToCheck: urlToCheck,
                urlAlreadyExists: urlAlreadyExists,
                sourceCurrentContentLength: sourceCurrentContent.length,
                sourceCurrentContentPreview: sourceCurrentContent.substring(0, 200)
              });
              
              if (urlAlreadyExists) {
                console.log('[AnkiVN Popup] Source URL already exists in field, skipping source info insertion');
                // Don't add source info again - return early (content already added to main field)
                showStatus(`Đã thêm vào field "${defaultField}"`);
                return;
              }
              
              console.log('[AnkiVN Popup] Adding source to separate field:', sourceTargetField);
              const sourceToInsert = sourceCurrentContent ? '<br>' + sourceInfo : sourceInfo;
              
              // Move cursor to end of source field
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
          
          const fieldGroup = targetDiv.closest(".field-group");
          if (fieldGroup && fieldGroup.classList.contains("collapsed")) {
            toggleFieldCollapse(fieldGroup.querySelector('.field-header'));
          }
          
          targetDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          
          const statusMessage = sourceTargetField 
            ? `Đã thêm vào field "${defaultField}" và nguồn vào "${sourceTargetField}"`
            : `Đã thêm vào field "${defaultField}"`;
          showStatus(statusMessage);
          console.log('[AnkiVN Popup] Content inserted successfully:', {
            field: defaultField,
            sourceField: sourceTargetField,
            newContentLength: targetDiv.innerHTML.length,
            contentPreview: targetDiv.innerHTML.substring(0, 100)
          });
          
          // Clear duplicate tracking in background to allow new selections
          chrome.runtime.sendMessage({
            action: 'clearAltSelectionTracking'
          }).catch(() => {});
          
          return;
        } catch (error) {
          console.error('[AnkiVN Popup] Error inserting into default field:', error);
          console.error('[AnkiVN Popup] Error stack:', error.stack);
          console.error('[AnkiVN Popup] Error details:', {
            field: defaultField,
            targetDiv: targetDiv,
            contentLength: content.length
          });
          // Fall through to show field selector
        }
      } else {
        console.warn('[AnkiVN Popup] Default field not found in DOM:', defaultField);
        console.warn('[AnkiVN Popup] Available fields:', Array.from(document.querySelectorAll('.field-input-div')).map(d => d.dataset.field));
        console.warn('[AnkiVN Popup] All field elements:', Array.from(document.querySelectorAll('.field-input-div')).map(d => ({
          field: d.dataset.field,
          className: d.className,
          id: d.id
        })));
      }
    } else {
      console.log('[AnkiVN Popup] No default field set, showing field selector');
      console.log('[AnkiVN Popup] Fields available for selector:', fields);
    }
    
    // Otherwise, show field selector
    console.log('[AnkiVN Popup] Showing field selector modal');
    showFieldSelector(content, fields, url, title, modelName);
  }
  
  // Show field selector dialog
  async function showFieldSelector(text, fields, url, title, modelName = null) {
    // Get field types to filter out droplist fields
    let fieldTypes = {};
    let filteredFields = fields;
    
    if (modelName) {
      try {
        // Try to get field types from Anki-Connect
        // Anki-Connect has modelFields action that returns field info
        const modelFields = await invoke('modelFields', { modelName: modelName });
        console.log('[AnkiVN Popup] Field Selector - Model fields info:', modelFields);
        
        if (modelFields && Array.isArray(modelFields)) {
          // Extract field types from modelFields
          modelFields.forEach(field => {
            if (field.name && field.type) {
              fieldTypes[field.name] = field.type;
            }
          });
          
          // Filter out droplist fields
          filteredFields = fields.filter(fieldName => {
            const fieldType = fieldTypes[fieldName];
            const isDroplist = fieldType === 'droplist' || fieldType === 'select';
            console.log('[AnkiVN Popup] Field Selector - Field type check:', {
              fieldName: fieldName,
              fieldType: fieldType,
              isDroplist: isDroplist
            });
            return !isDroplist;
          });
          
          console.log('[AnkiVN Popup] Field Selector - Filtered fields (excluding droplist):', {
            originalFields: fields,
            filteredFields: filteredFields,
            fieldTypes: fieldTypes
          });
        }
      } catch (error) {
        console.warn('[AnkiVN Popup] Field Selector - Could not get field types:', error);
        // If we can't get field types, show all fields
        filteredFields = fields;
      }
    }
    
    // Create modal overlay
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
    
    // Create modal content
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
    
    // Create field list HTML
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
    
    // Track selected field
    let selectedField = null;
    
    // Get references to elements
    const cancelBtn = modal.querySelector('#alt-selection-cancel');
    const fieldItems = modal.querySelectorAll('.field-selector-item');
    
    console.log('[AnkiVN Popup] Field Selector - Modal created:', {
      cancelBtn: !!cancelBtn,
      fieldItemsCount: fieldItems.length,
      filteredFields: filteredFields,
      originalFieldsCount: fields.length,
      modelName: modelName,
      textLength: text.length,
      textPreview: text.substring(0, 50)
    });
    
    // Handle cancel button click
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (overlay && overlay.parentNode) {
          document.body.removeChild(overlay);
        }
      });
    }
    
    // Handle field item clicks
    fieldItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove previous selection
        fieldItems.forEach(i => {
          i.style.borderColor = '#ddd';
          i.style.background = '#fff';
          i.style.color = '';
        });
        
        // Highlight selected item
        item.style.borderColor = '#3498db';
        item.style.background = '#e8f4f8';
        item.style.color = '#2980b9';
        
        selectedField = item.dataset.field;
        console.log('[AnkiVN Popup] Field Selector - Field selected:', selectedField);
        
        // Auto-apply after selection (no need for Apply button)
        if (!selectedField) {
          showStatus('Vui lòng chọn field', true);
          return;
        }
        
        // Ensure model is loaded and fields are rendered
        const currentModel = document.getElementById('model-search')?.value;
        if (modelName && currentModel !== modelName) {
          console.log('[AnkiVN Popup] Field Selector - Loading model:', modelName);
          document.getElementById('model-search').value = modelName;
          await createFieldsForModel(modelName);
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log('[AnkiVN Popup] Field Selector - Model loaded');
        }
        
        // Find target field
        console.log('[AnkiVN Popup] Field Selector - Looking for field:', selectedField);
        const availableFieldsList = Array.from(document.querySelectorAll('.field-input-div')).map(f => f.dataset.field);
        console.log('[AnkiVN Popup] Field Selector - Available fields:', availableFieldsList);
        
        let targetDiv = document.querySelector(`.field-input-div[data-field="${selectedField}"]`);
        const firstAttempt = {
          selectedField: selectedField,
          found: !!targetDiv
        };
        console.log('[AnkiVN Popup] Field Selector - First attempt:', firstAttempt);
        
        if (!targetDiv) {
          console.log('[AnkiVN Popup] Field Selector - Field not found, waiting 300ms...');
          await new Promise(resolve => setTimeout(resolve, 300));
          targetDiv = document.querySelector(`.field-input-div[data-field="${selectedField}"]`);
          const secondAttempt = {
            selectedField: selectedField,
            found: !!targetDiv
          };
          console.log('[AnkiVN Popup] Field Selector - Second attempt:', secondAttempt);
        }
        
        const targetDivInfo = {
          found: !!targetDiv,
          field: targetDiv ? targetDiv.dataset.field : 'none',
          element: targetDiv
        };
        console.log('[AnkiVN Popup] Field Selector - Target div:', targetDivInfo);
        
        if (!targetDiv) {
          showStatus(`Không tìm thấy field "${selectedField}"`, true);
          const availableFields = Array.from(document.querySelectorAll('.field-input-div')).map(d => d.dataset.field);
          console.error('[AnkiVN Popup] Field Selector - Available fields:', availableFields);
          const allFieldElements = Array.from(document.querySelectorAll('.field-input-div')).map(d => {
            return {
              field: d.dataset.field,
              className: d.className,
              id: d.id
            };
          });
          console.error('[AnkiVN Popup] Field Selector - All field elements:', allFieldElements);
          return;
        }
        
        try {
          // Focus the field
          setActiveElement(targetDiv);
          targetDiv.focus();
          
          // Wait for focus
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Prepare content and source info
          const contentWithSource = escapeHTML(text);
          let sourceInfo = '';
          if (url && title) {
            const escapedUrl = escapeHTML(url);
            const escapedTitle = escapeHTML(title);
            sourceInfo = `<small style="color: #888; font-style: italic;">Nguồn: <a href="${escapedUrl}" target="_blank">${escapedTitle}</a></small>`;
          }
          
          // Get sourceField from settings
          const currentModel = document.getElementById('model-search')?.value || modelName;
          let sourceFieldSetting = null;
          if (currentModel) {
            const defaultsKey = `contextMenuDefaults_${currentModel}`;
            const defaultsData = await chrome.storage.local.get(defaultsKey);
            const defaults = defaultsData[defaultsKey] || {};
            sourceFieldSetting = defaults['altSelectionSource'] || null;
          }
          
          // Determine if source should be added to same field or different field
          const shouldAddSourceToSameField = sourceFieldSetting === 'SAME' || sourceFieldSetting === null || sourceFieldSetting === '';
          const sourceTargetField = (!shouldAddSourceToSameField && sourceFieldSetting) ? sourceFieldSetting : null;
          
          // Check if URL already exists in target field (if source should be in same field)
          const currentContent = targetDiv.innerHTML.trim();
          let shouldAddSource = shouldAddSourceToSameField && sourceInfo;
          if (shouldAddSource && url) {
            const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
            const urlToCheck = urlMatch ? urlMatch[0] : url;
            const urlAlreadyExists = currentContent.includes(urlToCheck);
            
            const sourceUrlCheckSameField = {
              urlToCheck: urlToCheck,
              urlAlreadyExists: urlAlreadyExists
            };
            console.log('[AnkiVN Popup] Field Selector - Source URL check in same field:', sourceUrlCheckSameField);
            
            if (urlAlreadyExists) {
              console.log('[AnkiVN Popup] Field Selector - Source URL already exists, skipping source info');
              shouldAddSource = false;
            }
          }
          
          const preparingToInsert = {
            field: selectedField,
            textLength: text.length,
            textPreview: text.substring(0, 50),
            currentContentLength: targetDiv.innerHTML.length,
            shouldAddSourceToSameField: shouldAddSourceToSameField,
            sourceFieldSetting: sourceFieldSetting,
            sourceTargetField: sourceTargetField,
            shouldAddSource: shouldAddSource
          };
          console.log('[AnkiVN Popup] Field Selector - Preparing to insert:', preparingToInsert);
          
          // Create content to insert (use shouldAddSource which already checks for duplicates)
          const needsLineBreak = currentContent.length > 0;
          const contentToInsert = shouldAddSource
            ? (needsLineBreak ? '<br>' : '') + contentWithSource + sourceInfo
            : (needsLineBreak ? '<br>' : '') + contentWithSource;
          
          const contentToInsertInfo = {
            shouldAddSource: shouldAddSource,
            contentLength: contentToInsert.length,
            preview: contentToInsert.substring(0, 100)
          };
          console.log('[AnkiVN Popup] Field Selector - Content to insert:', contentToInsertInfo);
          
          // Move cursor to end
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
          
          // Try execCommand first
          try {
            const success = document.execCommand('insertHTML', false, contentToInsert);
            console.log('[AnkiVN Popup] Field Selector - execCommand result:', success);
            if (!success) {
              throw new Error('execCommand returned false');
            }
          } catch (e) {
            console.warn('[AnkiVN Popup] Field Selector - execCommand failed, using innerHTML:', e);
            // Fallback: use innerHTML - use contentToInsert which already handles source info
            targetDiv.innerHTML = (needsLineBreak ? targetDiv.innerHTML + contentToInsert : contentToInsert);
          }
          
          // Trigger input event
          targetDiv.dispatchEvent(new Event('input', { bubbles: true }));
          
          // If source should go to a different field, insert it there
          if (sourceTargetField && sourceInfo && url) {
            const sourceTargetDiv = document.querySelector(`.field-input-div[data-field="${sourceTargetField}"]`);
            if (sourceTargetDiv) {
              console.log('[AnkiVN Popup] Field Selector - Checking if source URL already exists in field:', sourceTargetField);
              const sourceCurrentContent = sourceTargetDiv.innerHTML.trim();
              
              // Check if URL already exists in source field
              const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
              const urlToCheck = urlMatch ? urlMatch[0] : url;
              const urlAlreadyExists = sourceCurrentContent.includes(urlToCheck);
              
              const sourceUrlCheck = {
                urlToCheck: urlToCheck,
                urlAlreadyExists: urlAlreadyExists
              };
              console.log('[AnkiVN Popup] Field Selector - Source URL check:', sourceUrlCheck);
              
              if (!urlAlreadyExists) {
                console.log('[AnkiVN Popup] Field Selector - Adding source to separate field:', sourceTargetField);
                const sourceToInsert = sourceCurrentContent ? '<br>' + sourceInfo : sourceInfo;
                
                // Move cursor to end of source field
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
              } else {
                console.log('[AnkiVN Popup] Field Selector - Source URL already exists, skipping source info insertion');
              }
            }
          }
          
          // Expand field if collapsed
          const fieldGroup = targetDiv.closest(".field-group");
          if (fieldGroup && fieldGroup.classList.contains("collapsed")) {
            toggleFieldCollapse(fieldGroup.querySelector('.field-header'));
          }
          
          // Scroll field into view
          setTimeout(() => {
            targetDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
          
          // Determine status message based on whether source was added
          let sourceWasAdded = false;
          if (sourceTargetField && sourceInfo && url) {
            const sourceTargetDiv = document.querySelector(`.field-input-div[data-field="${sourceTargetField}"]`);
            if (sourceTargetDiv) {
              const urlMatch = url.match(/https?:\/\/[^\s<>"]+/);
              const urlToCheck = urlMatch ? urlMatch[0] : url;
              // Check if URL was actually added (if it doesn't exist, we added it)
              const urlExistsNow = sourceTargetDiv.innerHTML.includes(urlToCheck);
              // If URL exists now but didn't exist before (we checked earlier), we added it
              sourceWasAdded = urlExistsNow;
            }
          }
          
          const statusMessage = sourceTargetField && sourceWasAdded
            ? `Đã thêm vào field "${selectedField}" và nguồn vào "${sourceTargetField}"`
            : `Đã thêm vào field "${selectedField}"`;
          showStatus(statusMessage);
          const contentAddedSuccess = {
            field: selectedField,
            sourceField: sourceTargetField,
            newContentLength: targetDiv.innerHTML.length,
            contentPreview: targetDiv.innerHTML.substring(0, 100)
          };
          console.log('[AnkiVN Popup] Field Selector - Content added successfully:', contentAddedSuccess);
          
          // Clear duplicate tracking in background to allow new selections
          chrome.runtime.sendMessage({
            action: 'clearAltSelectionTracking'
          }).catch(() => {});
          
          // Remove overlay after successful insertion
          if (overlay && overlay.parentNode) {
            document.body.removeChild(overlay);
            console.log('[AnkiVN Popup] Field Selector - Modal closed');
          }
        } catch (error) {
          console.error('[AnkiVN Popup] Field Selector - Error:', error);
          console.error('[AnkiVN Popup] Field Selector - Error stack:', error.stack);
          const errorDetails = {
            field: selectedField,
            targetDiv: targetDiv,
            textLength: text.length,
            modelName: modelName
          };
          console.error('[AnkiVN Popup] Field Selector - Error details:', errorDetails);
          showStatus(`Lỗi: ${error.message}`, true);
          
          // Remove overlay even on error
          if (overlay && overlay.parentNode) {
            document.body.removeChild(overlay);
          }
        }
      });
    });
    
    // Close if clicking on overlay background
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        console.log('[AnkiVN Popup] Field Selector - Overlay background clicked, closing');
        if (overlay && overlay.parentNode) {
          document.body.removeChild(overlay);
        }
      }
    });
    
    // Prevent modal clicks from closing overlay
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
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
    // Chỉ xóa tags input nếu feature được bật và không phải sticky
    if (isTagsEnabled && !stickyFields['Tags'] && document.getElementById('tags-input')) {
      document.getElementById('tags-input').value = '';
    }
  } catch (error) {
    showStatus(`Lỗi khi thêm note: ${error.message}`, true);
  }
}