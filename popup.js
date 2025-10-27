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
 * [HÀM ĐƯỢC CẬP NHẬT LOGIC TÌM KIẾM]
 * Thiết lập logic autocomplete cho một ô input
 */
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  let currentFocus = -1; // Biến theo dõi mục đang được highlight

  // Hàm hiển thị gợi ý
  function showSuggestions(value) {
    container.innerHTML = ''; // Xóa gợi ý cũ
    const valLower = value.toLowerCase();

    // [LOGIC MỚI] Tách truy vấn thành các từ khóa (theo dấu cách)
    const keywords = valLower.split(' ').filter(k => k.trim() !== '');

    // Lọc: item phải chứa TẤT CẢ các từ khóa
    const suggestions = sourceArray.filter(item => {
        const target = item.toLowerCase();
        // Dùng .every() để đảm bảo mọi từ khóa đều có trong item
        return keywords.every(keyword => target.includes(keyword));
    });
    
    if (suggestions.length === 0) {
      container.style.display = 'none';
      return;
    }

    suggestions.forEach((item) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.textContent = item;
      
      // Thêm sự kiện click
      suggestionItem.addEventListener('click', () => {
        input.value = item;
        closeAllLists();
        if (onSelectCallback) {
          onSelectCallback(item);
        }
      });
      container.appendChild(suggestionItem);
    });

    container.style.display = 'block';
    currentFocus = -1; // Reset focus khi danh sách thay đổi
  }

  // Sự kiện 'input' - Hiển thị khi gõ
  input.addEventListener('input', () => {
    showSuggestions(input.value);
  });

  // Sự kiện 'focus' - Hiển thị TẤT CẢ khi click vào
  input.addEventListener('focus', () => {
    showSuggestions(''); // Hiển thị tất cả
  });

  // Sự kiện 'keydown' - Xử lý mũi tên và Enter
  input.addEventListener('keydown', (e) => {
    let items = container.getElementsByClassName('suggestion-item');
    if (items.length === 0) return;

    if (e.keyCode == 40) { // Mũi tên xuống
      e.preventDefault();
      currentFocus++;
      if (currentFocus >= items.length) currentFocus = 0;
      addActive(items);
    } else if (e.keyCode == 38) { // Mũi tên lên
      e.preventDefault();
      currentFocus--;
      if (currentFocus < 0) currentFocus = items.length - 1;
      addActive(items);
    } else if (e.keyCode == 13) { // Phím Enter
      e.preventDefault();
      if (currentFocus > -1) {
        items[currentFocus].click(); // Kích hoạt sự kiện click
      }
    } else if (e.keyCode == 27) { // Phím Escape
      closeAllLists();
    }
  });

  // Hàm tô sáng mục được chọn
  function addActive(items) {
    if (!items) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    
    items[currentFocus].classList.add('active');
    // Cuộn để nhìn thấy
    items[currentFocus].scrollIntoView({ block: 'nearest' });
  }

  // Hàm bỏ tô sáng
  function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
    }
  }

  // Hàm đóng danh sách
  function closeAllLists() {
    container.innerHTML = '';
    container.style.display = 'none';
  }

  // Đóng danh sách khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (e.target !== input) {
      closeAllLists();
    }
  });
}

// Hàm khởi tạo popup
document.addEventListener('DOMContentLoaded', async function() {
  try {
    allDecks = await invoke('deckNames');
    allModels = await invoke('modelNames');
    
    console.log("Decks đã tải:", allDecks);
    console.log("Models đã tải:", allModels);
    
    // Thiết lập autocomplete (đã được nâng cấp)
    setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
    setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
      if (selectedModel) {
        createFieldsForModel(selectedModel);
      } else {
        document.getElementById('fields-container').innerHTML = '';
      }
    });

    const tags = await invoke('getTags');
    const tagsDatalist = document.getElementById('tags-datalist');
    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      tagsDatalist.appendChild(option);
    });

    document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);

  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Không thể kết nối với Anki-Connect. Hãy đảm bảo Anki đang chạy và plugin Anki-Connect đã được cài đặt.', 'error');
  }
});

// Hàm thêm note vào Anki (không đổi)
async function addNoteToAnki() {
  try {
    showStatus('Đang thêm...', 'info');

    const deckName = document.getElementById('deck-search').value;
    const modelName = document.getElementById('model-search').value;
    const tagsInput = document.getElementById('tags-input').value;

    if (!deckName || !modelName) {
      throw new Error('Vui lòng chọn deck và note type');
    }
    
    if (!allDecks.includes(deckName)) {
      throw new Error('Tên Deck không hợp lệ. Vui lòng chọn từ gợi ý.');
    }
    if (!allModels.includes(modelName)) {
      throw new Error('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.');
    }

    const fields = {};
    const fieldInputs = document.querySelectorAll('.field-input');
    
    if (fieldInputs.length === 0) {
        throw new Error('Vui lòng chọn Note Type để hiển thị fields.');
    }
    
    fieldInputs.forEach(input => {
      const fieldName = input.id.replace('field-', '');
      fields[fieldName] = input.value;
    });

    const hasContent = Object.values(fields).some(value => value.trim() !== '');
    if (!hasContent) {
      throw new Error('Vui lòng nhập nội dung cho ít nhất một field');
    }

    const tagsArray = tagsInput
      .split(/[\s,]+/)
      .filter(tag => tag.trim() !== '')
      .map(tag => tag.trim());

    const params = {
      note: {
        deckName: deckName,
        modelName: modelName,
        fields: fields,
        tags: tagsArray
      }
    };

    const result = await invoke('addNote', params);
    showStatus('Thêm thành công! Note ID: ' + result, 'success');

    fieldInputs.forEach(input => {
      input.value = '';
    });
    document.getElementById('tags-input').value = '';

  } catch (error) {
    console.error('Error adding note:', error);
    showStatus('Lỗi: ' + error.message, 'error');
  }
}

// Hàm hiển thị thông báo (không đổi)
function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
}
