// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {};
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;
let currentAudio = null; // Để quản lý audio đang phát
let activeTextarea = null; // [MỚI] Lưu textarea đang focus

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
            // [MỚI] Listener để lưu textarea đang active
            input.addEventListener('focus', () => { activeTextarea = input; });
            input.addEventListener('blur', () => { /* Có thể đặt activeTextarea = null ở đây nếu muốn */ });
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
        // Thay thế [sound:filename] bằng span để style
        renderedView.innerHTML = textarea.value.replace(/\[sound:(.*?)\]/gi, '<span class="ankivn-sound-placeholder">$1</span>');
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
            // Thêm kiểm tra chế độ view lần nữa
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
             // Kiểm tra trước khi gán innerHTML
             if (currentPreviewContainer && currentPreviewContainer.closest('.field-group') && currentPreviewContainer.closest('.field-group').dataset.viewMode === 'rendered') {
                 currentPreviewContainer.innerHTML = `<span class="preview-error">⚠️ Lỗi tải ảnh "${filename}"</span>`;
             }
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
                 delete button.dataset.playing; // Xóa trạng thái playing
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
                 // Kiểm tra xem nút còn tồn tại và đang ở view rendered không
                if (!button.closest('.field-group') || button.closest('.field-group').dataset.viewMode !== 'rendered') return;

                if (base64Data) {
                    // Xác định mime type cơ bản cho audio
                    let audioMime = 'audio/mpeg'; // Default mp3
                    if (filename.toLowerCase().endsWith('.ogg')) audioMime = 'audio/ogg';
                    else if (filename.toLowerCase().endsWith('.wav')) audioMime = 'audio/wav';
                    // Thêm các loại khác nếu cần

                    audioObject = new Audio(`data:${audioMime};base64,${base64Data}`);
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
                    audioObject.onerror = (e) => {
                         console.error("Audio playback error:", e);
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
                     button.disabled = false; // Cho phép thử lại? Hoặc để im?
                }
            } catch (error) {
                 console.error("Error retrieving/playing audio:", error);
                 showStatus(`Lỗi tải audio "${filename}"`, 'error');
                 button.textContent = '🔊 Lỗi tải';
                 button.disabled = false;
                 // isPlaying vẫn là false
            }
        };
        // Kiểm tra lại trước khi append (phòng trường hợp user chuyển view)
        const finalPreviewContainer = document.getElementById(`preview-${fieldId}`);
         if (finalPreviewContainer && finalPreviewContainer.closest('.field-group') && finalPreviewContainer.closest('.field-group').dataset.viewMode === 'rendered') {
            finalPreviewContainer.appendChild(button);
         }
    }
}


// --- Hàm hiển thị Modal ảnh ---
function showImageModal(src, caption) {
    const modal = document.getElementById("image-preview-modal");
    const modalImg = document.getElementById("modal-image");
    const captionText = document.getElementById("modal-caption");
    const closeBtn = modal.querySelector(".modal-close-btn");

    if (!modal || !modalImg || !captionText || !closeBtn) {
        console.error("Modal elements not found!");
        return;
    }

    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerHTML = caption;

    const closeModal = () => {
        modal.style.display = "none";
        modalImg.src = ""; // Xóa src để tránh hiển thị ảnh cũ khi mở lại
    }

    closeBtn.onclick = closeModal;
    // Đóng khi click bên ngoài ảnh (vào vùng nền mờ)
    modal.onclick = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    }
}

// --- Hàm toggleFieldCollapse ---
async function toggleFieldCollapse(event) {
    // Ngăn collapse khi click vào các nút control bên trong header
    if (event.target.classList.contains('preview-audio-button') ||
        event.target.classList.contains('preview-image') ||
        event.target.classList.contains('btn-toggle-view')) {
        return;
    }

    const fieldHeader = event.currentTarget;
    const fieldGroup = fieldHeader.closest('.field-group');
    if (!fieldGroup) return;

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
        // Trigger autoExpand cho textarea bên trong (nếu có và đang hiển thị)
        const textarea = inputArea.querySelector('.field-input');
        if (textarea && textarea.style.display !== 'none') {
            autoExpandTextarea({ target: textarea });
        }
    }

    // Lưu trạng thái collapse
    const storageKey = `collapsedFields_${currentModelName}`;
    try {
        const currentState = await chrome.storage.local.get(storageKey);
        const updatedState = currentState[storageKey] || {};
        updatedState[fieldName] = newState;
        await chrome.storage.local.set({ [storageKey]: updatedState });
    } catch (error) { console.error('Error saving collapse state:', error); }
}


