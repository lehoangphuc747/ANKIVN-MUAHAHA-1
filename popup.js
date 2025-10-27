// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let currentFieldNames = []; // Thêm biến lưu tên fields hiện tại
let statusTimeout = null;

// --- Hàm invoke (Ném lỗi như ban đầu) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`); // Ném lỗi HTTP rõ hơn
        const result = await response.json();
        if (result.error) throw new Error(result.error); // Ném lỗi từ Anki-Connect
        return result.result;
    } catch (error) {
        console.error(`Anki-Connect error (${action}):`, error);
        // Ném lỗi để hàm gọi (DOMContentLoaded) có thể bắt và xử lý
        throw error;
    }
}

// --- Hàm createFieldsForModel ---
async function createFieldsForModel(modelName) {
    console.log("Attempting to create fields for model:", modelName); // DEBUG
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if (!Array.isArray(fieldNames)) {
             throw new Error("Received invalid data for field names.");
        }
        currentFieldNames = fieldNames; // Lưu lại
        console.log("Fields for context menu:", currentFieldNames); // DEBUG

        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", modelName: modelName, fields: fieldNames })
              .catch(err => console.warn("Could not send fields to background:", err));

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = ''; // Xóa fields cũ

        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const collapseStorageKey = `collapsedFields_${modelName}`;
        const settings = await chrome.storage.local.get([hiddenFieldsStorageKey, collapseStorageKey]);
        const hiddenFields = settings[hiddenFieldsStorageKey] || {};
        const collapsedFields = settings[collapseStorageKey] || {};
        // console.log("Retrieved settings:", { hiddenFields, collapsedFields }); // DEBUG

        if (fieldNames.length === 0) {
            fieldsContainer.innerHTML = '<p><i>Note Type này không có field nào.</i></p>'; return;
        }

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`; const isHidden = hiddenFields[fieldName] || false; const isCollapsed = collapsedFields[fieldName] || false;
            const fieldGroup = document.createElement('div'); fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`; fieldGroup.dataset.fieldName = fieldName;
            const fieldHeader = document.createElement('div'); fieldHeader.className = 'field-header'; fieldHeader.addEventListener('click', toggleFieldCollapse);
            const toggle = document.createElement('span'); toggle.className = 'collapse-toggle'; toggle.textContent = isCollapsed ? '▶' : '🔽'; toggle.style.pointerEvents = 'none'; // Đặt icon đúng ban đầu
            const label = document.createElement('label'); label.textContent = fieldName; label.style.pointerEvents = 'none';
            const input = document.createElement('textarea'); input.id = fieldId; input.className = 'form-control field-input'; input.placeholder = `Nội dung ${fieldName}...`; input.rows = 2; input.addEventListener('input', autoExpandTextarea);
            if (isCollapsed) { input.style.display = 'none'; label.style.opacity = '0.65'; /* toggle đã đặt icon ở trên */ }
            // else { toggle.style.transform = 'rotate(0deg)'; } // Không cần dòng này nữa
            fieldHeader.appendChild(toggle); fieldHeader.appendChild(label); fieldGroup.appendChild(fieldHeader); fieldGroup.appendChild(input); fieldsContainer.appendChild(fieldGroup);
            autoExpandTextarea({ target: input });
        });
        console.log("Fields created successfully."); // DEBUG

    } catch (error) {
        console.error('Error creating/loading fields:', error);
        showStatus('Lỗi tải fields: ' + error.message, 'error');
        currentFieldNames = []; // Reset
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [] })
              .catch(err => console.warn("Could not send empty fields to background:", err));
        document.getElementById('fields-container').innerHTML = `<p style="color: var(--error-text);"><i>Lỗi tải fields.</i></p>`;
    }
 }

