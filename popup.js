// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let statusTimeout = null;

// --- Hàm invoke (Sửa lại: Ném lỗi như ban đầu) ---
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

// --- Hàm createFieldsForModel (Đã cập nhật UI v1.22.0) ---
async function createFieldsForModel(modelName) {
    console.log("Attempting to create fields for model:", modelName); // DEBUG
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        // Quan trọng: Kiểm tra fieldNames có phải là mảng hợp lệ không
        if (!Array.isArray(fieldNames)) {
             throw new Error("Received invalid data for field names.");
        }

        currentFieldNames = fieldNames; // Lưu lại
        console.log("Fields for context menu:", currentFieldNames); // DEBUG

        // Gửi message cho background (vẫn giữ)
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", modelName: modelName, fields: fieldNames })
              .catch(err => console.warn("Could not send fields to background:", err)); // Dùng warn thay error

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = ''; // Xóa fields cũ

        // Lấy settings ẩn và collapse
        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const collapseStorageKey = `collapsedFields_${modelName}`;
        // Lấy cả hai cùng lúc
        const settings = await chrome.storage.local.get([hiddenFieldsStorageKey, collapseStorageKey]);
        const hiddenFields = settings[hiddenFieldsStorageKey] || {};
        const collapsedFields = settings[collapseStorageKey] || {};
        console.log("Retrieved settings:", { hiddenFields, collapsedFields }); // DEBUG

        if (fieldNames.length === 0) {
            fieldsContainer.innerHTML = '<p><i>Note Type này không có field nào.</i></p>'; // Thông báo rõ hơn
            return;
        }

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`; const isHidden = hiddenFields[fieldName] || false; const isCollapsed = collapsedFields[fieldName] || false;
            const fieldGroup = document.createElement('div'); fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`; fieldGroup.dataset.fieldName = fieldName;
            const fieldHeader = document.createElement('div'); fieldHeader.className = 'field-header'; fieldHeader.addEventListener('click', toggleFieldCollapse);
            const toggle = document.createElement('span'); toggle.className = 'collapse-toggle'; toggle.textContent = '▶'; toggle.style.pointerEvents = 'none';
            const label = document.createElement('label'); label.textContent = fieldName; label.style.pointerEvents = 'none';
            const input = document.createElement('textarea'); input.id = fieldId; input.className = 'form-control field-input'; input.placeholder = `Nội dung ${fieldName}...`; input.rows = 2; input.addEventListener('input', autoExpandTextarea);
            if (isCollapsed) { input.style.display = 'none'; label.style.opacity = '0.65'; toggle.style.transform = 'rotate(-90deg)'; }
            else { toggle.style.transform = 'rotate(0deg)'; }
            fieldHeader.appendChild(toggle); fieldHeader.appendChild(label); fieldGroup.appendChild(fieldHeader); fieldGroup.appendChild(input); fieldsContainer.appendChild(fieldGroup);
            autoExpandTextarea({ target: input }); // Gọi để tính chiều cao ban đầu
        });
        console.log("Fields created successfully."); // DEBUG

    } catch (error) {
        console.error('Error creating/loading fields:', error); // Log lỗi chi tiết hơn
        showStatus('Lỗi tải fields: ' + error.message, 'error');
        currentFieldNames = []; // Reset
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [] }) // Gửi mảng rỗng
              .catch(err => console.warn("Could not send empty fields to background:", err));
        document.getElementById('fields-container').innerHTML = `<p style="color: var(--error-text);"><i>Lỗi tải fields.</i></p>`; // Hiển thị lỗi trong container
    }
 }
// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên code v1.22.0 ... */ }
// --- Hàm autoExpandTextarea (không đổi) ---
function autoExpandTextarea(event) { /* ... giữ nguyên code v1.22.0 ... */ }
// --- Hàm openOptionsPage (không đổi) ---
function openOptionsPage() { console.log("Opening options page..."); chrome.runtime.openOptionsPage(); } // Thêm log
// --- Hàm generateRandomId (không đổi) ---
function generateRandomId(length = 14) { /* ... giữ nguyên code ... */ }
// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') { /* ... giữ nguyên code v1.20.0 ... */ }