// --- Các hàm tiện ích (autoExpand, openOptions, generateRandomId, showStatus) ---
function autoExpandTextarea(event) { const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight + 2) + 'px'; }
function openOptionsPage() { chrome.runtime.openOptionsPage(); }
function generateRandomId(length = 14) { let r = ''; const c = '0123456789'; for (let i = 0; i < length; i++) r += c.charAt(Math.floor(Math.random() * 10)); return r; }
function showStatus(message, type = 'info') { const s = document.getElementById('status-message'); s.textContent = message; s.className = `status-message ${type}`; if (statusTimeout) clearTimeout(statusTimeout); if (type === 'success') { statusTimeout = setTimeout(() => { if (s.textContent === message) { s.textContent = ''; s.className = 'status-message'; } statusTimeout = null; }, 4000); } else { statusTimeout = null; } }

// --- Hàm setupAutocomplete ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  const input = document.getElementById(inputId); const container = document.getElementById(containerId); if (!input || !container) { console.error(`Autocomplete elements not found: #${inputId} or #${containerId}`); return; } let currentFocus = -1;
  function showSuggestions(value) { container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== ''); const validSource = Array.isArray(sourceArray) ? sourceArray : []; const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); }); if (suggestions.length === 0) { container.style.display = 'none'; return; } suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) { console.log(`Autocomplete callback: ${item}`); onSelectCallback(item); } }); container.appendChild(suggestionItem); }); container.style.display = 'block'; currentFocus = -1; }
  input.addEventListener('input', () => { showSuggestions(input.value); }); input.addEventListener('focus', () => { showSuggestions(''); }); input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); } function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); } function closeAllLists(elm) { if (elm !== input && !container.contains(elm)) { container.innerHTML = ''; container.style.display = 'none'; } } container.addEventListener('mousedown', (e) => { if (e.target === container) e.preventDefault(); }); document.addEventListener('click', (e) => { closeAllLists(e.target); });
}


// --- Các hàm xử lý Preset ---
async function loadPresets() { const data = await chrome.storage.local.get('allPresets'); allPresets = data.allPresets || {}; const presetSelect = document.getElementById('preset-select'); presetSelect.innerHTML = '<option value="">-- Chọn cấu hình --</option>'; Object.keys(allPresets).sort().forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; presetSelect.appendChild(option); }); }
async function saveCurrentPreset() { const deckName = document.getElementById('deck-search').value.trim(); const modelName = document.getElementById('model-search').value.trim(); const tags = document.getElementById('tags-input').value.trim(); if (!deckName || !modelName) { showStatus('Cần chọn Deck và Note Type.', 'error'); return; } const name = prompt("Nhập tên cấu hình:", ""); if (!name) return; if (allPresets[name] && !confirm(`Cấu hình "${name}" đã có. Ghi đè?`)) return; allPresets[name] = { deckName, modelName, tags }; await chrome.storage.local.set({ allPresets }); await loadPresets(); document.getElementById('preset-select').value = name; showStatus(`Đã lưu cấu hình "${name}".`, 'success'); }
async function deleteCurrentPreset() { const presetSelect = document.getElementById('preset-select'); const name = presetSelect.value; if (!name) { showStatus('Chọn cấu hình để xóa.', 'error'); return; } if (confirm(`Xóa cấu hình "${name}"?`)) { delete allPresets[name]; await chrome.storage.local.set({ allPresets }); await loadPresets(); showStatus(`Đã xóa cấu hình "${name}".`, 'success'); } }
async function applyPreset() { const presetSelect = document.getElementById('preset-select'); const name = presetSelect.value; if (!name) return; const preset = allPresets[name]; if (!preset) return; if (!allDecks.includes(preset.deckName)) { showStatus(`Lỗi: Deck "${preset.deckName}" không tồn tại.`, 'error'); return; } if (!allModels.includes(preset.modelName)) { showStatus(`Lỗi: Note Type "${preset.modelName}" không tồn tại.`, 'error'); return; } document.getElementById('deck-search').value = preset.deckName; document.getElementById('model-search').value = preset.modelName; document.getElementById('tags-input').value = preset.tags; await createFieldsForModel(preset.modelName); showStatus(`Đã tải cấu hình "${name}".`, 'info'); }

