// src/features/note-loader.js
import { invoke } from '../api/anki-connect.js';
import { showStatus } from '../ui/status.js';
import { createFieldsForModel } from '../ui/fields.js';

/**
 * Setup note search với autocomplete
 * @param {HTMLElement} inputElement - Input element để tìm kiếm note
 * @param {Function} onNoteSelected - Callback khi note được chọn (noteId) => void
 */
export function setupNoteSearch(inputElement, onNoteSelected) {
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
      suggestionsContainer.style.display = 'none';
      inputElement.value = '';
      if (onNoteSelected) {
        await onNoteSelected(noteId);
      }
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (e.target !== inputElement && !container.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
    }
  });
}

/**
 * Load note và điền vào fields
 * @param {number} noteId - ID của note cần tải
 * @param {Function} onNoteLoaded - Callback khi note được tải (noteId) => void
 */
export async function loadNote(noteId, onNoteLoaded = null) {
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
      // Lấy deck từ note
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

    showStatus(`Đã tải note (ID: ${noteId})`);

    // Gọi callback nếu có
    if (onNoteLoaded) {
      onNoteLoaded(noteId);
    }
  } catch (error) {
    showStatus(`Lỗi khi tải note: ${error.message}`, true);
    console.error('[AnkiVN] Error loading note:', error);
  }
}

