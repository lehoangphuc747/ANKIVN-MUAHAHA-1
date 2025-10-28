// popup.js
let allDecks = [];
let allModels = [];
let allTags = [];
let allPresets = {};
let currentModelName = '';
let currentFieldNames = [];
let statusTimeout = null;
let currentAudio = null; // Để quản lý audio đang phát
let activeElement = null; // Lưu element đang focus (div hoặc textarea)
let globalEditorMode = 'normal'; // Chế độ editor mặc định

// --- Hàm invoke (Kết nối AnkiConnect) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, version: 6, params: params })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        // Ném lỗi nếu AnkiConnect trả về lỗi
        if (Object.prototype.hasOwnProperty.call(result, 'error') && result.error) {
            throw new Error(result.error);
        }
        return result.result;
    } catch (error) {
        console.error(`Anki-Connect error (${action}):`, error);
        // Ném lỗi để hàm gọi có thể bắt và xử lý riêng
        throw error;
    }
}

// --- Hàm tạo Fields ---
async function createFieldsForModel(modelName) {
    console.log("Creating fields for model:", modelName);
    currentModelName = modelName;
    const fieldsContainer = document.getElementById('fields-container');
    fieldsContainer.innerHTML = '<p>Đang tải fields...</p>'; // Thông báo đang tải

    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if (!Array.isArray(fieldNames)) throw new Error("Received invalid data for field names.");
        currentFieldNames = fieldNames;
        console.log("Fields received:", currentFieldNames);

        // Gửi danh sách fields cho background script để cập nhật context menu
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", modelName: modelName, fields: fieldNames })
              .catch(err => console.warn("Could not send fields to background:", err));

        fieldsContainer.innerHTML = ''; // Xóa thông báo "Đang tải"

        // Lấy cài đặt ẩn/thu gọn từ storage
        const settingsKeys = [`hiddenFields_${modelName}`, `collapsedFields_${modelName}`];
        const settings = await chrome.storage.local.get(settingsKeys);
        const hiddenFields = settings[settingsKeys[0]] || {};
        const collapsedFields = settings[settingsKeys[1]] || {};
        console.log("Retrieved settings:", { hiddenFields, collapsedFields });

        if (fieldNames.length === 0) {
            fieldsContainer.innerHTML = '<p><i>Note Type này không có field nào.</i></p>';
            return;
        }

        // Tạo HTML cho từng field
        fieldNames.forEach(fieldName => {
            const safeFieldName = fieldName.replace(/\s+/g, '-'); // Tạo id an toàn
            const fieldIdBase = `field-${safeFieldName}`;
            const divId = `${fieldIdBase}-div`;
            const textareaId = `${fieldIdBase}-textarea`;
            const previewId = `preview-${fieldIdBase}`;

            const isHidden = hiddenFields[fieldName] || false;
            const isCollapsed = collapsedFields[fieldName] || false;

            const fieldGroup = document.createElement('div');
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            fieldGroup.dataset.fieldName = fieldName;
            fieldGroup.dataset.editorMode = globalEditorMode; // Đặt mode ban đầu

            // --- Field Header ---
            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';
            fieldHeader.addEventListener('click', toggleFieldCollapse); // Listener collapse

            const toggleCollapse = document.createElement('span');
            toggleCollapse.className = 'collapse-toggle';
            toggleCollapse.textContent = isCollapsed ? '▶' : '🔽';
            toggleCollapse.style.pointerEvents = 'none'; // Không bắt sự kiện click trên icon

            const label = document.createElement('label');
            label.textContent = fieldName;
            label.title = fieldName; // Hiển thị tên đầy đủ khi hover
            label.style.pointerEvents = 'none'; // Không bắt sự kiện click trên label
            label.style.flexGrow = '1'; // Cho label chiếm hết phần còn lại

            fieldHeader.appendChild(toggleCollapse);
            fieldHeader.appendChild(label);
            fieldGroup.appendChild(fieldHeader);
            // --- Hết Header ---

            // --- Field Input Area (chứa div, textarea, preview) ---
            const inputContainer = document.createElement('div');
            inputContainer.className = 'field-input-area';
            if (isCollapsed) inputContainer.style.display = 'none'; // Ẩn ban đầu nếu collapsed

            // Div ContentEditable (Normal Mode)
            const inputDiv = document.createElement('div');
            inputDiv.id = divId;
            inputDiv.contentEditable = true;
            inputDiv.className = 'form-control field-input-div';
            inputDiv.dataset.placeholder = `Nội dung ${fieldName}...`; // Dùng CSS để hiển thị placeholder
            inputDiv.style.display = globalEditorMode === 'normal' ? '' : 'none'; // Hiển thị/ẩn ban đầu
            inputDiv.addEventListener('input', handleInputEvent);
            inputDiv.addEventListener('focus', handleFocusEvent);
            inputDiv.addEventListener('blur', handleBlurEvent);
            inputContainer.appendChild(inputDiv);

            // Textarea (Source Mode)
            const inputTextarea = document.createElement('textarea');
            inputTextarea.id = textareaId;
            inputTextarea.className = 'form-control field-input-textarea';
            inputTextarea.placeholder = `HTML/Source ${fieldName}...`;
            inputTextarea.rows = 3;
            inputTextarea.style.display = globalEditorMode === 'source' ? '' : 'none'; // Hiển thị/ẩn ban đầu
            inputTextarea.addEventListener('input', handleInputEvent);
            inputTextarea.addEventListener('focus', handleFocusEvent);
            inputTextarea.addEventListener('blur', handleBlurEvent);
            inputContainer.appendChild(inputTextarea);

            // Media Preview Container
            const previewContainer = document.createElement('div');
            previewContainer.id = previewId;
            previewContainer.className = 'media-preview-container';
            previewContainer.style.display = globalEditorMode === 'normal' ? '' : 'none'; // Chỉ hiển thị ở Normal mode
            inputContainer.appendChild(previewContainer);

            fieldGroup.appendChild(inputContainer);
            fieldsContainer.appendChild(fieldGroup);

            // Kích hoạt autoExpand nếu đang ở Source Mode
            if (globalEditorMode === 'source') {
                 autoExpandTextarea({ target: inputTextarea });
            }
            // Update preview lần đầu nếu đang ở Normal Mode
            if (globalEditorMode === 'normal') {
                 updateMediaPreviewFromContent(inputDiv.innerHTML, previewId);
            }
        });
        console.log("Fields created successfully.");

    } catch (error) {
        console.error('Error creating/loading fields:', error);
        showStatus(`Lỗi tải fields: ${error.message}`, 'error');
        currentModelName = ''; // Reset model name
        currentFieldNames = []; // Reset fields
        fieldsContainer.innerHTML = `<p class="status-message error"><i>Lỗi tải fields. Vui lòng thử lại hoặc kiểm tra Anki.</i></p>`;
        // Gửi danh sách trống cho background
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null })
              .catch(err => console.warn("Could not send empty fields to background:", err));
    }
}

