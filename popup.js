// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let statusTimeout = null; // Biến để lưu timeout của status message

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json(); if (result.error) throw new Error(result.error); return result.result;
    } catch (error) { console.error('Anki-Connect error:', error); showStatus('Lỗi kết nối Anki-Connect: ' + error.message, 'error'); throw error; } // Hiển thị lỗi kết nối
}

// --- Hàm createFieldsForModel (không đổi từ v1.19.0) ---
async function createFieldsForModel(modelName) { /* ... giữ nguyên code ... */
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        const fieldsContainer = document.getElementById('fields-container'); fieldsContainer.innerHTML = '';
        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`; const hiddenData = await chrome.storage.local.get(hiddenFieldsStorageKey); const hiddenFields = hiddenData[hiddenFieldsStorageKey] || {};
        const collapseStorageKey = `collapsedFields_${modelName}`; const collapseData = await chrome.storage.local.get(collapseStorageKey); const collapsedFields = collapseData[collapseStorageKey] || {};
        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`; const isHidden = hiddenFields[fieldName] || false; const isCollapsed = collapsedFields[fieldName] || false;
            const fieldGroup = document.createElement('div'); fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            const fieldHeader = document.createElement('div'); fieldHeader.className = 'field-header';
            const toggle = document.createElement('span'); toggle.className = 'collapse-toggle'; toggle.textContent = '▼'; toggle.dataset.targetId = fieldId; toggle.dataset.fieldName = fieldName; toggle.addEventListener('click', toggleFieldCollapse);
            const label = document.createElement('label'); label.textContent = fieldName + ':'; label.htmlFor = fieldId;
            const input = document.createElement('textarea'); input.id = fieldId; input.className = 'form-control field-input'; input.placeholder = `Nhập nội dung cho ${fieldName}`; input.rows = 3; if (isCollapsed) { input.style.display = 'none'; }
            fieldHeader.appendChild(toggle); fieldHeader.appendChild(label); fieldGroup.appendChild(fieldHeader); fieldGroup.appendChild(input); fieldsContainer.appendChild(fieldGroup);
        });
    } catch (error) { console.error('Error creating fields:', error); showStatus('Không thể tải fields cho model này.', 'error'); }
 }
// --- Hàm toggleFieldCollapse (không đổi từ v1.19.0) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên code ... */
    const toggle = event.target; const fieldName = toggle.dataset.fieldName; const targetId = toggle.dataset.targetId; const fieldGroup = toggle.closest('.field-group'); const targetTextarea = document.getElementById(targetId); if (!fieldGroup || !targetTextarea || !fieldName) return; const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed'); const newState = !isCurrentlyCollapsed; if (newState) { fieldGroup.classList.add('collapsed'); targetTextarea.style.display = 'none'; } else { fieldGroup.classList.remove('collapsed'); targetTextarea.style.display = ''; } const storageKey = `collapsedFields_${currentModelName}`; try { const currentState = await chrome.storage.local.get(storageKey); const updatedState = currentState[storageKey] || {}; updatedState[fieldName] = newState; await chrome.storage.local.set({ [storageKey]: updatedState }); } catch (error) { console.error('Error saving collapse state:', error); }
 }
// --- Hàm setupAutocomplete (không đổi từ v1.19.0) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên code ... */
  const input = document.getElementById(inputId); const container = document.getElementById(containerId); let currentFocus = -1;
  function showSuggestions(value) { container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== ''); const suggestions = sourceArray.filter(item => { const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); }); if (suggestions.length === 0) { container.style.display = 'none'; return; } suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); }); container.appendChild(suggestionItem); }); container.style.display = 'block'; currentFocus = -1; }
  input.addEventListener('input', () => showSuggestions(input.value)); input.addEventListener('focus', () => showSuggestions(''));
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { container.innerHTML = ''; container.style.display = 'none'; }
  document.addEventListener('click', (e) => { if (e.target !== input && !container.contains(e.target)) closeAllLists(); }); // Đã sửa ở v1.18.0
}
// --- Hàm openOptionsPage (không đổi từ v1.19.0) ---
function openOptionsPage() { chrome.runtime.openOptionsPage(); }
// --- Hàm generateRandomId (không đổi từ v1.19.0) ---
function generateRandomId(length = 14) { /* ... giữ nguyên code ... */
    let result = ''; const characters = '0123456789'; const charactersLength = characters.length; for (let i = 0; i < length; i++) { result += characters.charAt(Math.floor(Math.random() * charactersLength)); } return result;
}

