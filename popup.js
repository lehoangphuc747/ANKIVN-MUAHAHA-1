// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {};
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;
let currentAudio = null;

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên ... */
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

// --- [CẬP NHẬT] Hàm tạo Fields ---
async function createFieldsForModel(modelName) {
    console.log("Creating fields for model:", modelName);
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if (!Array.isArray(fieldNames)) throw new Error("Invalid field names data.");
        currentFieldNames = fieldNames;

        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", modelName: modelName, fields: fieldNames })
              .catch(err => console.warn("Could not send fields to background:", err));

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';

        const settingsKeys = [`hiddenFields_${modelName}`, `collapsedFields_${modelName}`];
        const settings = await chrome.storage.local.get(settingsKeys);
        const hiddenFields = settings[settingsKeys[0]] || {};
        const collapsedFields = settings[settingsKeys[1]] || {};

        if (fieldNames.length === 0) {
            fieldsContainer.innerHTML = '<p><i>Note Type này không có field nào.</i></p>'; return;
        }

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`;
            const isHidden = hiddenFields[fieldName] || false;
            const isCollapsed = collapsedFields[fieldName] || false;
            const isCodeViewDefault = false; // Mặc định hiển thị Rendered

            const fieldGroup = document.createElement('div');
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            fieldGroup.dataset.fieldName = fieldName;
            fieldGroup.dataset.viewMode = isCodeViewDefault ? 'code' : 'rendered'; // [MỚI] Lưu trạng thái view

            // --- Header (Toggle + Label + Show Code Button) ---
            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';
            // Không gán listener collapse ở đây nữa, gán sau khi thêm nút Show Code

            const toggleCollapse = document.createElement('span');
            toggleCollapse.className = 'collapse-toggle';
            toggleCollapse.textContent = isCollapsed ? '▶' : '🔽';
            toggleCollapse.style.pointerEvents = 'none';

            const label = document.createElement('label');
            label.textContent = fieldName;
            label.style.pointerEvents = 'none';
            label.style.flexGrow = '1'; // Cho label chiếm không gian

            // [MỚI] Nút Show Code/Rendered
            const toggleViewBtn = document.createElement('button');
            toggleViewBtn.className = 'btn-secondary btn-toggle-view';
            toggleViewBtn.textContent = isCodeViewDefault ? '🖼️' : ' </> '; // Icon Rendered / Code
            toggleViewBtn.title = isCodeViewDefault ? 'Hiển thị Rendered' : 'Hiển thị Code HTML';
            toggleViewBtn.addEventListener('click', (e) => {
                 e.stopPropagation(); // Ngăn sự kiện collapse
                 toggleFieldView(fieldGroup);
            });

            fieldHeader.appendChild(toggleCollapse);
            fieldHeader.appendChild(label);
            fieldHeader.appendChild(toggleViewBtn); // Thêm nút vào header
            fieldHeader.addEventListener('click', toggleFieldCollapse); // Giờ mới gán listener collapse
            fieldGroup.appendChild(fieldHeader);
            // --- Hết Header ---


            // --- Input Area (Textarea + Rendered View + Preview) ---
            const inputContainer = document.createElement('div');
            inputContainer.className = 'field-input-area';
            if (isCollapsed) inputContainer.style.display = 'none';

            // Textarea (Code View)
            const input = document.createElement('textarea');
            input.id = fieldId;
            input.className = 'form-control field-input';
            input.placeholder = `Nội dung ${fieldName}...`;
            input.rows = 2;
            input.addEventListener('input', () => {
                 autoExpandTextarea({ target: input });
                 updateRenderedView(input); // [MỚI] Cập nhật rendered view khi gõ
                 updateMediaPreview(input);
            });
            input.style.display = isCodeViewDefault ? '' : 'none'; // Ẩn/hiện theo view mode
            inputContainer.appendChild(input);

             // [MỚI] Rendered View Div
            const renderedView = document.createElement('div');
            renderedView.id = `rendered-${fieldId}`;
            renderedView.className = 'rendered-field-view form-control'; // Style giống form-control
             renderedView.style.display = isCodeViewDefault ? 'none' : ''; // Ẩn/hiện theo view mode
            renderedView.innerHTML = ''; // Sẽ cập nhật sau
            inputContainer.appendChild(renderedView);


            // Media Preview Container (luôn nằm cuối)
            const previewContainer = document.createElement('div');
            previewContainer.id = `preview-${fieldId}`;
            previewContainer.className = 'media-preview-container';
            // Hiển thị preview chỉ khi ở chế độ rendered
            previewContainer.style.display = isCodeViewDefault ? 'none' : '';
            inputContainer.appendChild(previewContainer);

            fieldGroup.appendChild(inputContainer);
            fieldsContainer.appendChild(fieldGroup);

            autoExpandTextarea({ target: input });
            updateRenderedView(input); // [MỚI] Cập nhật lần đầu
            updateMediaPreview(input);
        });
        console.log("Fields created successfully.");

    } catch (error) {
        console.error('Error creating fields:', error);
        showStatus('Lỗi tải fields: ' + error.message, 'error');
        currentFieldNames = [];
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null }).catch(err => console.warn("Could not send empty fields:", err));
        document.getElementById('fields-container').innerHTML = `<p style="color: var(--error-text);"><i>Lỗi tải fields.</i></p>`;
    }
}

// --- [MỚI] Hàm chuyển đổi View Mode (Code/Rendered) ---
function toggleFieldView(fieldGroup) {
    const fieldId = `field-${fieldGroup.dataset.fieldName}`;
    const textarea = fieldGroup.querySelector(`#${fieldId}`);
    const renderedView = fieldGroup.querySelector(`#rendered-${fieldId}`);
    const previewContainer = fieldGroup.querySelector(`#preview-${fieldId}`);
    const toggleBtn = fieldGroup.querySelector('.btn-toggle-view');

    const currentMode = fieldGroup.dataset.viewMode;
    const newMode = currentMode === 'code' ? 'rendered' : 'code';
    fieldGroup.dataset.viewMode = newMode;

    if (newMode === 'code') {
        textarea.style.display = '';
        renderedView.style.display = 'none';
        previewContainer.style.display = 'none'; // Ẩn preview khi xem code
        toggleBtn.textContent = '🖼️'; // Icon chuyển sang Rendered
        toggleBtn.title = 'Hiển thị Rendered';
    } else { // newMode === 'rendered'
        textarea.style.display = 'none';
        renderedView.style.display = '';
        previewContainer.style.display = ''; // Hiện preview khi xem rendered
        toggleBtn.textContent = ' </> '; // Icon chuyển sang Code
        toggleBtn.title = 'Hiển thị Code HTML';
        updateRenderedView(textarea); // Cập nhật nội dung render
        updateMediaPreview(textarea); // Cập nhật preview media
    }
}