// --- Hàm xử lý sự kiện input chung ---
function handleInputEvent(event) {
    const target = event.target;
    const fieldGroup = target.closest('.field-group');
    if (!fieldGroup) return;

    const fieldName = fieldGroup.dataset.fieldName;
    const safeFieldName = fieldName.replace(/\s+/g, '-');
    const fieldIdBase = `field-${safeFieldName}`;
    const divId = `${fieldIdBase}-div`;
    const textareaId = `${fieldIdBase}-textarea`;
    const previewId = `preview-${fieldIdBase}`;

    const divElement = fieldGroup.querySelector(`#${divId}`);
    const textareaElement = fieldGroup.querySelector(`#${textareaId}`);

    if (target.id === divId) { // Input từ div contenteditable
        syncDivToTextarea(divElement, textareaElement);
        updateMediaPreviewFromContent(divElement.innerHTML, previewId);
        // ensureContentEditableKeepsFocus(divElement); // Có thể gây lỗi nhảy con trỏ
    } else if (target.id === textareaId) { // Input từ textarea
        autoExpandTextarea({ target: textareaElement });
        syncTextareaToDiv(textareaElement, divElement);
        // Không update preview từ textarea
    }
}

// --- Hàm xử lý sự kiện focus/blur ---
function handleFocusEvent(event) {
    activeElement = event.target; // Cập nhật element đang focus
    console.log("Focus on:", activeElement.id);
}
function handleBlurEvent(event) {
    const target = event.target;
    // Đồng bộ lần cuối khi mất focus khỏi div (đảm bảo textarea có nội dung mới nhất)
    if (target.classList.contains('field-input-div')) {
        const fieldGroup = target.closest('.field-group');
        if (fieldGroup) {
            const fieldName = fieldGroup.dataset.fieldName;
            const safeFieldName = fieldName.replace(/\s+/g, '-');
            const textareaId = `field-${safeFieldName}-textarea`;
            const textareaElement = fieldGroup.querySelector(`#${textareaId}`);
            syncDivToTextarea(target, textareaElement);
        }
    }
    // Bỏ activeElement nếu element mất focus chính là nó
    if (activeElement === target) {
        console.log("Blur from:", activeElement.id);
        activeElement = null;
    }
}

