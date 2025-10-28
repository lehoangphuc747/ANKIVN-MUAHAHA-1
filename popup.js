// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {};
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;
let currentAudio = null;
let activeTextarea = null; // [MỚI] Lưu textarea đang focus

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên ... */ }

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
            const isCodeViewDefault = false;

            const fieldGroup = document.createElement('div');
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            fieldGroup.dataset.fieldName = fieldName;
            fieldGroup.dataset.viewMode = isCodeViewDefault ? 'code' : 'rendered';

            // --- Header ---
            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';
            const toggleCollapse = document.createElement('span');
            toggleCollapse.className = 'collapse-toggle';
            toggleCollapse.textContent = isCollapsed ? '▶' : '🔽';
            toggleCollapse.style.pointerEvents = 'none';
            const label = document.createElement('label');
            label.textContent = fieldName;
            label.style.pointerEvents = 'none';
            label.style.flexGrow = '1';
            const toggleViewBtn = document.createElement('button');
            toggleViewBtn.className = 'btn-secondary btn-toggle-view';
            toggleViewBtn.textContent = isCodeViewDefault ? '🖼️' : ' </> ';
            toggleViewBtn.title = isCodeViewDefault ? 'Hiển thị Rendered' : 'Hiển thị Code HTML';
            toggleViewBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFieldView(fieldGroup); });
            fieldHeader.appendChild(toggleCollapse);
            fieldHeader.appendChild(label);
            fieldHeader.appendChild(toggleViewBtn);
            fieldHeader.addEventListener('click', toggleFieldCollapse);
            fieldGroup.appendChild(fieldHeader);
            // --- Hết Header ---

            // --- Input Area ---
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
                 updateRenderedView(input);
                 updateMediaPreview(input);
            });
            // [MỚI] Listener để lưu textarea đang active
            input.addEventListener('focus', () => { activeTextarea = input; });
            input.addEventListener('blur', () => { /* Có thể đặt activeTextarea = null ở đây nếu muốn */ });
            input.style.display = isCodeViewDefault ? '' : 'none';
            inputContainer.appendChild(input);

            // Rendered View Div
            const renderedView = document.createElement('div');
            renderedView.id = `rendered-${fieldId}`;
            renderedView.className = 'rendered-field-view form-control';
            renderedView.style.display = isCodeViewDefault ? 'none' : '';
            inputContainer.appendChild(renderedView);

            // Media Preview Container
            const previewContainer = document.createElement('div');
            previewContainer.id = `preview-${fieldId}`;
            previewContainer.className = 'media-preview-container';
            previewContainer.style.display = isCodeViewDefault ? 'none' : '';
            inputContainer.appendChild(previewContainer);

            fieldGroup.appendChild(inputContainer);
            fieldsContainer.appendChild(fieldGroup);

            autoExpandTextarea({ target: input });
            updateRenderedView(input);
            updateMediaPreview(input);
        });
        console.log("Fields created successfully.");

    } catch (error) { /* ... giữ nguyên xử lý lỗi ... */ }
}

// --- Hàm chuyển đổi View Mode (không đổi) ---
function toggleFieldView(fieldGroup) { /* ... giữ nguyên ... */ }

// --- Hàm cập nhật Rendered View (không đổi) ---
function updateRenderedView(textarea) { /* ... giữ nguyên ... */ }

// --- Hàm cập nhật Media Preview (không đổi) ---
async function updateMediaPreview(textarea) { /* ... giữ nguyên ... */ }

// --- Hàm hiển thị Modal ảnh (không đổi) ---
function showImageModal(src, caption) { /* ... giữ nguyên ... */ }

// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên ... */ }

// --- Các hàm tiện ích (không đổi) ---
function autoExpandTextarea(event) { /* ... giữ nguyên ... */ }
function openOptionsPage() { /* ... giữ nguyên ... */ }
function generateRandomId(length = 14) { /* ... giữ nguyên ... */ }
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */ }

// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên ... */ }

// --- Các hàm xử lý Preset (không đổi) ---
async function loadPresets() { /* ... giữ nguyên ... */ }
async function saveCurrentPreset() { /* ... giữ nguyên ... */ }
async function deleteCurrentPreset() { /* ... giữ nguyên ... */ }
async function applyPreset() { /* ... giữ nguyên ... */ }

