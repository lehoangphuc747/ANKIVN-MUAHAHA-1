// settings.js
let allModelsForSettings = []; // Lưu danh sách model
let currentSettingsModel = ''; // Lưu model đang cấu hình

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json(); if (result.error) throw new Error(result.error); return result.result;
    } catch (error) {
        console.error('Anki-Connect error in settings:', error); // Log lỗi cụ thể
        showStatus('Lỗi kết nối Anki-Connect: ' + error.message, 'error');
        // Không ném lỗi ở đây để UI vẫn load được phần nào
        // throw error;
        return null; // Trả về null để hàm gọi biết có lỗi
    }
}

// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('settings-status'); statusElement.textContent = message; statusElement.className = `status-message ${type}`;
    // Xóa timeout cũ nếu có
    if (window.settingsStatusTimeout) clearTimeout(window.settingsStatusTimeout);
    // Chỉ tự ẩn nếu là success
    if (type === 'success') {
       window.settingsStatusTimeout = setTimeout(() => { if (statusElement.textContent === message) { statusElement.textContent = ''; statusElement.className = 'status-message'; } }, 4000);
    } else {
        window.settingsStatusTimeout = null; // Reset timeout nếu là lỗi/info
    }
}

// --- Hàm setupAutocomplete (Đảm bảo giống hệt popup.js) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  console.log(`Setting up autocomplete for input: #${inputId} with ${sourceArray ? sourceArray.length : 0} items`); // DEBUG
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) {
      console.error(`Autocomplete setup failed: Cannot find elements #${inputId} or #${containerId}`);
      return; // Thoát nếu không tìm thấy element
  }
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase();
    const keywords = valLower.split(' ').filter(k => k.trim() !== '');

    // Đảm bảo sourceArray là một mảng trước khi filter
    const validSource = Array.isArray(sourceArray) ? sourceArray : [];
    console.log(`Filtering ${validSource.length} items with keywords:`, keywords); // DEBUG

    const suggestions = validSource.filter(item => {
        // Kiểm tra item có phải string không
        if (typeof item !== 'string') return false;
        const target = item.toLowerCase();
        return keywords.every(keyword => target.includes(keyword));
    });
    console.log(`Found ${suggestions.length} suggestions for "${value}"`); // DEBUG

    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => {
        const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item;
        suggestionItem.addEventListener('click', () => {
            console.log(`Suggestion clicked: ${item}`); // DEBUG
            input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item);
        });
        container.appendChild(suggestionItem);
    });
    container.style.display = 'block'; currentFocus = -1;
  }

  input.addEventListener('input', () => {
      console.log(`Input event on #${inputId}: ${input.value}`); // DEBUG
      showSuggestions(input.value);
  });
  input.addEventListener('focus', () => {
       console.log(`Focus event on #${inputId}`); // DEBUG
       showSuggestions(''); // Hiển thị tất cả khi focus
   });
  input.addEventListener('keydown', (e) => {
      let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return;
      console.log(`Keydown event on #${inputId}: ${e.keyCode}`); // DEBUG
      if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); }
      else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); }
      else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { items[currentFocus].click(); console.log(`Enter pressed on suggestion: ${items[currentFocus].textContent}`); } } // DEBUG
      else if (e.keyCode == 27) { closeAllLists(); console.log("Escape pressed"); } // DEBUG
  });

  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { console.log(`Closing suggestions for #${inputId}`); container.innerHTML = ''; container.style.display = 'none'; } // DEBUG
  document.addEventListener('click', (e) => { if (e.target !== input && !container.contains(e.target) ) closeAllLists(); });
}

