// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) { /* ... giữ nguyên ... */ }
// --- Hàm createFieldsForModel (không đổi) ---
async function createFieldsForModel(modelName) { /* ... giữ nguyên ... */ }
// --- Hàm toggleFieldCollapse (không đổi) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên ... */ }
// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) { /* ... giữ nguyên ... */ }
// --- Hàm openOptionsPage (không đổi) ---
function openOptionsPage() { /* ... giữ nguyên ... */ }
// --- Hàm showStatus (không đổi) ---
function showStatus(message, type = 'info') { /* ... giữ nguyên ... */ }

// --- [HÀM MỚI] Tạo ID ngẫu nhiên gồm 14 chữ số ---
function generateRandomId(length = 14) {
    let result = '';
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    // Đảm bảo không bắt đầu bằng số 0 nếu cần (ít khi cần cho ID dài)
    // if (result.startsWith('0')) return generateRandomId(length);
    return result;
}


// --- Hàm khởi tạo popup (không đổi) ---
document.addEventListener('DOMContentLoaded', async function() { /* ... giữ nguyên ... */ });


// --- [HÀM ĐƯỢC CẬP NHẬT] Thêm logic tạo Random ID ---
async function addNoteToAnki() {
    try {
        showStatus('Đang thêm...', 'info');
        const deckName = document.getElementById('deck-search').value;
        const modelName = document.getElementById('model-search').value; // = currentModelName
        const tagsInput = document.getElementById('tags-input').value;

        if (!deckName || !modelName || !allDecks.includes(deckName) || !allModels.includes(modelName)) {
            throw new Error('Vui lòng chọn Deck và Note Type hợp lệ từ gợi ý.');
        }

        // [MỚI] Lấy cấu hình Random ID Field cho model hiện tại
        const randomIdFieldKey = `randomIdField_${modelName}`;
        const randomIdSetting = await chrome.storage.local.get(randomIdFieldKey);
        const targetRandomIdField = randomIdSetting[randomIdFieldKey] || null; // Tên field cần điền ID, hoặc null

        // Lấy cấu hình ẩn field
        const hiddenFieldsKey = `hiddenFields_${modelName}`;
        const hiddenData = await chrome.storage.local.get(hiddenFieldsKey);
        const hiddenFields = hiddenData[hiddenFieldsKey] || {};

        const fields = {};
        const fieldInputs = document.querySelectorAll('.field-input');

        if (fieldInputs.length === 0 && modelName) {
             console.warn("Inputs not found, trying to reload fields for model:", modelName);
             await createFieldsForModel(modelName);
             await new Promise(resolve => setTimeout(resolve, 150)); // Chờ lâu hơn chút
             fieldInputs = document.querySelectorAll('.field-input');
             if (fieldInputs.length === 0) throw new Error('Không thể tìm thấy fields.');
        } else if (fieldInputs.length === 0) {
             throw new Error('Vui lòng chọn Note Type.');
        }

        let hasContent = false;
        let randomIdFieldExists = false; // Kiểm tra xem field cấu hình có tồn tại không

        fieldInputs.forEach(input => {
            const fieldName = input.id.replace('field-', '');
            const fieldGroup = input.closest('.field-group');
            const isHiddenBySetting = fieldGroup && fieldGroup.classList.contains('field-hidden-by-setting');

             // Kiểm tra field cấu hình có tồn tại
            if (fieldName === targetRandomIdField) {
                 randomIdFieldExists = true;
            }

            // Chỉ lấy giá trị nếu không bị ẩn VÀ không phải là field random ID (nếu có cấu hình)
            if (!isHiddenBySetting && fieldName !== targetRandomIdField) {
                fields[fieldName] = input.value;
                if (input.value.trim() !== '') {
                    hasContent = true;
                }
            }
            // Nếu là field random ID hoặc bị ẩn, sẽ gán giá trị sau (hoặc để trống)
            else if (!isHiddenBySetting && fieldName === targetRandomIdField) {
                 fields[fieldName] = ''; // Sẽ được ghi đè bởi ID ngẫu nhiên
                 // Vẫn tính là có nội dung nếu field ID được cấu hình
                 hasContent = true;
            } else {
                 fields[fieldName] = ''; // Field bị ẩn thì gửi rỗng
            }
        });

        // [MỚI] Tạo và gán Random ID nếu được cấu hình và field tồn tại
        if (targetRandomIdField && randomIdFieldExists) {
            fields[targetRandomIdField] = generateRandomId();
            console.log(`Generated Random ID for field "${targetRandomIdField}": ${fields[targetRandomIdField]}`);
        } else if (targetRandomIdField && !randomIdFieldExists) {
             console.warn(`Random ID Field "${targetRandomIdField}" configured but not found in the current model's fields.`);
             // Có thể báo lỗi cho người dùng nếu muốn
             // throw new Error(`Field "${targetRandomIdField}" được cấu hình nhận ID ngẫu nhiên không tồn tại.`);
        }


        // Kiểm tra lại hasContent sau khi gán ID (nếu có)
        if (!hasContent && !targetRandomIdField) { // Chỉ lỗi nếu không có nội dung VÀ không có cấu hình ID
             throw new Error('Vui lòng nhập nội dung cho ít nhất một field (không bị ẩn).');
        } else if (!hasContent && targetRandomIdField && !randomIdFieldExists){
             // Trường hợp chỉ có field ID được cấu hình nhưng field đó ko tồn tại -> lỗi
              throw new Error('Field ID ngẫu nhiên được cấu hình không tồn tại và không có nội dung nào khác.');
        }


        const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
        const params = { note: { deckName: deckName, modelName: modelName, fields: fields, tags: tagsArray } };

        console.log("Sending note:", params.note); // Debugging

        const result = await invoke('addNote', params);
        showStatus('Thêm thành công! Note ID: ' + result, 'success');

        // Xóa input fields và tags
        document.querySelectorAll('.field-input').forEach(input => { input.value = ''; });
        document.getElementById('tags-input').value = '';

    } catch (error) { console.error('Error adding note:', error); showStatus('Lỗi: ' + error.message, 'error'); }
}
