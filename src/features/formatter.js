// src/features/formatter.js
import { activeElement, currentClozeIndex, incrementClozeIndex, restoreSelection } from '../sidebar/main.js';
import { showStatus } from '../ui/status.js';

export function applyFormat(command, value = null) {
  console.log('[applyFormat] START', { command, value, activeElement: !!activeElement });
  
  if (!activeElement || !activeElement.isContentEditable) {
    console.log('[applyFormat] ERROR: No activeElement or not contentEditable');
    showStatus("Vui lòng chọn một field để áp dụng định dạng", true);
    return;
  }
  
  console.log('[applyFormat] ActiveElement:', {
    tagName: activeElement.tagName,
    className: activeElement.className,
    isContentEditable: activeElement.isContentEditable,
    innerHTML: activeElement.innerHTML.substring(0, 50)
  });
  
  activeElement.focus();
  
  // Try to restore saved selection first
  let selectionRestored = false;
  if (command === 'foreColor' || command === 'backColor') {
    selectionRestored = restoreSelection();
    if (selectionRestored) {
      console.log('[applyFormat] Selection restored from saved');
    }
  }
  
  const selection = window.getSelection();
  
  console.log('[applyFormat] Selection:', {
    rangeCount: selection.rangeCount,
    anchorNode: selection.anchorNode ? selection.anchorNode.nodeName : null,
    focusNode: selection.focusNode ? selection.focusNode.nodeName : null,
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    toString: selection.toString(),
    isCollapsed: selection.rangeCount > 0 ? selection.getRangeAt(0).collapsed : 'no range'
  });
  
  // Special handling for color commands
  if (command === 'foreColor' || command === 'backColor') {
    console.log('[applyFormat] Color command detected:', command);
    
    if (!value) {
      console.warn('[applyFormat] No color value provided for', command);
      return;
    }
    
    console.log('[applyFormat] Color value:', value);
    
    // Check if we have a selection
    if (!selection || selection.rangeCount === 0) {
      console.log('[applyFormat] ERROR: No selection or rangeCount is 0');
      showStatus("Vui lòng chọn text để áp dụng màu", true);
      return;
    }
    
    const range = selection.getRangeAt(0);
    console.log('[applyFormat] Range:', {
      collapsed: range.collapsed,
      startContainer: range.startContainer.nodeName,
      endContainer: range.endContainer.nodeName,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      commonAncestorContainer: range.commonAncestorContainer.nodeName,
      toString: range.toString()
    });
    
    // Check if range is within activeElement
    const isWithinActiveElement = activeElement.contains(range.commonAncestorContainer) || 
                                   activeElement === range.commonAncestorContainer ||
                                   range.commonAncestorContainer.contains(activeElement);
    console.log('[applyFormat] Range within activeElement:', isWithinActiveElement);
    
    // If no text is selected, show message
    if (range.collapsed) {
      console.log('[applyFormat] ERROR: Range is collapsed (no text selected)');
      showStatus("Vui lòng chọn text trước khi áp dụng màu", true);
      return;
    }
    
    // Ensure range is within activeElement
    if (!isWithinActiveElement) {
      console.log('[applyFormat] WARNING: Range is not within activeElement, trying to fix...');
      // Try to restore selection again with focus
      activeElement.focus();
      if (restoreSelection()) {
        // Try again with restored selection
        const newSelection = window.getSelection();
        if (newSelection.rangeCount > 0) {
          const newRange = newSelection.getRangeAt(0);
          if (!newRange.collapsed && 
              (activeElement.contains(newRange.commonAncestorContainer) || 
               activeElement === newRange.commonAncestorContainer)) {
            console.log('[applyFormat] Restored selection is valid, continuing...');
            // Continue with the restored range
          } else {
            console.log('[applyFormat] Restored selection is not valid');
            showStatus("Vui lòng chọn text trong field để áp dụng màu", true);
            return;
          }
        } else {
          showStatus("Vui lòng chọn text trong field để áp dụng màu", true);
          return;
        }
      } else {
        showStatus("Vui lòng chọn text trong field để áp dụng màu", true);
        return;
      }
    }
    
    // Try execCommand first (but for backColor, prefer manual approach for better compatibility)
    if (command === 'backColor') {
      console.log('[applyFormat] Using manual approach for backColor (better compatibility)');
      // Skip execCommand for backColor and go directly to manual approach
    } else {
      console.log('[applyFormat] Trying execCommand...');
      try {
        // Ensure the range is selected
        selection.removeAllRanges();
        selection.addRange(range);
        
        const success = document.execCommand(command, false, value);
        console.log('[applyFormat] execCommand result:', success);
        
        if (success) {
          console.log('[applyFormat] execCommand SUCCESS');
          activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          
          // Verify the color was applied (only for foreColor)
          if (command === 'foreColor') {
            try {
              const selectedElement = selection.anchorNode.nodeType === Node.TEXT_NODE 
                ? selection.anchorNode.parentElement 
                : selection.anchorNode;
              const appliedColor = window.getComputedStyle(selectedElement).color;
              console.log('[applyFormat] Applied color check:', appliedColor);
            } catch (e) {
              console.warn('[applyFormat] Could not verify applied color:', e);
            }
          }
          
          return;
        } else {
          console.log('[applyFormat] execCommand returned false, trying manual approach');
        }
      } catch (e) {
        console.error('[applyFormat] execCommand exception:', e);
      }
    }
    
    // Manual approach: wrap selection with span
    console.log('[applyFormat] Using manual approach...');
    try {
      // Ensure we have a valid range
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Get the selected content
      const selectedContent = range.cloneContents();
      const selectedText = range.toString();
      console.log('[applyFormat] Selected text:', selectedText);
      console.log('[applyFormat] Selected content nodes:', selectedContent.childNodes.length);
      
      // Create a span with the color style
      const span = document.createElement('span');
      if (command === 'foreColor') {
        span.style.color = value;
        console.log('[applyFormat] Setting span color to:', value);
      } else if (command === 'backColor') {
        span.style.backgroundColor = value;
        console.log('[applyFormat] Setting span backgroundColor to:', value);
      }
      
      // Try to surround the range
      try {
        console.log('[applyFormat] Trying surroundContents...');
        range.surroundContents(span);
        console.log('[applyFormat] surroundContents SUCCESS');
      } catch (surroundError) {
        console.log('[applyFormat] surroundContents failed, using extract/insert method:', surroundError);
        // If surroundContents fails (e.g., range spans multiple nodes),
        // extract contents and wrap them
        try {
          // Delete the selected content
          range.deleteContents();
          // Append the cloned content to span
          span.appendChild(selectedContent);
          // Insert the span at the range position
          range.insertNode(span);
          console.log('[applyFormat] Manual insert SUCCESS');
        } catch (insertError) {
          console.error('[applyFormat] Manual insert failed:', insertError);
          // Last resort: try to insert span with text content
          span.textContent = selectedText;
          range.deleteContents();
          range.insertNode(span);
          console.log('[applyFormat] Fallback insert SUCCESS');
        }
      }
      
      // Update selection to the new span (or its contents)
      selection.removeAllRanges();
      const newRange = document.createRange();
      // Select the span contents for better UX
      if (span.firstChild) {
        newRange.selectNodeContents(span);
      } else {
        newRange.selectNode(span);
      }
      selection.addRange(newRange);
      
      console.log('[applyFormat] Manual approach SUCCESS');
      console.log('[applyFormat] ActiveElement innerHTML after:', activeElement.innerHTML.substring(0, 200));
      
      // Verify the style was applied
      if (command === 'backColor') {
        const computedStyle = window.getComputedStyle(span);
        console.log('[applyFormat] Applied backgroundColor:', computedStyle.backgroundColor);
      } else {
        const computedStyle = window.getComputedStyle(span);
        console.log('[applyFormat] Applied color:', computedStyle.color);
      }
      
      activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      return;
    } catch (e) {
      console.error('[applyFormat] Manual color application failed:', e);
      console.error('[applyFormat] Error stack:', e.stack);
      showStatus("Không thể áp dụng màu. Vui lòng thử lại.", true);
      return;
    }
  }
  
  // For other commands (bold, italic, etc.)
  console.log('[applyFormat] Non-color command:', command);
  try {
    const success = document.execCommand(command, false, value);
    console.log('[applyFormat] execCommand result:', success);
    activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  } catch (e) {
    console.error(`[applyFormat] Error executing format command '${command}':`, e);
    showStatus(`Lỗi khi áp dụng định dạng: ${e.message}`, true);
  }
}

export function addCloze(clozeNumber = null) {
  if (!activeElement || !activeElement.isContentEditable) return;
  activeElement.focus();
  const selection = window.getSelection();
  let indexToUse;

  if (clozeNumber !== null && !isNaN(clozeNumber) && clozeNumber > 0) {
      indexToUse = parseInt(clozeNumber);
  } else {
      indexToUse = currentClozeIndex;
      incrementClozeIndex();
  }

  const clozeText = `{{c${indexToUse}::${selection.toString() || ''}}}`;
  try {
      document.execCommand('insertText', false, clozeText);
  } catch (e) {
      console.error("Error inserting cloze text:", e);
  }
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}