// --- Hàm toggleFieldCollapse ---
async function toggleFieldCollapse(event) {
    const fieldHeader = event.currentTarget; const fieldGroup = fieldHeader.closest('.field-group'); if (!fieldGroup) return;
    const fieldName = fieldGroup.dataset.fieldName; const targetTextarea = fieldGroup.querySelector('.field-input'); const toggleIcon = fieldHeader.querySelector('.collapse-toggle'); const label = fieldHeader.querySelector('label');
    if (!targetTextarea || !fieldName || !toggleIcon || !label) { console.error("Collapse elements not found!"); return; }
    const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed'); const newState = !isCurrentlyCollapsed;
    fieldGroup.classList.toggle('collapsed', newState);
    if (newState) { targetTextarea.style.display = 'none'; label.style.opacity = '0.65'; toggleIcon.textContent = '▶'; } // Đổi icon khi đóng
    else { targetTextarea.style.display = ''; label.style.opacity = '1'; toggleIcon.textContent = '🔽'; autoExpandTextarea({ target: targetTextarea }); } // Đổi icon khi mở
    const storageKey = `collapsedFields_${currentModelName}`; try { const currentState = await chrome.storage.local.get(storageKey); const updatedState = currentState[storageKey] || {}; updatedState[fieldName] = newState; await chrome.storage.local.set({ [storageKey]: updatedState }); } catch (error) { console.error('Error saving collapse state:', error); }
}

// --- Hàm autoExpandTextarea ---
function autoExpandTextarea(event) { const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight + 2) + 'px'; }
// --- Hàm openOptionsPage ---
function openOptionsPage() { console.log("Opening options page..."); chrome.runtime.openOptionsPage(); }
// --- Hàm generateRandomId ---
function generateRandomId(length = 14) { let r = ''; const c = '0123456789'; for (let i = 0; i < length; i++) r += c.charAt(Math.floor(Math.random() * 10)); return r; }
// --- Hàm showStatus ---
function showStatus(message, type = 'info') { const s = document.getElementById('status-message'); s.textContent = message; s.className = `status-message ${type}`; if (statusTimeout) clearTimeout(statusTimeout); if (type === 'success') { statusTimeout = setTimeout(() => { if (s.textContent === message) { s.textContent = ''; s.className = 'status-message'; } statusTimeout = null; }, 4000); } else { statusTimeout = null; } }

// --- Hàm setupAutocomplete ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  // console.log(`Setup autocomplete: #${inputId}, ${sourceArray?.length} items`); // DEBUG
  const input = document.getElementById(inputId); const container = document.getElementById(containerId); if (!input || !container) { console.error(`Autocomplete elements not found: #${inputId} or #${containerId}`); return; } let currentFocus = -1;
  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const validSource = Array.isArray(sourceArray) ? sourceArray : [];
    const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    // console.log(`Found ${suggestions.length} suggestions for "${value}"`); // DEBUG
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) { console.log(`Autocomplete callback: ${item}`); onSelectCallback(item); } }); container.appendChild(suggestionItem); });
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { showSuggestions(input.value); });
  input.addEventListener('focus', () => { console.log(`Focus on #${inputId}`); showSuggestions(''); }); // DEBUG + show all
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists(elm) { if (elm !== input && !container.contains(elm)) { /* console.log(`Closing suggestions for #${inputId}`); */ container.innerHTML = ''; container.style.display = 'none'; } } // DEBUG comment out
  container.addEventListener('mousedown', (e) => { if (e.target === container) e.preventDefault(); });
  document.addEventListener('click', (e) => { closeAllLists(e.target); });
}

