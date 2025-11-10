// src/features/source-view.js
import { showStatus } from '../ui/status.js';
import { updateMediaPreview } from './media-preview.js';
import { activeElement, setActiveElement, sourceViewState } from '../sidebar/main.js';

let toggleSourceViewBtn = null;

function toggleSourceCodeView() {
  console.log('[AnkiVN Sidebar] toggleSourceCodeView called');
  console.log('[AnkiVN Sidebar] Current activeElement:', activeElement);
  
  let fieldDiv = activeElement;
  if (!fieldDiv || !fieldDiv.classList.contains('field-input-div')) {
    console.log('[AnkiVN Sidebar] No active field, checking for fields in source view...');
    for (const [field, state] of sourceViewState.entries()) {
      if (state && state.isSourceView) {
        fieldDiv = field;
        console.log('[AnkiVN Sidebar] Found field in source view:', field.dataset.field);
        break;
      }
    }
  }
  
  if (!fieldDiv || !fieldDiv.classList.contains('field-input-div')) {
    console.log('[AnkiVN Sidebar] No active field and no field in source view, cannot toggle');
    showStatus('Vui lòng chọn một field để xem source code', true);
    return;
  }
  
  const fieldName = fieldDiv.dataset.field;
  console.log('[AnkiVN Sidebar] Toggling source view for field:', fieldName);
  
  const state = sourceViewState.get(fieldDiv);
  const isCurrentlySourceView = state && state.isSourceView;
  
  if (activeElement !== fieldDiv) {
    setActiveElement(fieldDiv);
  }
  
  if (isCurrentlySourceView) {
    // Switch back to render view
    console.log('[AnkiVN Sidebar] Switching from source view to render view');
    const textarea = state.sourceTextarea;
    const htmlContent = textarea.value;
    
    console.log('[AnkiVN Sidebar] HTML content from textarea:', {
      length: htmlContent.length,
      preview: htmlContent.substring(0, 100)
    });
    
    fieldDiv.innerHTML = htmlContent;
    fieldDiv.contentEditable = 'true';
    fieldDiv.style.display = '';
    
    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
    
    sourceViewState.delete(fieldDiv);
    console.log('[AnkiVN Sidebar] Source view state deleted for field');
    
    delete fieldDiv.dataset.keepActive;
    console.log('[AnkiVN Sidebar] Cleared keepActive flag');
    
    fieldDiv.focus();
    setActiveElement(fieldDiv);
    fieldDiv.dispatchEvent(new Event('input', { bubbles: true }));
    
    const fieldGroup = fieldDiv.closest('.field-group');
    if (fieldGroup) {
      const previewContainer = fieldGroup.querySelector('.media-preview-container');
      if (previewContainer) {
        updateMediaPreview(fieldDiv.innerHTML, previewContainer);
        console.log('[AnkiVN Sidebar] Media preview updated');
      }
    }
    
    console.log('[AnkiVN Sidebar] Switched to render view, field innerHTML length:', fieldDiv.innerHTML.length);
    showStatus('Đã chuyển sang chế độ hiển thị');
  } else {
    // Switch to source view
    console.log('[AnkiVN Sidebar] Switching from render view to source view');
    const htmlContent = fieldDiv.innerHTML;
    
    console.log('[AnkiVN Sidebar] Current HTML content:', {
      length: htmlContent.length,
      preview: htmlContent.substring(0, 100)
    });
    
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
    
    fieldDiv.style.display = 'none';
    fieldDiv.contentEditable = 'false';
    
    fieldDiv.dataset.keepActive = 'true';
    console.log('[AnkiVN Sidebar] Set keepActive flag on field div');
    
    const inputArea = fieldDiv.parentNode;
    if (inputArea && inputArea.classList.contains('field-input-area')) {
      inputArea.insertBefore(textarea, fieldDiv.nextSibling);
      console.log('[AnkiVN Sidebar] Textarea inserted into field-input-area');
    } else {
      fieldDiv.parentNode.insertBefore(textarea, fieldDiv.nextSibling);
      console.log('[AnkiVN Sidebar] Textarea inserted after field div (fallback)');
    }
    
    sourceViewState.set(fieldDiv, {
      isSourceView: true,
      sourceTextarea: textarea
    });
    console.log('[AnkiVN Sidebar] Source view state set for field:', fieldName);
    
    textarea.addEventListener('focus', () => {
      console.log('[AnkiVN Sidebar] Textarea focused, keeping activeElement as fieldDiv');
      if (activeElement !== fieldDiv) {
        setActiveElement(fieldDiv);
      }
    });
    
    textarea.addEventListener('blur', () => {
      console.log('[AnkiVN Sidebar] Textarea blurred, but keeping activeElement as fieldDiv');
    });
    
    if (typeof window.updateSourceViewButtonState === 'function') {
      window.updateSourceViewButtonState();
    }
    console.log('[AnkiVN Sidebar] Button state updated: active (source view)');
    
    setTimeout(() => {
      textarea.focus();
      textarea.select();
      console.log('[AnkiVN Sidebar] Textarea focused and selected');
    }, 50);
    
    console.log('[AnkiVN Sidebar] Switched to source view, textarea value length:', textarea.value.length);
    showStatus('Đã chuyển sang chế độ Source Code');
  }
}

function updateSourceViewButtonState() {
  console.log('[AnkiVN Sidebar] updateSourceViewButtonState called, activeElement:', activeElement);
  
  if (!toggleSourceViewBtn) return;
  
  if (!activeElement || !activeElement.classList.contains('field-input-div')) {
    toggleSourceViewBtn.classList.remove('active');
    toggleSourceViewBtn.title = 'Xem/Chỉnh sửa Source Code';
    console.log('[AnkiVN Sidebar] No active field, button state: inactive');
    return;
  }
  
  const state = sourceViewState.get(activeElement);
  const isSourceView = state && state.isSourceView;
  
  console.log('[AnkiVN Sidebar] Source view state for field:', {
    field: activeElement.dataset.field,
    isSourceView: isSourceView,
    state: state
  });
  
  if (isSourceView) {
    toggleSourceViewBtn.classList.add('active');
    toggleSourceViewBtn.title = 'Chuyển về chế độ hiển thị';
    console.log('[AnkiVN Sidebar] Button state: active (source view)');
  } else {
    toggleSourceViewBtn.classList.remove('active');
    toggleSourceViewBtn.title = 'Xem/Chỉnh sửa Source Code';
    console.log('[AnkiVN Sidebar] Button state: inactive (render view)');
  }
}

export function setupSourceView() {
  toggleSourceViewBtn = document.getElementById('toggle-source-view');
  if (!toggleSourceViewBtn) return;
  
  toggleSourceViewBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    toggleSourceCodeView();
  });
  
  window.updateSourceViewButtonState = updateSourceViewButtonState;
  updateSourceViewButtonState();
}

