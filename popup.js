// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {};
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;
let currentAudio = null; // Để quản lý audio đang phát
let activeElement = null; // [CẬP NHẬT] Lưu element đang focus (div hoặc textarea)
let globalEditorMode = 'normal'; // [THÊM MỚI] Chế độ editor mặc định

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) {
    // ... code invoke giữ nguyên ...
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
            const fieldIdBase = `field-${fieldName.replace(/\s+/g, '-')}`; // Base ID an toàn
            const divId = `${fieldIdBase}-div`;
            const textareaId = `${fieldIdBase}-textarea`;
            const previewId = `preview-${fieldIdBase}`;

            const isHidden = hiddenFields[fieldName] || false;
            const isCollapsed = collapsedFields[fieldName] || false;

            const fieldGroup = document.createElement('div');
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            fieldGroup.dataset.fieldName = fieldName;
            // [CẬP NHẬT] Áp dụng global mode
            fieldGroup.dataset.editorMode = globalEditorMode;

            // --- Header (Toggle + Label) ---
            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';
            fieldHeader.addEventListener('click', toggleFieldCollapse); // Listener collapse

            const toggleCollapse = document.createElement('span');
            toggleCollapse.className = 'collapse-toggle';
            toggleCollapse.textContent = isCollapsed ? '▶' : '🔽';
            toggleCollapse.style.pointerEvents = 'none';

            const label = document.createElement('label');
            label.textContent = fieldName;
            label.style.pointerEvents = 'none';
            label.style.flexGrow = '1';

            fieldHeader.appendChild(toggleCollapse);
            fieldHeader.appendChild(label);
            fieldGroup.appendChild(fieldHeader);
            // --- Hết Header ---

            // --- Input Area (Div + Textarea + Preview) ---
            const inputContainer = document.createElement('div');
            inputContainer.className = 'field-input-area';
            if (isCollapsed) inputContainer.style.display = 'none';

            // Div ContentEditable (Normal Mode)
            const inputDiv = document.createElement('div');
            inputDiv.id = divId;
            inputDiv.contentEditable = true;
            inputDiv.className = 'form-control field-input-div';
            inputDiv.dataset.placeholder = `Nội dung ${fieldName}...`; // Dùng CSS để hiển thị placeholder
            // [CẬP NHẬT] Event listener đồng bộ
            inputDiv.addEventListener('input', () => {
                syncDivToTextarea(inputDiv, document.getElementById(textareaId));
                updateMediaPreviewFromContent(inputDiv.innerHTML, previewId); // Update preview từ div
                ensureContentEditableKeepsFocus(inputDiv); // Giữ focus và con trỏ
            });
            inputDiv.addEventListener('focus', () => { activeElement = inputDiv; });
            inputDiv.addEventListener('blur', () => {
                // Khi mất focus khỏi div, đồng bộ lần cuối
                syncDivToTextarea(inputDiv, document.getElementById(textareaId));
                 if (activeElement === inputDiv) activeElement = null;
            });
            inputContainer.appendChild(inputDiv);

            // Textarea (Source Mode)
            const inputTextarea = document.createElement('textarea');
            inputTextarea.id = textareaId;
            inputTextarea.className = 'form-control field-input-textarea';
            inputTextarea.placeholder = `HTML/Source ${fieldName}...`;
            inputTextarea.rows = 3; // Có thể tăng rows cho source mode
            // [CẬP NHẬT] Event listener đồng bộ
            inputTextarea.addEventListener('input', () => {
                 autoExpandTextarea({ target: inputTextarea });
                 syncTextareaToDiv(inputTextarea, document.getElementById(divId));
                 // Không cần update preview từ textarea vì preview chỉ hiển thị ở normal mode
            });
            inputTextarea.addEventListener('focus', () => { activeElement = inputTextarea; });
            inputTextarea.addEventListener('blur', () => {
                 if (activeElement === inputTextarea) activeElement = null;
            });
            inputContainer.appendChild(inputTextarea);

            // Media Preview Container (luôn nằm cuối)
            const previewContainer = document.createElement('div');
            previewContainer.id = previewId;
            previewContainer.className = 'media-preview-container';
            inputContainer.appendChild(previewContainer);

            fieldGroup.appendChild(inputContainer);
            fieldsContainer.appendChild(fieldGroup);

            // Ban đầu ẩn/hiện dựa trên global mode
            inputDiv.style.display = globalEditorMode === 'normal' ? '' : 'none';
            inputTextarea.style.display = globalEditorMode === 'source' ? '' : 'none';
            previewContainer.style.display = globalEditorMode === 'normal' ? '' : 'none';

            if (globalEditorMode === 'source') {
                 autoExpandTextarea({ target: inputTextarea });
            }
            // Không cần gọi updateRenderedView nữa
            if (globalEditorMode === 'normal') {
                 updateMediaPreviewFromContent(inputDiv.innerHTML, previewId); // Update preview lần đầu
            }
        });
        console.log("Fields created successfully.");

    } catch (error) {
        // ... xử lý lỗi giữ nguyên ...
    }
}

