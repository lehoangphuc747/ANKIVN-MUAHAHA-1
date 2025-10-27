// popup.js
let allDecks = [];
let allModels = [];

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

/**
 * [HÀM MỚI]
 * Thiết lập logic autocomplete cho một ô input
 * @param {string} inputId - ID của ô input
 * @param {string} containerId - ID của div chứa gợi ý
 * @param {string[]} sourceArray - Mảng dữ liệu (allDecks hoặc allModels)
 * @param {function(string)} onSelectCallback - (Tùy chọn) Hàm gọi khi một mục được chọn
 */
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);

  input.addEventListener('input', () => {
    const value = input.value.toLowerCase();
    container.innerHTML = ''; // Xóa gợi ý cũ
    
    if (!value) {
      container.style.display = 'none';
      return;
    }

    const suggestions = sourceArray.filter(item => item.toLowerCase().includes(value));
    
    if (suggestions.length > 0) {
      suggestions.forEach(item => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.textContent = item;
        
        suggestionItem.addEventListener('click', () => {
          input.value = item; // Điền giá trị vào input
          container.innerHTML = '';
          container.style.display = 'none';
          
          // Gọi callback nếu có (dùng để tải fields cho model)
          if (onSelectCallback) {
            onSelectCallback(item);
          }
        });
        
        container.appendChild(suggestionItem);
      });
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  });

  // Ẩn gợi ý khi click ra ngoài
  input.addEventListener('blur', () => {
    // Thêm delay nhỏ để sự kiện click vào gợi ý kịp chạy
    setTimeout(() => {
      container.style.display = 'none';
    }, 200);
  });
}

// Hàm khởi tạo popup
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Lấy và lưu trữ decks và models
    allDecks = await invoke('deckNames');
    allModels = await invoke('modelNames');
    
    // Thiết lập autocomplete
    setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
    setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
      // Đây là callback `onSelectCallback`
      // Khi chọn một model, gọi hàm createFieldsForModel
      if (selectedModel) {
        createFieldsForModel(selectedModel);
      } else {
        document.getElementById('fields-container').innerHTML = '';
      }
    });

    // Lấy danh sách tags (cho datalist)
    const tags = await invoke('getTags');
    const tagsDatalist = document.getElementById('tags-datalist');
    
    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      tagsDatalist.appendChild(option);
    });

    // Thêm event listener cho nút thêm note
    document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);

  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Không thể kết nối với Anki-Connect. Hãy đảm bảo Anki đang chạy và plugin Anki-Connect đã được cài đặt.', 'error');
  }
});

// Hàm thêm note vào Anki
async function addNoteToAnki() {
  try {
    showStatus('Đang thêm...', 'info');

    // [ĐÃ THAY ĐỔI] Lấy giá trị từ ô input search
    const deckName = document.getElementById('deck-search').value;
    const modelName = document.getElementById('model-search').value;
    const tagsInput = document.getElementById('tags-input').value;

    if (!deckName || !modelName) {
      throw new Error('Vui lòng chọn deck và note type');
    }
    
    // [ĐÃ THAY ĐỔI] Kiểm tra xem deck và model có hợp lệ không
    if (!allDecks.includes(deckName)) {
      throw new Error('Tên Deck không hợp lệ. Vui lòng chọn từ gợi ý.');
    }
    if (!allModels.includes(modelName)) {
      throw new Error('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.');
    }

    // Tạo object fields từ các input
    const fields = {};
    const fieldInputs = document.querySelectorAll('.field-input');
    
    if (fieldInputs.length === 0) {
        throw new Error('Vui lòng chọn Note Type để hiển thị fields.');
    }
    
    fieldInputs.forEach(input => {
      const fieldName = input.id.replace('field-', '');
      fields[fieldName] = input.value;
    });

    const hasContent = Object.values(fields).some(value => value