// --- Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) DOM loaded"); // DEBUG
    try {
        allDecks = await invoke('deckNames');
        if (!Array.isArray(allDecks)) allDecks = []; // Đảm bảo là mảng nếu lỗi
        console.log("Decks loaded:", allDecks);

        allModels = await invoke('modelNames');
        if (!Array.isArray(allModels)) allModels = []; // Đảm bảo là mảng nếu lỗi
        console.log("Models loaded:", allModels);

        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            console.log(`Sidebar autocomplete selected model: ${selectedModel}`); // DEBUG
            // Chỉ gọi createFieldsForModel nếu selectedModel hợp lệ VÀ có trong danh sách đã tải
            if (selectedModel && allModels.includes(selectedModel)) {
                 createFieldsForModel(selectedModel);
            } else if (!selectedModel) { // Xóa input
                document.getElementById('fields-container').innerHTML = ''; currentModelName = ''; currentFieldNames = [];
                chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [] }).catch(err => console.warn("Could not send empty fields:", err));
            } else { console.warn(`Invalid model selected: "${selectedModel}"`); }
        });

        const tags = await invoke('getTags');
        const tagsDatalist = document.getElementById('tags-datalist');
        if (Array.isArray(tags)) tags.forEach(tag => { const o = document.createElement('option'); o.value = tag; tagsDatalist.appendChild(o); });
        else console.warn("Tags data is not an array:", tags);

        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        const settingsLink = document.getElementById('open-settings-link');
        if (settingsLink) {
            settingsLink.addEventListener('click', openOptionsPage);
            console.log("Settings link event listener attached."); // DEBUG
        } else { console.error("Settings link not found!"); }

    } catch (error) {
        // Lỗi này xảy ra khi invoke bị throw (do Anki-Connect lỗi hoặc mạng)
        console.error("Critical error during sidebar init:", error);
        showStatus('Lỗi kết nối Anki: ' + error.message, 'error');
        // Vô hiệu hóa input
        document.getElementById('deck-search').disabled = true;
        document.getElementById('model-search').disabled = true;
        document.getElementById('add-note-btn').disabled = true;
    }
});

// --- Hàm thêm note vào Anki ---
async function addNoteToAnki() {
    try {
        showStatus('Đang thêm...', 'info');
        const deckName = document.getElementById('deck-search').value.trim();
        const modelName = document.getElementById('model-search').value.trim();
        const tagsInput = document.getElementById('tags-input').value.trim();

        // Kiểm tra chặt chẽ hơn
        if (!deckName) { showStatus('Vui lòng chọn hoặc nhập Deck.', 'error'); return; }
        if (!modelName) { showStatus('Vui lòng chọn hoặc nhập Note Type.', 'error'); return; }
        if (!Array.isArray(allDecks) || !allDecks.includes(deckName)) { showStatus('Tên Deck không hợp lệ. Vui lòng chọn từ gợi ý.', 'error'); return; }
        if (!Array.isArray(allModels) || !allModels.includes(modelName)) { showStatus('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.', 'error'); return; }

        const fields = {};
        let hasContent = false;
        // Lấy đúng các field group đang hiển thị (không bị ẩn bởi setting)
        const fieldGroups = document.querySelectorAll('#fields-container .field-group:not(.field-hidden-by-setting)');

        if (fieldGroups.length === 0 && currentFieldNames.length > 0) {
             console.warn("Field groups found in DOM but selector failed? Or fields hidden?");
             // Nếu chắc chắn model đã chọn đúng và có field, nhưng không tìm thấy group -> có thể lỗi lạ
             // Thử tìm lại input trực tiếp
             const directInputs = document.querySelectorAll('#fields-container .field-input');
             if (directInputs.length !== currentFieldNames.filter(fname => !(hiddenFields[fname] || false)).length) {
                  // Số lượng input không khớp -> lỗi hiển thị field?
                  throw new Error("Lỗi hiển thị fields. Hãy thử chọn lại Note Type.");
             }
             // Nếu tìm thấy input trực tiếp thì dùng tạm? (Hơi rủi ro)
             directInputs.forEach(input => {
                const fieldName = input.id.replace('field-', '');
                 if(fieldName){
                      const value = input.value.trim();
                      fields[fieldName] = value;
                      if (value) hasContent = true;
                 }
             });

        } else if (fieldGroups.length === 0 && currentFieldNames.length === 0 && currentModelName) {
             // Model đã chọn nhưng không có field (trường hợp hợp lệ)
             // Vẫn cho phép thêm nếu có tags? (Tùy logic mong muốn)
             // Hiện tại: Báo lỗi nếu không có field nào để nhập
             showStatus('Note Type này không có field để nhập liệu.', 'error'); return;
        } else {
             // Trường hợp bình thường
             fieldGroups.forEach(group => {
                 const fieldName = group.dataset.fieldName;
                 const input = group.querySelector('.field-input');
                 if (input && fieldName) {
                     const value = input.value; // Giữ nguyên khoảng trắng nếu user cố tình nhập
                     fields[fieldName] = value;
                     if (value.trim()) hasContent = true; // Kiểm tra trim để xác định có nội dung không
                 }
             });
        }


        // Xử lý Random ID Field
        const randomIdFieldKey = `randomIdField_${modelName}`;
        const storedData = await chrome.storage.local.get(randomIdFieldKey);
        const randomIdField = storedData[randomIdFieldKey];
        let idGenerated = false;
        if (randomIdField && fields.hasOwnProperty(randomIdField) && fields[randomIdField].trim() === '') { // Chỉ tạo ID nếu field đó trống
            fields[randomIdField] = generateRandomId();
            idGenerated = true;
            hasContent = true; // Nếu chỉ có ID được tạo thì vẫn tính là có nội dung
        } else if (randomIdField && !fields.hasOwnProperty(randomIdField)) {
            console.warn(`Random ID Field "${randomIdField}" is configured but not found or hidden.`);
        }

        // Kiểm tra lại nội dung sau khi có thể đã tạo ID
        if (!hasContent) {
            showStatus('Vui lòng nhập nội dung cho ít nhất một field (hoặc cấu hình Random ID Field).', 'error'); return;
        }

        const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
        const params = { note: { deckName, modelName, fields, tags: tagsArray } };
        console.log("Sending note:", JSON.parse(JSON.stringify(params.note))); // Deep copy để log không bị thay đổi sau này

        const result = await invoke('addNote', params);
        if (result === null) throw new Error("AnkiConnect returned null for addNote."); // Lỗi nếu Anki trả về null

        showStatus('Thêm thành công! Note ID: ' + result, 'success');

        // Xóa nội dung fields (trừ field ID nếu vừa được tạo?)
        document.querySelectorAll('.field-input').forEach(input => {
             const fieldName = input.id.replace('field-', '');
             // Giữ lại ID nếu vừa tạo? (Tùy chọn)
             // if (idGenerated && fieldName === randomIdField) return;
             input.value = '';
             autoExpandTextarea({ target: input }); // Reset chiều cao
         });
        // Không xóa tags? (Tùy chọn)
        // document.getElementById('tags-input').value = '';

    } catch (error) {
        console.error('Error adding note:', error);
        showStatus('Lỗi thêm note: ' + (error.message || 'Không xác định'), 'error');
    }
}


