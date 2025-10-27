// popup.js
let allDecks = [];
let allModels = [];
let currentModelName = ''; // Lưu model đang chọn để dùng làm key storage

// --- Hàm giao tiếp với Anki-Connect API (không đổi) ---
async function invoke(action, params = {}) {
  // ... (giữ nguyên code hàm invoke) ...
  try {
    const response = await fetch('http://localhost:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        version: 6,
        params: params
      })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.result;
  } catch (error) {
    console.error('Anki-Connect error:', error);
    throw error;
  }
}


// --- [HÀM ĐƯỢC VIẾT LẠI] Hàm tạo fields động, hỗ trợ collapse và ghi nhớ ---
async function createFieldsForModel(modelName) {
  currentModelName = modelName; // Lưu lại model name hiện tại
  try {
    const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
    const fieldsContainer = document.getElementById('fields-container');
    fieldsContainer.innerHTML = ''; // Xóa sạch nội dung cũ

    // Lấy trạng thái collapse đã lưu cho model này
    const storageKey = `collapsedFields_${modelName}`;
    const storedState = await chrome.storage.local.get(storageKey);
    const collapsedFields = storedState[storageKey] || {}; // Lấy object trạng thái, mặc định là {}

    fieldNames.forEach(fieldName => {
      const fieldId = `field-${fieldName}`;
      const isCollapsed = collapsedFields[fieldName] || false; // Mặc định là không collapse

      // Tạo cấu trúc HTML mới
      const fieldGroup = document.createElement('div');
      fieldGroup.className = `form-group field-group ${isCollapsed ? 'collapsed' : ''}`; // Thêm class 'collapsed' nếu cần

      const fieldHeader = document.createElement('div');
      fieldHeader.className = 'field-header';

      const toggle = document.createElement('span');
      toggle.className = 'collapse-toggle';
      toggle.textContent = '▼'; // Icon mặc định
      toggle.dataset.targetId = fieldId; // Lưu id của textarea cần ẩn/hiện
      toggle.dataset.fieldName = fieldName; // Lưu tên field để dùng cho storage
      toggle.addEventListener('click', toggleFieldCollapse); // Gắn sự kiện click

      const label = document.createElement('label');
      label.textContent = fieldName + ':';
      label.htmlFor = fieldId;

      const input = document.createElement('textarea');
      input.id = fieldId;
      input.className = 'form-control field-input';
      input.placeholder = `Nhập nội dung cho ${fieldName}`;
      input.rows = 3;
      if (isCollapsed) {
        input.style.display = 'none'; // Ẩn nếu trạng thái là collapsed
      }

      // Gắn các element vào DOM
      fieldHeader.appendChild(toggle);
      fieldHeader.appendChild(label);
      fieldGroup.appendChild(fieldHeader);
      fieldGroup.appendChild(input);
      fieldsContainer.appendChild(fieldGroup);
    });
    
  } catch (error) {
    console.error('Error creating fields:', error);
    showStatus('Không thể tải thông tin fields cho model này.', 'error');
  }
}

// --- [HÀM MỚI] Xử lý sự kiện collapse/expand và lưu trạng thái ---
async function toggleFieldCollapse(event) {
  const toggle = event.target;
  const fieldName = toggle.dataset.fieldName;
  const targetId = toggle.dataset.targetId;
  const fieldGroup = toggle.closest('.field-group'); // Tìm div cha .field-group
  const targetTextarea = document.getElementById(targetId);

  if (!fieldGroup || !targetTextarea || !fieldName) return;

  const isCurrentlyCollapsed = fieldGroup.classList.contains('collapsed');
  const newState = !isCurrentlyCollapsed; // Trạng thái mới (ngược lại)

  // Cập nhật giao diện
  if (newState) {
    fieldGroup.classList.add('collapsed');
    targetTextarea.style.display = 'none';
    // toggle.textContent = '▶'; // Đổi icon nếu muốn
  } else {
    fieldGroup.classList.remove('collapsed');
    targetTextarea.style.display = '';
    // toggle.textContent = '▼'; // Đổi icon nếu muốn
  }

  // Lưu trạng thái mới vào storage
  const storageKey = `collapsedFields_${currentModelName}`; // Dùng model name hiện tại làm key
  try {
    const currentState = await chrome.storage.local.get(storageKey);
    const updatedState = currentState[storageKey] || {};
    updatedState[fieldName] = newState; // Cập nhật trạng thái cho field này
    await chrome.storage.local.set({ [storageKey]: updatedState });
    console.log(`Saved collapse state for ${currentModelName} - ${fieldName}: ${newState}`);
  } catch (error) {
    console.error('Error saving collapse state:', error);
  }
}


