// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = '';
let statusTimeout = null; // Biến để lưu timeout của status message

// --- Hàm invoke (Đã sửa lỗi xử lý error) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, version: 6, params: params }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json(); if (result.error) throw new Error(result.error); return result.result;
    } catch (error) {
        console.error(`Anki-Connect error in sidebar (${action}):`, error); // Log lỗi cụ thể
        showStatus(`Lỗi (${action}): ${error.message}. Anki/Anki-Connect có đang chạy?`, 'error');
        // Không ném lỗi ở đây nữa để UI vẫn load được phần nào
        return null; // Trả về null để hàm gọi biết có lỗi
    }
}


// --- Hàm createFieldsForModel (Đã cập nhật UI v1.22.0) ---
async function createFieldsForModel(modelName) { /* ... giữ nguyên code v1.22.0 ... */ }
// --- Hàm toggleFieldCollapse (Đã cập nhật UI v1.22.0) ---
async function toggleFieldCollapse(event) { /* ... giữ nguyên code v1.22.0 ... */ }
// --- Hàm autoExpandTextarea (Đã thêm ở v1.22.0) ---
function autoExpandTextarea(event) { /* ... giữ nguyên code v1.22.0 ... */ }
// --- Hàm openOptionsPage (không đổi) ---
function openOptionsPage() { chrome.runtime.openOptionsPage(); }
// --- Hàm generateRandomId (không đổi) ---
function generateRandomId(length = 14) { /* ... giữ nguyên code ... */ }


// --- Hàm setupAutocomplete (Đảm bảo giống hệt settings.js) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  console.log(`Setting up autocomplete for input: #${inputId} with ${sourceArray ? sourceArray.length : 0} items`); // DEBUG
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) { console.error(`Autocomplete setup failed: Cannot find elements #${inputId} or #${containerId}`); return; }
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = ''; const valLower = value.toLowerCase(); const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const validSource = Array.isArray(sourceArray) ? sourceArray : []; // Đảm bảo là mảng
    // console.log(`Filtering ${validSource.length} items with keywords:`, keywords); // DEBUG
    const suggestions = validSource.filter(item => { if (typeof item !== 'string') return false; const target = item.toLowerCase(); return keywords.every(keyword => target.includes(keyword)); });
    // console.log(`Found ${suggestions.length} suggestions for "${value}"`); // DEBUG
    if (suggestions.length === 0) { container.style.display = 'none'; return; }
    suggestions.forEach((item) => { const suggestionItem = document.createElement('div'); suggestionItem.className = 'suggestion-item'; suggestionItem.textContent = item; suggestionItem.addEventListener('click', () => { /* console.log(`Suggestion clicked: ${item}`); */ input.value = item; closeAllLists(); if (onSelectCallback) onSelectCallback(item); }); container.appendChild(suggestionItem); }); // DEBUG comment out
    container.style.display = 'block'; currentFocus = -1;
  }
  input.addEventListener('input', () => { /* console.log(`Input event on #${inputId}: ${input.value}`); */ showSuggestions(input.value); }); // DEBUG comment out
  input.addEventListener('focus', () => { /* console.log(`Focus event on #${inputId}`); */ showSuggestions(''); }); // DEBUG comment out
  input.addEventListener('keydown', (e) => { let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return; /* console.log(`Keydown event on #${inputId}: ${e.keyCode}`); */ if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { items[currentFocus].click(); /* console.log(`Enter pressed on suggestion: ${items[currentFocus].textContent}`); */ } } else if (e.keyCode == 27) { closeAllLists(); /* console.log("Escape pressed"); */ } }); // DEBUG comment out
  function addActive(items) { if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1; items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' }); }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { /* console.log(`Closing suggestions for #${inputId}`); */ container.innerHTML = ''; container.style.display = 'none'; } // DEBUG comment out
  // Sửa lỗi đóng suggestions khi click vào scrollbar
  container.addEventListener('mousedown', (e) => { if (e.target === container) e.preventDefault(); });
  document.addEventListener('click', (e) => { if (e.target !== input && !container.contains(e.target) ) closeAllLists(); });
}

// --- Hàm showStatus (Đã cập nhật v1.20.0) ---
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message; statusElement.className = `status-message ${type}`;
    if (statusTimeout) clearTimeout(statusTimeout);
    if (type === 'success') { statusTimeout = setTimeout(() => { if (statusElement.textContent === message) { statusElement.textContent = ''; statusElement.className = 'status-message'; } statusTimeout = null; }, 4000); }
    else { statusTimeout = null; }
}


// --- Hàm khởi tạo popup (Đảm bảo gọi setupAutocomplete đúng) ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Sidebar (popup.js) loaded"); // DEBUG
    try {
        allDecks = await invoke('deckNames');
        allModels = await invoke('modelNames');

        // Kiểm tra kết quả invoke
        if (allDecks === null || allModels === null) {
             console.error("Failed to load decks or models. Autocomplete might not work.");
             // Không throw lỗi, nhưng hiển thị lỗi qua showStatus đã được gọi trong invoke
             allDecks = Array.isArray(allDecks) ? allDecks : []; // Đảm bảo là mảng
             allModels = Array.isArray(allModels) ? allModels : []; // Đảm bảo là mảng
        } else {
             console.log("Decks loaded for sidebar:", allDecks); // DEBUG
             console.log("Models loaded for sidebar:", allModels); // DEBUG
        }

        // Gọi setupAutocomplete sau khi đã có dữ liệu (hoặc mảng rỗng)
        setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
        setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
            console.log(`Sidebar autocomplete selected: ${selectedModel}`); // DEBUG
            if (selectedModel) createFieldsForModel(selectedModel);
            else document.getElementById('fields-container').innerHTML = '';
        });

        // Tải tags (không cần autocomplete phức tạp)
        const tags = await invoke('getTags');
        const tagsDatalist = document.getElementById('tags-datalist');
        if (Array.isArray(tags)) { // Kiểm tra tags có phải là mảng không
           tags.forEach(tag => { const option = document.createElement('option'); option.value = tag; tagsDatalist.appendChild(option); });
        } else {
            console.warn("invoke('getTags') did not return an array:", tags);
        }


        document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
        document.getElementById('open-settings-link').addEventListener('click', openOptionsPage);

    } catch (error) {
        // Lỗi này chủ yếu xảy ra nếu invoke bị throw (đã sửa) hoặc lỗi DOM khác
        console.error("Unexpected error during sidebar init:", error);
        showStatus('Lỗi không xác định khi khởi tạo sidebar.', 'error');
    }
});

// --- Hàm thêm note vào Anki (không đổi từ v1.19.0) ---
async function addNoteToAnki() { /* ... giữ nguyên code ... */ }