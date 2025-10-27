// settings.js
let allModelsForSettings = []; // Lưu danh sách model
let currentSettingsModel = ''; // Lưu model đang cấu hình

// --- Hàm invoke (Sửa lỗi xử lý error) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.result;
    } catch (error) {
        // [SỬA LỖI] Log lỗi và trả về null thay vì throw, để code khác vẫn chạy
        console.error(`Anki-Connect error in settings (${action}):`, error);
        showStatus(`Lỗi (${action}): ${error.message}. Anki/Anki-Connect có đang chạy?`, 'error');
        // Không throw error ở đây nữa
        return null; // Trả về null để hàm gọi biết có lỗi
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

// --- Hàm setupAutocomplete (Đảm bảo giống hệt popup.js) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  console.log(`Setting up autocomplete for input: #${inputId} with ${sourceArray ? sourceArray.length : 0} items`); // DEBUG
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) { console.error(`Autocomplete setup failed: Cannot find elements #${inputId} or #${containerId}`); return; }
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const validSource = Array.isArray(sourceArray) ? sourceArray : []; // Đảm bảo là mảng
    // console.log(`Filtering ${validSource.length} items with keywords:`, keywords); // DEBUG
    const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    // console.log(`Found ${suggestions.length} suggestions for "${value}"`); // DEBUG
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { console.log(`Suggestion clicked: ${item}`); input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); }); container.appendChild(suggestionItem); });
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { /* console.log(`Input event on #${inputId}: ${input.value}`); */ showSuggestions(input.value); }); // DEBUG comment out
  input.addEventListener('focus', () => { /* console.log(`Focus event on #${inputId}`); */ showSuggestions(''); }); // DEBUG comment out
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; /* console.log(`Keydown event on #${inputId}: ${e.keyCode}`); */ if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { items[currentFocus].click(); /* console.log(`Enter pressed on suggestion: ${items[currentFocus].textContent}`); */ } } else if (e.keyCode == 27) { closeAllLists(); /* console.log("Escape pressed"); */ } }); // DEBUG comment out
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { /* console.log(`Closing suggestions for #${inputId}`); */ container.innerHTML = ''; container.style.display = 'none'; } // DEBUG comment out
  document.addEventListener('click', (e) => { if (e.target !== input && !container.contains(e.target) ) closeAllLists(); });
}


// --- Hàm loadFieldsForSettings (không đổi) ---
async function loadFieldsForSettings(modelName) { /* ... giữ nguyên code ... */
    currentSettingsModel = modelName; const fieldsListContainer = document.getElementById('settings-fields-list-container'); const randomIdSection = document.getElementById('random-id-section'); const randomIdSelect = document.getElementById('random-id-field-select'); fieldsListContainer.innerHTML = '<p>Đang tải fields...</p>'; randomIdSelect.innerHTML = '<option value="">-- Không tự động tạo ID --</option>'; randomIdSection.style.display = 'none';
    if (!modelName || !allModelsForSettings.includes(modelName)) { fieldsListContainer.innerHTML = `<p><i>${!modelName ? 'Hãy chọn một Note Type hợp lệ.' : 'Tên Note Type không hợp lệ.'}</i></p>`; return; }
    try { const fieldNames = await invoke('modelFieldNames', { modelName: modelName }); if(fieldNames === null) throw new Error("modelFieldNames returned null."); const hiddenFieldsKey = `hiddenFields_${modelName}`; const randomIdFieldKey = `randomIdField_${modelName}`; const storedData = await chrome.storage.local.get([hiddenFieldsKey, randomIdFieldKey]); const hiddenFields = storedData[hiddenFieldsKey] || {}; const selectedRandomIdField = storedData[randomIdFieldKey] || ""; fieldsListContainer.innerHTML = '';
        if (fieldNames.length === 0) { fieldsListContainer.innerHTML = '<p><i>Model này không có field nào.</i></p>'; return; }
        fieldNames.forEach(fieldName => { const isHidden = hiddenFields[fieldName] || false; const checkboxId = `check-${fieldName.replace(/\s+/g, '-')}`; const itemDiv = document.createElement('div'); itemDiv.className = `field-checkbox-item ${isHidden ? 'checked' : ''}`; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.dataset.fieldName = fieldName; checkbox.checked = isHidden; checkbox.style.pointerEvents = 'none'; const label = document.createElement('label'); label.htmlFor = checkboxId; label.textContent = fieldName; label.title = fieldName; itemDiv.appendChild(checkbox); itemDiv.appendChild(label); itemDiv.addEventListener('click', () => { checkbox.checked = !checkbox.checked; itemDiv.classList.toggle('checked', checkbox.checked); }); fieldsListContainer.appendChild(itemDiv); const option = document.createElement('option'); option.value = fieldName; option.textContent = fieldName; randomIdSelect.appendChild(option); });
        if (selectedRandomIdField) { randomIdSelect.value = selectedRandomIdField; } randomIdSection.style.display = 'block';
    } catch (error) { console.error('Error loading fields/settings:', error); fieldsListContainer.innerHTML = `<p style="color: red;">Lỗi tải cấu hình: ${error.message}</p>`; showStatus('Lỗi tải cấu hình: ' + error.message, 'error'); randomIdSection.style.display = 'none'; }
}

