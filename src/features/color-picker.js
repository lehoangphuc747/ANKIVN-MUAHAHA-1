// src/features/color-picker.js
import { applyFormat } from './formatter.js';
import { showStatus } from '../ui/status.js';
import { SAVED_FORECOLORS_KEY, SAVED_BACKCOLORS_KEY } from '../utils/storage.js';
import { activeElement, setActiveElement, saveSelection, restoreSelection, savedSelection } from '../sidebar/main.js';

// Lưu field reference để tránh mất khi DOM thay đổi
let savedFieldForForeColor = null;
let savedFieldForBackColor = null;

// Color utility functions
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function isLightColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.7;
}

function updateColorSwatch(swatch, color, isBackColor = false) {
  if (swatch && color) {
    swatch.style.backgroundColor = color;
    if (isBackColor || isLightColor(color)) {
      swatch.style.border = '1px solid #ccc';
    } else {
      swatch.style.border = '1.5px solid rgba(255, 255, 255, 0.95)';
    }
  }
}

function closeAllColorDropdowns() {
  document.querySelectorAll('.color-picker-wrapper').forEach(wrapper => {
    wrapper.classList.remove('active');
    wrapper.querySelector('.color-btn')?.classList.remove('active');
  });
}

async function saveColor(color, type) {
  try {
    const key = type === 'foreColor' ? SAVED_FORECOLORS_KEY : SAVED_BACKCOLORS_KEY;
    const grid = type === 'foreColor' 
      ? document.getElementById('saved-forecolors-grid')
      : document.getElementById('saved-backcolors-grid');
    
    const data = await chrome.storage.local.get(key);
    let colors = data[key] || [];
    
    const normalizedColor = color.toUpperCase();
    colors = colors.filter(c => c.toUpperCase() !== normalizedColor);
    colors.unshift(normalizedColor);
    colors = colors.slice(0, 18);
    
    await chrome.storage.local.set({ [key]: colors });
    renderSavedColors(grid, colors, type);
  } catch (e) {
    console.error('Error saving color:', e);
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
  
  colors.forEach((color) => {
    const colorItem = document.createElement('div');
    colorItem.className = 'saved-color-item';
    colorItem.style.backgroundColor = color;
    colorItem.title = color;
    colorItem.dataset.color = color;
    
    if (type === 'backColor' || isLightColor(color)) {
      colorItem.style.border = '2px solid #ccc';
    }
    
    colorItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      const picker = type === 'foreColor' 
        ? document.getElementById('forecolor-picker')
        : document.getElementById('backcolor-picker');
      const hexInput = type === 'foreColor'
        ? document.getElementById('forecolor-hex-input')
        : document.getElementById('backcolor-hex-input');
      const swatch = type === 'foreColor'
        ? document.getElementById('forecolor-swatch')
        : document.getElementById('backcolor-swatch');
      
      picker.value = color;
      hexInput.value = color.toUpperCase();
      updateColorSwatch(swatch, color, type === 'backColor');
      
      if (activeElement) {
        activeElement.focus();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (savedSelection) {
          restoreSelection();
        } else {
          saveSelection();
          if (savedSelection) {
            restoreSelection();
          }
        }
        applyFormat(type, color);
        updateColorSwatch(swatch, color, type === 'backColor');
      }
      closeAllColorDropdowns();
    });
    
    grid.appendChild(colorItem);
  });
}

async function loadSavedColors() {
  try {
    const foreColorsData = await chrome.storage.local.get(SAVED_FORECOLORS_KEY);
    const foreColors = foreColorsData[SAVED_FORECOLORS_KEY] || [];
    renderSavedColors(document.getElementById('saved-forecolors-grid'), foreColors, 'foreColor');
    
    const backColorsData = await chrome.storage.local.get(SAVED_BACKCOLORS_KEY);
    const backColors = backColorsData[SAVED_BACKCOLORS_KEY] || [];
    renderSavedColors(document.getElementById('saved-backcolors-grid'), backColors, 'backColor');
  } catch (e) {
    console.error('Error loading saved colors:', e);
  }
}

