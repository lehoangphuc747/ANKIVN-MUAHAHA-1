// settings.js
let allModelsForSettings = [];

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên ... */ 
    try { const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) }); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const result = await response.json(); if (result.error) throw new Error(result.error); return result.result; } catch (error) { console.error('Anki-Connect error:', error); showStatus('Lỗi kết nối Anki-Connect: ' + error.message, 'error'); throw error; }
}
// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */
    const statusElement = document.getElementById('settings-status'); statusElement.textContent = message; statusElement.className = `status-message ${type}`; setTimeout(() => { if (statusElement.textContent === message) { statusElement.textContent = ''; statusElement.className = 'status-message'; } }, 4000);
}
// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên ... */
  const input = document.getElementById(inputId); const container = document.getElementById(containerId); let currentFocus = -1;
  function showSuggestions(value) { container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== ''); const suggestions = sourceArray.filter(item => { const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); }); if (suggestions.length === 0) { container.style.display = 'none'; return; } suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); }); container.appendChild(suggestionItem); }); container.style.display = 'block'; currentFocus = -1; }
  input.addEventListener('input', () => showSuggestions(input.value)); input.addEventListener('focus', () => showSuggestions(''));
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { container.innerHTML = ''; container.style.display = 'none'; }
  document.addEventListener('click', (e) => { if (e.target !== input) closeAllLists(); });
}

// --- [HÀM ĐƯỢC VIẾT LẠI] Tải Fields với UI cải tiến ---
async function loadFieldsForSettings(modelName) {
    const fieldsListContainer = document.getElementById('settings-fields-list-container');
    fieldsListContainer.innerHTML = '<p>Đang tải fields...</p>';

    if (!modelName || !allModelsForSettings.includes(modelName)) {
        fieldsListContainer.innerHTML = `<p><i>${!modelName ? 'Hãy chọn một Note Type ở trên.' : 'Tên Note Type không hợp lệ.'}</i></p>`; return;
    }

    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        const storageKey = `hiddenFields_${modelName}`;
        const storedData = await chrome.storage.local.get(storageKey);
        const hiddenFields = storedData[storageKey] || {};

        fieldsListContainer.innerHTML = '';

        if (fieldNames.length === 0) {
             fieldsListContainer.innerHTML = '<p><i>Model này không có field nào.</i></p>'; return;
        }

        fieldNames.forEach(fieldName => {
            const isHidden = hiddenFields[fieldName] || false;
            const checkboxId = `check-${fieldName.replace(/\s+/g, '-')}`; // Tạo ID an toàn

            // Tạo item div (clickable)
            const itemDiv = document.createElement('div');
            itemDiv.className = 'field-checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.dataset.fieldName = fieldName;
            checkbox.checked = isHidden;

            const label = document.createElement('label');
            label.htmlFor = checkboxId; // Trỏ tới checkbox
            label.textContent = fieldName;
            label.title = fieldName; // Tooltip

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);

            // [MỚI] Thêm sự kiện click vào toàn bộ itemDiv
            itemDiv.addEventListener('click', (event) => {
                // Ngăn chặn việc click vào label kích hoạt 2 lần event
                if (event.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // Kích hoạt sự kiện change thủ công nếu cần (ít khi cần)
                    // checkbox.dispatchEvent(new Event('change'));
                }
                // Cập nhật style ngay lập tức (tùy chọn)
                 if(checkbox.checked) {
                     itemDiv.style.backgroundColor = "#fff0f0"; // Màu nền nhẹ khi ẩn
                 } else {
                     itemDiv.style.backgroundColor = "#f9f9f9"; // Màu nền mặc định
                 }
            });
             // [MỚI] Set style ban đầu dựa trên trạng thái checked
             if(checkbox.checked) {
                 itemDiv.style.backgroundColor = "#fff0f0";
             } else {
                 itemDiv.style.backgroundColor = "#f9f9f9";
             }


            fieldsListContainer.appendChild(itemDiv);
        });

    } catch (error) {
        console.error('Error loading fields for settings:', error);
        fieldsListContainer.innerHTML = `<p style="color: red;">Lỗi tải fields: ${error.message}</p>`;
        showStatus('Lỗi tải fields: ' + error.message, 'error');
    }
}


// --- Hàm lưu cài đặt (thay đổi selector) ---
async function saveSettings() {
    const selectedModel = document.getElementById('settings-model-search').value;
    if (!selectedModel || !allModelsForSettings.includes(selectedModel)) {
        showStatus(`Vui lòng chọn Note Type hợp lệ${!selectedModel ? '' : ' từ gợi ý'}.`, 'error'); return;
    }

    // [THAY ĐỔI] Lấy checkbox từ container mới
    const checkboxes = document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]');
    const hiddenFieldsState = {};
    checkboxes.forEach(checkbox => { const fieldName = checkbox.dataset.fieldName; hiddenFieldsState[fieldName] = checkbox.checked; });

    const storageKey = `hiddenFields_${selectedModel}`;
    try {
        await chrome.storage.local.set({ [storageKey]: hiddenFieldsState });
        console.log(`Settings saved for ${selectedModel}:`, hiddenFieldsState);
        showStatus('Đã lưu cài đặt cho Note Type: ' + selectedModel, 'success');
    } catch (error) { console.error('Error saving settings:', error); showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error'); }
}

// --- Hàm Chọn/Bỏ chọn tất cả (thay đổi selector) ---
function setAllCheckboxes(checkedState) {
    // [THAY ĐỔI] Lấy checkbox từ container mới
    const checkboxes = document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = checkedState;
        // Cập nhật style tương ứng
        const itemDiv = checkbox.closest('.field-checkbox-item');
        if (itemDiv) {
            itemDiv.style.backgroundColor = checkedState ? "#fff0f0" : "#f9f9f9";
        }
    });
}

// --- Khởi tạo trang Settings (không đổi) ---
document.addEventListener('DOMContentLoaded', async () => {
    const saveButton = document.getElementById('save-settings-btn');
    const selectAllButton = document.getElementById('select-all-fields');
    const deselectAllButton = document.getElementById('deselect-all-fields');

    try {
        allModelsForSettings = await invoke('modelNames');
        setupAutocomplete('settings-model-search', 'settings-model-suggestions', allModelsForSettings, loadFieldsForSettings);
    } catch (error) { showStatus('Không thể tải danh sách Note Types.', 'error'); }

    saveButton.addEventListener('click', saveSettings);
    selectAllButton.addEventListener('click', () => setAllCheckboxes(true));
    deselectAllButton.addEventListener('click', () => setAllCheckboxes(false));
});