// --- [HÀM ĐẦY ĐỦ] Lưu cài đặt ---
async function saveSettings() {
    console.log("Save button clicked"); // DEBUG
    const selectedModel = document.getElementById('settings-model-search').value; // Hoặc dùng currentSettingsModel đã lưu

    if (!selectedModel) {
        showStatus('Vui lòng chọn Note Type trước khi lưu.', 'error');
        console.log("Save failed: No model selected."); // DEBUG
        return;
    }
     // Thêm kiểm tra model hợp lệ
     if (!allModelsForSettings.includes(selectedModel)) {
         showStatus('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.', 'error');
         console.log(`Save failed: Invalid model name "${selectedModel}".`); // DEBUG
         return;
     }


    // Lưu trạng thái ẩn
    const checkboxes = document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]');
    const hiddenFieldsState = {};
    checkboxes.forEach(checkbox => {
        const fieldName = checkbox.dataset.fieldName;
        if (fieldName) { // Đảm bảo fieldName tồn tại
             hiddenFieldsState[fieldName] = checkbox.checked;
        } else {
             console.warn("Checkbox found without fieldName dataset:", checkbox); // DEBUG
        }
    });
    const hiddenFieldsKey = `hiddenFields_${selectedModel}`;
    console.log(`Preparing to save hidden fields for ${selectedModel}:`, hiddenFieldsState); // DEBUG

    // Lấy và lưu Random ID Field được chọn
    const randomIdSelect = document.getElementById('random-id-field-select');
    const selectedRandomIdField = randomIdSelect.value;
    const randomIdFieldKey = `randomIdField_${selectedModel}`;
     console.log(`Preparing to save random ID field for ${selectedModel}: "${selectedRandomIdField}"`); // DEBUG

    try {
        // Lưu cả hai vào storage cùng lúc
        await chrome.storage.local.set({
            [hiddenFieldsKey]: hiddenFieldsState,
            [randomIdFieldKey]: selectedRandomIdField
        });

        console.log(`Settings saved successfully for ${selectedModel}`); // DEBUG
        showStatus('Đã lưu cài đặt cho Note Type: ' + selectedModel, 'success');
    } catch (error) {
        console.error('Error saving settings to chrome.storage:', error); // DEBUG
        showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    }
}

// --- Hàm setAllCheckboxes (không đổi) ---
function setAllCheckboxes(checkedState) { /* ... giữ nguyên code ... */ }

// --- Khởi tạo trang Settings (không đổi) ---
document.addEventListener('DOMContentLoaded', async () => { /* ... giữ nguyên code ... */
    console.log("Settings page loaded"); const saveButton = document.getElementById('save-settings-btn'); const selectAllButton = document.getElementById('select-all-fields'); const deselectAllButton = document.getElementById('deselect-all-fields');
    try { allModelsForSettings = await invoke('modelNames'); if (allModelsForSettings === null) { showStatus('Không thể lấy danh sách Note Type từ Anki.', 'error'); console.error("invoke('modelNames') returned null"); allModelsForSettings = []; } else { console.log("Models loaded for settings:", allModelsForSettings); } setupAutocomplete('settings-model-search', 'settings-model-suggestions', allModelsForSettings, (selectedModel) => { console.log(`Autocomplete selected: ${selectedModel}`); loadFieldsForSettings(selectedModel); } ); } catch (error) { console.error("Error fetching model names:", error); showStatus('Không thể tải danh sách Note Types.', 'error'); }
    saveButton.addEventListener('click', saveSettings); selectAllButton.addEventListener('click', () => setAllCheckboxes(true)); deselectAllButton.addEventListener('click', () => setAllCheckboxes(false));
});