async function applyColor(color, type) {
  if (!color) {
    console.warn(`[Apply ${type}] No color value`);
    return;
  }
  
  let currentActiveElement = activeElement;
  
  // Nếu không có activeElement, thử tìm field theo thứ tự ưu tiên:
  // 1. Field đã lưu trong biến module-level (ưu tiên cao nhất)
  // 2. Field với flag keep-active
  // 3. Field chứa savedSelection range
  // 4. Field đang được focus trong document
  // 5. Field đầu tiên có thể edit được (fallback cuối cùng)
  if (!currentActiveElement) {
    console.log(`[Apply ${type}] No activeElement, trying to find field...`);
    
    // Thử 1: Field đã lưu trong biến module-level (ưu tiên cao nhất vì không bị mất khi DOM thay đổi)
    const savedField = type === 'foreColor' ? savedFieldForForeColor : savedFieldForBackColor;
    console.log(`[Apply ${type}] Check 1 - Saved field:`, savedField ? 'exists' : 'null');
    if (savedField && document.body.contains(savedField)) {
      if (savedField.isContentEditable) {
        console.log(`[Apply ${type}] ✓ Restoring activeElement from saved module variable`);
        setActiveElement(savedField);
        currentActiveElement = savedField;
      } else {
        console.log(`[Apply ${type}] ✗ Saved field exists but not contentEditable`);
      }
    } else if (savedField) {
      console.log(`[Apply ${type}] ✗ Saved field no longer in DOM`);
      // Clear saved field nếu không còn hợp lệ
      if (type === 'foreColor') {
        savedFieldForForeColor = null;
      } else {
        savedFieldForBackColor = null;
      }
    }
    
    // Thử 2: Field với flag keep-active
    if (!currentActiveElement) {
      const fieldWithFlag = document.querySelector('.field-input-div[data-keep-active="true"]');
      console.log(`[Apply ${type}] Check 2 - Field with flag:`, fieldWithFlag ? 'exists' : 'null');
      if (fieldWithFlag && fieldWithFlag.isContentEditable) {
        console.log(`[Apply ${type}] ✓ Restoring activeElement from flag`);
        setActiveElement(fieldWithFlag);
        currentActiveElement = fieldWithFlag;
      }
    }
    
    // Thử 3: Field chứa savedSelection range
    if (!currentActiveElement && savedSelection) {
      console.log(`[Apply ${type}] Check 3 - savedSelection exists`);
      try {
        const container = savedSelection.commonAncestorContainer;
        let fieldElement = null;
        
        if (container.nodeType === Node.TEXT_NODE) {
          fieldElement = container.parentElement?.closest('.field-input-div');
        } else {
          fieldElement = container.closest('.field-input-div');
        }
        
        console.log(`[Apply ${type}] Check 3 - Field from savedSelection:`, fieldElement ? 'exists' : 'null');
        if (fieldElement && fieldElement.isContentEditable) {
          console.log(`[Apply ${type}] ✓ Found field from savedSelection`);
          setActiveElement(fieldElement);
          currentActiveElement = fieldElement;
        }
      } catch (e) {
        console.warn(`[Apply ${type}] ✗ Error finding field from savedSelection:`, e);
      }
    } else if (!currentActiveElement) {
      console.log(`[Apply ${type}] Check 3 - No savedSelection`);
    }
    
    // Thử 4: Field đang được focus
    if (!currentActiveElement) {
      const focusedElement = document.activeElement;
      console.log(`[Apply ${type}] Check 4 - document.activeElement:`, focusedElement?.tagName, focusedElement?.className);
      if (focusedElement && 
          focusedElement.classList.contains('field-input-div') && 
          focusedElement.isContentEditable) {
        console.log(`[Apply ${type}] ✓ Using currently focused element`);
        setActiveElement(focusedElement);
        currentActiveElement = focusedElement;
      }
    }
    
    // Thử 5: Field đầu tiên có thể edit được (fallback cuối cùng)
    if (!currentActiveElement) {
      // Thử nhiều cách query selector
      let firstField = document.querySelector('.field-input-div[contenteditable="true"]');
      if (!firstField) {
        // Thử query tất cả field-input-div và filter
        const allFields = Array.from(document.querySelectorAll('.field-input-div'));
        console.log(`[Apply ${type}] Check 5 - Total fields found:`, allFields.length);
        firstField = allFields.find(field => field.isContentEditable);
        console.log(`[Apply ${type}] Check 5 - First editable field:`, firstField ? 'exists' : 'null');
      }
      
      if (firstField && firstField.isContentEditable) {
        console.log(`[Apply ${type}] ✓ Using first available field as fallback`);
        setActiveElement(firstField);
        currentActiveElement = firstField;
      } else {
        console.error(`[Apply ${type}] ✗ No editable fields found in DOM`);
        const allFields = Array.from(document.querySelectorAll('.field-input-div'));
        console.error(`[Apply ${type}] Debug - All fields:`, allFields.map(f => ({
          tagName: f.tagName,
          className: f.className,
          isContentEditable: f.isContentEditable,
          contentEditable: f.contentEditable,
          hasKeepActive: f.dataset.keepActive === 'true'
        })));
      }
    }
  }
  
  if (!currentActiveElement || !currentActiveElement.isContentEditable) {
    console.error(`[Apply ${type}] No valid activeElement found after all attempts`);
    console.error(`[Apply ${type}] Debug info:`, {
      activeElement: !!activeElement,
      savedFieldForForeColor: !!savedFieldForForeColor,
      savedFieldForBackColor: !!savedFieldForBackColor,
      savedSelection: !!savedSelection,
      documentActiveElement: document.activeElement?.tagName,
      totalFields: document.querySelectorAll('.field-input-div').length
    });
    showStatus("Vui lòng chọn một field trước", true);
    closeAllColorDropdowns();
    return;
  }
  
  currentActiveElement.focus();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (savedSelection) {
    const restored = restoreSelection();
    if (!restored) {
      console.warn(`[Apply ${type}] Failed to restore selection`);
    }
  }
  
  applyFormat(type, color);
  
  const swatch = type === 'foreColor'
    ? document.getElementById('forecolor-swatch')
    : document.getElementById('backcolor-swatch');
  updateColorSwatch(swatch, color, type === 'backColor');
  
  await saveColor(color, type);
  closeAllColorDropdowns();
  
  // Clear saved field reference sau khi apply thành công
  if (type === 'foreColor') {
    savedFieldForForeColor = null;
  } else {
    savedFieldForBackColor = null;
  }
  
  if (currentActiveElement) {
    delete currentActiveElement.dataset.keepActive;
  }
  
  const btn = type === 'foreColor'
    ? document.getElementById('format-forecolor')
    : document.getElementById('format-backcolor');
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => {
    btn.style.transform = '';
  }, 150);
}

