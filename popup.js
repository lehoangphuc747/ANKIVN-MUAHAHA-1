// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let statusTimeout = null;

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên ... */ }
// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên ... */ }
// --- Hàm openOptionsPage (không đổi) ---
function openOptionsPage() { chrome.runtime.openOptionsPage(); }
// --- Hàm generateRandomId (không đổi) ---
function generateRandomId(length = 14) { /* ... giữ nguyên ... */ }
// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */ }

// --- [HÀM MỚI] Tự động thay đổi chiều cao textarea ---
function autoExpandTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto'; // Reset chiều cao để tính toán lại
    // Set chiều cao mới = scrollHeight (chiều cao nội dung thực tế)
    // Thêm 2px để tránh scrollbar xuất hiện không cần thiết ở một số trường hợp
    textarea.style.height = (textarea.scrollHeight + 2) + 'px';
}


// --- [HÀM ĐƯỢC VIẾT LẠI] Tạo fields với header clickable, rows=2, auto-expand ---
async function createFieldsForModel(modelName) {
    currentModelName = modelName;
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if(fieldNames === null) throw new Error("modelFieldNames returned null."); // Thêm kiểm tra lỗi

        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';

        const hiddenFieldsStorageKey = `hiddenFields_${modelName}`;
        const hiddenData = await chrome.storage.local.get(hiddenFieldsStorageKey);
        const hiddenFields = hiddenData[hiddenFieldsStorageKey] || {};

        const collapseStorageKey = `collapsedFields_${modelName}`;
        const collapseData = await chrome.storage.local.get(collapseStorageKey);
        const collapsedFields = collapseData[collapseStorageKey] || {};

        fieldNames.forEach(fieldName => {
            const fieldId = `field-${fieldName}`;
            const isHidden = hiddenFields[fieldName] || false;
            const isCollapsed = collapsedFields[fieldName] || false;

            const fieldGroup = document.createElement('div');
            fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'field-hidden-by-setting' : ''}`;
            fieldGroup.dataset.fieldName = fieldName; // Lưu tên field vào group để toggle dễ hơn

            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-header';
            fieldHeader.addEventListener('click', toggleFieldCollapse); // Gắn event vào header

            const toggle = document.createElement('span');
            toggle.className = 'collapse-toggle';
            toggle.textContent = '▶'; // Đổi thành chevron
            toggle.style.pointerEvents = 'none'; // Không cho click vào icon nữa

            const label = document.createElement('label');
            label.textContent = fieldName; // Bỏ dấu ':' nếu muốn gọn hơn
            // label.htmlFor = fieldId; // Không cần htmlFor vì click vào header rồi
            label.style.pointerEvents = 'none'; // Không cho click vào label nữa

            const input = document.createElement('textarea');
            input.id = fieldId;
            input.className = 'form-control field-input';
            input.placeholder = `Nội dung ${fieldName}...`;
            input.rows = 2; // [THAY ĐỔI] Giảm số dòng mặc định
            input.addEventListener('input', autoExpandTextarea); // [THÊM MỚI] Gắn event auto-expand

            // Khôi phục trạng thái collapse
            if (isCollapsed) {
                input.style.display = 'none';
                label.style.opacity = '0.6';
                toggle.style.transform = 'rotate(-90deg)';
            } else {
                 toggle.style.transform = 'rotate(0deg)'; // Đặt lại trạng thái mở
            }

            fieldHeader.appendChild(toggle);
            fieldHeader.appendChild(label);
            fieldGroup.appendChild(fieldHeader);
            fieldGroup.appendChild(input);
            fieldsContainer.appendChild(fieldGroup);

             // [QUAN TRỌNG] Gọi autoExpand một lần ban đầu nếu có nội dung sẵn (ít khi xảy ra khi mới tạo)
             // Hoặc để tính chiều cao đúng cho placeholder nhiều dòng
            autoExpandTextarea({ target: input });

        });

    } catch (error) {
        console.error('Error creating fields:', error);
        showStatus('Không thể tải fields: ' + error.message, 'error'); // Hiển thị lỗi rõ hơn
    }
}

// --- [HÀM ĐƯỢC VIẾT LẠI] Toggle collapse khi click header ---
async function toggleFieldCollapse(event) {
    const fieldHeader = event.currentTarget; // Lấy header được click
    const fieldGroup = fieldHeader.closest('.field-group');
    if (!fieldGroup) return;

    const fieldName = fieldGroup.dataset.fieldName;
    const targetTextarea = fieldGroup.querySelector('.field-input');
    const toggleIcon = fieldHeader.querySelector('.collapse-toggle');
    const label = fieldHeader.querySelector('label');

    if (!targetTextarea || !fieldName || !toggleIcon || !label) return;

    const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed');
    const newState = !isCurrentlyCollapsed; // Trạng thái mới

    // Cập nhật giao diện
    fieldGroup.classList.toggle('collapsed', newState);
    if (newState) {
        targetTextarea.style.display = 'none';
        label.style.opacity = '0.6';
        toggleIcon.style.transform = 'rotate(-90deg)';
    } else {
        targetTextarea.style.display = '';
        label.style.opacity = '1';
        toggleIcon.style.transform = 'rotate(0deg)';
        // [QUAN TRỌNG] Trigger auto-expand khi mở ra để tính lại chiều cao
        autoExpandTextarea({ target: targetTextarea });
    }

    // Lưu trạng thái mới vào storage
    const storageKey = `collapsedFields_${currentModelName}`;
    try {
        const currentState = await chrome.storage.local.get(storageKey);
        const updatedState = currentState[storageKey] || {};
        updatedState[fieldName] = newState;
        await chrome.storage.local.set({ [storageKey]: updatedState });
    } catch (error) { console.error('Error saving collapse state:', error); }
}


// --- Hàm khởi tạo popup (không đổi) ---
document.addEventListener('DOMContentLoaded', async function() { /* ... giữ nguyên code ... */ });
// --- Hàm thêm note vào Anki (không đổi) ---
async function addNoteToAnki() { /* ... giữ nguyên code ... */ }