// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';

// --- Hàm giao tiếp với Anki-Connect API (không đổi) ---
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
        throw error; // Ném lại lỗi để hàm gọi có thể xử lý
    }
}


// --- [HÀM ĐƯỢC CẬP NHẬT] Đọc setting ẩn ---
async function createFieldsForModel(modelName) {
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';

        // [MỚI] Lấy trạng thái ẩn từ settings
        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const hiddenData = await chrome.storage.local.get(hiddenFieldsStorageKey);
        const hiddenFields = hiddenData[hiddenFieldsStorageKey] || {};

        // Lấy trạng thái collapse đã lưu (vẫn giữ)
        const collapseStorageKey = `collapsedFields_${modelName}`;
        const collapseData = await chrome.storage.local.get(collapseStorageKey);
        const collapsedFields = collapseData[collapseStorageKey] || {};

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`;
            const isHidden = hiddenFields[fieldName] || false; // Kiểm tra setting ẩn
            const isCollapsed = collapsedFields[fieldName] || false; // Kiểm tra trạng thái collapse

            // Tạo cấu trúc HTML
            const fieldGroup = document.createElement('div');
            // [MỚI] Thêm class ẩn nếu cần
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;

            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';

            const toggle = document.createElement('span');
            toggle.className = 'collapse-toggle';
            toggle.textContent = '▼';
            toggle.dataset.targetId = fieldId;
            toggle.dataset.fieldName = fieldName;
            toggle.addEventListener('click', toggleFieldCollapse);

            const label = document.createElement('label');
            label.textContent = fieldName + ':';
            label.htmlFor = fieldId;

            const input = document.createElement('textarea');
            input.id = fieldId;
            input.className = 'form-control field-input';
            input.placeholder = `Nhập nội dung cho ${fieldName}`;
            input.rows = 3;
            if (isCollapsed) {
                input.style.display = 'none';
            }

            fieldHeader.appendChild(toggle);
            fieldHeader.appendChild(label);
            fieldGroup.appendChild(fieldHeader);
            fieldGroup.appendChild(input);
            fieldsContainer.appendChild(fieldGroup);
        });

    } catch (error) {
        console.error('Error creating fields:', error);
        showStatus('Không thể tải thông tin fields cho model này.', 'error');
    }
}

// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) {
    const toggle = event.target;
    const fieldName = toggle.dataset.fieldName;
    const targetId = toggle.dataset.targetId;
    const fieldGroup = toggle.closest('.field-group');
    const targetTextarea = document.getElementById(targetId);
    if (!fieldGroup || !targetTextarea || !fieldName) return;
    const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed');
    const newState = !isCurrentlyCollapsed;
    if (newState) { fieldGroup.classList.add('collapsed'); targetTextarea.style.display = 'none'; }
    else { fieldGroup.classList.remove('collapsed'); targetTextarea.style.display = ''; }
    const storageKey = `collapsedFields_${currentModelName}`;
    try {
        const currentState = await chrome.storage.local.get(storageKey);
        const updatedState = currentState[storageKey] || {};
        updatedState[fieldName] = newState;
        await chrome.storage.local.set({ [storageKey]: updatedState });
        // console.log(`Saved collapse state for ${currentModelName} - ${fieldName}: ${newState}`);
    } catch (error) { console.error('Error saving collapse state:', error); }
}

// --- Hàm setupAutocomplete (không đổi) ---
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

// --- [HÀM MỚI] Mở trang cài đặt ---
function openOptionsPage() {
    chrome.runtime.openOptionsPage();
}

// --- Hàm khởi tạo popup (thêm listener cho link settings) ---
document.addEventListener('DOMContentLoaded', async function() {
    try {
        allDecks = await invoke('deckNames');
        allModels = await invoke('modelNames');
        // console.log("Decks:", allDecks); console.log("Models:", allModels); // Bỏ comment nếu cần debug

        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            if (selectedModel) createFieldsForModel(selectedModel);
            else document.getElementById('fields-container').innerHTML = '';
        });

        const tags = await invoke('getTags');
        const tagsDatalist = document.getElementById('tags-datalist');
        tags.forEach(tag => { const option = document.createElement('option'); option.value = tag; tagsDatalist.appendChild(option); });

        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);

        // [MỚI] Thêm listener cho link mở settings
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);

    } catch (error) {
        console.error('Error initializing popup:', error);
        showStatus('Không thể kết nối với Anki-Connect. Hãy đảm bảo Anki đang chạy và plugin Anki-Connect đã được cài đặt.', 'error');
    }
});

// --- Hàm thêm note vào Anki (không đổi) ---
async function addNoteToAnki() {
    try {
        showStatus('Đang thêm...', 'info');
        const deckName = document.getElementById('deck-search').value;
        const modelName = document.getElementById('model-search').value;
        const tagsInput = document.getElementById('tags-input').value;
        if (!deckName || !modelName) throw new Error('Vui lòng chọn deck và note type');
        if (!allDecks.includes(deckName)) throw new Error('Tên Deck không hợp lệ.');
        if (!allModels.includes(modelName)) throw new Error('Tên Note Type không hợp lệ.');
        const fields = {};
        const fieldInputs = document.querySelectorAll('.field-input');
        if (fieldInputs.length === 0 && modelName) { // Kiểm tra nếu model đã chọn nhưng chưa có field (có thể do lỗi tải)
             console.warn("Không tìm thấy field inputs, thử tải lại fields cho model:", modelName);
             await createFieldsForModel(modelName); // Thử tải lại field
             // Đợi một chút để DOM cập nhật rồi tìm lại
             await new Promise(resolve => setTimeout(resolve, 100));
             fieldInputs = document.querySelectorAll('.field-input'); // Tìm lại
             if (fieldInputs.length === 0) throw new Error('Không thể tìm thấy fields cho Note Type đã chọn.');

        } else if (fieldInputs.length === 0) {
             throw new Error('Vui lòng chọn Note Type để hiển thị fields.');
        }

        let hasContent = false;
        fieldInputs.forEach(input => {
            const fieldName = input.id.replace('field-', '');
            const fieldGroup = input.closest('.field-group');
            // Chỉ lấy giá trị của field KHÔNG bị ẩn bởi setting
            if (!fieldGroup || !fieldGroup.classList.contains('field-hidden-by-setting')) {
                fields[fieldName] = input.value;
                if (input.value.trim() !== '') {
                    hasContent = true;
                }
            } else {
                 fields[fieldName] = ''; // Gửi giá trị rỗng cho field bị ẩn
            }
        });

        if (!hasContent) throw new Error('Vui lòng nhập nội dung cho ít nhất một field (không bị ẩn).');

        const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
        const params = { note: { deckName: deckName, modelName: modelName, fields: fields, tags: tagsArray } };
        const result = await invoke('addNote', params);
        showStatus('Thêm thành công! Note ID: ' + result, 'success');
        document.querySelectorAll('.field-input').forEach(input => { input.value = ''; }); // Vẫn xóa hết input
        document.getElementById('tags-input').value = '';
    } catch (error) { console.error('Error adding note:', error); showStatus('Lỗi: ' + error.message, 'error'); }
}


// --- Hàm hiển thị thông báo (không đổi) ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
}