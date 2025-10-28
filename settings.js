// settings.js
let allModelsForSettings = [];
let currentSettingsModel = '';

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.result;
    } catch (error) {
        console.error(`Anki-Connect error in settings (${action}):`, error);
        showStatus(`Lỗi (${action}): ${error.message}. Anki/Anki-Connect có đang chạy?`, 'error');
        return null;
    }
}

// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('settings-status'); statusElement.textContent = message; statusElement.className = `status-message ${type}`;
    if (window.settingsStatusTimeout) clearTimeout(window.settingsStatusTimeout);
    if (type === 'success') {
       window.settingsStatusTimeout = setTimeout(() => { if (statusElement.textContent === message) { statusElement.textContent = ''; statusElement.className = 'status-message'; } }, 4000);
    } else {
        window.settingsStatusTimeout = null;
    }
}

// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  const input = document.getElementById(inputId); const container = document.getElementById(containerId); if (!input || !container) { console.error(`Autocomplete setup failed: Cannot find elements #${inputId} or #${containerId}`); return; } let currentFocus = -1;
  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const validSource = Array.isArray(sourceArray) ? sourceArray : [];
    const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); }); container.appendChild(suggestionItem); });
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { showSuggestions(input.value); });
  input.addEventListener('focus', () => { showSuggestions(''); });
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { items[currentFocus].click(); } } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { container.innerHTML = ''; container.style.display = 'none'; }
  document.addEventListener('click', (e) => { if (e.target !== input && !container.contains(e.target) ) closeAllLists(); });
}