// --- Hàm xử lý định dạng ---
function applyFormat(command, value = null) {
    if (!activeTextarea) {
        showStatus("Vui lòng click vào field cần định dạng.", "error");
        return;
    }
    activeTextarea.focus();
    document.execCommand(command, false, value);
    activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- Hàm xử lý Cloze ---
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
    let highestCloze = 0;
    const clozeRegex = /\{\{c(\d+)::/g;
    let match;
    while ((match = clozeRegex.exec(activeTextarea.value)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > highestCloze) highestCloze = num;
    }
    const nextClozeNum = highestCloze + 1;
    const clozeText = `{{c${nextClozeNum}::${selectedText}}}`;
    const before = activeTextarea.value.substring(0, start);
    const after = activeTextarea.value.substring(end);
    activeTextarea.value = before + clozeText + after;
    activeTextarea.selectionStart = start + clozeText.length;
    activeTextarea.selectionEnd = start + clozeText.length;
    activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
}


// --- [CẬP NHẬT] Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) DOM loaded");
    try {
        await loadPresets();
        const results = await Promise.all([ 
            invoke('deckNames'), 
            invoke('modelNames'), 
            invoke('getTags'), 
            chrome.storage.local.get(['lastUsedDeck', 'lastUsedModel']) 
        ]);
        
        allDecks = Array.isArray(results[0]) ? results[0] : [];
        allModels = Array.isArray(results[1]) ? results[1] : [];
        allTags = Array.isArray(results[2]) ? results[2] : [];
        const lastSettings = results[3] || {};

        // [SỬA LỖI] Thêm log để kiểm tra
        console.log("Data loaded:", { decks: allDecks.length, models: allModels.length, tags: allTags.length, lastSettings });
        if (allDecks.length === 0) console.warn("Không tìm thấy Deck nào. Autocomplete sẽ không hoạt động.");
        if (allModels.length === 0) console.warn("Không tìm thấy Model nào. Autocomplete sẽ không hoạt động.");


        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            if (selectedModel && allModels.includes(selectedModel)) {
                 createFieldsForModel(selectedModel);
            } else if (!selectedModel) {
                document.getElementById('fields-container').innerHTML = ''; currentModelName = ''; currentFieldNames = [];
                chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null }).catch(err => console.warn("Could not send empty fields:", err));
            }
        });

        const tagsDatalist = document.getElementById('tags-datalist');
        tagsDatalist.innerHTML = '';
        allTags.forEach(tag => { const o = document.createElement('option'); o.value = tag; tagsDatalist.appendChild(o); });

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
        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);
        document.getElementById('preset-select').addEventListener('change', applyPreset);
        document.getElementById('save-preset-btn').addEventListener('click', saveCurrentPreset);
        document.getElementById('delete-preset-btn').addEventListener('click', deleteCurrentPreset);

        document.getElementById('format-bold').addEventListener('click', () => applyFormat('bold'));
        document.getElementById('format-italic').addEventListener('click', () => applyFormat('italic'));
        document.getElementById('format-underline').addEventListener('click', () => applyFormat('underline'));
        document.getElementById('format-remove').addEventListener('click', () => applyFormat('removeFormat'));
        document.getElementById('format-cloze').addEventListener('click', addCloze);

        const forecolorPicker = document.getElementById('forecolor-picker');
        document.getElementById('format-forecolor').addEventListener('click', () => applyFormat('foreColor', forecolorPicker.value));
        forecolorPicker.addEventListener('input', () => applyFormat('foreColor', forecolorPicker.value));

        const backcolorPicker = document.getElementById('backcolor-picker');
        document.getElementById('format-backcolor').addEventListener('click', () => applyFormat('hiliteColor', backcolorPicker.value));
        backcolorPicker.addEventListener('input', () => applyFormat('hiliteColor', backcolorPicker.value));

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && e.key === 'b') { e.preventDefault(); applyFormat('bold'); }
            else if (e.ctrlKey && !e.shiftKey && e.key === 'i') { e.preventDefault(); applyFormat('italic'); }
            else if (e.ctrlKey && !e.shiftKey && e.key === 'u') { e.preventDefault(); applyFormat('underline'); }
            else if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); addCloze(); } // Thêm key 'c'
        });

    } catch (error) { 
        console.error("Critical error during sidebar init:", error); 
        showStatus('Lỗi kết nối Anki: ' + error.message, 'error'); 
        // [SỬA LỖI] Vô hiệu hóa TOÀN BỘ UI khi lỗi
        document.getElementById('deck-search').disabled = true;
        document.getElementById('model-search').disabled = true;
        document.getElementById('add-note-btn').disabled = true;
        document.getElementById('preset-select').disabled = true;
        document.getElementById('save-preset-btn').disabled = true;
        document.getElementById('delete-preset-btn').disabled = true;
        document.getElementById('tags-input').disabled = true;
        const toolbar = document.getElementById('format-toolbar');
        if (toolbar) toolbar.querySelectorAll('button, input').forEach(el => el.disabled = true);
    }
});