export function setupColorPickers() {
  const foreColorPicker = document.getElementById('forecolor-picker');
  const foreColorHexInput = document.getElementById('forecolor-hex-input');
  const foreColorSwatch = document.getElementById('forecolor-swatch');
  const foreColorBtn = document.getElementById('format-forecolor');
  const foreColorWrapper = foreColorBtn?.closest('.color-picker-wrapper');
  const applyForeColorBtn = document.getElementById('apply-forecolor-btn');

  const backColorPicker = document.getElementById('backcolor-picker');
  const backColorHexInput = document.getElementById('backcolor-hex-input');
  const backColorSwatch = document.getElementById('backcolor-swatch');
  const backColorBtn = document.getElementById('format-backcolor');
  const backColorWrapper = backColorBtn?.closest('.color-picker-wrapper');
  const applyBackColorBtn = document.getElementById('apply-backcolor-btn');

  if (!foreColorBtn || !backColorBtn) return;

  // Toggle dropdown on button click
  foreColorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Lưu selection và field trước khi mở dropdown
    saveSelection();
    let fieldToSave = activeElement;
    
    if (fieldToSave && fieldToSave.isContentEditable) {
      fieldToSave.dataset.keepActive = 'true';
      savedFieldForForeColor = fieldToSave; // Lưu reference vào biến module-level
      console.log('[Forecolor Button] Saved selection and set keepActive flag');
    } else {
      // Nếu không có activeElement, thử lưu field đang được focus
      const focused = document.activeElement;
      if (focused && focused.classList.contains('field-input-div') && focused.isContentEditable) {
        setActiveElement(focused);
        focused.dataset.keepActive = 'true';
        savedFieldForForeColor = focused; // Lưu reference vào biến module-level
        console.log('[Forecolor Button] Saved focused field as activeElement');
      } else {
        // Nếu vẫn không có, thử tìm field từ savedSelection
        if (savedSelection) {
          try {
            const container = savedSelection.commonAncestorContainer;
            const fieldFromSelection = container.nodeType === Node.TEXT_NODE
              ? container.parentElement?.closest('.field-input-div')
              : container.closest('.field-input-div');
            if (fieldFromSelection && fieldFromSelection.isContentEditable) {
              setActiveElement(fieldFromSelection);
              fieldFromSelection.dataset.keepActive = 'true';
              savedFieldForForeColor = fieldFromSelection;
              console.log('[Forecolor Button] Saved field from savedSelection');
            }
          } catch (e) {
            console.warn('[Forecolor Button] Error finding field from savedSelection:', e);
          }
        }
      }
    }
    
    const isActive = foreColorWrapper?.classList.contains('active');
    closeAllColorDropdowns();
    if (!isActive && foreColorWrapper) {
      foreColorWrapper.classList.add('active');
      foreColorBtn.classList.add('active');
    }
  });

  backColorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Lưu selection và field trước khi mở dropdown
    saveSelection();
    let fieldToSave = activeElement;
    
    if (fieldToSave && fieldToSave.isContentEditable) {
      fieldToSave.dataset.keepActive = 'true';
      savedFieldForBackColor = fieldToSave; // Lưu reference vào biến module-level
      console.log('[Backcolor Button] Saved selection and set keepActive flag');
    } else {
      // Nếu không có activeElement, thử lưu field đang được focus
      const focused = document.activeElement;
      if (focused && focused.classList.contains('field-input-div') && focused.isContentEditable) {
        setActiveElement(focused);
        focused.dataset.keepActive = 'true';
        savedFieldForBackColor = focused; // Lưu reference vào biến module-level
        console.log('[Backcolor Button] Saved focused field as activeElement');
      } else {
        // Nếu vẫn không có, thử tìm field từ savedSelection
        if (savedSelection) {
          try {
            const container = savedSelection.commonAncestorContainer;
            const fieldFromSelection = container.nodeType === Node.TEXT_NODE
              ? container.parentElement?.closest('.field-input-div')
              : container.closest('.field-input-div');
            if (fieldFromSelection && fieldFromSelection.isContentEditable) {
              setActiveElement(fieldFromSelection);
              fieldFromSelection.dataset.keepActive = 'true';
              savedFieldForBackColor = fieldFromSelection;
              console.log('[Backcolor Button] Saved field from savedSelection');
            }
          } catch (e) {
            console.warn('[Backcolor Button] Error finding field from savedSelection:', e);
          }
        }
      }
    }
    
    const isActive = backColorWrapper?.classList.contains('active');
    closeAllColorDropdowns();
    if (!isActive && backColorWrapper) {
      backColorWrapper.classList.add('active');
      backColorBtn.classList.add('active');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    // Không đóng dropdown nếu click vào Apply button (để apply color trước)
    if (e.target.closest('.apply-color-btn')) {
      return;
    }
    
    if (!e.target.closest('.color-picker-wrapper')) {
      closeAllColorDropdowns();
      // Clear saved fields khi đóng dropdown
      savedFieldForForeColor = null;
      savedFieldForBackColor = null;
      document.querySelectorAll('.field-input-div[data-keep-active]').forEach(el => {
        delete el.dataset.keepActive;
        if (document.activeElement !== el) {
          setActiveElement(null);
        }
      });
    }
  });

  // Sync color picker and hex input
  foreColorPicker?.addEventListener('input', (e) => {
    const color = e.target.value.toUpperCase();
    foreColorHexInput.value = color;
    updateColorSwatch(foreColorSwatch, color);
  });

  backColorPicker?.addEventListener('input', (e) => {
    const color = e.target.value.toUpperCase();
    backColorHexInput.value = color;
    updateColorSwatch(backColorSwatch, color, true);
  });

  // Sync hex input with color picker
  foreColorHexInput?.addEventListener('input', (e) => {
    let value = e.target.value.toUpperCase();
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

  backColorHexInput?.addEventListener('input', (e) => {
    let value = e.target.value.toUpperCase();
    if (!value.startsWith('#')) {
      if (/^[0-9A-F]{6}$/i.test(value)) {
        value = '#' + value;
        backColorHexInput.value = value;
      }
    }
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      backColorPicker.value = value;
      updateColorSwatch(backColorSwatch, value, true);
    }
  });

  // Apply buttons
  applyForeColorBtn?.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Đảm bảo lưu selection trước khi apply
    if (!savedSelection) {
      saveSelection();
    }
    
    const color = foreColorHexInput?.value || foreColorPicker?.value;
    await applyColor(color, 'foreColor');
  });

  applyBackColorBtn?.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Đảm bảo lưu selection trước khi apply
    if (!savedSelection) {
      saveSelection();
    }
    
    const color = backColorHexInput?.value || backColorPicker?.value;
    await applyColor(color, 'backColor');
  });

  // Initialize swatches
  if (foreColorPicker && foreColorSwatch) {
    updateColorSwatch(foreColorSwatch, foreColorPicker.value);
  }
  if (backColorPicker && backColorSwatch) {
    updateColorSwatch(backColorSwatch, backColorPicker.value, true);
  }

  // Load saved colors
  loadSavedColors();
}