// --- Hàm setupAutocomplete (không đổi) ---
function setupAutocomplete(inputId, containerId, sourceArray, onSelectCallback = null) {
  // ... (giữ nguyên code hàm setupAutocomplete) ...
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  let currentFocus = -1;

  function showSuggestions(value) {
    container.innerHTML = '';
    const valLower = value.toLowerCase();
    const keywords = valLower.split(' ').filter(k => k.trim() !== '');
    const suggestions = sourceArray.filter(item => {
        const target = item.toLowerCase();
        return keywords.every(keyword => target.includes(keyword));
    });
    if (suggestions.length === 0) {
      container.style.display = 'none'; return;
    }
    suggestions.forEach((item) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.textContent = item;
      suggestionItem.addEventListener('click', () => {
        input.value = item; closeAllLists();
        if (onSelectCallback) onSelectCallback(item);
      });
      container.appendChild(suggestionItem);
    });
    container.style.display = 'block'; currentFocus = -1;
  }

  input.addEventListener('input', () => showSuggestions(input.value));
  input.addEventListener('focus', () => showSuggestions(''));
  input.addEventListener('keydown', (e) => {
    let items = container.getElementsByClassName('suggestion-item'); if (items.length === 0) return;
    if (e.keyCode == 40) { e.preventDefault(); currentFocus++; if (currentFocus >= items.length) currentFocus = 0; addActive(items); } 
    else if (e.keyCode == 38) { e.preventDefault(); currentFocus--; if (currentFocus < 0) currentFocus = items.length - 1; addActive(items); } 
    else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) items[currentFocus].click(); } 
    else if (e.keyCode == 27) { closeAllLists(); }
  });

  function addActive(items) {
    if (!items) return false; removeActive(items); if (currentFocus >= items.length) currentFocus = 0; if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active'); items[currentFocus].scrollIntoView({ block: 'nearest' });
  }
  function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove('active'); }
  function closeAllLists() { container.innerHTML = ''; container.style.display = 'none'; }
  document.addEventListener('click', (e) => { if (e.target !== input) closeAllLists(); });
}

// --- Hàm khởi tạo popup (không đổi) ---
document.addEventListener('DOMContentLoaded', async function() {
  // ... (giữ nguyên code hàm DOMContentLoaded) ...
  try {
    allDecks = await invoke('deckNames');
    allModels = await invoke('modelNames');
    console.log("Decks đã tải:", allDecks); console.log("Models đã tải:", allModels);
    setupAutocomplete('deck-search', 'deck-suggestions', allDecks);
    setupAutocomplete('model-search', 'model-suggestions', allModels, (selectedModel) => {
      if (selectedModel) createFieldsForModel(selectedModel);
      else document.getElementById('fields-container').innerHTML = '';
    });
    const tags = await invoke('getTags');
    const tagsDatalist = document.getElementById('tags-datalist');
    tags.forEach(tag => { const option = document.createElement('option'); option.value = tag; tagsDatalist.appendChild(option); });
    document.getElementById('add-note-btn').addEventListener('click', addNoteToAnki);
  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Không thể kết nối với Anki-Connect. Hãy đảm bảo Anki đang chạy và plugin Anki-Connect đã được cài đặt.', 'error');
  }
});

// --- Hàm thêm note vào Anki (không đổi) ---
async function addNoteToAnki() {
  // ... (giữ nguyên code hàm addNoteToAnki) ...
  try {
    showStatus('Đang thêm...', 'info');
    const deckName = document.getElementById('deck-search').value;
    const modelName = document.getElementById('model-search').value;
    const tagsInput = document.getElementById('tags-input').value;
    if (!deckName || !modelName) throw new Error('Vui lòng chọn deck và note type');
    if (!allDecks.includes(deckName)) throw new Error('Tên Deck không hợp lệ. Vui lòng chọn từ gợi ý.');
    if (!allModels.includes(modelName)) throw new Error('Tên Note Type không hợp lệ. Vui lòng chọn từ gợi ý.');
    const fields = {};
    const fieldInputs = document.querySelectorAll('.field-input');
    if (fieldInputs.length === 0) throw new Error('Vui lòng chọn Note Type để hiển thị fields.');
    fieldInputs.forEach(input => { const fieldName = input.id.replace('field-', ''); fields[fieldName] = input.value; });
    const hasContent = Object.values(fields).some(value => value.trim() !== '');
    if (!hasContent) throw new Error('Vui lòng nhập nội dung cho ít nhất một field');
    const tagsArray = tagsInput.split(/[\s,]+/).filter(tag => tag.trim() !== '').map(tag => tag.trim());
    const params = { note: { deckName: deckName, modelName: modelName, fields: fields, tags: tagsArray } };
    const result = await invoke('addNote', params);
    showStatus('Thêm thành công! Note ID: ' + result, 'success');
    fieldInputs.forEach(input => { input.value = ''; }); document.getElementById('tags-input').value = '';
  } catch (error) {
    console.error('Error adding note:', error); showStatus('Lỗi: ' + error.message, 'error');
  }
}

// --- Hàm hiển thị thông báo (không đổi) ---
function showStatus(message, type = 'info') {
  // ... (giữ nguyên code hàm showStatus) ...
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message; statusElement.className = `status-message ${type}`;
}