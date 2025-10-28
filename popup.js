// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {}; // [MỚI]
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.result;
    } catch (error) {
        console.error(`Anki-Connect error (${action}):`, error);
        throw error;
    }
}

// --- Hàm createFieldsForModel (không đổi) ---
async function createFieldsForModel(modelName) {
    console.log("Attempting to create fields for model:", modelName);
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if (!Array.isArray(fieldNames)) {
             throw new Error("Received invalid data for field names.");
        }
        currentFieldNames = fieldNames;

        // Gửi thông tin (có cả modelName) cho background
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", modelName: modelName, fields: fieldNames })
              .catch(err => console.warn("Could not send fields to background:", err));

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';

        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const collapseStorageKey = `collapsedFields_${modelName}`;
        const settings = await chrome.storage.local.get([hiddenFieldsStorageKey, collapseStorageKey]);
        const hiddenFields = settings[hiddenFieldsStorageKey] || {};
        const collapsedFields = settings[collapseStorageKey] || {};

        if (fieldNames.length === 0) {
            fieldsContainer.innerHTML = '<p><i>Note Type này không có field nào.</i></p>'; return;
        }

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`; const isHidden = hiddenFields[fieldName] || false; const isCollapsed = collapsedFields[fieldName] || false;
            const fieldGroup = document.createElement('div'); fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`; fieldGroup.dataset.fieldName = fieldName;
            const fieldHeader = document.createElement('div'); fieldHeader.className = 'field-header'; fieldHeader.addEventListener('click', toggleFieldCollapse);
            const toggle = document.createElement('span'); toggle.className = 'collapse-toggle'; toggle.textContent = isCollapsed ? '▶' : '🔽'; toggle.style.pointerEvents = 'none';
            const label = document.createElement('label'); label.textContent = fieldName; label.style.pointerEvents = 'none';
            const input = document.createElement('textarea'); input.id = fieldId; input.className = 'form-control field-input'; input.placeholder = `Nội dung ${fieldName}...`; input.rows = 2; input.addEventListener('input', autoExpandTextarea);
            if (isCollapsed) { input.style.display = 'none'; label.style.opacity = '0.65'; }
            fieldHeader.appendChild(toggle); fieldHeader.appendChild(label); fieldGroup.appendChild(fieldHeader); fieldGroup.appendChild(input); fieldsContainer.appendChild(fieldGroup);
            autoExpandTextarea({ target: input });
        });
        console.log("Fields created successfully.");

    } catch (error) {
        console.error('Error creating/loading fields:', error);
        showStatus('Lỗi tải fields: ' + error.message, 'error');
        currentFieldNames = [];
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null })
              .catch(err => console.warn("Could not send empty fields to background:", err));
        document.getElementById('fields-container').innerHTML = `<p style="color: var(--error-text);"><i>Lỗi tải fields.</i></p>`;
    }
 }

// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) {
    const fieldHeader = event.currentTarget; const fieldGroup = fieldHeader.closest('.field-group'); if (!fieldGroup) return;
    const fieldName = fieldGroup.dataset.fieldName; const targetTextarea = fieldGroup.querySelector('.field-input'); const toggleIcon = fieldHeader.querySelector('.collapse-toggle'); const label = fieldHeader.querySelector('label');
    if (!targetTextarea || !fieldName || !toggleIcon || !label) { console.error("Collapse elements not found!"); return; }
    const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed'); const newState = !isCurrentlyCollapsed;
    fieldGroup.classList.toggle('collapsed', newState);
    if (newState) { targetTextarea.style.display = 'none'; label.style.opacity = '0.65'; toggleIcon.textContent = '▶'; }
    else { targetTextarea.style.display = ''; label.style.opacity = '1'; toggleIcon.textContent = '🔽'; autoExpandTextarea({ target: targetTextarea }); }
    const storageKey = `collapsedFields_${currentModelName}`; try { const currentState = await chrome.storage.local.get(storageKey); const updatedState = currentState[storageKey] || {}; updatedState[fieldName] = newState; await chrome.storage.local.set({ [storageKey]: updatedState }); } catch (error) { console.error('Error saving collapse state:', error); }
}