// --- [CẬP NHẬT] Hàm loadFieldsForSettings ---
async function loadFieldsForSettings(modelName) {
    currentSettingsModel = modelName;
    const fieldsListContainer = document.getElementById('settings-fields-list-container');
    const stickyFieldsListContainer = document.getElementById('settings-sticky-fields-list-container'); // [MỚI]
    const randomIdSection = document.getElementById('random-id-section');
    const randomIdSelect = document.getElementById('random-id-field-select');

    // Reset
    fieldsListContainer.innerHTML = '<p>Đang tải fields...</p>';
    stickyFieldsListContainer.innerHTML = '<p>Đang tải fields...</p>'; // [MỚI]
    randomIdSelect.innerHTML = '<option value="">-- Không tự động tạo ID --</option>';
    randomIdSection.style.display = 'none';

    if (!modelName || !allModelsForSettings.includes(modelName)) {
        const msg = `<p><i>${!modelName ? 'Hãy chọn một Note Type hợp lệ.' : 'Tên Note Type không hợp lệ.'}</i></p>`;
        fieldsListContainer.innerHTML = msg;
        stickyFieldsListContainer.innerHTML = msg; // [MỚI]
        return;
    }
    
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if(fieldNames === null) throw new Error("modelFieldNames returned null.");

        // [MỚI] Các key để lấy từ storage
        const hiddenFieldsKey = `hiddenFields_${modelName}`;
        const stickyFieldsKey = `stickyFields_${modelName}`; // [MỚI]
        const randomIdFieldKey = `randomIdField_${modelName}`;
        
        const storedData = await chrome.storage.local.get([hiddenFieldsKey, stickyFieldsKey, randomIdFieldKey]); // [MỚI] Lấy cả 3
        
        const hiddenFields = storedData[hiddenFieldsKey] || {};
        const stickyFields = storedData[stickyFieldsKey] || {}; // [MỚI]
        const selectedRandomIdField = storedData[randomIdFieldKey] || "";

        fieldsListContainer.innerHTML = '';
        stickyFieldsListContainer.innerHTML = ''; // [MỚI]

        if (fieldNames.length === 0) {
            const msg = '<p><i>Model này không có field nào.</i></p>';
            fieldsListContainer.innerHTML = msg;
            stickyFieldsListContainer.innerHTML = msg; // [MỚI]
            return;
        }

        fieldNames.forEach(fieldName => {
            const checkboxId = `check-hide-${fieldName.replace(/\s+/g, '-')}`;
            const isHidden = hiddenFields[fieldName] || false;

            // Tạo item cho "Ẩn Field"
            const hideItemDiv = document.createElement('div');
            hideItemDiv.className = `field-checkbox-item ${isHidden ? 'checked' : ''}`;
            const hideCheckbox = document.createElement('input');
            hideCheckbox.type = 'checkbox'; hideCheckbox.id = checkboxId; hideCheckbox.dataset.fieldName = fieldName; hideCheckbox.checked = isHidden; hideCheckbox.style.pointerEvents = 'none';
            const hideLabel = document.createElement('label');
            hideLabel.htmlFor = checkboxId; hideLabel.textContent = fieldName; hideLabel.title = fieldName;
            hideItemDiv.appendChild(hideCheckbox); hideItemDiv.appendChild(hideLabel);
            hideItemDiv.addEventListener('click', () => {
                hideCheckbox.checked = !hideCheckbox.checked;
                hideItemDiv.classList.toggle('checked', hideCheckbox.checked);
            });
            fieldsListContainer.appendChild(hideItemDiv);

            // [MỚI] Tạo item cho "Ghim Field"
            const stickyCheckboxId = `check-sticky-${fieldName.replace(/\s+/g, '-')}`;
            const isSticky = stickyFields[fieldName] || false;
            const stickyItemDiv = document.createElement('div');
            // Thêm class 'sticky-item' để tùy chỉnh style
            stickyItemDiv.className = `field-checkbox-item sticky-item ${isSticky ? 'checked' : ''}`; 
            const stickyCheckbox = document.createElement('input');
            stickyCheckbox.type = 'checkbox'; stickyCheckbox.id = stickyCheckboxId; stickyCheckbox.dataset.fieldName = fieldName; stickyCheckbox.checked = isSticky; stickyCheckbox.style.pointerEvents = 'none';
            const stickyLabel = document.createElement('label');
            stickyLabel.htmlFor = stickyCheckboxId; stickyLabel.textContent = `📌 ${fieldName}`; stickyLabel.title = fieldName;
            stickyItemDiv.appendChild(stickyCheckbox); stickyItemDiv.appendChild(stickyLabel);
            stickyItemDiv.addEventListener('click', () => {
                stickyCheckbox.checked = !stickyCheckbox.checked;
                stickyItemDiv.classList.toggle('checked', stickyCheckbox.checked);
            });
            stickyFieldsListContainer.appendChild(stickyItemDiv);
            
            // Tạo option cho "Random ID"
            const option = document.createElement('option');
            option.value = fieldName; option.textContent = fieldName;
            randomIdSelect.appendChild(option);
        });

        if (selectedRandomIdField) { randomIdSelect.value = selectedRandomIdField; }
        randomIdSection.style.display = 'block';

    } catch (error) {
        console.error('Error loading fields/settings:', error);
        const errorMsg = `<p style="color: red;">Lỗi tải cấu hình: ${error.message}</p>`;
        fieldsListContainer.innerHTML = errorMsg;
        stickyFieldsListContainer.innerHTML = errorMsg; // [MỚI]
        showStatus('Lỗi tải cấu hình: ' + error.message, 'error');
        randomIdSection.style.display = 'none';
    }
}