// --- Hàm đồng bộ nội dung ---
function syncDivToTextarea(divElement, textareaElement) {
    if (divElement && textareaElement && textareaElement.value !== divElement.innerHTML) {
        // console.log("Syncing div to textarea");
        textareaElement.value = divElement.innerHTML;
        // Trigger input event cho textarea để autoExpand nếu cần (tránh lặp vô hạn)
        // textareaElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
}
function syncTextareaToDiv(textareaElement, divElement) {
    if (textareaElement && divElement && divElement.innerHTML !== textareaElement.value) {
        // console.log("Syncing textarea to div");
        divElement.innerHTML = textareaElement.value;
        // Trigger input event cho div để update preview nếu đang ở normal mode
        if (globalEditorMode === 'normal') {
            divElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
    }
}

// --- Hàm chuyển chế độ global ---
function setGlobalEditorMode(newMode) {
    if (newMode !== 'normal' && newMode !== 'source') return;
    if (newMode === globalEditorMode) return; // Không làm gì nếu đã ở mode đó

    console.log("Switching global editor mode to:", newMode);
    globalEditorMode = newMode;
    document.body.dataset.editorMode = newMode; // Cập nhật attribute trên body

    // Cập nhật trạng thái nút bấm
    document.getElementById('mode-normal-btn').classList.toggle('active', newMode === 'normal');
    document.getElementById('mode-source-btn').classList.toggle('active', newMode === 'source');
    // CSS sẽ tự động disable toolbar dựa trên `body[data-editor-mode="source"]`

    // Lưu element đang focus trước khi chuyển đổi
    const focusedElement = activeElement;
    let focusFieldName = null;
    if (focusedElement) {
        focusFieldName = focusedElement.closest('.field-group')?.dataset.fieldName;
    }

    // Duyệt qua tất cả các field và chuyển đổi hiển thị
    document.querySelectorAll('.field-group').forEach(fieldGroup => {
        const fieldName = fieldGroup.dataset.fieldName;
        const safeFieldName = fieldName.replace(/\s+/g, '-');
        const fieldIdBase = `field-${safeFieldName}`;
        const divId = `${fieldIdBase}-div`;
        const textareaId = `${fieldIdBase}-textarea`;
        const previewId = `preview-${fieldIdBase}`;

        const divElement = fieldGroup.querySelector(`#${divId}`);
        const textareaElement = fieldGroup.querySelector(`#${textareaId}`);
        const previewContainer = fieldGroup.querySelector(`#${previewId}`);

        if (divElement && textareaElement && previewContainer) {
            fieldGroup.dataset.editorMode = newMode; // Cập nhật data attribute của field

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

    // Focus lại element tương ứng nếu có
    if (focusFieldName) {
        const safeFocusFieldName = focusFieldName.replace(/\s+/g, '-');
        const focusFieldIdBase = `field-${safeFocusFieldName}`;
        const newFocusElementId = newMode === 'normal' ? `${focusFieldIdBase}-div` : `${focusFieldIdBase}-textarea`;
        const newFocusElement = document.getElementById(newFocusElementId);
        if (newFocusElement) {
            newFocusElement.focus();
            activeElement = newFocusElement; // Cập nhật lại activeElement
            console.log("Refocused on:", newFocusElement.id);
        } else {
             activeElement = null; // Mất focus nếu không tìm thấy element mới
        }
    } else {
        activeElement = null; // Clear active element nếu không có focus trước đó
    }
}


// --- Hàm cập nhật Media Preview (Chỉ chạy ở Normal Mode) ---
async function updateMediaPreviewFromContent(content, previewId) {
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) {
        // console.warn("Preview container not found:", previewId);
        return;
    }

    // Xóa và ẩn nếu không phải Normal mode
    if (globalEditorMode !== 'normal') {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
        return;
    }
    previewContainer.style.display = ''; // Đảm bảo hiển thị nếu đang ở normal mode
    previewContainer.innerHTML = ''; // Xóa preview cũ

    // Tìm thẻ img đầu tiên
    const imgMatch = content.match(/<img src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
        const filename = imgMatch[1];
        // Bỏ qua nếu là data URI (đã là base64)
        if (filename.startsWith('data:')) {
            const img = document.createElement('img');
            img.src = filename;
            img.alt = "Image Preview";
            img.className = 'preview-image';
            img.title = `Click để xem lớn hơn`;
            img.addEventListener('click', () => showImageModal(img.src, "Image Preview"));
            previewContainer.appendChild(img);
        } else {
            // Tải base64 từ Anki nếu là tên file
            previewContainer.innerHTML = `<span class="preview-loading">⏳ Đang tải ảnh "${filename}"...</span>`;
            try {
                const base64Data = await invoke('retrieveMediaFile', { filename: filename });
                const currentPreviewContainer = document.getElementById(previewId); // Lấy lại container phòng trường hợp bị xóa/thay đổi
                if (!currentPreviewContainer || globalEditorMode !== 'normal') return; // Kiểm tra lại mode và container

                if (base64Data) {
                    currentPreviewContainer.innerHTML = ''; // Xóa loading
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
                    currentPreviewContainer.innerHTML = `<span class="preview-error">⚠️ Lỗi tải ảnh "${filename}": ${error.message}</span>`;
                }
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
        let isPlaying = false;
        let audioObject = null; // Lưu trữ thẻ <audio>

        button.onclick = async (event) => {
            event.stopPropagation(); // Ngăn sự kiện click lan ra header (gây collapse)
            if (currentAudio && currentAudio !== audioObject) {
                currentAudio.pause(); // Dừng audio khác nếu đang phát
            }

            if (isPlaying) {
                if (audioObject) audioObject.pause();
            } else {
                button.textContent = '⏳ Tải...';
                button.disabled = true;
                try {
                    const base64Data = await invoke('retrieveMediaFile', { filename: filename });
                    const currentPrevContainer = document.getElementById(previewId); // Re-fetch container
                    if (!currentPrevContainer || globalEditorMode !== 'normal') return; // Re-check mode

                    if (base64Data) {
                        if (!audioObject) { // Tạo thẻ audio nếu chưa có
                             audioObject = new Audio();
                             let mimeType = 'audio/mpeg'; // Mặc định mp3
                             if (filename.toLowerCase().endsWith('.ogg')) mimeType = 'audio/ogg';
                             else if (filename.toLowerCase().endsWith('.wav')) mimeType = 'audio/wav';
                             // Thêm các mime type khác nếu cần
                             audioObject.src = `data:${mimeType};base64,${base64Data}`;
                             audioObject.onplay = () => {
                                 isPlaying = true; button.textContent = '❚❚ Dừng'; currentAudio = audioObject; button.disabled = false;
                             };
                             audioObject.onpause = () => {
                                 isPlaying = false; button.textContent = '🔊 Nghe'; audioObject.currentTime = 0; if (currentAudio === audioObject) currentAudio = null; button.disabled = false;
                             };
                             audioObject.onerror = (e) => {
                                 console.error("Audio playback error:", e);
                                 showStatus(`Lỗi phát audio "${filename}"`, 'error');
                                 isPlaying = false; button.textContent = '⚠️ Lỗi'; button.disabled = true; if (currentAudio === audioObject) currentAudio = null;
                             };
                             audioObject.onended = () => { // Tự reset khi phát xong
                                 isPlaying = false; button.textContent = '🔊 Nghe'; if (currentAudio === audioObject) currentAudio = null; button.disabled = false;
                             }
                        }
                        audioObject.play();
                    } else {
                        throw new Error("File audio không tìm thấy.");
                    }
                } catch (error) {
                    console.error("Error retrieving/playing audio preview:", error);
                     const currentPrevContainer = document.getElementById(previewId);
                     if (currentPrevContainer && globalEditorMode === 'normal') {
                         currentPrevContainer.innerHTML = `<span class="preview-error">⚠️ Lỗi tải audio "${filename}": ${error.message}</span>`;
                     }
                    isPlaying = false; button.textContent = '⚠️ Lỗi'; button.disabled = true;
                }
            }
        };
        // Thêm nút vào container (kiểm tra lại mode)
        const finalPreviewContainer = document.getElementById(previewId);
        if (finalPreviewContainer && globalEditorMode === 'normal') {
            finalPreviewContainer.appendChild(button);
        }
    }
}


// --- Hàm hiển thị Modal ảnh ---
function showImageModal(src, caption) {
    const modal = document.getElementById("image-preview-modal");
    const modalImg = document.getElementById("modal-image");
    const captionText = document.getElementById("modal-caption");
    const span = modal.querySelector(".modal-close-btn");

    modal.style.display = "block";
    modalImg.src = src;
    captionText.textContent = caption || "Image Preview";

    span.onclick = function() {
        modal.style.display = "none";
    }
    // Đóng modal khi click ra ngoài ảnh
    modal.onclick = function(event) {
        if (event.target === modal || event.target === captionText) {
             modal.style.display = "none";
        }
    }
}

// --- Hàm toggleFieldCollapse ---
async function toggleFieldCollapse(event) {
    const fieldHeader = event.currentTarget;
    const fieldGroup = fieldHeader.closest('.field-group');
    if (!fieldGroup) return;

    // Ngăn collapse khi click vào các nút control bên trong header (nếu có)
    // Hoặc khi click vào preview media
    if (event.target !== fieldHeader && !event.target.classList.contains('collapse-toggle') && !event.target.closest('label')) {
       // console.log("Click inside header, preventing collapse.");
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
        // Trigger autoExpand cho textarea nếu đang ở source mode và được mở ra
        if (globalEditorMode === 'source') {
            const safeFieldName = fieldName.replace(/\s+/g, '-');
            const textareaId = `field-${safeFieldName}-textarea`;
            const textarea = inputArea.querySelector(`#${textareaId}`);
            if (textarea) {
                autoExpandTextarea({ target: textarea });
            }
        }
    }

    // Lưu trạng thái collapse vào storage
    const storageKey = `collapsedFields_${currentModelName}`;
    try {
        const currentState = await chrome.storage.local.get(storageKey);
        const updatedState = currentState[storageKey] || {};
        updatedState[fieldName] = newState;
        await chrome.storage.local.set({ [storageKey]: updatedState });
        // console.log("Saved collapse state:", { [storageKey]: updatedState });
    } catch (error) {
        console.error('Error saving collapse state:', error);
    }
}


// --- Các hàm tiện ích ---
function autoExpandTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto'; // Reset height để tính lại scrollHeight
    textarea.style.height = (textarea.scrollHeight + 2) + 'px'; // +2 để tránh scrollbar nhỏ
}
function openOptionsPage() {
    chrome.runtime.openOptionsPage();
}
function generateRandomId(length = 14) {
    let result = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`; // Reset class
    statusElement.style.display = 'block'; // Ensure visible

    if (statusTimeout) clearTimeout(statusTimeout);

    if (type === 'success') {
        statusTimeout = setTimeout(() => {
            if (statusElement.textContent === message) { // Chỉ ẩn nếu nội dung chưa bị thay đổi
                statusElement.textContent = '';
                statusElement.className = 'status-message';
                statusElement.style.display = 'none';
            }
            statusTimeout = null;
        }, 4000); // Tự ẩn sau 4 giây
    } else {
        statusTimeout = null; // Không tự ẩn lỗi hoặc info
    }
}

// --- Hàm setupAutocomplete ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  console.log(`Setting up autocomplete for input: #${inputId} with ${sourceArray ? sourceArray.length : 0} items`);
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) { console.error(`Autocomplete setup failed: Cannot find elements #${inputId} or #${containerId}`); return; }
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = '';
    const valLower = value.toLowerCase();
    const keywords = valLower.split(' ').filter(k => k.trim() !== ''); // Tách keywords
    const validSource = Array.isArray(sourceArray) ? sourceArray : []; // Đảm bảo là mảng

    const suggestions = validSource.filter(item => {
        if (typeof item !== 'string') return false;
        const target = item.toLowerCase();
        // Kiểm tra xem target có chứa TẤT CẢ các keywords không
        return keywords.every(keyword => target.includes(keyword));
    });

    if (suggestions.length === 0) {
      container.style.display = 'none';
      return;
    }

    suggestions.forEach((item, index) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.textContent = item;
      suggestionItem.addEventListener('click', () => {
        console.log(`Suggestion clicked: ${item} for #${inputId}`);
        input.value = item; // Điền giá trị
        closeAllLists();    // Đóng danh sách
        // Trigger input event để xử lý logic sau khi chọn (ví dụ: load fields)
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (onSelectCallback) {
            onSelectCallback(item); // Gọi callback nếu có
        }
      });
      container.appendChild(suggestionItem);
    });
    container.style.display = 'block';
    currentFocus = -1; // Reset focus index
  }

  input.addEventListener('input', () => {
    // console.log(`Input event on #${inputId}: ${input.value}`);
    showSuggestions(input.value);
    // Gọi callback ngay khi input thay đổi (nếu cần xử lý autocomplete tức thì)
    // if (onSelectCallback) onSelectCallback(input.value); // Bỏ comment nếu muốn
  });

  input.addEventListener('focus', () => {
    console.log(`Focus event on #${inputId}`);
    showSuggestions(''); // Hiển thị tất cả khi focus (nếu danh sách không quá dài)
  });

  input.addEventListener('keydown', (e) => {
    let items = container.getElementsByClassName('suggestion-item');
    if (items.length === 0) return;
    // console.log(`Keydown event on #${inputId}: ${e.key}`);
    if (e.key === 'ArrowDown') { // Down arrow
      e.preventDefault();
      currentFocus++;
      if (currentFocus >= items.length) currentFocus = 0;
      addActive(items);
    } else if (e.key === 'ArrowUp') { // Up arrow
      e.preventDefault();
      currentFocus--;
      if (currentFocus < 0) currentFocus = items.length - 1;
      addActive(items);
    } else if (e.key === 'Enter') { // Enter
      e.preventDefault(); // Ngăn submit form (nếu có)
      if (currentFocus > -1) {
        items[currentFocus].click(); // Simulate click on the active item
      } else if (items.length > 0 && input.value.trim() !== '') {
         // Nếu không có item nào được chọn nhưng có suggestion và input có giá trị
         // -> chọn suggestion đầu tiên khớp hoặc điền giá trị hiện tại?
         // Tạm thời: Không làm gì, để user tự click hoặc chọn lại
         console.log("Enter pressed with no active suggestion");
      }
    } else if (e.key === 'Escape') { // Escape
      closeAllLists();
    }
  });

  function addActive(items) {
    if (!items || items.length === 0) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active');
    // Scroll into view if needed
    items[currentFocus].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
    }
  }

  function closeAllLists() {
    // console.log(`Closing suggestions for #${inputId}`);
    container.innerHTML = '';
    container.style.display = 'none';
  }

  // Ngăn input mất focus khi click vào scrollbar của suggestions
  container.addEventListener('mousedown', (e) => {
      if (e.target === container) { // Chỉ ngăn khi click trực tiếp vào container (scrollbar)
          e.preventDefault();
      }
  });

  // Đóng suggestions khi click ra ngoài
  document.addEventListener('click', (e) => {
    // Đóng nếu click không phải vào input và không phải vào container suggestions
    if (e.target !== input && !container.contains(e.target)) {
      closeAllLists();
    }
  });
}


// --- Các hàm xử lý Preset ---
async function loadPresets() {
    const presetSelect = document.getElementById('preset-select');
    presetSelect.innerHTML = '<option value="">-- Chọn cấu hình --</option>'; // Reset
    try {
        const data = await chrome.storage.local.get(['presets']);
        allPresets = data.presets || {};
        console.log("Presets loaded:", Object.keys(allPresets).length);
        for (const name in allPresets) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            presetSelect.appendChild(option);
        }
    } catch (error) {
        console.error("Error loading presets:", error);
        showStatus("Lỗi tải cấu hình.", 'error');
    }
}
async function saveCurrentPreset() {
    const deckName = document.getElementById('deck-search').value.trim();
    const modelName = document.getElementById('model-search').value.trim();
    const tags = document.getElementById('tags-input').value.trim();

    if (!deckName || !modelName) {
        showStatus("Vui lòng chọn Deck và Note Type trước khi lưu.", 'error');
        return;
    }

    const presetName = prompt("Nhập tên cho cấu hình này:", `${deckName} - ${modelName}`);
    if (!presetName) return; // User cancelled

    allPresets[presetName] = { deckName, modelName, tags };

    try {
        await chrome.storage.local.set({ presets: allPresets });
        showStatus(`Đã lưu cấu hình "${presetName}".`, 'success');
        await loadPresets(); // Tải lại danh sách dropdown
        document.getElementById('preset-select').value = presetName; // Chọn preset vừa lưu
    } catch (error) {
        console.error("Error saving preset:", error);
        showStatus("Lỗi lưu cấu hình.", 'error');
    }
}
async function deleteCurrentPreset() {
    const presetSelect = document.getElementById('preset-select');
    const presetName = presetSelect.value;
    if (!presetName) {
        showStatus("Vui lòng chọn cấu hình để xóa.", 'error');
        return;
    }
    if (!allPresets[presetName]) {
         showStatus(`Cấu hình "${presetName}" không tồn tại.`, 'error');
         return;
    }

    if (confirm(`Bạn có chắc muốn xóa cấu hình "${presetName}" không?`)) {
        delete allPresets[presetName];
        try {
            await chrome.storage.local.set({ presets: allPresets });
            showStatus(`Đã xóa cấu hình "${presetName}".`, 'success');
            await loadPresets(); // Tải lại dropdown
        } catch (error) {
            console.error("Error deleting preset:", error);
            showStatus("Lỗi xóa cấu hình.", 'error');
        }
    }
}
async function applyPreset() {
    const presetSelect = document.getElementById('preset-select');
    const presetName = presetSelect.value;
    if (!presetName || !allPresets[presetName]) return;

    const preset = allPresets[presetName];
    console.log("Applying preset:", presetName, preset);

    const deckInput = document.getElementById('deck-search');
    const modelInput = document.getElementById('model-search');
    const tagsInput = document.getElementById('tags-input');

    deckInput.value = preset.deckName || '';
    modelInput.value = preset.modelName || '';
    tagsInput.value = preset.tags || '';

    // Quan trọng: Trigger input event để load field sau khi đổi model
    modelInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Tải lại fields cho model mới
    if (preset.modelName && allModels.includes(preset.modelName)) {
        await createFieldsForModel(preset.modelName);
    } else {
        // Xóa fields nếu model không hợp lệ
        document.getElementById('fields-container').innerHTML = '';
        currentModelName = '';
        currentFieldNames = [];
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null })
              .catch(err => console.warn("Could not send empty fields:", err));
    }
}