// --- Hàm loadFieldsForSettings (không đổi từ v1.18.0) ---
async function loadFieldsForSettings(modelName) { /* ... giữ nguyên code ... */
    currentSettingsModel = modelName; const fieldsListContainer = document.getElementById('settings-fields-list-container'); const randomIdSection = document.getElementById('random-id-section'); const randomIdSelect = document.getElementById('random-id-field-select'); fieldsListContainer.innerHTML = '<p>Đang tải fields...</p>'; randomIdSelect.innerHTML = '<option value="">-- Không tự động tạo ID --</option>'; randomIdSection.style.display = 'none';
    if (!modelName || !allModelsForSettings.includes(modelName)) { fieldsListContainer.innerHTML = `<p><i>${!modelName ? 'Hãy chọn một Note Type hợp lệ.' : 'Tên Note Type không hợp lệ.'}</i></p>`; return; }
    try { const fieldNames = await invoke('modelFieldNames', { modelName: modelName }); const hiddenFieldsKey = `hiddenFields_${modelName}`; const randomIdFieldKey = `randomIdField_${modelName}`; const storedData = await chrome.storage.local.get([hiddenFieldsKey, randomIdFieldKey]); const hiddenFields = storedData[hiddenFieldsKey] || {}; const selectedRandomIdField = storedData[randomIdFieldKey] || ""; fieldsListContainer.innerHTML = '';
        if (fieldNames === null) throw new Error("Anki-Connect returned null for field names."); // Thêm kiểm tra null
        if (fieldNames.length === 0) { fieldsListContainer.innerHTML = '<p><i>Model này không có field nào.</i></p>'; return; }
        fieldNames.forEach(fieldName => { const isHidden = hiddenFields[fieldName] || false; const checkboxId = `check-${fieldName.replace(/\s+/g, '-')}`; const itemDiv = document.createElement('div'); itemDiv.className = `field-checkbox-item ${isHidden ? 'checked' : ''}`; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.dataset.fieldName = fieldName; checkbox.checked = isHidden; checkbox.style.pointerEvents = 'none'; const label = document.createElement('label'); label.htmlFor = checkboxId; label.textContent = fieldName; label.title = fieldName; itemDiv.appendChild(checkbox); itemDiv.appendChild(label); itemDiv.addEventListener('click', () => { checkbox.checked = !checkbox.checked; itemDiv.classList.toggle('checked', checkbox.checked); }); fieldsListContainer.appendChild(itemDiv); const option = document.createElement('option'); option.value = fieldName; option.textContent = fieldName; randomIdSelect.appendChild(option); });
        if (selectedRandomIdField) { randomIdSelect.value = selectedRandomIdField; } randomIdSection.style.display = 'block';
    } catch (error) { console.error('Error loading fields/settings:', error); fieldsListContainer.innerHTML = `<p style="color: red;">Lỗi tải cấu hình: ${error.message}</p>`; showStatus('Lỗi tải cấu hình: ' + error.message, 'error'); randomIdSection.style.display = 'none'; }
}

// --- Hàm saveSettings (không đổi từ v1.18.0) ---
async function saveSettings() { /* ... giữ nguyên code ... */ }
// --- Hàm setAllCheckboxes (không đổi từ v1.18.0) ---
function setAllCheckboxes(checkedState) { /* ... giữ nguyên code ... */ }

// --- Khởi tạo trang Settings (không đổi từ v1.18.0) ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Settings page loaded"); // DEBUG
    const saveButton = document.getElementById('save-settings-btn');
    const selectAllButton = document.getElementById('select-all-fields');
    const deselectAllButton = document.getElementById('deselect-all-fields');

    try {
        allModelsForSettings = await invoke('modelNames');
        // Kiểm tra kết quả trả về từ invoke
        if (allModelsForSettings === null) {
             showStatus('Không thể lấy danh sách Note Type từ Anki. Anki-Connect bị lỗi?', 'error');
             console.error("invoke('modelNames') returned null");
             allModelsForSettings = []; // Đặt thành mảng rỗng để tránh lỗi sau này
        } else {
             console.log("Models loaded for settings:", allModelsForSettings); // DEBUG
        }

        setupAutocomplete(
            'settings-model-search',
            'settings-model-suggestions',
            allModelsForSettings, // Đảm bảo truyền mảng này
            (selectedModel) => {
                console.log(`Autocomplete selected: ${selectedModel}`); // DEBUG
                loadFieldsForSettings(selectedModel);
            }
        );

    } catch (error) {
       console.error("Error fetching model names:", error); // Log lỗi chi tiết
       showStatus('Không thể tải danh sách Note Types.', 'error');
    }

    saveButton.addEventListener('click', saveSettings);
    selectAllButton.addEventListener('click', () => setAllCheckboxes(true));
    deselectAllButton.addEventListener('click', () => setAllCheckboxes(false));
});