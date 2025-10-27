// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let statusTimeout = null; // Biến để lưu timeout của status message

// --- Hàm invoke (Đã sửa lỗi xử lý error) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json(); if (result.error) throw new Error(result.error); return result.result;
    } catch (error) {
        console.error(`Anki-Connect error in sidebar (${action}):`, error); // Log lỗi cụ thể
        showStatus(`Lỗi (${action}): ${error.message}. Anki/Anki-Connect có đang chạy?`, 'error');
        // Không ném lỗi ở đây nữa để UI vẫn load được phần nào
        return null; // Trả về null để hàm gọi biết có lỗi
    }
}


// --- Hàm createFieldsForModel (Đã cập nhật UI v1.22.0) ---
async function createFieldsForModel(modelName) {
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if(fieldNames === null) throw new Error("modelFieldNames returned null."); // Thêm kiểm tra lỗi

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';

        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const hiddenData = await chrome.storage.local.get(hiddenFieldsStorageKey);
        const hiddenFields = hiddenData[hiddenFieldsStorageKey] || {};

        const collapseStorageKey = `collapsedFields_${modelName}`;
        const collapseData = await chrome.storage.local.get(collapseStorageKey);
        const collapsedFields = collapseData[collapseStorageKey] || {};

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`;
            const isHidden = hiddenFields[fieldName] || false;
            const isCollapsed = collapsedFields[fieldName] || false;

            const fieldGroup = document.createElement('div');
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            fieldGroup.dataset.fieldName = fieldName; // Lưu tên field vào group để toggle dễ hơn

            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';
            fieldHeader.addEventListener('click', toggleFieldCollapse); // Gắn event vào header

            const toggle = document.createElement('span');
            toggle.className = 'collapse-toggle';
            toggle.textContent = '▶'; // Đổi thành chevron
            toggle.style.pointerEvents = 'none'; // Không cho click vào icon nữa

            const label = document.createElement('label');
            label.textContent = fieldName; // Bỏ dấu ':' nếu muốn gọn hơn
            // label.htmlFor = fieldId; // Không cần htmlFor vì click vào header rồi
            label.style.pointerEvents = 'none'; // Không cho click vào label nữa

            const input = document.createElement('textarea');
            input.id = fieldId;
            input.className = 'form-control field-input';
            input.placeholder = `Nội dung ${fieldName}...`;
            input.rows = 2; // [THAY ĐỔI] Giảm số dòng mặc định
            input.addEventListener('input', autoExpandTextarea); // [THÊM MỚI] Gắn event auto-expand

            // Khôi phục trạng thái collapse
            if (isCollapsed) {
                input.style.display = 'none';
                label.style.opacity = '0.6';
                toggle.style.transform = 'rotate(-90deg)';
            } else {
                 toggle.style.transform = 'rotate(0deg)'; // Đặt lại trạng thái mở
            }

            fieldHeader.appendChild(toggle);
            fieldHeader.appendChild(label);
            fieldGroup.appendChild(fieldHeader);
            fieldGroup.appendChild(input);
            fieldsContainer.appendChild(fieldGroup);

             // [QUAN TRỌNG] Gọi autoExpand một lần ban đầu nếu có nội dung sẵn (ít khi xảy ra khi mới tạo)
             // Hoặc để tính chiều cao đúng cho placeholder nhiều dòng
            autoExpandTextarea({ target: input });

        });

    } catch (error) {
        console.error('Error creating fields:', error);
        showStatus('Không thể tải fields: ' + error.message, 'error'); // Hiển thị lỗi rõ hơn
    }
 }
// --- Hàm toggleFieldCollapse (Đã cập nhật UI v1.22.0) ---
async function toggleFieldCollapse(event) {
    const fieldHeader = event.currentTarget; // Lấy header được click
    const fieldGroup = fieldHeader.closest('.field-group');
    if (!fieldGroup) return;

    const fieldName = fieldGroup.dataset.fieldName;
    const targetTextarea = fieldGroup.querySelector('.field-input');
    const toggleIcon = fieldHeader.querySelector('.collapse-toggle');
    const label = fieldHeader.querySelector('label');

    if (!targetTextarea || !fieldName || !toggleIcon || !label) return;

    const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed');
    const newState = !isCurrentlyCollapsed; // Trạng thái mới

    // Cập nhật giao diện
    fieldGroup.classList.toggle('collapsed', newState);
    if (newState) {
        targetTextarea.style.display = 'none';
        label.style.opacity = '0.65'; // Đã sửa trong styles.css v1.23
        toggleIcon.style.transform = 'rotate(-90deg)';
    } else {
        targetTextarea.style.display = '';
        label.style.opacity = '1';
        toggleIcon.style.transform = 'rotate(0deg)';
        // [QUAN TRỌNG] Trigger auto-expand khi mở ra để tính lại chiều cao
        autoExpandTextarea({ target: targetTextarea });
    }

    // Lưu trạng thái mới vào storage
    const storageKey = `collapsedFields_${currentModelName}`;
    try {
        const currentState = await chrome.storage.local.get(storageKey);
        const updatedState = currentState[storageKey] || {};
        updatedState[fieldName] = newState;
        await chrome.storage.local.set({ [storageKey]: updatedState });
    } catch (error) { console.error('Error saving collapse state:', error); }
 }
// --- Hàm autoExpandTextarea (Đã thêm ở v1.22.0) ---
function autoExpandTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto'; // Reset chiều cao để tính toán lại
    textarea.style.height = (textarea.scrollHeight + 2) + 'px';
 }
// --- Hàm openOptionsPage (không đổi) ---
function openOptionsPage() { chrome.runtime.openOptionsPage(); }
// --- Hàm generateRandomId (không đổi) ---
function generateRandomId(length = 14) {
    let result = ''; const characters = '0123456789'; const charactersLength = characters.length; for (let i = 0; i < length; i++) { result += characters.charAt(Math.floor(Math.random() * charactersLength)); } return result;
}


// --- Hàm setupAutocomplete (Đảm bảo giống hệt settings.js) ---
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
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { /* console.log(`Suggestion clicked: ${item}`); */ input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); }); container.appendChild(suggestionItem); }); // DEBUG comment out
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { /* console.log(`Input event on #${inputId}: ${input.value}`); */ showSuggestions(input.value); }); // DEBUG comment out
  input.addEventListener('focus', () => { /* console.log(`Focus event on #${inputId}`); */ showSuggestions(''); }); // DEBUG comment out
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; /* console.log(`Keydown event on #${inputId}: ${e.keyCode}`); */ if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { items[currentFocus].click(); /* console.log(`Enter pressed on suggestion: ${items[currentFocus].textContent}`); */ } } else if (e.keyCode == 27) { closeAllLists(); /* console.log("Escape pressed"); */ } }); // DEBUG comment out
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { /* console.log(`Closing suggestions for #${inputId}`); */ container.innerHTML = ''; container.style.display = 'none'; } // DEBUG comment out
  // Sửa lỗi đóng suggestions khi click vào scrollbar
  container.addEventListener('mousedown', (e) => { if (e.target === container) e.preventDefault(); });
  document.addEventListener('click', (e) => { if (e.target !== input && !container.contains(e.target) ) closeAllLists(); });
}