// --- Hàm xử lý định dạng (Bold, Italic, v.v.) ---
function applyFormat(command, value = null) {
    if (globalEditorMode !== 'normal') {
        showStatus("Chức năng định dạng chỉ hoạt động ở Normal Mode.", "warning");
        return;
    }
    if (!activeElement || !activeElement.isContentEditable) {
        showStatus("Vui lòng đặt con trỏ vào field cần định dạng.", "warning");
        activeElement?.focus(); // Thử focus lại element cuối cùng
        if (!activeElement || !activeElement.isContentEditable) return; // Vẫn không được thì bỏ qua
    }

    activeElement.focus(); // Đảm bảo focus đúng element
    document.execCommand(command, false, value);

    // Đồng bộ và cập nhật preview sau khi định dạng
    const fieldGroup = activeElement.closest('.field-group');
    if (fieldGroup) {
        const fieldName = fieldGroup.dataset.fieldName;
        const safeFieldName = fieldName.replace(/\s+/g, '-');
        const textareaId = `field-${safeFieldName}-textarea`;
        const previewId = `preview-field-${safeFieldName}`;
        const textareaElement = document.getElementById(textareaId);
        syncDivToTextarea(activeElement, textareaElement);
        updateMediaPreviewFromContent(activeElement.innerHTML, previewId);
    }
     // Thử giữ focus sau execCommand
     setTimeout(() => activeElement?.focus(), 0);
}

