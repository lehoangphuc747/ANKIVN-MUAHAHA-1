// settings.js
let allModelsForSettings = []; // Lưu danh sách model

// --- Hàm giao tiếp với Anki-Connect (copy từ popup.js) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, version: 6, params: params })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.result;
    } catch (error) {
        console.error('Anki-Connect error:', error);
        showStatus('Lỗi kết nối Anki-Connect: ' + error.message, 'error');
        throw error;
    }
}

// --- Hàm hiển thị thông báo (copy từ popup.js, nhưng dùng ID khác) ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('settings-status'); // ID khác
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    setTimeout(() => {
       if (statusElement.textContent === message) {
           statusElement.textContent = '';
           statusElement.className = 'status-message';
       }
    }, 4000);
}

// --- Hàm setupAutocomplete (copy từ popup.js) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase();
    const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const suggestions = sourceArray.filter(item => { const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => {
        const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item;
        suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); });
        container.appendChild(suggestionItem);
    });
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => showSuggestions(input.value));
  input.addEventListener('focus', () => showSuggestions(''));
  input.addEventListener('keydown', (e) => {
      let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return;
      if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); }
      else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); }
      else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); }
      else if (e.keyCode == 27) { closeAllLists(); }
  });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { container.innerHTML = ''; container.style.display = 'none'; }
  document.addEventListener('click', (e) => { if (e.target !== input) closeAllLists(); });
}


// --- Hàm tải Fields và trạng thái ẩn (không đổi) ---
async function loadFieldsForSettings(modelName) {
    const fieldsListDiv = document.getElementById('settings-fields-list');
    fieldsListDiv.innerHTML = '<p>Đang tải fields...</p>';

    if (!modelName) {
        fieldsListDiv.innerHTML = '<p><i>Hãy chọn một Note Type ở trên.</i></p>';
        return;
    }
    // [THÊM] Kiểm tra model có hợp lệ không trước khi gọi API
    if (!allModelsForSettings.includes(modelName)) {
         fieldsListDiv.innerHTML = '<p><i>Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.</i></p>';
         return;
    }

    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        const storageKey = `hiddenFields_${modelName}`;
        const storedData = await chrome.storage.local.get(storageKey);
        const hiddenFields = storedData[storageKey] || {};

        fieldsListDiv.innerHTML = '';

        if (fieldNames.length === 0) {
             fieldsListDiv.innerHTML = '<p><i>Model này không có field nào.</i></p>';
             return;
        }

        fieldNames.forEach(fieldName => {
            const isHidden = hiddenFields[fieldName] || false;
            const div = document.createElement('div'); div.className = 'field-checkbox-group';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `check-${fieldName}`; checkbox.dataset.fieldName = fieldName; checkbox.checked = isHidden;
            const label = document.createElement('label'); label.htmlFor = `check-${fieldName}`; label.textContent = fieldName;
            div.appendChild(checkbox); div.appendChild(label); fieldsListDiv.appendChild(div);
        });

    } catch (error) {
        console.error('Error loading fields for settings:', error);
        fieldsListDiv.innerHTML = `<p style="color: red;">Lỗi tải fields: ${error.message}</p>`;
        showStatus('Lỗi tải fields: ' + error.message, 'error');
    }
}

// --- Hàm lưu cài đặt (không đổi nhiều, chỉ lấy model từ input) ---
async function saveSettings() {
    // [THAY ĐỔI] Lấy model từ ô input autocomplete
    const selectedModel = document.getElementById('settings-model-search').value;

    if (!selectedModel) {
        showStatus('Vui lòng chọn Note Type trước khi lưu.', 'error'); return;
    }
    // [THÊM] Kiểm tra model có hợp lệ không
     if (!allModelsForSettings.includes(selectedModel)) {
         showStatus('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.', 'error'); return;
     }

    const checkboxes = document.querySelectorAll('#settings-fields-list input[type="checkbox"]');
    const hiddenFieldsState = {};
    checkboxes.forEach(checkbox => { const fieldName = checkbox.dataset.fieldName; hiddenFieldsState[fieldName] = checkbox.checked; });

    const storageKey = `hiddenFields_${selectedModel}`;
    try {
        await chrome.storage.local.set({ [storageKey]: hiddenFieldsState });
        console.log(`Settings saved for ${selectedModel}:`, hiddenFieldsState);
        showStatus('Đã lưu cài đặt cho Note Type: ' + selectedModel, 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    }
}


// --- [ĐÃ VIẾT LẠI] Khởi tạo trang Settings ---
document.addEventListener('DOMContentLoaded', async () => {
    const saveButton = document.getElementById('save-settings-btn');

    // Tải danh sách Note Types và thiết lập autocomplete
    try {
        allModelsForSettings = await invoke('modelNames'); // Lấy và lưu vào biến toàn cục

        // Gọi setupAutocomplete
        setupAutocomplete(
            'settings-model-search',         // ID ô input
            'settings-model-suggestions',    // ID div gợi ý
            allModelsForSettings,            // Mảng dữ liệu model
            (selectedModel) => {             // Callback khi chọn
                loadFieldsForSettings(selectedModel); // Tải fields tương ứng
            }
        );

    } catch (error) {
       showStatus('Không thể tải danh sách Note Types. Anki-Connect có đang chạy?', 'error');
       // Có thể vô hiệu hóa input nếu muốn
       // document.getElementById('settings-model-search').disabled = true;
    }

    // Thêm event listener cho nút Lưu
    saveButton.addEventListener('click', saveSettings);
});