// src/features/color-picker.js
import { applyFormat } from './formatter.js';
import { showStatus } from '../ui/status.js';
import { SAVED_FORECOLORS_KEY, SAVED_BACKCOLORS_KEY } from '../utils/storage.js';
import { activeElement, setActiveElement, saveSelection, restoreSelection, savedSelection } from '../sidebar/main.js';

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
  if (!currentActiveElement) {
    const fieldWithFlag = document.querySelector('.field-input-div[data-keep-active="true"]');
    if (fieldWithFlag) {
      console.log(`[Apply ${type}] Restoring activeElement from flag`);
      setActiveElement(fieldWithFlag);
      currentActiveElement = fieldWithFlag;
    }
  }
  
  if (!currentActiveElement) {
    console.error(`[Apply ${type}] No activeElement found`);
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
    saveSelection();
    if (activeElement) {
      activeElement.dataset.keepActive = 'true';
      console.log('[Forecolor Button] Saved selection and set keepActive flag');
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
    saveSelection();
    if (activeElement) {
      activeElement.dataset.keepActive = 'true';
      console.log('[Backcolor Button] Saved selection and set keepActive flag');
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
    if (!e.target.closest('.color-picker-wrapper')) {
      closeAllColorDropdowns();
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
    const color = foreColorHexInput?.value || foreColorPicker?.value;
    await applyColor(color, 'foreColor');
  });

  applyBackColorBtn?.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
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