// --- Hàm xử lý Cloze ---
function addCloze() {
    if (globalEditorMode !== 'normal') {
        showStatus("Chức năng Cloze chỉ hoạt động ở Normal Mode.", "warning");
        return;
    }
     if (!activeElement || !activeElement.isContentEditable) {
        showStatus("Vui lòng đặt con trỏ vào field cần tạo Cloze.", "warning");
        activeElement?.focus();
        if (!activeElement || !activeElement.isContentEditable) return;
    }

    activeElement.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        showStatus("Vui lòng bôi đen phần text cần làm cloze.", "error");
        return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // Tìm số cloze lớn nhất hiện có trong field này
    let highestCloze = 0;
    const clozeRegex = /\{\{c(\d+)::/g;
    let match;
    const fullContent = activeElement.innerHTML; // Lấy HTML
    while ((match = clozeRegex.exec(fullContent)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > highestCloze) {
            highestCloze = num;
        }
    }
    const nextClozeNum = highestCloze + 1;
    const clozeText = `{{c${nextClozeNum}::${selectedText}}}`;

    // Thay thế nội dung đã chọn bằng clozeText (dùng insertHTML hoặc tương tự)
    document.execCommand('insertHTML', false, clozeText);

    // Đồng bộ và cập nhật preview
    const fieldGroup = activeElement.closest('.field-group');
    if (fieldGroup) {
        const fieldName = fieldGroup.dataset.fieldName;
        const safeFieldName = fieldName.replace(/\s+/g, '-');
        const textareaId = `field-${safeFieldName}-textarea`;
        const previewId = `preview-field-${safeFieldName}`;
        const textareaElement = document.getElementById(textareaId);
        syncDivToTextarea(activeElement, textareaElement);
        updateMediaPreviewFromContent(activeElement.innerHTML, previewId);
    }
     // Thử giữ focus sau execCommand
     setTimeout(() => activeElement?.focus(), 0);
}


// --- Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) DOM loaded");
    showStatus("Đang kết nối tới Anki...", 'info');

    try {
        // Load Presets first
        await loadPresets();

        // Load Decks, Models, Tags, Last Used Settings concurrently
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

        console.log("Decks loaded:", allDecks.length);
        console.log("Models loaded:", allModels.length);
        console.log("Tags loaded:", allTags.length);
        console.log("Last settings:", lastSettings);

        // Setup Autocomplete
        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, async (selectedModel) => {
             // Hàm callback này sẽ được gọi KHI MỘT SUGGESTION ĐƯỢC CLICK
             console.log(`Autocomplete callback selected model: ${selectedModel}`);
             if (selectedModel && allModels.includes(selectedModel)) {
                  await createFieldsForModel(selectedModel);
             } else if (!selectedModel) { // Trường hợp xóa sạch input
                 document.getElementById('fields-container').innerHTML = '';
                 currentModelName = '';
                 currentFieldNames = [];
                 chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null })
                       .catch(err => console.warn("Could not send empty fields:", err));
             }
         });
        // Xử lý khi input model thay đổi (gõ hoặc xóa) - để cập nhật context menu realtime
         document.getElementById('model-search').addEventListener('input', (event) => {
             const currentInput = event.target.value;
             if (!currentInput) { // Nếu xóa sạch input
                  document.getElementById('fields-container').innerHTML = '';
                  currentModelName = '';
                  currentFieldNames = [];
                  chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null })
                       .catch(err => console.warn("Could not send empty fields:", err));
             } else if (allModels.includes(currentInput) && currentInput !== currentModelName) {
                  // Nếu gõ đúng tên model và khác model hiện tại -> Tải field
                  // createFieldsForModel(currentInput); // Bỏ comment nếu muốn tải field ngay khi gõ đúng tên
             }
         });


        // Populate Tags Datalist
        const tagsDatalist = document.getElementById('tags-datalist');
        tagsDatalist.innerHTML = ''; // Clear old options
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            tagsDatalist.appendChild(option);
        });

        // Restore last used Deck/Model and load fields
        let modelToLoad = null;
        if (lastSettings.lastUsedDeck && allDecks.includes(lastSettings.lastUsedDeck)) {
            document.getElementById('deck-search').value = lastSettings.lastUsedDeck;
        }
        if (lastSettings.lastUsedModel && allModels.includes(lastSettings.lastUsedModel)) {
            document.getElementById('model-search').value = lastSettings.lastUsedModel;
            modelToLoad = lastSettings.lastUsedModel; // Chỉ định model cần load
        }
        // Load fields cho model cuối cùng (nếu có) SAU KHI GÁN XONG CÁC EVENT LISTENER
        if (modelToLoad) {
            console.log("Loading fields for last used model:", modelToLoad);
            await createFieldsForModel(modelToLoad);
        } else {
            // Nếu không có model nào được load, gửi danh sách field trống cho context menu
            chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [], modelName: null })
                  .catch(err => console.warn("Could not send empty fields:", err));
        }


        // --- Gán sự kiện cho các nút ---
        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);
        document.getElementById('preset-select').addEventListener('change', applyPreset);
        document.getElementById('save-preset-btn').addEventListener('click', saveCurrentPreset);
        document.getElementById('delete-preset-btn').addEventListener('click', deleteCurrentPreset);

        // Listener cho nút chuyển mode
        document.getElementById('mode-normal-btn').addEventListener('click', () => setGlobalEditorMode('normal'));
        document.getElementById('mode-source-btn').addEventListener('click', () => setGlobalEditorMode('source'));

        // Listener cho toolbar định dạng
        document.getElementById('format-bold').addEventListener('click', () => applyFormat('bold'));
        document.getElementById('format-italic').addEventListener('click', () => applyFormat('italic'));
        document.getElementById('format-underline').addEventListener('click', () => applyFormat('underline'));
        document.getElementById('format-remove').addEventListener('click', () => applyFormat('removeFormat'));
        document.getElementById('format-cloze').addEventListener('click', addCloze);

        // Listener cho color pickers
        const foreColorPicker = document.getElementById('forecolor-picker');
        const backColorPicker = document.getElementById('backcolor-picker');
        foreColorPicker.addEventListener('input', (e) => applyFormat('foreColor', e.target.value));
        backColorPicker.addEventListener('input', (e) => applyFormat('backColor', e.target.value));
        // Reset picker màu khi click nút tương ứng (để chọn lại dễ hơn)
        document.getElementById('format-forecolor').addEventListener('click', () => foreColorPicker.click());
        document.getElementById('format-backcolor').addEventListener('click', () => backColorPicker.click());


        // Listener cho phím tắt
        document.addEventListener('keydown', (e) => {
             // Chỉ bắt phím tắt khi đang focus vào field (div hoặc textarea)
             if (activeElement && (activeElement.classList.contains('field-input-div') || activeElement.classList.contains('field-input-textarea'))) {
                 if (e.ctrlKey && !e.shiftKey && e.key === 'b') { // Ctrl+B
                     e.preventDefault(); applyFormat('bold');
                 } else if (e.ctrlKey && !e.shiftKey && e.key === 'i') { // Ctrl+I
                     e.preventDefault(); applyFormat('italic');
                 } else if (e.ctrlKey && !e.shiftKey && e.key === 'u') { // Ctrl+U
                     e.preventDefault(); applyFormat('underline');
                 } else if (e.ctrlKey && e.shiftKey && e.key === 'C') { // Ctrl+Shift+C
                     e.preventDefault(); addCloze();
                 }
            }
        });

        // Listener đóng modal ảnh
        const modal = document.getElementById("image-preview-modal");
        const span = modal.querySelector(".modal-close-btn");
        span.onclick = function() { modal.style.display = "none"; }
        modal.onclick = function(event) {
            if (event.target === modal || event.target === document.getElementById("modal-caption")) {
                modal.style.display = "none";
            }
        }


        showStatus("Sẵn sàng!", 'success'); // Xóa thông báo "Đang kết nối"

    } catch (error) {
        // Lỗi nghiêm trọng khi khởi tạo (không kết nối được Anki)
        console.error("Critical error during sidebar initialization:", error);
        showStatus(`Lỗi kết nối Anki: ${error.message}. Anki có đang chạy không?`, 'error');
        // Vô hiệu hóa các thành phần UI chính
        document.getElementById('deck-search').disabled = true;
        document.getElementById('model-search').disabled = true;
        document.getElementById('add-note-btn').disabled = true;
        document.getElementById('tags-input').disabled = true;
        document.getElementById('preset-select').disabled = true;
        document.getElementById('save-preset-btn').disabled = true;
        document.getElementById('delete-preset-btn').disabled = true;
        document.getElementById('mode-normal-btn').disabled = true;
        document.getElementById('mode-source-btn').disabled = true;
        document.getElementById('format-toolbar').style.opacity = '0.5';
        document.getElementById('format-toolbar').style.pointerEvents = 'none';
    }
});