// --- [HÀM ĐƯỢC CẬP NHẬT] Hiển thị thông báo và tự ẩn nếu là success ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`; // Đặt class (màu sắc)

    // Xóa timeout cũ nếu có (để tránh thông báo lỗi bị ẩn quá nhanh)
    if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    }

    // Nếu là thông báo thành công, tự động ẩn sau 4 giây
    if (type === 'success') {
        statusTimeout = setTimeout(() => {
            if (statusElement.textContent === message) { // Chỉ ẩn nếu thông báo chưa bị ghi đè
                statusElement.textContent = '';
                statusElement.className = 'status-message'; // Reset class
            }
            statusTimeout = null; // Reset biến timeout
        }, 4000); // 4000 milliseconds = 4 giây
    }
}


// --- Hàm khởi tạo popup (không đổi từ v1.19.0) ---
document.addEventListener('DOMContentLoaded', async function() { /* ... giữ nguyên code ... */
   try { allDecks = await invoke('deckNames'); allModels = await invoke('modelNames'); console.log("Decks:", allDecks); console.log("Models:", allModels); setupAutocomplete('deck-search', 'deck-suggestions', allDecks); setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => { if (selectedModel) createFieldsForModel(selectedModel); else document.getElementById('fields-container').innerHTML = ''; }); const tags = await invoke('getTags'); const tagsDatalist = document.getElementById('tags-datalist'); tags.forEach(tag => { const option = document.createElement('option'); option.value = tag; tagsDatalist.appendChild(option); }); document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki); document.getElementById('open-settings-link').addEventListener('click', openOptionsPage); } catch (error) { console.error('Error initializing popup:', error); /* showStatus đã được gọi bên trong invoke nếu lỗi */ }
});

// --- Hàm thêm note vào Anki (không đổi từ v1.19.0) ---
async function addNoteToAnki() { /* ... giữ nguyên code ... */
   try { showStatus('Đang thêm...', 'info'); const deckName = document.getElementById('deck-search').value; const modelName = document.getElementById('model-search').value; const tagsInput = document.getElementById('tags-input').value; if (!deckName || !modelName || !allDecks.includes(deckName) || !allModels.includes(modelName)) { throw new Error('Vui lòng chọn Deck và Note Type hợp lệ.'); } const randomIdFieldKey = `randomIdField_${modelName}`; const randomIdSetting = await chrome.storage.local.get(randomIdFieldKey); const targetRandomIdField = randomIdSetting[randomIdFieldKey] || null; const hiddenFieldsKey = `hiddenFields_${modelName}`; const hiddenData = await chrome.storage.local.get(hiddenFieldsKey); const hiddenFields = hiddenData[hiddenFieldsKey] || {}; let fields = {}; let fieldInputs = document.querySelectorAll('.field-input'); if (fieldInputs.length === 0 && modelName) { console.warn("Inputs not found, retrying fields load:", modelName); await createFieldsForModel(modelName); await new Promise(resolve => setTimeout(resolve, 150)); fieldInputs = document.querySelectorAll('.field-input'); if (fieldInputs.length === 0) throw new Error('Cannot find fields.'); } else if (fieldInputs.length === 0) { throw new Error('Please select a Note Type.'); } let hasContent = false; let randomIdFieldExists = false; fieldInputs.forEach(input => { const fieldName = input.id.replace('field-', ''); const fieldGroup = input.closest('.field-group'); const isHiddenBySetting = fieldGroup && fieldGroup.classList.contains('field-hidden-by-setting'); if (fieldName === targetRandomIdField) randomIdFieldExists = true; if (!isHiddenBySetting && fieldName !== targetRandomIdField) { fields[fieldName] = input.value; if (input.value.trim() !== '') hasContent = true; } else if (!isHiddenBySetting && fieldName === targetRandomIdField) { fields[fieldName] = ''; hasContent = true; } else { fields[fieldName] = ''; } }); if (targetRandomIdField && randomIdFieldExists) { fields[targetRandomIdField] = generateRandomId(); console.log(`Generated ID for ${targetRandomIdField}: ${fields[targetRandomIdField]}`); } else if (targetRandomIdField && !randomIdFieldExists) { console.warn(`Configured Random ID Field "${targetRandomIdField}" not found.`); } if (!hasContent && !targetRandomIdField) { throw new Error('Please fill at least one field (not hidden).'); } else if (!hasContent && targetRandomIdField && !randomIdFieldExists){ throw new Error('Configured Random ID field not found and no other content.'); } const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim()); const params = { note: { deckName: deckName, modelName: modelName, fields: fields, tags: tagsArray } }; console.log("Sending note:", params.note); const result = await invoke('addNote', params); showStatus('Thêm thành công! Note ID: ' + result, 'success'); document.querySelectorAll('.field-input').forEach(input => { input.value = ''; }); document.getElementById('tags-input').value = ''; } catch (error) { console.error('Error adding note:', error); showStatus('Lỗi: ' + error.message, 'error'); }
}