// --- Listener nhận message từ background.js ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidebar received message:", message); // DEBUG
    if (message.action === "fillFieldFromContextMenu") {
        const { field, content, contentType } = message;
        const targetTextarea = document.getElementById(`field-${field}`);

        if (targetTextarea) {
             console.log(`Filling field "${field}" with ${contentType}:`, content);
             let finalContent = content; if (contentType === 'image') finalContent = `<img src="${content}">`;
             // Nối vào nội dung cũ thay vì ghi đè?
             targetTextarea.value += (targetTextarea.value ? '\n' : '') + finalContent; // Nối vào
             // targetTextarea.value = finalContent; // Ghi đè
             targetTextarea.dispatchEvent(new Event('input', { bubbles: true })); // Trigger autoExpand
             const fieldGroup = targetTextarea.closest('.field-group'); if (fieldGroup && fieldGroup.classList.contains('collapsed')) { const header = fieldGroup.querySelector('.field-header'); if(header) header.click(); }
             sendResponse({ success: true, message: `Field "${field}" updated.` });
        } else {
             console.warn(`Field "${field}" not found in sidebar.`);
             if (!currentModelName) showStatus(`Lỗi: Chọn Note Type trước khi gửi vào field "${field}"`, 'error');
             else showStatus(`Lỗi: Field "${field}" không tìm thấy. Model có đúng?`, 'error');
             sendResponse({ success: false, message: `Field "${field}" not found.` });
        }
    }
    // return true; // Keep channel open for async response (not needed here)
});