// --- [CẬP NHẬT] Hàm lưu cài đặt ---
async function saveSettings() {
    console.log("Save button clicked");
    const selectedModel = document.getElementById('settings-model-search').value;

    if (!selectedModel || !allModelsForSettings.includes(selectedModel)) {
        showStatus('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.', 'error');
        return;
    }

    try {
        // Lưu trạng thái Ẩn
        const hiddenCheckboxes = document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]');
        const hiddenFieldsState = {};
        hiddenCheckboxes.forEach(checkbox => {
            hiddenFieldsState[checkbox.dataset.fieldName] = checkbox.checked;
        });
        const hiddenFieldsKey = `hiddenFields_${selectedModel}`;
        console.log(`Saving hidden fields for ${selectedModel}:`, hiddenFieldsState);

        // [MỚI] Lưu trạng thái Ghim
        const stickyCheckboxes = document.querySelectorAll('#settings-sticky-fields-list-container input[type="checkbox"]');
        const stickyFieldsState = {};
        stickyCheckboxes.forEach(checkbox => {
            stickyFieldsState[checkbox.dataset.fieldName] = checkbox.checked;
        });
        const stickyFieldsKey = `stickyFields_${selectedModel}`;
        console.log(`Saving sticky fields for ${selectedModel}:`, stickyFieldsState);

        // Lấy và lưu Random ID Field
        const randomIdSelect = document.getElementById('random-id-field-select');
        const selectedRandomIdField = randomIdSelect.value;
        const randomIdFieldKey = `randomIdField_${selectedModel}`;
        console.log(`Saving random ID field for ${selectedModel}: "${selectedRandomIdField}"`);

        // [MỚI] Lưu tất cả vào storage
        await chrome.storage.local.set({
            [hiddenFieldsKey]: hiddenFieldsState,
            [stickyFieldsKey]: stickyFieldsState,
            [randomIdFieldKey]: selectedRandomIdField
        });

        console.log(`Settings saved successfully for ${selectedModel}`);
        showStatus('Đã lưu cài đặt cho Note Type: ' + selectedModel, 'success');
    } catch (error) {
        console.error('Error saving settings to chrome.storage:', error);
        showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    }
}

// --- Hàm setAllCheckboxes (không đổi) ---
function setAllCheckboxes(checkedState) {
    document.querySelectorAll('#settings-fields-list-container .field-checkbox-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = checkedState;
            item.classList.toggle('checked', checkedState);
        }
    });
}

// --- [MỚI] Hàm setAllStickyCheckboxes ---
function setAllStickyCheckboxes(checkedState) {
    document.querySelectorAll('#settings-sticky-fields-list-container .field-checkbox-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = checkedState;
            item.classList.toggle('checked', checkedState);
        }
    });
}


// --- [CẬP NHẬT] Khởi tạo trang Settings ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Settings page loaded");
    
    // Nút cho Ẩn
    const selectAllButton = document.getElementById('select-all-fields');
    const deselectAllButton = document.getElementById('deselect-all-fields');
    
    // [MỚI] Nút cho Ghim
    const selectAllStickyButton = document.getElementById('select-all-sticky-fields');
    const deselectAllStickyButton = document.getElementById('deselect-all-sticky-fields');

    const saveButton = document.getElementById('save-settings-btn');

    try {
        allModelsForSettings = await invoke('modelNames');
        if (allModelsForSettings === null) {
            showStatus('Không thể lấy danh sách Note Type từ Anki.', 'error');
            allModelsForSettings = [];
        } else {
            console.log("Models loaded for settings:", allModelsForSettings.length);
        }
        setupAutocomplete('settings-model-search', 'settings-model-suggestions', allModelsForSettings, (selectedModel) => {
            console.log(`Autocomplete selected: ${selectedModel}`);
            loadFieldsForSettings(selectedModel);
        });
    } catch (error) {
        console.error("Error fetching model names:", error);
        showStatus('Không thể tải danh sách Note Types.', 'error');
    }

    // Gán sự kiện
    saveButton.addEventListener('click', saveSettings);
    selectAllButton.addEventListener('click', () => setAllCheckboxes(true));
    deselectAllButton.addEventListener('click', () => setAllCheckboxes(false));
    
    // [MỚI] Gán sự kiện cho nút Ghim
    selectAllStickyButton.addEventListener('click', () => setAllStickyCheckboxes(true));
    deselectAllStickyButton.addEventListener('click', () => setAllStickyCheckboxes(false));
});