// --- Hàm showStatus (Đã cập nhật v1.20.0) ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message; statusElement.className = `status-message ${type}`;
    if (statusTimeout) clearTimeout(statusTimeout);
    if (type === 'success') { statusTimeout = setTimeout(() => { if (statusElement.textContent === message) { statusElement.textContent = ''; statusElement.className = 'status-message'; } statusTimeout = null; }, 4000); }
    else { statusTimeout = null; }
}


// --- Hàm khởi tạo popup (Đảm bảo gọi setupAutocomplete đúng) ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) loaded"); // DEBUG
    try {
        allDecks = await invoke('deckNames');
        allModels = await invoke('modelNames');

        if (allDecks === null || allModels === null) {
             console.error("Failed to load decks or models. Autocomplete might not work.");
             allDecks = Array.isArray(allDecks) ? allDecks : [];
             allModels = Array.isArray(allModels) ? allModels : [];
        } else {
             console.log("Decks loaded for sidebar:", allDecks);
             console.log("Models loaded for sidebar:", allModels);
        }

        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            console.log(`Sidebar autocomplete selected: ${selectedModel}`);
            if (selectedModel) createFieldsForModel(selectedModel);
            else document.getElementById('fields-container').innerHTML = '';
        });

        const tags = await invoke('getTags');
        const tagsDatalist = document.getElementById('tags-datalist');
        if (Array.isArray(tags)) {
           tags.forEach(tag => { const option = document.createElement('option'); option.value = tag; tagsDatalist.appendChild(option); });
        } else {
            console.warn("invoke('getTags') did not return an array:", tags);
        }

        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);

    } catch (error) {
        console.error("Unexpected error during sidebar init:", error);
        showStatus('Lỗi không xác định khi khởi tạo sidebar.', 'error');
    }
});

// --- Hàm thêm note vào Anki (không đổi) ---
async function addNoteToAnki() { /* ... giữ nguyên code v1.19.0 ... */ }
