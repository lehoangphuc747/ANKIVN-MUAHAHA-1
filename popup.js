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

/**
 * [HÀM MỚI]
 * Hàm lọc các option của một dropdown dựa trên input search.
 * @param {string} inputId - ID của ô input search
 * @param {string} selectId - ID của thẻ select dropdown
 */
function setupDropdownFilter(inputId, selectId) {
  const searchInput = document.getElementById(inputId);
  const selectDropdown = document.getElementById(selectId);

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const options = selectDropdown.getElementsByTagName('option');

    for (const option of options) {
      // Luôn hiển thị option "-- Chọn ..."
      if (option.value === "") {
        option.style.display = '';
        continue;
      }
      
      const text = option.textContent.toLowerCase();
      if (text.includes(searchTerm)) {
        option.style.display = ''; // Hiện
      } else {
        option.style.display = 'none'; // Ẩn
      }
    }
  });
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

    // --- [CODE MỚI] Kích hoạt 2 bộ lọc ---
    setupDropdownFilter('deck-search', 'deck-select');
    setupDropdownFilter('model-search', 'model-select');
    // ------------------------------------

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
    // Hiển thị thông báo đang xử lý
    showStatus('Đang thêm...', 'info');

    // Lấy giá trị từ form
    const deckName = document.getElementById('deck-select').value;
    const modelName = document.getElementById('model-select').value;
    const tagsInput = document.getElementById('tags-input').value;

    // Kiểm tra dữ liệu bắt buộc
    if (!deckName || !modelName) {
      throw new Error('Vui lòng chọn deck và note type');
    }

    // Tạo object fields từ các input
    const fields = {};
    const fieldInputs = document.querySelectorAll('.field-input');
    
    fieldInputs.forEach(input => {
      const fieldName = input.id.replace('field-', '');
      fields[fieldName] = input.value;
    });

    // Kiểm tra xem có field nào được điền không
    const hasContent = Object.values(fields).some(value => value.trim() !== '');
    if (!hasContent) {
      throw new Error('Vui lòng nhập nội dung cho ít nhất một field');
    }

    // Xử lý tags (phân tách bằng dấu cách hoặc phẩy)
    const tagsArray = tagsInput
      .split(/[\s,]+/)
      .filter(tag => tag.trim() !== '')
      .map(tag => tag.trim());

    // Tạo payload
    const params = {
      note: {
        deckName: deckName,
        modelName: modelName,
        fields: fields,
        tags: tagsArray
      }
    };

    // Gọi API thêm note
    const result = await invoke('addNote', params);

    // Thành công
    showStatus('Thêm thành công! Note ID: ' + result, 'success');

    // Xóa nội dung các ô input (giữ nguyên deck và model)
    fieldInputs.forEach(input => {
      input.value = '';
    });
    document.getElementById('tags-input').value = '';

  } catch (error) {
    console.error('Error adding note:', error);
    showStatus('Lỗi: ' + error.message, 'error');
  }
}

// Hàm hiển thị thông báo
function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
}