// --- [THÊM MỚI] Hàm đồng bộ nội dung ---
function syncDivToTextarea(divElement, textareaElement) {
    if (divElement && textareaElement) {
        textareaElement.value = divElement.innerHTML;
        // Trigger input event cho textarea để autoExpand nếu cần
        textareaElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
}
function syncTextareaToDiv(textareaElement, divElement) {
    if (textareaElement && divElement) {
        divElement.innerHTML = textareaElement.value;
        // Trigger input event cho div để update preview nếu cần
         divElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
}

// --- [THÊM MỚI] Hàm chuyển chế độ global ---
function setGlobalEditorMode(newMode) {
    if (newMode !== 'normal' && newMode !== 'source') return;
    if (newMode === globalEditorMode) return;

    globalEditorMode = newMode;
    console.log("Switching global editor mode to:", newMode);

    // Cập nhật trạng thái nút bấm
    document.getElementById('mode-normal-btn').classList.toggle('active', newMode === 'normal');
    document.getElementById('mode-source-btn').classList.toggle('active', newMode === 'source');
    document.body.classList.toggle('source-mode', newMode === 'source'); // Thêm class vào body để CSS có thể disable toolbar

    // Duyệt qua tất cả các field và chuyển đổi hiển thị
    document.querySelectorAll('.field-group').forEach(fieldGroup => {
        const divId = `field-${fieldGroup.dataset.fieldName.replace(/\s+/g, '-')}-div`;
        const textareaId = `field-${fieldGroup.dataset.fieldName.replace(/\s+/g, '-')}-textarea`;
        const previewId = `preview-field-${fieldGroup.dataset.fieldName.replace(/\s+/g, '-')}`;

        const divElement = fieldGroup.querySelector(`#${divId}`);
        const textareaElement = fieldGroup.querySelector(`#${textareaId}`);
        const previewContainer = fieldGroup.querySelector(`#${previewId}`);

        if (divElement && textareaElement && previewContainer) {
            fieldGroup.dataset.editorMode = newMode; // Cập nhật data attribute

            if (newMode === 'normal') {
                syncTextareaToDiv(textareaElement, divElement); // Đồng bộ từ source -> normal
                divElement.style.display = '';
                textareaElement.style.display = 'none';
                previewContainer.style.display = '';
                updateMediaPreviewFromContent(divElement.innerHTML, previewId); // Cập nhật preview
            } else { // newMode === 'source'
                syncDivToTextarea(divElement, textareaElement); // Đồng bộ từ normal -> source
                divElement.style.display = 'none';
                textareaElement.style.display = '';
                previewContainer.style.display = 'none'; // Ẩn preview
                autoExpandTextarea({ target: textareaElement }); // Kích hoạt auto-expand
            }
        }
    });

    // Cập nhật element đang active nếu có
    if (activeElement) {
        const fieldName = activeElement.closest('.field-group')?.dataset.fieldName;
        if (fieldName) {
            const fieldIdBase = `field-${fieldName.replace(/\s+/g, '-')}`;
            activeElement = document.getElementById(newMode === 'normal' ? `${fieldIdBase}-div` : `${fieldIdBase}-textarea`);
            activeElement?.focus(); // Focus lại element mới
        } else {
             activeElement = null; // Mất focus nếu không tìm thấy field
        }
    }
}


// --- Hàm chuyển đổi View Mode (Code/Rendered) - Bị loại bỏ ---
// function toggleFieldView(fieldGroup) { ... } // Không cần hàm này nữa

// --- Hàm cập nhật nội dung Rendered View - Bị loại bỏ ---
// function updateRenderedView(textarea) { ... } // Không cần hàm này nữa, div contenteditable tự render

// --- [CẬP NHẬT] Hàm cập nhật Media Preview ---
// Thay vì nhận textarea, nhận content và previewId
async function updateMediaPreviewFromContent(content, previewId) {
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;

    // Chỉ hiển thị preview nếu đang ở chế độ 'normal'
    if (globalEditorMode !== 'normal') {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
        return;
    }
    previewContainer.style.display = '';

    previewContainer.innerHTML = ''; // Xóa preview cũ

    // Tìm thẻ img đầu tiên
    const imgMatch = content.match(/<img src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
        // ... (logic tải và hiển thị ảnh preview giữ nguyên, chỉ cần dùng previewContainer) ...
        const filename = imgMatch[1];
        previewContainer.innerHTML = `<span class="preview-loading">⏳ Đang tải ảnh "${filename}"...</span>`;
        try {
            const base64Data = await invoke('retrieveMediaFile', { filename: filename });
            const currentPreviewContainer = document.getElementById(previewId);
            if (!currentPreviewContainer || globalEditorMode !== 'normal') return; // Kiểm tra lại mode

            if (base64Data) {
                // ... (tạo và thêm img như cũ) ...
                currentPreviewContainer.innerHTML = '';
                 const img = document.createElement('img');
                 let mimeType = 'image/webp'; // Mặc định webp
                 if (filename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                 else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
                 else if (filename.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
                 else if (filename.toLowerCase().endsWith('.svg')) mimeType = 'image/svg+xml';

                 img.src = `data:${mimeType};base64,${base64Data}`;
                 img.alt = filename;
                 img.className = 'preview-image';
                 img.title = `Click để xem lớn hơn: ${filename}`;
                 img.addEventListener('click', () => showImageModal(img.src, filename));
                 currentPreviewContainer.appendChild(img);
            } else {
                 currentPreviewContainer.innerHTML = `<span class="preview-error">⚠️ Ảnh "${filename}" không tìm thấy!</span>`;
            }
        } catch (error) {
             console.error("Error retrieving image preview:", error);
             const currentPreviewContainer = document.getElementById(previewId);
             if (currentPreviewContainer && globalEditorMode === 'normal') {
                 currentPreviewContainer.innerHTML = `<span class="preview-error">⚠️ Lỗi tải ảnh "${filename}"</span>`;
             }
        }
    }

    // Tìm thẻ sound đầu tiên
    const soundMatch = content.match(/\[sound:(.*?)\]/i);
    if (soundMatch) {
        // ... (logic tạo nút audio và xử lý play/stop giữ nguyên, chỉ cần dùng previewContainer) ...
         const filename = soundMatch[1];
         const button = document.createElement('button');
         button.className = 'btn-secondary preview-audio-button';
         button.textContent = '🔊 Nghe';
         button.title = filename;
         let isPlaying = false;
         let audioObject = null;

         button.onclick = async (event) => {
            // ... (code xử lý audio giữ nguyên) ...
         };
         const finalPreviewContainer = document.getElementById(previewId);
          if (finalPreviewContainer && globalEditorMode === 'normal') { // Kiểm tra lại mode
             finalPreviewContainer.appendChild(button);
          }
    }
}


// --- Hàm hiển thị Modal ảnh (không đổi) ---
function showImageModal(src, caption) {
    // ... code giữ nguyên ...
}

// --- Hàm toggleFieldCollapse (không đổi nhiều) ---
async function toggleFieldCollapse(event) {
    // ... code giữ nguyên, chỉ cần đảm bảo nó ẩn/hiện đúng inputArea ...
    const fieldHeader = event.currentTarget;
    const fieldGroup = fieldHeader.closest('.field-group');
    if (!fieldGroup) return;

    // Ngăn collapse khi click vào các nút control bên trong header
    if (event.target.classList.contains('preview-audio-button') ||
        event.target.classList.contains('preview-image') ||
        event.target.classList.contains('btn-toggle-view')) { // btn-toggle-view đã bị xóa nhưng để phòng hờ
        return;
    }

    const fieldName = fieldGroup.dataset.fieldName;
    const inputArea = fieldGroup.querySelector('.field-input-area');
    const toggleIcon = fieldHeader.querySelector('.collapse-toggle');
    const label = fieldHeader.querySelector('label');

    if (!inputArea || !fieldName || !toggleIcon || !label) { console.error("Collapse elements not found!"); return; }

    const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed');
    const newState = !isCurrentlyCollapsed;

    fieldGroup.classList.toggle('collapsed', newState);
    if (newState) {
        inputArea.style.display = 'none';
        label.style.opacity = '0.65';
        toggleIcon.textContent = '▶';
    } else {
        inputArea.style.display = '';
        label.style.opacity = '1';
        toggleIcon.textContent = '🔽';
        // Trigger autoExpand cho textarea nếu đang ở source mode
        if (globalEditorMode === 'source') {
             const textareaId = `field-${fieldName.replace(/\s+/g, '-')}-textarea`;
             const textarea = inputArea.querySelector(`#${textareaId}`);
             if (textarea) {
                  autoExpandTextarea({ target: textarea });
             }
        }
    }

    // Lưu trạng thái collapse (giữ nguyên)
    // ...
}


// --- Các hàm tiện ích (autoExpand, openOptions, generateRandomId, showStatus) ---
// ... code giữ nguyên ...
function autoExpandTextarea(event) { const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight + 2) + 'px'; }
// ...

// --- Hàm setupAutocomplete (không đổi) ---
// ... code giữ nguyên ...

// --- Các hàm xử lý Preset (không đổi) ---
// ... code giữ nguyên ...

// --- [CẬP NHẬT] Hàm xử lý định dạng ---
function applyFormat(command, value = null) {
    // Chỉ hoạt động ở Normal Mode và khi activeElement là contenteditable div
    if (globalEditorMode !== 'normal' || !activeElement || !activeElement.isContentEditable) {
        showStatus("Chức năng định dạng chỉ hoạt động ở Normal Mode.", "warning");
        return;
    }
    activeElement.focus(); // Đảm bảo focus đúng element
    document.execCommand(command, false, value);

    // [CẬP NHẬT] Đồng bộ div -> textarea sau khi định dạng
    const fieldGroup = activeElement.closest('.field-group');
    if(fieldGroup){
        const textareaId = `field-${fieldGroup.dataset.fieldName.replace(/\s+/g, '-')}-textarea`;
        const textareaElement = document.getElementById(textareaId);
        syncDivToTextarea(activeElement, textareaElement);
        // Trigger input event trên div để cập nhật preview
        activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
    ensureContentEditableKeepsFocus(activeElement); // Cố gắng giữ focus
}

// --- [CẬP NHẬT] Hàm xử lý Cloze ---
function addCloze() {
    // Chỉ hoạt động ở Normal Mode và khi activeElement là contenteditable div
    if (globalEditorMode !== 'normal' || !activeElement || !activeElement.isContentEditable) {
         showStatus("Chức năng Cloze chỉ hoạt động ở Normal Mode.", "warning");
        return;
    }
    activeElement.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        showStatus("Vui lòng bôi đen phần text cần làm cloze.", "error");
        return;
    }
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    let highestCloze = 0;
    const clozeRegex = /\{\{c(\d+)::/g;
    let match;
    // Kiểm tra toàn bộ nội dung của div đang active
    const fullContent = activeElement.innerHTML; // Lấy HTML để kiểm tra chính xác hơn
    while ((match = clozeRegex.exec(fullContent)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > highestCloze) highestCloze = num;
    }
    const nextClozeNum = highestCloze + 1;
    const clozeText = `{{c${nextClozeNum}::${selectedText}}}`; // Chỉ bọc text, không bọc HTML

    // Thay thế nội dung đã chọn bằng clozeText
    range.deleteContents(); // Xóa nội dung đã chọn
    const textNode = document.createTextNode(clozeText); // Tạo text node mới
    range.insertNode(textNode); // Chèn vào vị trí cũ

    // Di chuyển con trỏ đến cuối phần vừa chèn
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // [CẬP NHẬT] Đồng bộ div -> textarea
     const fieldGroup = activeElement.closest('.field-group');
     if(fieldGroup){
        const textareaId = `field-${fieldGroup.dataset.fieldName.replace(/\s+/g, '-')}-textarea`;
        const textareaElement = document.getElementById(textareaId);
        syncDivToTextarea(activeElement, textareaElement);
        // Trigger input event trên div để cập nhật preview
        activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
}

// [THÊM MỚI] Hàm tiện ích để cố gắng giữ focus và con trỏ trong contenteditable
function ensureContentEditableKeepsFocus(element) {
    // Đôi khi execCommand làm mất focus, thử focus lại
    // Tuy nhiên, việc này có thể làm mất vị trí con trỏ. Cần giải pháp phức tạp hơn để lưu/restore selection.
    // Tạm thời chỉ focus lại nếu mất
    if (document.activeElement !== element) {
       // console.log("Refocusing contenteditable");
       // element.focus(); // Việc này có thể gây lỗi hoặc nhảy con trỏ, tạm bỏ
    }
}


// --- [CẬP NHẬT] Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    // ... code load preset, deck, model, tag, last used giữ nguyên ...
    console.log("Sidebar (popup.js) DOM loaded");
    try {
        await loadPresets();
        // ... code Promise.all giữ nguyên ...
        const results = await Promise.all([
            invoke('deckNames'),
            invoke('modelNames'),
            invoke('getTags'),
            chrome.storage.local.get(['lastUsedDeck', 'lastUsedModel'])
        ]);
        // ... gán allDecks, allModels, allTags, lastSettings ...

        // ... code setupAutocomplete giữ nguyên ...
        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
         setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
             if (selectedModel && allModels.includes(selectedModel)) {
                  createFieldsForModel(selectedModel);
             } else if (!selectedModel) {
                 document.getElementById('fields-container').innerHTML = ''; currentModelName = ''; currentFieldNames = [];
                 chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null }).catch(err => console.warn("Could not send empty fields:", err));
             }
         });


        // ... code xử lý tags datalist giữ nguyên ...
         const tagsDatalist = document.getElementById('tags-datalist');
         tagsDatalist.innerHTML = '';
         allTags.forEach(tag => { const o = document.createElement('option'); o.value = tag; tagsDatalist.appendChild(o); });


        // ... code xử lý last used deck/model và load field lần đầu giữ nguyên ...
         let modelToLoad = null;
         if (lastSettings.lastUsedDeck && allDecks.includes(lastSettings.lastUsedDeck)) {
             document.getElementById('deck-search').value = lastSettings.lastUsedDeck;
         }
         if (lastSettings.lastUsedModel && allModels.includes(lastSettings.lastUsedModel)) {
             document.getElementById('model-search').value = lastSettings.lastUsedModel;
             modelToLoad = lastSettings.lastUsedModel;
         }
         if (modelToLoad) {
             await createFieldsForModel(modelToLoad);
         }


        // --- Gán sự kiện (cập nhật) ---
        // ... các listener cũ giữ nguyên ...
        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);
        document.getElementById('preset-select').addEventListener('change', applyPreset);
        document.getElementById('save-preset-btn').addEventListener('click', saveCurrentPreset);
        document.getElementById('delete-preset-btn').addEventListener('click', deleteCurrentPreset);

        // [THÊM MỚI] Listener cho nút chuyển mode
        document.getElementById('mode-normal-btn').addEventListener('click', () => setGlobalEditorMode('normal'));
        document.getElementById('mode-source-btn').addEventListener('click', () => setGlobalEditorMode('source'));

        // ... listener cho toolbar và phím tắt giữ nguyên ...
        document.getElementById('format-bold').addEventListener('click', () => applyFormat('bold'));
        // ... (các nút khác) ...
        document.getElementById('format-cloze').addEventListener('click', addCloze);
        // ... (color pickers) ...
        document.addEventListener('keydown', (e) => {
            // ... (xử lý phím tắt) ...
        });

    } catch (error) {
        // ... xử lý lỗi init giữ nguyên ...
        console.error("Critical error during sidebar init:", error);
        showStatus('Lỗi kết nối Anki: ' + error.message, 'error');
        // Vô hiệu hóa UI khi lỗi
        document.getElementById('deck-search').disabled = true;
        document.getElementById('model-search').disabled = true;
        document.getElementById('add-note-btn').disabled = true;
        // ... (disable các nút khác) ...
        document.getElementById('mode-normal-btn').disabled = true; // Disable mode toggle
        document.getElementById('mode-source-btn').disabled = true;
    }
});

