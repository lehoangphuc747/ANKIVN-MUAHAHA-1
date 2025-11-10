// src/content/alt-selection.js
// Content script to detect Alt + text selection and send to extension

let isAltPressed = false;
let lastSentSelection = null; // Track last sent selection to avoid duplicates
let lastSendTime = 0; // Track last send time for debouncing

// Listen for Alt key down
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' || e.altKey) {
    isAltPressed = true;
    console.log('[AnkiVN Content] Alt key pressed');
  }
});

// Listen for Alt key up
document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt' || !e.altKey) {
    isAltPressed = false;
    console.log('[AnkiVN Content] Alt key released');
  }
});

// Function to create selection hash for duplicate detection
// Use full text length + first 50 chars + last 50 chars to handle long texts
function createSelectionHash(text, url) {
  if (!text || text.length === 0) return '';
  const textLen = text.length;
  const firstPart = text.substring(0, Math.min(50, textLen));
  const lastPart = textLen > 50 ? text.substring(textLen - 50) : '';
  // Use a simple hash of the text for better comparison
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${textLen}|${hash}|${url}`;
}

// Function to send selection (with duplicate and debounce checks)
function sendSelectionIfNew(text, url, title) {
  const now = Date.now();
  const selectionHash = createSelectionHash(text, url);
  
  // Debounce: don't send if sent within last 500ms
  if (now - lastSendTime < 500) {
    console.log('[AnkiVN Content] Debouncing - too soon after last send');
    return;
  }
  
  // Duplicate check: don't send if same selection
  if (lastSentSelection === selectionHash) {
    console.log('[AnkiVN Content] Duplicate selection detected, skipping');
    return;
  }
  
  console.log('[AnkiVN Content] Sending altSelectionDetected message:', {
    textLength: text.length,
    textPreview: text.substring(0, 50),
    url: url,
    title: title
  });
  
  // Update tracking
  lastSentSelection = selectionHash;
  lastSendTime = now;
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'altSelectionDetected',
    text: text,
    url: url,
    title: title
  }).then(() => {
    console.log('[AnkiVN Content] Message sent successfully');
  }).catch(err => {
    // Ignore errors if extension context is invalid
    console.error('[AnkiVN Content] Error sending message:', err);
  });
}

// Listen for mouseup after text selection
document.addEventListener('mouseup', async (e) => {
  // Wait a bit for selection to be set
  setTimeout(() => {
    if (isAltPressed) {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      console.log('[AnkiVN Content] Mouseup - Alt pressed:', isAltPressed, 'Text length:', text.length);
      
      if (text && text.length > 0) {
        // Check if selection is not in an input/textarea (to avoid interfering with extension UI)
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.isContentEditable
        )) {
          // Skip if selecting in input fields
          console.log('[AnkiVN Content] Skipping - selection is in input/textarea/contentEditable');
          return;
        }
        
        sendSelectionIfNew(text, window.location.href, document.title);
      } else {
        console.log('[AnkiVN Content] No text selected or text is empty');
      }
    }
  }, 10);
});

// Also listen for selection change (for keyboard selection)
// But only trigger if mouseup didn't already trigger (to avoid duplicates)
document.addEventListener('selectionchange', async () => {
  if (isAltPressed) {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    console.log('[AnkiVN Content] Selection change - Alt pressed:', isAltPressed, 'Text length:', text.length);
    
    if (text && text.length > 0) {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable
      )) {
        console.log('[AnkiVN Content] Skipping selectionchange - in input/textarea/contentEditable');
        return;
      }
      
      // Debounce to avoid too many messages
      // Use longer timeout for selectionchange to let mouseup handle it first
      clearTimeout(window.ankivnSelectionTimeout);
      window.ankivnSelectionTimeout = setTimeout(() => {
        sendSelectionIfNew(text, window.location.href, document.title);
      }, 500); // Longer delay to let mouseup handle first
    }
  }
});

// Reset tracking when Alt is released
document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt' || !e.altKey) {
    // Clear tracking after a delay to allow for new selections
    setTimeout(() => {
      lastSentSelection = null;
      lastSendTime = 0;
      console.log('[AnkiVN Content] Reset selection tracking');
    }, 1000);
  }
});