// --- [MỚI] Hàm cập nhật nội dung Rendered View ---
function updateRenderedView(textarea) {
    const fieldId = textarea.id;
    const renderedView = document.getElementById(`rendered-${fieldId}`);
    if (renderedView) {
        // TODO: Cân nhắc sanitize HTML ở đây nếu cần bảo mật
        // Hiện tại chỉ gán trực tiếp để hiển thị đúng format
        renderedView.innerHTML = textarea.value;
    }
}


// --- Hàm cập nhật Media Preview (không đổi) ---
async function updateMediaPreview(textarea) { /* ... giữ nguyên ... */
    const fieldId = textarea.id;
    const previewContainer = document.getElementById(`preview-${fieldId}`);
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    const content = textarea.value;
    const imgMatch = content.match(/<img src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
        const filename = imgMatch[1];
        try {
            const base64Data = await invoke('retrieveMediaFile', { filename: filename });
            if (base64Data) {
                const img = document.createElement('img');
                img.src = `data:image/webp;base64,${base64Data}`;
                img.alt = filename;
                img.className = 'preview-image';
                img.title = `Click để xem lớn hơn: ${filename}`;
                img.addEventListener('click', () => showImageModal(img.src, filename));
                previewContainer.appendChild(img);
            } else { previewContainer.innerHTML = `<span class="preview-error">⚠️ Ảnh "${filename}" không tìm thấy!</span>`; }
        } catch (error) { console.error("Error retrieving image preview:", error); previewContainer.innerHTML = `<span class="preview-error">⚠️ Lỗi tải ảnh "${filename}"</span>`; }
    }
    const soundMatch = content.match(/\[sound:(.*?)\]/i);
    if (soundMatch) {
        const filename = soundMatch[1];
        const button = document.createElement('button');
        button.className = 'btn-secondary preview-audio-button';
        button.textContent = '🔊 Nghe';
        button.title = filename;
        button.onclick = async (event) => {
            event.stopPropagation();
            button.disabled = true; button.textContent = '🔊 Đang tải...';
            try {
                const base64Data = await invoke('retrieveMediaFile', { filename: filename });
                if (base64Data) {
                    if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; }
                    currentAudio = new Audio(`data:audio/mpeg;base64,${base64Data}`);
                    currentAudio.play();
                    button.textContent = '🔊 Đang phát...';
                    currentAudio.onended = () => { button.textContent = '🔊 Nghe'; button.disabled = false; currentAudio = null; };
                    currentAudio.onerror = () => { showStatus(`Lỗi phát audio "${filename}"`, 'error'); button.textContent = '🔊 Lỗi'; currentAudio = null; }
                } else { showStatus(`Audio "${filename}" không tìm thấy!`, 'error'); button.textContent = '🔊 Không thấy'; }
            } catch (error) { console.error("Error retrieving/playing audio:", error); showStatus(`Lỗi tải audio "${filename}"`, 'error'); button.textContent = '🔊 Lỗi tải'; button.disabled = false; }
        };
        previewContainer.appendChild(button);
    }
}


