// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {};
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;
let currentAudio = null; // Để quản lý audio đang phát

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
            fieldGroup.dataset.viewMode = isCodeViewDefault ? 'code' : 'rendered'; // Lưu trạng thái view

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

            // Nút Show Code/Rendered
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
                 updateRenderedView(input); // Cập nhật rendered view khi gõ
                 updateMediaPreview(input); // Cập nhật preview media khi gõ
            });
            input.style.display = isCodeViewDefault ? '' : 'none'; // Ẩn/hiện theo view mode
            inputContainer.appendChild(input);

             // Rendered View Div
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
            updateRenderedView(input); // Cập nhật lần đầu
            updateMediaPreview(input); // Cập nhật preview lần đầu
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

// --- Hàm chuyển đổi View Mode (Code/Rendered) ---
function toggleFieldView(fieldGroup) {
    const fieldId = `field-${fieldGroup.dataset.fieldName}`;
    const textarea = fieldGroup.querySelector(`#${fieldId}`);
    const renderedView = fieldGroup.querySelector(`#rendered-${fieldId}`);
    const previewContainer = fieldGroup.querySelector(`#preview-${fieldId}`);
    const toggleBtn = fieldGroup.querySelector('.btn-toggle-view');

    if (!textarea || !renderedView || !previewContainer || !toggleBtn) {
        console.error("Elements for view toggle not found in field group:", fieldGroup);
        return;
    }

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

// --- Hàm cập nhật nội dung Rendered View ---
function updateRenderedView(textarea) {
    const fieldId = textarea.id;
    const renderedView = document.getElementById(`rendered-${fieldId}`);
    if (renderedView) {
        // Rất cơ bản, không an toàn nếu HTML có script độc hại
        // Cần thư viện sanitize nếu extension xử lý HTML từ nguồn không tin cậy
        // Hiện tại chỉ là HTML từ người dùng nhập hoặc từ context menu (ảnh/sound tag)
        renderedView.innerHTML = textarea.value;
    }
}


// --- Hàm cập nhật Media Preview ---
async function updateMediaPreview(textarea) {
    const fieldId = textarea.id;
    const previewContainer = document.getElementById(`preview-${fieldId}`);
    if (!previewContainer) return;

    // Chỉ hiển thị preview nếu đang ở chế độ 'rendered'
    const fieldGroup = textarea.closest('.field-group');
    if (!fieldGroup || fieldGroup.dataset.viewMode !== 'rendered') {
        previewContainer.innerHTML = ''; // Xóa preview nếu không ở chế độ rendered
        previewContainer.style.display = 'none';
        return;
    }
    previewContainer.style.display = ''; // Hiển thị lại container nếu đang ở rendered

    previewContainer.innerHTML = ''; // Xóa preview cũ
    const content = textarea.value;

    // Tìm thẻ img đầu tiên
    const imgMatch = content.match(/<img src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
        const filename = imgMatch[1];
        // Hiển thị loading
        previewContainer.innerHTML = `<span class="preview-loading">⏳ Đang tải ảnh "${filename}"...</span>`;
        try {
            const base64Data = await invoke('retrieveMediaFile', { filename: filename });
            // Kiểm tra xem preview container còn tồn tại không (phòng trường hợp user chuyển view nhanh)
            const currentPreviewContainer = document.getElementById(`preview-${fieldId}`);
            if (!currentPreviewContainer || !currentPreviewContainer.closest('.field-group') || currentPreviewContainer.closest('.field-group').dataset.viewMode !== 'rendered') return;

            if (base64Data) {
                currentPreviewContainer.innerHTML = ''; // Xóa loading
                const img = document.createElement('img');
                // Thử đoán mime type cơ bản
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
             const currentPreviewContainer = document.getElementById(`preview-${fieldId}`);
             if (currentPreviewContainer) currentPreviewContainer.innerHTML = `<span class="preview-error">⚠️ Lỗi tải ảnh "${filename}"</span>`;
        }
    }

    // Tìm thẻ sound đầu tiên
    const soundMatch = content.match(/\[sound:(.*?)\]/i);
    if (soundMatch) {
        const filename = soundMatch[1];
        const button = document.createElement('button');
        button.className = 'btn-secondary preview-audio-button';
        button.textContent = '🔊 Nghe';
        button.title = filename;
        let isPlaying = false; // Trạng thái của nút này
        let audioObject = null; // Lưu trữ đối tượng audio

        button.onclick = async (event) => {
            event.stopPropagation();

            if (isPlaying && audioObject) { // Nếu đang phát -> dừng
                audioObject.pause();
                audioObject.currentTime = 0;
                button.textContent = '🔊 Nghe';
                isPlaying = false;
                if (currentAudio === audioObject) currentAudio = null; // Hủy nếu là audio hiện tại
                audioObject = null;
                return;
            }

            // Dừng audio khác đang phát (nếu có)
             if (currentAudio) {
                 currentAudio.pause();
                 currentAudio.currentTime = 0;
                 // Tìm nút cũ và reset text/state
                 const oldButton = document.querySelector(`.preview-audio-button[data-playing="true"]`);
                 if (oldButton) {
                     oldButton.textContent = '🔊 Nghe';
                     oldButton.disabled = false;
                     delete oldButton.dataset.playing;
                 }
                 currentAudio = null;
            }


            button.disabled = true; button.textContent = '🔊 Đang tải...';
            try {
                const base64Data = await invoke('retrieveMediaFile', { filename: filename });
                 // Kiểm tra xem nút còn tồn tại không
                if (!button.closest('.field-group') || button.closest('.field-group').dataset.viewMode !== 'rendered') return;

                if (base64Data) {
                    audioObject = new Audio(`data:audio/mpeg;base64,${base64Data}`); // Giả định mp3
                    currentAudio = audioObject; // Lưu lại audio đang phát
                    button.dataset.playing = "true"; // Đánh dấu nút đang phát
                    audioObject.play();
                    button.textContent = '🔊 Dừng'; // Đổi thành nút Dừng
                    button.disabled = false; // Cho phép nhấn Dừng
                    isPlaying = true;

                    audioObject.onended = () => {
                        button.textContent = '🔊 Nghe';
                        button.disabled = false;
                        isPlaying = false;
                        if (currentAudio === audioObject) currentAudio = null;
                        delete button.dataset.playing;
                        audioObject = null;
                    };
                    audioObject.onerror = () => {
                         showStatus(`Lỗi phát audio "${filename}"`, 'error');
                         button.textContent = '🔊 Lỗi';
                         button.disabled = false;
                         isPlaying = false;
                         if (currentAudio === audioObject) currentAudio = null;
                         delete button.dataset.playing;
                         audioObject = null;
                    }
                } else {
                    showStatus(`Audio "${filename}" không tìm thấy!`, 'error');
                     button.textContent = '🔊 Không thấy';
                     // Không disable nút này
                }
            } catch (error) {
                 console.error("Error retrieving/playing audio:", error);
                 showStatus(`Lỗi tải audio "${filename}"`, 'error');
                 button.textContent = '🔊 Lỗi tải';
                 button.disabled = false;
                 // isPlaying vẫn là false
            }
        };
        previewContainer.appendChild(button);
    }
}


// --- Hàm hiển thị Modal ảnh (không đổi) ---
function showImageModal(src, caption) { /* ... giữ nguyên ... */ }

// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên ... */ }

// --- Các hàm tiện ích (autoExpand, openOptions, generateRandomId, showStatus) không đổi ---
function autoExpandTextarea(event) { /* ... giữ nguyên ... */ }
function openOptionsPage() { /* ... giữ nguyên ... */ }
function generateRandomId(length = 14) { /* ... giữ nguyên ... */ }
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */ }

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
async function addNoteToAnki() { /* ... giữ nguyên ... */ }


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

             // Nối vào nội dung cũ
             targetTextarea.value += (targetTextarea.value ? '\n' : '') + finalContentToInsert;

             // Trigger input event để cập nhật cả rendered view và preview
             targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));

             const fieldGroup = targetTextarea.closest('.field-group');
             if (fieldGroup) {
                 // Chuyển sang chế độ Rendered View nếu đang ở Code View
                 if (fieldGroup.dataset.viewMode === 'code') {
                     toggleFieldView(fieldGroup);
                 } else {
                     // Nếu đã ở Rendered view, cần gọi lại updateMediaPreview thủ công
                     // vì dispatchEvent('input') không đủ trigger update nếu không có thay đổi text
                     updateMediaPreview(targetTextarea); // [SỬA LỖI] Gọi lại preview
                 }
                 // Mở field nếu đang collapse
                 if (fieldGroup.classList.contains('collapsed')) {
                     const header = fieldGroup.querySelector('.field-header');
                     if(header) header.click();
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

