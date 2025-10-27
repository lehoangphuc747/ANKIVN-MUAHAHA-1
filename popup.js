// popup.js
// Hàm giao tiếp với Anki-Connect API
async function invoke(action, params = {}) {
  try {
    const response = await fetch('http://localhost:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        version: 6,
        params: params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.result;
  } catch (error) {
    console.error('Anki-Connect error:', error);
    throw error;
  }
}

// Hàm khởi tạo popup
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Lấy danh sách decks
    const decks = await invoke('deckNames');
    const deckSelect = document.getElementById('deck-select');
    
    decks.forEach(deck => {
      const option = document.createElement('option');
      option.value = deck;
      option.textContent = deck;
      deckSelect.appendChild(option);
    });

    // Lấy danh sách models (note types)
    const models = await invoke('modelNames');
    const modelSelect = document.getElementById('model-select');
    
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    // Lấy danh sách tags
    const tags = await invoke('getTags');
    const tagsDatalist = document.getElementById('tags-datalist');
    
    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      tagsDatalist.appendChild(option);
    });

  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Không thể kết nối với Anki-Connect. Hãy đảm bảo Anki đang chạy và plugin Anki-Connect đã được cài đặt.', 'error');
  }
});

// Hàm hiển thị thông báo
function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
}

// Các hàm khác sẽ được thêm sau