// --- Hàm thêm note vào Anki ---
async function addNoteToAnki() {
    console.log("Attempting to add note...");
    showStatus('Đang thêm note...', 'info');

    const deckName = document.getElementById('deck-search').value.trim();
    const modelName = document.getElementById('model-search').value.trim();
    const tagsInput = document.getElementById('tags-input').value.trim();

    // --- Validate inputs ---
    if (!deckName) { showStatus('Vui lòng chọn hoặc nhập Deck.', 'error'); return; }
    if (!modelName) { showStatus('Vui lòng chọn hoặc nhập Note Type.', 'error'); return; }
    if (!Array.isArray(allDecks) || !allDecks.includes(deckName)) {
        showStatus('Tên Deck không hợp lệ. Vui lòng chọn từ gợi ý hoặc kiểm tra lại.', 'error'); return;
    }
    if (!Array.isArray(allModels) || !allModels.includes(modelName)) {
         showStatus('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý hoặc kiểm tra lại.', 'error'); return;
    }
    if (currentModelName !== modelName) { // Đảm bảo fields đang hiển thị đúng là của model đã chọn
         showStatus('Note Type đã thay đổi, vui lòng đợi fields tải lại hoặc kiểm tra lại lựa chọn.', 'error'); return;
    }


    const fields = {};
    let hasContent = false;
    let fieldReadError = false;

    // Lấy nội dung từ các field đang hiển thị (không bị ẩn bởi setting)
    document.querySelectorAll('#fields-container .field-group:not(.field-hidden-by-setting)').forEach(fieldGroup => {
        if (fieldReadError) return; // Dừng nếu có lỗi
        const fieldName = fieldGroup.dataset.fieldName;
        if (!fieldName) {
            console.error("Field group missing data-field-name:", fieldGroup);
            fieldReadError = true;
            return;
        }

        const safeFieldName = fieldName.replace(/\s+/g, '-');
        const fieldIdBase = `field-${safeFieldName}`;
        let value = '';

        if (globalEditorMode === 'normal') {
            const divElement = fieldGroup.querySelector(`#${fieldIdBase}-div`);
            if (divElement) {
                value = divElement.innerHTML; // Lấy HTML từ div
            } else {
                console.warn(`Contenteditable div not found for field: ${fieldName}`);
            }
        } else { // Source mode
            const textareaElement = fieldGroup.querySelector(`#${fieldIdBase}-textarea`);
            if (textareaElement) {
                value = textareaElement.value; // Lấy text từ textarea
            } else {
                 console.warn(`Textarea not found for field: ${fieldName}`);
            }
        }

        fields[fieldName] = value;
        // Kiểm tra nội dung không chỉ là khoảng trắng hoặc thẻ br trống
        // dùng textContent của div hoặc value của textarea để kiểm tra nội dung thực sự
        let checkValue = value;
        if (globalEditorMode === 'normal') {
             const divElement = fieldGroup.querySelector(`#${fieldIdBase}-div`);
             checkValue = divElement?.textContent || '';
        } else {
            const textareaElement = fieldGroup.querySelector(`#${fieldIdBase}-textarea`);
             checkValue = textareaElement?.value || '';
        }
        if (checkValue.trim()) {
            hasContent = true;
        }
    });

    if (fieldReadError) {
         showStatus('Lỗi khi đọc nội dung fields. Vui lòng thử lại.', 'error'); return;
    }

    // Xử lý Random ID Field (nếu được cấu hình và field đó trống)
    const randomIdFieldKey = `randomIdField_${modelName}`;
    let randomIdField = null;
    try {
        const storedData = await chrome.storage.local.get(randomIdFieldKey);
        randomIdField = storedData[randomIdFieldKey];
        if (randomIdField && fields.hasOwnProperty(randomIdField) && fields[randomIdField].trim() === '') {
            fields[randomIdField] = generateRandomId();
            hasContent = true; // Nếu chỉ có ID được tạo thì vẫn tính là có nội dung
            console.log(`Generated Random ID for field "${randomIdField}": ${fields[randomIdField]}`);
        } else if (randomIdField && !fields.hasOwnProperty(randomIdField)) {
             console.warn(`Random ID Field "${randomIdField}" is configured but not found or hidden.`);
        }
    } catch (storageError) {
         console.error("Error reading randomIdField setting:", storageError);
         // Không cần dừng, tiếp tục thêm note
    }


    // Kiểm tra lại nội dung sau khi có thể đã tạo ID
    if (!hasContent) {
        showStatus('Vui lòng nhập nội dung cho ít nhất một field (hoặc cấu hình Random ID Field).', 'error');
        return;
    }

    const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());

    // --- Tạo object note cho AnkiConnect ---
    const noteData = {
        deckName: deckName,
        modelName: modelName,
        fields: fields,
        tags: tagsArray,
        options: {
            allowDuplicate: false // Hoặc đọc từ cài đặt nếu muốn
            // Thêm duplicateScope nếu cần
        }
        // Có thể thêm audio, video, picture ở đây nếu cần xử lý từ sidebar
    };

    console.log("Sending note data to Anki:", JSON.parse(JSON.stringify(noteData))); // Log deep copy

    try {
        const result = await invoke('addNote', { note: noteData });
        if (result === null) {
             // AnkiConnect trả về null thường là do note không được thêm (ví dụ duplicate và allowDuplicate=false)
             // Cần kiểm tra lại lỗi duplicate cụ thể hơn nếu có thể
             const canAddResult = await invoke('canAddNotesWithErrorDetail', { notes: [noteData] });
             if (canAddResult && canAddResult.length > 0 && !canAddResult[0].canAdd && canAddResult[0].error) {
                  throw new Error(canAddResult[0].error); // Ném lỗi cụ thể từ canAddNotes
             } else {
                 throw new Error("AnkiConnect returned null, possibly a duplicate note.");
             }
        }

        showStatus(`Thêm thành công! Note ID: ${result}`, 'success');

        // Lưu Deck/Model cuối cùng
        try {
            await chrome.storage.local.set({ lastUsedDeck: deckName, lastUsedModel: modelName });
            console.log("Saved last used deck and model.");
        } catch (storageError) {
            console.error("Error saving last used deck/model:", storageError);
        }

        // Xóa nội dung fields không được ghim
        const stickyFieldsKey = `stickyFields_${modelName}`;
        let stickyFields = {};
        try {
             const stickyData = await chrome.storage.local.get(stickyFieldsKey);
             stickyFields = stickyData[stickyFieldsKey] || {};
        } catch (storageError) {
             console.error("Error reading stickyFields setting:", storageError);
        }

        document.querySelectorAll('#fields-container .field-group:not(.field-hidden-by-setting)').forEach(fieldGroup => {
            const fieldName = fieldGroup.dataset.fieldName;
            if (fieldName && !stickyFields[fieldName]) { // Chỉ xóa nếu không được ghim
                const safeFieldName = fieldName.replace(/\s+/g, '-');
                const fieldIdBase = `field-${safeFieldName}`;
                const divElement = fieldGroup.querySelector(`#${fieldIdBase}-div`);
                const textareaElement = fieldGroup.querySelector(`#${fieldIdBase}-textarea`);
                if (divElement) divElement.innerHTML = '';
                if (textareaElement) textareaElement.value = '';
                // Trigger input để reset preview và autoExpand
                if (globalEditorMode === 'normal' && divElement) {
                     divElement.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (globalEditorMode === 'source' && textareaElement) {
                    textareaElement.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (fieldName && stickyFields[fieldName]) {
                 console.log(`Keeping content for sticky field: ${fieldName}`);
            }
        });

        // Tùy chọn: Xóa tags hoặc giữ lại? Hiện tại đang giữ lại.
        // document.getElementById('tags-input').value = '';

    } catch (error) {
        console.error('Error adding note:', error);
        showStatus(`Lỗi thêm note: ${error.message}`, 'error');
    }
}


// --- Listener nhận message từ background.js (Context Menu) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidebar received message:", message);
    if (message.action === "fillFieldFromContextMenu") {
        const { field, content, contentType } = message;
        const safeFieldName = field.replace(/\s+/g, '-');
        const fieldIdBase = `field-${safeFieldName}`;
        const divId = `${fieldIdBase}-div`;
        const textareaId = `${fieldIdBase}-textarea`;

        const targetDiv = document.getElementById(divId);
        const targetTextarea = document.getElementById(textareaId);
        let targetElement = null;

        // Xác định element đích dựa trên mode hiện tại
        if (globalEditorMode === 'normal') {
            targetElement = targetDiv;
        } else {
            targetElement = targetTextarea;
        }

        if (targetElement) {
            console.log(`Filling field "${field}" (mode: ${globalEditorMode}) with ${contentType}:`, content);

            let finalContent = content;
            // Chỉ tạo thẻ img nếu content type là image (background đã gửi tên file)
            if (contentType === 'image') {
                finalContent = `<img src="${content}">`;
            } else if (contentType === 'text') {
                 // Nếu là text, kiểm tra xem có cần escape HTML không?
                 // Hiện tại đang chèn thẳng HTML (giả sử content đã an toàn hoặc là HTML mong muốn)
                 finalContent = content;
            }


            // Nối vào nội dung cũ (thêm dấu cách hoặc xuống dòng)
            const separator = (globalEditorMode === 'normal' ? '<br>' : '\n'); // Xuống dòng tùy mode
            if (globalEditorMode === 'normal') {
                 // Dùng insertHTML để chèn vào vị trí con trỏ nếu có thể, hoặc nối vào cuối
                 targetElement.focus(); // Focus trước khi chèn
                 document.execCommand('insertHTML', false, (targetElement.innerHTML.trim() ? separator : '') + finalContent);
            } else { // Source mode (textarea)
                 const currentValue = targetElement.value;
                 targetElement.value += (currentValue.trim() ? separator : '') + finalContent;
            }


            // Đồng bộ hóa giữa div và textarea
            if (globalEditorMode === 'normal') {
                syncDivToTextarea(targetDiv, targetTextarea);
            } else {
                syncTextareaToDiv(targetTextarea, targetDiv);
            }

            // Trigger input event để cập nhật preview (ở normal mode) và autoExpand (ở source mode)
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));

            // Tự động mở field nếu đang bị thu gọn
            const fieldGroup = targetElement.closest('.field-group');
            if (fieldGroup && fieldGroup.classList.contains('collapsed')) {
                const header = fieldGroup.querySelector('.field-header');
                if (header) header.click(); // Simulate click để mở
            }

            // Optional: Chuyển sang Normal Mode để xem preview?
            // if (globalEditorMode === 'source') {
            //     setGlobalEditorMode('normal');
            // }

            sendResponse({ success: true, message: `Field "${field}" updated.` });

        } else {
            console.warn(`Target element not found for field "${field}" in mode "${globalEditorMode}". Div found: ${!!targetDiv}, Textarea found: ${!!targetTextarea}`);
            let errorMsg = `Lỗi: Field "${field}" không tìm thấy.`;
            if (!currentModelName) errorMsg = `Lỗi: Chọn Note Type trước khi gửi vào field "${field}"`;
            else errorMsg = `Lỗi: Field "${field}" không tồn tại trong Note Type "${currentModelName}"?`;
            showStatus(errorMsg, 'error');
            sendResponse({ success: false, message: `Field "${field}" not found.` });
        }
    }
    // return true; // Cần thiết nếu sendResponse là bất đồng bộ (async), ở đây không cần
});
