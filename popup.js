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

// Hàm tạo fields động dựa trên model được chọn
async function createFieldsForModel(modelName) {
  try {
    const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
    const fieldsContainer = document.getElementById('fields-container');
    
    // Xóa sạch nội dung cũ
    fieldsContainer.innerHTML = '';
    
    // Tạo các field mới
    fieldNames.forEach(fieldName => {
      const fieldGroup = document.createElement('div');
      fieldGroup.className = 'form-group';
      
      const label = document.createElement('label');
      label.textContent = fieldName + ':';
      label.htmlFor = `field-${fieldName}`;
      
      // Sử dụng textarea cho các field có thể có nội dung dài
      const input = document.createElement('textarea');
      input.id = `field-${fieldName}`;
      input.className = 'form-control field-input';
      input.placeholder = `Nhập nội dung cho ${fieldName}`;
      input.rows = 3;
      
      fieldGroup.appendChild(label);
      fieldGroup.appendChild(input);
      fieldsContainer.appendChild(fieldGroup);
    });
    
  } catch (error) {
    console.error('Error creating fields:', error);
    showStatus('Không thể tải thông tin fields cho model này.', 'error');
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

    // Thêm event listener cho model-select
    modelSelect.addEventListener('change', function() {
      const selectedModel = this.value;
      if (selectedModel) {
        createFieldsForModel(selectedModel);
      } else {
        // Xóa fields nếu không có model nào được chọn
        document.getElementById('fields-container').innerHTML = '';
      }
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