// --- Các hàm tiện ích (không đổi) ---
function autoExpandTextarea(event) { const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight + 2) + 'px'; }
function openOptionsPage() { console.log("Opening options page..."); chrome.runtime.openOptionsPage(); }
function generateRandomId(length = 14) { let r = ''; const c = '0123456789'; for (let i = 0; i < length; i++) r += c.charAt(Math.floor(Math.random() * 10)); return r; }
function showStatus(message, type = 'info') { const s = document.getElementById('status-message'); s.textContent = message; s.className = `status-message ${type}`; if (statusTimeout) clearTimeout(statusTimeout); if (type === 'success') { statusTimeout = setTimeout(() => { if (s.textContent === message) { s.textContent = ''; s.className = 'status-message'; } statusTimeout = null; }, 4000); } else { statusTimeout = null; } }

// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  const input = document.getElementById(inputId); const container = document.getElementById(containerId); if (!input || !container) { console.error(`Autocomplete elements not found: #${inputId} or #${containerId}`); return; } let currentFocus = -1;
  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const validSource = Array.isArray(sourceArray) ? sourceArray : [];
    const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) { console.log(`Autocomplete callback: ${item}`); onSelectCallback(item); } }); container.appendChild(suggestionItem); });
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { showSuggestions(input.value); });
  input.addEventListener('focus', () => { showSuggestions(''); });
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists(elm) { if (elm !== input && !container.contains(elm)) { container.innerHTML = ''; container.style.display = 'none'; } }
  container.addEventListener('mousedown', (e) => { if (e.target === container) e.preventDefault(); });
  document.addEventListener('click', (e) => { closeAllLists(e.target); });
}

// --- [MỚI] Các hàm xử lý Preset ---
async function loadPresets() {
    const data = await chrome.storage.local.get('allPresets');
    allPresets = data.allPresets || {};
    const presetSelect = document.getElementById('preset-select');
    presetSelect.innerHTML = '<option value="">-- Chọn cấu hình --</option>'; // Reset
    Object.keys(allPresets).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        presetSelect.appendChild(option);
    });
}

async function saveCurrentPreset() {
    const deckName = document.getElementById('deck-search').value.trim();
    const modelName = document.getElementById('model-search').value.trim();
    const tags = document.getElementById('tags-input').value.trim();

    if (!deckName || !modelName) {
        showStatus('Cần chọn Deck và Note Type để lưu cấu hình.', 'error');
        return;
    }

    const name = prompt("Nhập tên cho cấu hình này:", "");
    if (!name) return; // Hủy

    if (allPresets[name]) {
        if (!confirm(`Cấu hình "${name}" đã tồn tại. Bạn muốn ghi đè?`)) {
            return;
        }
    }

    allPresets[name] = { deckName, modelName, tags };
    await chrome.storage.local.set({ allPresets });
    await loadPresets(); // Tải lại danh sách
    document.getElementById('preset-select').value = name; // Chọn cấu hình vừa lưu
    showStatus(`Đã lưu cấu hình "${name}".`, 'success');
}

async function deleteCurrentPreset() {
    const presetSelect = document.getElementById('preset-select');
    const name = presetSelect.value;
    if (!name) {
        showStatus('Vui lòng chọn một cấu hình để xóa.', 'error');
        return;
    }

    if (confirm(`Bạn có chắc muốn xóa cấu hình "${name}"?`)) {
        delete allPresets[name];
        await chrome.storage.local.set({ allPresets });
        await loadPresets(); // Tải lại danh sách
        showStatus(`Đã xóa cấu hình "${name}".`, 'success');
    }
}


async function applyPreset() {
    const presetSelect = document.getElementById('preset-select');
    const name = presetSelect.value;
    if (!name) return; // Không chọn gì

    const preset = allPresets[name];
    if (!preset) return;

    // Kiểm tra xem Deck/Model còn tồn tại không
    if (!allDecks.includes(preset.deckName)) {
        showStatus(`Lỗi: Deck "${preset.deckName}" không còn tồn tại.`, 'error');
        return;
    }
     if (!allModels.includes(preset.modelName)) {
        showStatus(`Lỗi: Note Type "${preset.modelName}" không còn tồn tại.`, 'error');
        return;
    }

    document.getElementById('deck-search').value = preset.deckName;
    document.getElementById('model-search').value = preset.modelName;
    document.getElementById('tags-input').value = preset.tags;

    // Quan trọng: Tải lại fields cho model đã chọn
    await createFieldsForModel(preset.modelName);
    showStatus(`Đã tải cấu hình "${name}".`, 'info');
}