// --- [CẬP NHẬT] Hàm thêm note (addNoteToAnki) ---
async function addNoteToAnki() {
    try {
        showStatus('Đang thêm...', 'info');
        const deckName = document.getElementById('deck-search').value.trim();
        const modelName = document.getElementById('model-search').value.trim();
        const tagsInput = document.getElementById('tags-input').value.trim();

        if (!deckName || !allDecks.includes(deckName)) { showStatus('Deck không hợp lệ.', 'error'); return; }
        if (!modelName || !allModels.includes(modelName)) { showStatus('Note Type không hợp lệ.', 'error'); return; }

        const fields = {};
        let hasContent = false;
        // [CẬP NHẬT] Lấy nội dung từ element tương ứng với mode hiện tại
        document.querySelectorAll('#fields-container .field-group:not(.field-hidden-by-setting)').forEach(fieldGroup => {
            const fieldName = fieldGroup.dataset.fieldName;
            if (fieldName) {
                const fieldIdBase = `field-${fieldName.replace(/\s+/g, '-')}`;
                let value = '';
                if (globalEditorMode === 'normal') {
                    const divElement = fieldGroup.querySelector(`#${fieldIdBase}-div`);
                    if (divElement) value = divElement.innerHTML; // Lấy HTML từ div
                } else { // Source mode
                    const textareaElement = fieldGroup.querySelector(`#${fieldIdBase}-textarea`);
                    if (textareaElement) value = textareaElement.value; // Lấy text từ textarea
                }
                fields[fieldName] = value;
                // Kiểm tra nội dung không chỉ là khoảng trắng hoặc thẻ br trống
                if (value.replace(/<br\s*\/?>/gi, '').trim()) {
                    hasContent = true;
                }
            }
        });


        // ... xử lý Random ID giữ nguyên ...
        const randomIdFieldKey = `randomIdField_${modelName}`;
        let settings = await chrome.storage.local.get(randomIdFieldKey);
        const randomIdField = settings[randomIdFieldKey];
        if (randomIdField && fields.hasOwnProperty(randomIdField) && fields[randomIdField].trim() === '') {
            fields[randomIdField] = generateRandomId();
            hasContent = true;
        }


        if (!hasContent) {
            showStatus('Vui lòng nhập nội dung.', 'error'); return;
        }

        // ... xử lý tags và gọi invoke('addNote') giữ nguyên ...
        const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
        const params = { note: { deckName, modelName, fields, tags: tagsArray } };
        const result = await invoke('addNote', params);
        // ...


        showStatus('Thêm thành công! Note ID: ' + result