// --- [MỚI] Hàm xử lý định dạng ---
function applyFormat(command, value = null) {
    if (!activeTextarea) {
        showStatus("Vui lòng click vào field cần định dạng.", "error");
        return;
    }
    // Chuyển focus về textarea để execCommand hoạt động
    activeTextarea.focus();

    // Sử dụng execCommand
    document.execCommand(command, false, value);

    // Trigger input event để cập nhật rendered view và preview
    activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- [MỚI] Hàm xử lý Cloze ---
function addCloze() {
    if (!activeTextarea) {
        showStatus("Vui lòng click vào field cần thêm cloze.", "error");
        return;
    }
    activeTextarea.focus();

    const start = activeTextarea.selectionStart;
    const end = activeTextarea.selectionEnd;
    const selectedText = activeTextarea.value.substring(start, end);

    if (!selectedText) {
        showStatus("Vui lòng bôi đen phần text cần làm cloze.", "error");
        return;
    }

    // Tìm số cloze lớn nhất hiện có
    let highestCloze = 0;
    const clozeRegex = /\{\{c(\d+)::/g;
    let match;
    while ((match = clozeRegex.exec(activeTextarea.value)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > highestCloze) {
            highestCloze = num;
        }
    }
    const nextClozeNum = highestCloze + 1;

    // Tạo cloze string
    const clozeText = `{{c${nextClozeNum}::${selectedText}}}`;

    // Chèn vào textarea
    const before = activeTextarea.value.substring(0, start);
    const after = activeTextarea.value.substring(end);
    activeTextarea.value = before + clozeText + after;

    // Cập nhật vị trí con trỏ sau khi chèn
    activeTextarea.selectionStart = start + clozeText.length;
    activeTextarea.selectionEnd = start + clozeText.length;

    // Trigger input event
    activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
}


// --- [CẬP NHẬT] Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) DOM loaded");
    try {
        // --- Tải dữ liệu (không đổi) ---
        await loadPresets();
        const results = await Promise.all([ invoke('deckNames'), invoke('modelNames'), invoke('getTags'), chrome.storage.local.get(['lastUsedDeck', 'lastUsedModel']) ]);
        allDecks = Array.isArray(results[0]) ? results[0] : []; allModels = Array.isArray(results[1]) ? results[1] : []; allTags = Array.isArray(results[2]) ? results[2] : []; const lastSettings = results[3] || {};
        setupAutocomplete('deck-search', 'deck-suggestions', allDecks); setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => { /* ... */ }); const tagsDatalist = document.getElementById('tags-datalist'); tagsDatalist.innerHTML = ''; allTags.forEach(tag => { /* ... */ }); let modelToLoad = null; if (lastSettings.lastUsedDeck && allDecks.includes(lastSettings.lastUsedDeck)) { /* ... */ } if (lastSettings.lastUsedModel && allModels.includes(lastSettings.lastUsedModel)) { /* ... */ } if (modelToLoad) { await createFieldsForModel(modelToLoad); }

        // --- Gán sự kiện (cập nhật) ---
        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);
        document.getElementById('preset-select').addEventListener('change', applyPreset);
        document.getElementById('save-preset-btn').addEventListener('click', saveCurrentPreset);
        document.getElementById('delete-preset-btn').addEventListener('click', deleteCurrentPreset);

        // [MỚI] Gán sự kiện cho thanh công cụ định dạng
        document.getElementById('format-bold').addEventListener('click', () => applyFormat('bold'));
        document.getElementById('format-italic').addEventListener('click', () => applyFormat('italic'));
        document.getElementById('format-underline').addEventListener('click', () => applyFormat('underline'));
        document.getElementById('format-remove').addEventListener('click', () => applyFormat('removeFormat'));
        document.getElementById('format-cloze').addEventListener('click', addCloze);

        // Màu chữ
        const forecolorPicker = document.getElementById('forecolor-picker');
        document.getElementById('format-forecolor').addEventListener('click', () => applyFormat('foreColor', forecolorPicker.value));
        forecolorPicker.addEventListener('input', () => applyFormat('foreColor', forecolorPicker.value)); // Apply màu ngay khi chọn

        // Màu nền
        const backcolorPicker = document.getElementById('backcolor-picker');
        document.getElementById('format-backcolor').addEventListener('click', () => applyFormat('hiliteColor', backcolorPicker.value)); // 'hiliteColor' hoặc 'backColor' tùy browser
        backcolorPicker.addEventListener('input', () => applyFormat('hiliteColor', backcolorPicker.value));

        // [MỚI] Phím tắt
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && e.key === 'b') { // Ctrl+B
                e.preventDefault(); applyFormat('bold');
            } else if (e.ctrlKey && !e.shiftKey && e.key === 'i') { // Ctrl+I
                e.preventDefault(); applyFormat('italic');
            } else if (e.ctrlKey && !e.shiftKey && e.key === 'u') { // Ctrl+U
                e.preventDefault(); applyFormat('underline');
            } else if (e.ctrlKey && e.shiftKey && e.key === 'C') { // Ctrl+Shift+C
                e.preventDefault(); addCloze();
            }
        });


    } catch (error) { /* ... giữ nguyên xử lý lỗi ... */ }
});

// --- Hàm thêm note (addNoteToAnki - không đổi) ---
async function addNoteToAnki() { /* ... giữ nguyên ... */ }

// --- Listener nhận message từ background (không đổi) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { /* ... giữ nguyên ... */ });