// --- [CẬP NHẬT] Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) DOM loaded");
    try {
        // [MỚI] Tải Presets trước
        await loadPresets();

        // Tải Deck, Model, Tags
        const results = await Promise.all([
            invoke('deckNames'),
            invoke('modelNames'),
            invoke('getTags'),
            chrome.storage.local.get(['lastUsedDeck', 'lastUsedModel']) // [MỚI] Lấy cài đặt cuối cùng
        ]);
        
        allDecks = Array.isArray(results[0]) ? results[0] : [];
        allModels = Array.isArray(results[1]) ? results[1] : [];
        allTags = Array.isArray(results[2]) ? results[2] : [];
        const lastSettings = results[3] || {};

        console.log("Decks loaded:", allDecks.length);
        console.log("Models loaded:", allModels.length);
        console.log("Tags loaded:", allTags.length);
        console.log("Last settings loaded:", lastSettings);

        // Setup Autocomplete
        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            if (selectedModel && allModels.includes(selectedModel)) {
                 createFieldsForModel(selectedModel);
            } else if (!selectedModel) {
                document.getElementById('fields-container').innerHTML = ''; currentModelName = ''; currentFieldNames = [];
                chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null }).catch(err => console.warn("Could not send empty fields:", err));
            }
        });

        // Populate Tags
        const tagsDatalist = document.getElementById('tags-datalist');
        tagsDatalist.innerHTML = ''; // Xóa cache cũ (nếu có)
        allTags.forEach(tag => { const o = document.createElement('option'); o.value = tag; tagsDatalist.appendChild(o); });

        // [MỚI] Áp dụng cài đặt cuối cùng
        let modelToLoad = null;
        if (lastSettings.lastUsedDeck && allDecks.includes(lastSettings.lastUsedDeck)) {
            document.getElementById('deck-search').value = lastSettings.lastUsedDeck;
            console.log("Restored last used deck:", lastSettings.lastUsedDeck);
        }
        if (lastSettings.lastUsedModel && allModels.includes(lastSettings.lastUsedModel)) {
            document.getElementById('model-search').value = lastSettings.lastUsedModel;
            modelToLoad = lastSettings.lastUsedModel; // Đánh dấu để tải field
            console.log("Restored last used model:", lastSettings.lastUsedModel);
        }

        // [MỚI] Tải fields cho model đã lưu (nếu có)
        if (modelToLoad) {
             console.log("Loading fields for restored model...");
             await createFieldsForModel(modelToLoad);
        }

        // Add Event Listeners
        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);
        // [MỚI] Listeners cho Presets
        document.getElementById('preset-select').addEventListener('change', applyPreset);
        document.getElementById('save-preset-btn').addEventListener('click', saveCurrentPreset);
        document.getElementById('delete-preset-btn').addEventListener('click', deleteCurrentPreset);


    } catch (error) {
        console.error("Critical error during sidebar init:", error);
        showStatus('Lỗi kết nối Anki: ' + error.message, 'error');
        document.getElementById('deck-search').disabled = true;
        document.getElementById('model-search').disabled = true;
        document.getElementById('add-note-btn').disabled = true;
        document.getElementById('preset-select').disabled = true;
        document.getElementById('save-preset-btn').disabled = true;
    }
});

