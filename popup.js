// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let currentFieldNames = []; // [MỚI] Lưu danh sách field hiện tại
let statusTimeout = null;

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên code ... */ }
// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên code ... */ }
// --- Hàm openOptionsPage (không đổi) ---
function openOptionsPage() { chrome.runtime.openOptionsPage(); }
// --- Hàm generateRandomId (không đổi) ---
function generateRandomId(length = 14) { /* ... giữ nguyên code ... */ }
// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') { /* ... giữ nguyên code ... */ }
// --- Hàm autoExpandTextarea (không đổi) ---
function autoExpandTextarea(event) { /* ... giữ nguyên code ... */ }
// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên code ... */ }

// --- [HÀM ĐƯỢC CẬP NHẬT] Gửi thông tin fields cho background ---
async function createFieldsForModel(modelName) {
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if(fieldNames === null) throw new Error("modelFieldNames returned null.");

        currentFieldNames = fieldNames; // [MỚI] Lưu lại danh sách field

        // [MỚI] Gửi message cho background để cập nhật context menu
        chrome.runtime.sendMessage({
             action: "updateFieldsForContextMenu",
             modelName: modelName,
             fields: fieldNames
        }).catch(err => console.error("Error sending fields to background:", err)); // Bắt lỗi nếu background chưa sẵn sàng

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';

        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const hiddenData = await chrome.storage.local.get(hiddenFieldsStorageKey);
        const hiddenFields = hiddenData[hiddenFieldsStorageKey] || {};
        const collapseStorageKey = `collapsedFields_${modelName}`;
        const collapseData = await chrome.storage.local.get(collapseStorageKey);
        const collapsedFields = collapseData[collapseStorageKey] || {};

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
            autoExpandTextarea({ target: input });
        });

    } catch (error) {
        console.error('Error creating fields:', error);
        showStatus('Không thể tải fields: ' + error.message, 'error');
        currentFieldNames = []; // [MỚI] Reset nếu lỗi
        // [MỚI] Gửi danh sách rỗng cho background nếu lỗi
        chrome.runtime.sendMessage({ action: "updateFieldsForContextMenu", fields: [] })
              .catch(err => console.error("Error sending empty fields to background:", err));
    }
}


// --- Hàm khởi tạo popup (không đổi) ---
document.addEventListener('DOMContentLoaded', async function() { /* ... giữ nguyên code ... */ });
// --- Hàm thêm note vào Anki (không đổi) ---
async function addNoteToAnki() { /* ... giữ nguyên code ... */ }


// --- [THÊM MỚI] Listener nhận message từ background.js ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidebar received message:", message); // DEBUG
    if (message.action === "fillFieldFromContextMenu") {
        const { field, content, contentType } = message;
        const targetTextarea = document.getElementById(`field-${field}`);

        if (targetTextarea) {
             console.log(`Filling field "${field}" with ${contentType}:`, content);

             // Xử lý nội dung ảnh: tạo thẻ HTML img
             let finalContent = content;
             if (contentType === 'image') {
                  // Đơn giản nhất là chèn URL, Anki sẽ tự tải nếu cấu hình đúng
                  // Hoặc có thể tạo thẻ img
                  finalContent = `<img src="${content}">`;
                  // Nếu muốn chèn nối tiếp thay vì ghi đè:
                  // targetTextarea.value += (targetTextarea.value ? '\n' : '') + finalContent;
             }

            // Ghi đè nội dung cũ hoặc nối vào (tùy bạn chọn)
            targetTextarea.value = finalContent; // Ghi đè

            // Trigger sự kiện input để autoExpand hoạt động
            targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Mở collapse nếu field đang bị đóng (tùy chọn)
            const fieldGroup = targetTextarea.closest('.field-group');
            if (fieldGroup && fieldGroup.classList.contains('collapsed')) {
                 // Tìm header và trigger click để mở
                 const header = fieldGroup.querySelector('.field-header');
                 if(header) header.click();
            }

            // Focus vào textarea đó (tùy chọn)
            // targetTextarea.focus();

            sendResponse({ success: true, message: `Field "${field}" updated.` });

        } else {
            console.warn(`Field "${field}" not found in sidebar.`);
             // Kiểm tra xem có phải do model chưa được chọn không
             if (!currentModelName) {
                  showStatus(`Lỗi: Chọn Note Type trước khi gửi vào field "${field}"`, 'error');
             } else {
                 showStatus(`Lỗi: Field "${field}" không tìm thấy. Model có đúng?`, 'error');
             }
            sendResponse({ success: false, message: `Field "${field}" not found.` });
        }
    }
    // Trả về true nếu bạn muốn giữ message channel mở cho sendResponse bất đồng bộ (ít khi cần)
    // return true;
});