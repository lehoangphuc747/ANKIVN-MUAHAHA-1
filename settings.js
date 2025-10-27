// settings.js
let allModelsForSettings = [];
let currentSettingsModel = ''; // Lưu model đang cấu hình

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên ... */ }
// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */ }
// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên ... */ }

// --- [HÀM ĐƯỢC CẬP NHẬT] Tải Fields và cấu hình Random ID ---
async function loadFieldsForSettings(modelName) {
    currentSettingsModel = modelName; // Lưu lại model name
    const fieldsListContainer = document.getElementById('settings-fields-list-container');
    const randomIdSection = document.getElementById('random-id-section');
    const randomIdSelect = document.getElementById('random-id-field-select');

    // Reset UI
    fieldsListContainer.innerHTML = '<p>Đang tải fields...</p>';
    randomIdSelect.innerHTML = '<option value="">-- Không tự động tạo ID --</option>'; // Reset dropdown
    randomIdSection.style.display = 'none'; // Ẩn khu vực Random ID

    if (!modelName || !allModelsForSettings.includes(modelName)) {
        fieldsListContainer.innerHTML = `<p><i>${!modelName ? 'Hãy chọn một Note Type hợp lệ.' : 'Tên Note Type không hợp lệ.'}</i></p>`; return;
    }

    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });

        // Lấy cấu hình đã lưu
        const hiddenFieldsKey = `hiddenFields_${modelName}`;
        const randomIdFieldKey = `randomIdField_${modelName}`;
        const storedData = await chrome.storage.local.get([hiddenFieldsKey, randomIdFieldKey]);
        const hiddenFields = storedData[hiddenFieldsKey] || {};
        const selectedRandomIdField = storedData[randomIdFieldKey] || ""; // Lấy field random ID đã lưu

        fieldsListContainer.innerHTML = ''; // Xóa thông báo tải

        if (fieldNames.length === 0) {
             fieldsListContainer.innerHTML = '<p><i>Model này không có field nào.</i></p>'; return; // Không hiển thị random ID nếu không có field
        }

        // Tạo checkbox ẩn/hiện
        fieldNames.forEach(fieldName => {
            const isHidden = hiddenFields[fieldName] || false;
            const checkboxId = `check-${fieldName.replace(/\s+/g, '-')}`;
            const itemDiv = document.createElement('div');
            itemDiv.className = `field-checkbox-item ${isHidden ? 'checked' : ''}`;
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.dataset.fieldName = fieldName; checkbox.checked = isHidden; checkbox.style.pointerEvents = 'none';
            const label = document.createElement('label'); label.htmlFor = checkboxId; label.textContent = fieldName; label.title = fieldName;
            itemDiv.appendChild(checkbox); itemDiv.appendChild(label);
            itemDiv.addEventListener('click', () => { checkbox.checked = !checkbox.checked; itemDiv.classList.toggle('checked', checkbox.checked); });
            fieldsListContainer.appendChild(itemDiv);

            // [MỚI] Thêm field vào dropdown Random ID
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            randomIdSelect.appendChild(option);
        });

        // [MỚI] Chọn giá trị đã lưu cho dropdown Random ID
        if (selectedRandomIdField) {
            randomIdSelect.value = selectedRandomIdField;
        }

        // [MỚI] Hiển thị khu vực Random ID
        randomIdSection.style.display = 'block';

    } catch (error) {
        console.error('Error loading fields/settings:', error);
        fieldsListContainer.innerHTML = `<p style="color: red;">Lỗi tải cấu hình: ${error.message}</p>`;
        showStatus('Lỗi tải cấu hình: ' + error.message, 'error');
        randomIdSection.style.display = 'none'; // Ẩn nếu có lỗi
    }
}


// --- [HÀM ĐƯỢC CẬP NHẬT] Lưu cả cài đặt ẩn và Random ID Field ---
async function saveSettings() {
    const selectedModel = document.getElementById('settings-model-search').value; // Hoặc dùng currentSettingsModel
    if (!selectedModel || !allModelsForSettings.includes(selectedModel)) {
        showStatus(`Vui lòng chọn Note Type hợp lệ${!selectedModel ? '' : ' từ gợi ý'}.`, 'error'); return;
    }

    // Lưu trạng thái ẩn
    const checkboxes = document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]');
    const hiddenFieldsState = {};
    checkboxes.forEach(checkbox => { const fieldName = checkbox.dataset.fieldName; hiddenFieldsState[fieldName] = checkbox.checked; });
    const hiddenFieldsKey = `hiddenFields_${selectedModel}`;

    // [MỚI] Lấy và lưu Random ID Field được chọn
    const randomIdSelect = document.getElementById('random-id-field-select');
    const selectedRandomIdField = randomIdSelect.value;
    const randomIdFieldKey = `randomIdField_${selectedModel}`;

    try {
        // Lưu cả hai vào storage cùng lúc
        await chrome.storage.local.set({
            [hiddenFieldsKey]: hiddenFieldsState,
            [randomIdFieldKey]: selectedRandomIdField
        });

        console.log(`Settings saved for ${selectedModel}:`, {hidden: hiddenFieldsState, randomIdField: selectedRandomIdField});
        showStatus('Đã lưu cài đặt cho Note Type: ' + selectedModel, 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    }
}

// --- Hàm setAllCheckboxes (không đổi) ---
function setAllCheckboxes(checkedState) { /* ... giữ nguyên ... */ }

// --- Khởi tạo trang Settings (không đổi) ---
document.addEventListener('DOMContentLoaded', async () => { /* ... giữ nguyên ... */ });