// --- [CẬP NHẬT] Hàm thêm note vào Anki ---
async function addNoteToAnki() {
    try {
        showStatus('Đang thêm...', 'info');
        const deckName = document.getElementById('deck-search').value.trim();
        const modelName = document.getElementById('model-search').value.trim();
        const tagsInput = document.getElementById('tags-input').value.trim();

        if (!deckName || !allDecks.includes(deckName)) { showStatus('Tên Deck không hợp lệ.', 'error'); return; }
        if (!modelName || !allModels.includes(modelName)) { showStatus('Tên Note Type không hợp lệ.', 'error'); return; }

        const fields = {};
        let hasContent = false;
        const fieldGroups = document.querySelectorAll('#fields-container .field-group:not(.field-hidden-by-setting)');

        if (fieldGroups.length === 0 && currentFieldNames.length > 0) {
             throw new Error("Lỗi hiển thị fields. Hãy thử chọn lại Note Type.");
        }
        
        fieldGroups.forEach(group => {
             const fieldName = group.dataset.fieldName;
             const input = group.querySelector('.field-input');
             if (input && fieldName) {
                 const value = input.value;
                 fields[fieldName] = value;
                 if (value.trim()) hasContent = true;
             }
        });
        
        // Xử lý Random ID
        const randomIdFieldKey = `randomIdField_${modelName}`;
        let settings = await chrome.storage.local.get(randomIdFieldKey);
        const randomIdField = settings[randomIdFieldKey];
        
        if (randomIdField && fields.hasOwnProperty(randomIdField) && fields[randomIdField].trim() === '') {
            fields[randomIdField] = generateRandomId();
            hasContent = true;
        }

        if (!hasContent) {
            showStatus('Vui lòng nhập nội dung cho ít nhất một field.', 'error'); return;
        }

        const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
        const params = { note: { deckName, modelName, fields, tags: tagsArray } };
        
        const result = await invoke('addNote', params);
        if (result === null) throw new Error("AnkiConnect returned null (thường là do trùng lặp).");

        showStatus('Thêm thành công! Note ID: ' + result, 'success');

        // [MỚI] Lưu Deck/Model vừa dùng
        await chrome.storage.local.set({ lastUsedDeck: deckName, lastUsedModel: modelName });
        console.log("Saved last used deck/model:", deckName, modelName);

        // [MỚI] Lấy cài đặt Ghim (Sticky)
        const stickyFieldsKey = `stickyFields_${modelName}`;
        settings = await chrome.storage.local.get(stickyFieldsKey);
        const stickyFields = settings[stickyFieldsKey] || {};

        // [CẬP NHẬT] Xóa nội dung fields (trừ các field được ghim)
        document.querySelectorAll('.field-input').forEach(input => {
             const fieldName = input.id.replace('field-', '');
             if (stickyFields[fieldName]) {
                 // console.log(`Field "${fieldName}" is sticky, not clearing.`); // DEBUG
             } else {
                 input.value = ''; // Chỉ xóa nếu không được ghim
                 autoExpandTextarea({ target: input }); // Reset chiều cao
             }
         });
         
        // Giữ lại tags (theo yêu cầu của preset)
        // document.getElementById('tags-input').value = '';

    } catch (error) {
        console.error('Error adding note:', error);
        if (error.message.includes("duplicate")) {
             showStatus('Lỗi: Note bị trùng lặp.', 'error');
        } else {
             showStatus('Lỗi thêm note: ' + (error.message || 'Không xác định'), 'error');
        }
    }
}


// --- [CẬP NHẬT] Listener nhận message từ background.js ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidebar received message:", message);
    if (message.action === "fillFieldFromContextMenu") {
        const { field, content, contentType } = message;
        const targetTextarea = document.getElementById(`field-${field}`);

        if (targetTextarea) {
             let finalContent = content;
             // [SỬA LỖI] Bây giờ background gửi tên file cho ảnh, popup sẽ tạo thẻ
             if (contentType === 'image') {
                 finalContent = `<img src="${content}">`;
             }
             // contentType 'audio' được gửi dưới dạng 'text' với nội dung [sound:...]
             
             console.log(`Filling field "${field}" with content:`, finalContent);
             
             targetTextarea.value += (targetTextarea.value ? '\n' : '') + finalContent;
             targetTextarea.dispatchEvent(new Event('input', { bubbles: true })); // Trigger autoExpand
             
             // Tự động mở field nếu đang bị thu gọn
             const fieldGroup = targetTextarea.closest('.field-group');
             if (fieldGroup && fieldGroup.classList.contains('collapsed')) {
                 const header = fieldGroup.querySelector('.field-header');
                 if(header) header.click();
             }
             
             sendResponse({ success: true, message: `Field "${field}" updated.` });
        } else {
             console.warn(`Field "${field}" not found in sidebar.`);
             const errorMsg = !currentModelName ? `Chọn Note Type trước khi gửi` : `Field "${field}" không tìm thấy`;
             showStatus(errorMsg, 'error');
             sendResponse({ success: false, message: `Field "${field}" not found.` });
        }
    }
    return true; // Cho phép phản hồi bất đồng bộ
});