// --- Hàm hiển thị Modal ảnh (không đổi) ---
function showImageModal(src, caption) { /* ... giữ nguyên ... */
    const modal = document.getElementById("image-preview-modal"); const modalImg = document.getElementById("modal-image"); const captionText = document.getElementById("modal-caption"); const closeBtn = modal.querySelector(".modal-close-btn"); modal.style.display = "block"; modalImg.src = src; captionText.innerHTML = caption; const closeModal = () => { modal.style.display = "none"; modalImg.src = ""; } closeBtn.onclick = closeModal; modal.onclick = (event) => { if (event.target === modal) closeModal(); }
}

// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên ... */
    if (event.target.classList.contains('preview-audio-button') || event.target.classList.contains('preview-image') || event.target.classList.contains('btn-toggle-view') /*[MỚI] Ngăn collapse khi click Show Code*/) { return; }
    const fieldHeader = event.currentTarget; const fieldGroup = fieldHeader.closest('.field-group'); if (!fieldGroup) return; const fieldName = fieldGroup.dataset.fieldName; const inputArea = fieldGroup.querySelector('.field-input-area'); const toggleIcon = fieldHeader.querySelector('.collapse-toggle'); const label = fieldHeader.querySelector('label'); if (!inputArea || !fieldName || !toggleIcon || !label) { console.error("Collapse elements not found!"); return; } const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed'); const newState = !isCurrentlyCollapsed; fieldGroup.classList.toggle('collapsed', newState); if (newState) { inputArea.style.display = 'none'; label.style.opacity = '0.65'; toggleIcon.textContent = '▶'; } else { inputArea.style.display = ''; label.style.opacity = '1'; toggleIcon.textContent = '🔽'; const textarea = inputArea.querySelector('.field-input'); if (textarea) autoExpandTextarea({ target: textarea }); } const storageKey = `collapsedFields_${currentModelName}`; try { const currentState = await chrome.storage.local.get(storageKey); const updatedState = currentState[storageKey] || {}; updatedState[fieldName] = newState; await chrome.storage.local.set({ [storageKey]: updatedState }); } catch (error) { console.error('Error saving collapse state:', error); }
}

// --- Các hàm tiện ích (autoExpand, openOptions, generateRandomId, showStatus) không đổi ---
function autoExpandTextarea(event) { /* ... giữ nguyên ... */ const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight + 2) + 'px'; }
function openOptionsPage() { /* ... giữ nguyên ... */ chrome.runtime.openOptionsPage(); }
function generateRandomId(length = 14) { /* ... giữ nguyên ... */ let r = ''; const c = '0123456789'; for (let i = 0; i < length; i++) r += c.charAt(Math.floor(Math.random() * 10)); return r; }
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */ const s = document.getElementById('status-message'); s.textContent = message; s.className = `status-message ${type}`; if (statusTimeout) clearTimeout(statusTimeout); if (type === 'success') { statusTimeout = setTimeout(() => { if (s.textContent === message) { s.textContent = ''; s.className = 'status-message'; } statusTimeout = null; }, 4000); } else { statusTimeout = null; } }

// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên ... */ }

// --- Các hàm xử lý Preset (loadPresets, saveCurrentPreset, deleteCurrentPreset, applyPreset) không đổi ---
async function loadPresets() { /* ... giữ nguyên ... */ }
async function saveCurrentPreset() { /* ... giữ nguyên ... */ }
async function deleteCurrentPreset() { /* ... giữ nguyên ... */ }
async function applyPreset() { /* ... giữ nguyên ... */ }