// --- Hàm thêm note (addNoteToAnki) ---
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
        const textareas = document.querySelectorAll('#fields-container .field-input');

        textareas.forEach(input => {
             const fieldGroup = input.closest('.field-group:not(.field-hidden-by-setting)');
             if (fieldGroup) { // Chỉ lấy field không bị ẩn
                const fieldName = fieldGroup.dataset.fieldName;
                if (fieldName) {
                    const value = input.value; // Lấy giá trị từ textarea
                    fields[fieldName] = value;
                    if (value.trim()) hasContent = true;
                }
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
            showStatus('Vui lòng nhập nội dung.', 'error'); return;
        }

        const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
        const params = { note: { deckName, modelName, fields, tags: tagsArray } };

        const result = await invoke('addNote', params);
        if (result === null) throw new Error("AnkiConnect returned null (trùng lặp?).");

        showStatus('Thêm thành công! Note ID: ' + result, 'success');
        await chrome.storage.local.set({ lastUsedDeck: deckName, lastUsedModel: modelName });

        const stickyFieldsKey = `stickyFields_${modelName}`;
        settings = await chrome.storage.local.get(stickyFieldsKey);
        const stickyFields = settings[stickyFieldsKey] || {};

        document.querySelectorAll('.field-input').forEach(input => {
            const fieldName = input.id.replace('field-', '');
            if (!stickyFields[fieldName]) {
                input.value = '';
                // [SỬA LỖI] Cập nhật cả 3 hàm sau khi xóa
                autoExpandTextarea({ target: input });
                updateRenderedView(input);
                updateMediaPreview(input);
            }
        });
    } catch (error) {
        console.error('Error adding note:', error);
        showStatus('Lỗi thêm note: ' + (error.message || 'Không xác định'), 'error');
    }
}

// --- Listener nhận message từ background ---
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
             targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));

             const fieldGroup = targetTextarea.closest('.field-group');
             if (fieldGroup) {
                 if (fieldGroup.dataset.viewMode === 'code') {
                     toggleFieldView(fieldGroup);
                 } else {
                     // [SỬA LỖI] Chỉ gọi updateMediaPreview là đủ (vì 'input' event đã gọi updateRenderedView)
                     updateMediaPreview(targetTextarea); 
                 }
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
    return true; // Keep channel open for async response
});