// --- Hàm setupAutocomplete (Đảm bảo giống hệt settings.js) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  // console.log(`Setting up autocomplete for input: #${inputId} with ${sourceArray ? sourceArray.length : 0} items`); // DEBUG
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) { console.error(`Autocomplete setup failed: Cannot find elements #${inputId} or #${containerId}`); return; }
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const validSource = Array.isArray(sourceArray) ? sourceArray : [];
    const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { input.value = item; closeAllLists(); if (onSelectCallback) { console.log(`Callback triggered for: ${item}`); onSelectCallback(item); } }); container.appendChild(suggestionItem); }); // Thêm log callback
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { showSuggestions(input.value); });
  input.addEventListener('focus', () => { showSuggestions(''); }); // Hiển thị tất cả khi focus
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { items[currentFocus].click(); } } else if (e.keyCode == 27) { closeAllLists(); } });
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists(elm) { // Thêm tham số để kiểm tra click vào đâu
       // Chỉ đóng nếu click ra ngoài input VÀ container gợi ý
       if (elm !== input && !container.contains(elm)) {
           container.innerHTML = ''; container.style.display = 'none';
       }
   }
  // Sửa lỗi đóng suggestions khi click vào scrollbar
  container.addEventListener('mousedown', (e) => { if (e.target === container) e.preventDefault(); });
  // Sửa sự kiện click document để truyền target element
  document.addEventListener('click', (e) => { closeAllLists(e.target); });
}

// --- [HÀM ĐƯỢC CẬP NHẬT] Khởi tạo popup ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) loaded");
    try {
        // [SỬA LỖI] Gọi invoke tuần tự và kiểm tra lỗi ngay lập tức
        allDecks = await invoke('deckNames');
        if (allDecks === null) { // Kiểm tra null vì invoke trả về null khi lỗi
             console.error("Failed to load decks.");
             allDecks = []; // Gán mảng rỗng để không lỗi autocomplete
             // Không cần showStatus vì invoke đã gọi rồi
        } else {
             console.log("Decks loaded:", allDecks);
        }

        allModels = await invoke('modelNames');
        if (allModels === null) {
             console.error("Failed to load models.");
             allModels = [];
        } else {
             console.log("Models loaded:", allModels);
        }

        // Gọi setupAutocomplete sau khi đã có dữ liệu (hoặc mảng rỗng)
        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            console.log(`Sidebar autocomplete selected model: ${selectedModel}`); // DEBUG
            // Chỉ gọi createFieldsForModel nếu selectedModel hợp lệ
            if (selectedModel && allModels.includes(selectedModel)) { // Thêm kiểm tra includes
                 createFieldsForModel(selectedModel);
            } else if (!selectedModel) { // Nếu chọn giá trị rỗng (ví dụ xóa input)
                document.getElementById('fields-container').innerHTML = ''; // Xóa fields
                currentModelName = ''; // Reset model name
                currentFieldNames = []; // Reset fields list
                 // Gửi danh sách rỗng cho background
                chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [] })
                      .catch(err => console.warn("Could not send empty fields to background:", err));
            } else {
                 console.warn(`Invalid model selected or not found in list: "${selectedModel}"`);
                 // Không làm gì cả hoặc hiển thị lỗi nhẹ
            }
        });

        // Tải tags
        const tags = await invoke('getTags');
        const tagsDatalist = document.getElementById('tags-datalist');
        if (Array.isArray(tags)) {
           tags.forEach(tag => { const option = document.createElement('option'); option.value = tag; tagsDatalist.appendChild(option); });
        } else {
            console.warn("invoke('getTags') did not return an array:", tags);
        }

        // Gắn sự kiện cho nút
        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        // [SỬA LỖI] Gắn sự kiện cho nút settings
        const settingsLink = document.getElementById('open-settings-link');
        if (settingsLink) { // Kiểm tra nút có tồn tại không
            settingsLink.addEventListener('click', openOptionsPage);
            console.log("Settings link event listener attached."); // DEBUG
        } else {
            console.error("Settings link (#open-settings-link) not found!");
        }


    } catch (error) {
        // Lỗi này chỉ xảy ra nếu invoke NÉM lỗi (đã sửa ở trên) hoặc lỗi DOM khác
        console.error("Critical error during sidebar init:", error);
        // Hiển thị lỗi nghiêm trọng cho người dùng
        showStatus('Lỗi nghiêm trọng khi khởi tạo: ' + error.message, 'error');
        // Vô hiệu hóa các input để tránh lỗi tiếp theo
        document.getElementById('deck-search').disabled = true;
        document.getElementById('model-search').disabled = true;
        document.getElementById('add-note-btn').disabled = true;
    }
});

// --- Hàm thêm note vào Anki (không đổi) ---
async function addNoteToAnki() { /* ... giữ nguyên code v1.19.0 ... */ }

// --- [THÊM MỚI] Listener nhận message từ background.js ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidebar received message:", message); // DEBUG
    if (message.action === "fillFieldFromContextMenu") {
        const { field, content, contentType } = message;
        const targetTextarea = document.getElementById(`field-${field}`);

        if (targetTextarea) {
             console.log(`Filling field "${field}" with ${contentType}:`, content);
             let finalContent = content; if (contentType === 'image') finalContent = `<img src="${content}">`;
             targetTextarea.value = finalContent; // Ghi đè
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
    // Không cần return true vì sendResponse được gọi đồng bộ
});