// --- Khởi tạo popup (DOMContentLoaded) không đổi ---
document.addEventListener('DOMContentLoaded', async function() { /* ... giữ nguyên ... */ });

// --- Hàm thêm note (addNoteToAnki) không đổi ---
async function addNoteToAnki() { /* ... giữ nguyên ... */
     try { showStatus('Đang thêm...', 'info'); const deckName = document.getElementById('deck-search').value.trim(); const modelName = document.getElementById('model-search').value.trim(); const tagsInput = document.getElementById('tags-input').value.trim(); if (!deckName || !allDecks.includes(deckName)) { showStatus('Tên Deck không hợp lệ.', 'error'); return; } if (!modelName || !allModels.includes(modelName)) { showStatus('Tên Note Type không hợp lệ.', 'error'); return; } const fields = {}; let hasContent = false; const fieldGroups = document.querySelectorAll('#fields-container .field-group:not(.field-hidden-by-setting)'); if (fieldGroups.length === 0 && currentFieldNames.length > 0) { throw new Error("Lỗi hiển thị fields."); } fieldGroups.forEach(group => { const fieldName = group.dataset.fieldName; const input = group.querySelector('.field-input'); if (input && fieldName) { const value = input.value; fields[fieldName] = value; if (value.trim()) hasContent = true; } }); const randomIdFieldKey = `randomIdField_${modelName}`; let settings = await chrome.storage.local.get(randomIdFieldKey); const randomIdField = settings[randomIdFieldKey]; if (randomIdField && fields.hasOwnProperty(randomIdField) && fields[randomIdField].trim() === '') { fields[randomIdField] = generateRandomId(); hasContent = true; } if (!hasContent) { showStatus('Vui lòng nhập nội dung.', 'error'); return; } const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim()); const params = { note: { deckName, modelName, fields, tags: tagsArray } }; const result = await invoke('addNote', params); if (result === null) throw new Error("AnkiConnect returned null (trùng lặp?)."); showStatus('Thêm thành công! Note ID: ' + result, 'success'); await chrome.storage.local.set({ lastUsedDeck: deckName, lastUsedModel: modelName }); const stickyFieldsKey = `stickyFields_${modelName}`; settings = await chrome.storage.local.get(stickyFieldsKey); const stickyFields = settings[stickyFieldsKey] || {}; document.querySelectorAll('.field-input').forEach(input => { const fieldName = input.id.replace('field-', ''); if (!stickyFields[fieldName]) { input.value = ''; autoExpandTextarea({ target: input }); updateRenderedView(input); /*[MỚI]*/ updateMediaPreview(input); /*[MỚI]*/ } }); } catch (error) { console.error('Error adding note:', error); showStatus('Lỗi thêm note: ' + (error.message || 'Không xác định'), 'error'); }
}


// --- [CẬP NHẬT] Listener nhận message từ background ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidebar received message:", message);
    if (message.action === "fillFieldFromContextMenu") {
        const { field, content, contentType } = message;
        const targetTextarea = document.getElementById(`field-${field}`);

        if (targetTextarea) {
             let finalContentToInsert = content;
             if (contentType === 'image') {
                 finalContentToInsert = `<img src="${content}">`;
             }

             console.log(`Filling field "${field}" with content:`, finalContentToInsert);

             targetTextarea.value += (targetTextarea.value ? '\n' : '') + finalContentToInsert;
             // [CẬP NHẬT] Trigger input event để cập nhật cả rendered view và preview
             targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));

             const fieldGroup = targetTextarea.closest('.field-group');
             if (fieldGroup) {
                 // [MỚI] Chuyển sang chế độ Rendered View nếu đang ở Code View
                 if (fieldGroup.dataset.viewMode === 'code') {
                     toggleFieldView(fieldGroup);
                 }
                 // Mở field nếu đang collapse
                 if (fieldGroup.classList.contains('collapsed')) {
                     const header = fieldGroup.querySelector('.field-header');
                     if(header) header.click(); // Sử dụng hàm toggleFieldCollapse qua click
                 }
             }

             sendResponse({ success: true, message: `Field "${field}" updated.` });
        } else {
             console.warn(`Field "${field}" not found in sidebar.`);
             const errorMsg = !currentModelName ? `Chọn Note Type trước khi gửi` : `Field "${field}" không tìm thấy`;
             showStatus(errorMsg, 'error');
             sendResponse({ success: false, message: `Field "${field}" not found.` });
        }
    }
    return true;
});

