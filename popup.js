/**
 * popup.js
 * * Logic cho AnkiVN MUAHAHA Extension Sidebar.
 * Quản lý việc lấy decks, models, tạo fields, thêm note,
 * quản lý presets, media preview, và rich text formatting.
 */

// --- Globals ---
const ANKI_CONNECT_URL = "http://localhost:8765";
const ANKI_CONNECT_VERSION = 6;
const HEADER_COLLAPSE_KEY = 'ankivn_header_collapsed';
const LAST_USED_DECK_KEY = 'ankivn_lastUsedDeck';
const LAST_USED_MODEL_KEY = 'ankivn_lastUsedModel';
const PRESETS_KEY = 'ankivn_presets';

let modelFieldsCache = {}; // Cache { modelName: [field1, field2] }
let modelTemplatesCache = {}; // Cache { modelName: [...] }
let modelCssCache = {}; // Cache { modelName: "css..." }

let activeElement = null; // Theo dõi field (div contenteditable) đang focus
let currentClozeIndex = 1; // Theo dõi chỉ số cloze
let currentPlayingAudio = null; // Theo dõi audio đang phát

// --- Anki-Connect API ---

/**
 * Gửi yêu cầu đến Anki-Connect
 * @param {string} action - Tên action (vd: 'deckNames')
 * @param {object} params - Các tham số cho action
 * @returns {Promise<any>} - Kết quả từ Anki-Connect
 */
async function invoke(action, params = {}) {
  console.log(`invoke: ${action}`, params);
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: action,
        version: ANKI_CONNECT_VERSION,
        params: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Anki-Connect error: ${data.error}`);
    }

    console.log(`invoke success: ${action}`, data.result);
    return data.result;
  } catch (error) {
    console.error(`Error invoking Anki-Connect action '${action}':`, error);
    // Ném lỗi ra ngoài để DOMContentLoaded có thể bắt
    throw error;
  }
}

// --- DOMContentLoaded (Main Entry Point) ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("AnkiVN MUAHAHA Sidebar DOMContentLoaded - v1.46.0 Fix Applied");

  const deckInput = document.getElementById("deck-search");
  const modelInput = document.getElementById("model-search");
  const tagsInput = document.getElementById("tags-input"); // Sửa ID nếu cần
  const addNoteBtn = document.getElementById("add-note-btn");
  const openSettingsLink = document.getElementById("open-settings-link");
  const statusMessage = document.getElementById("status-message");
  const toggleHeaderBtn = document.getElementById('toggle-header-btn');

  // Preset controls
  const presetSelect = document.getElementById('preset-select');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');

  // Hàm hiển thị trạng thái
  const showStatus = (message, isError = false) => {
    console.log(`showStatus (isError: ${isError}): ${message}`);
    statusMessage.textContent = message;
    statusMessage.className = isError ? "status-error" : "status-success";
    statusMessage.style.display = "block";

    // Tự động ẩn thông báo thành công
    if (!isError) {
      setTimeout(() => {
        if (statusMessage.textContent === message) {
          statusMessage.style.display = "none";
          statusMessage.textContent = "";
        }
      }, 4000);
    }
  };

  // --- Header Collapse Logic ---
  const setHeaderCollapsed = (isCollapsed) => {
    if (isCollapsed) {
      document.body.classList.add('header-collapsed');
      toggleHeaderBtn.textContent = '🔽';
      toggleHeaderBtn.title = 'Hiện header';
    } else {
      document.body.classList.remove('header-collapsed');
      toggleHeaderBtn.textContent = '🔼';
      toggleHeaderBtn.title = 'Ẩn header';
    }
  };

  toggleHeaderBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isCollapsed = document.body.classList.contains('header-collapsed');
    setHeaderCollapsed(!isCollapsed);
    chrome.storage.local.set({ [HEADER_COLLAPSE_KEY]: !isCollapsed });
  });

  // Khôi phục trạng thái collapse
  chrome.storage.local.get(HEADER_COLLAPSE_KEY, (result) => {
    setHeaderCollapsed(result[HEADER_COLLAPSE_KEY] || false);
  });

  // --- Preset Logic ---
  const loadPresets = async () => {
    presetSelect.innerHTML = '<option value="">Chọn preset...</option>';
    try {
      const result = await chrome.storage.local.get(PRESETS_KEY);
      const presets = result[PRESETS_KEY] || {};
      for (const presetName in presets) {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        presetSelect.appendChild(option);
      }
    } catch (e) {
      console.error("Error loading presets:", e);
    }
  };

  const saveCurrentPreset = async () => {
    const presetName = prompt("Đặt tên cho preset này:", presetSelect.value || "Preset mới");
    if (!presetName) return;

    try {
      const result = await chrome.storage.local.get(PRESETS_KEY);
      const presets = result[PRESETS_KEY] || {};
      presets[presetName] = {
        deckName: deckInput.value,
        modelName: modelInput.value,
        tags: tagsInput.value // Sửa ID nếu cần
      };
      await chrome.storage.local.set({ [PRESETS_KEY]: presets });
      await loadPresets();
      presetSelect.value = presetName;
      showStatus(`Đã lưu preset '${presetName}'`);
    } catch (e) {
      console.error("Error saving preset:", e);
      showStatus(`Lỗi khi lưu preset: ${e.message}`, true);
    }
  };

  const deleteCurrentPreset = async () => {
    const presetName = presetSelect.value;
    if (!presetName) {
      showStatus("Vui lòng chọn preset để xóa", true);
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa preset '${presetName}'?`)) {
      return;
    }

    try {
      const result = await chrome.storage.local.get(PRESETS_KEY);
      const presets = result[PRESETS_KEY] || {};
      delete presets[presetName];
      await chrome.storage.local.set({ [PRESETS_KEY]: presets });
      await loadPresets();
      showStatus(`Đã xóa preset '${presetName}'`);
    } catch (e) {
      console.error("Error deleting preset:", e);
      showStatus(`Lỗi khi xóa preset: ${e.message}`, true);
    }
  };

  const applyPreset = async (presetName) => {
    if (!presetName) return;

    try {
      const result = await chrome.storage.local.get(PRESETS_KEY);
      const presets = result[PRESETS_KEY] || {};
      const preset = presets[presetName];
      if (preset) {
        deckInput.value = preset.deckName || "";
        modelInput.value = preset.modelName || "";
        tagsInput.value = preset.tags || ""; // Sửa ID nếu cần
        showStatus(`Đã áp dụng preset '${presetName}'`);
        // Tự động tải fields
        if (preset.modelName) {
          await createFieldsForModel(preset.modelName, showStatus);
        } else {
          document.getElementById("fields-container").innerHTML = ""; // Xóa fields nếu preset không có model
        }
      }
    } catch (e) {
      console.error("Error applying preset:", e);
      showStatus(`Lỗi khi áp dụng preset: ${e.message}`, true);
    }
  };

  // Gán sự kiện cho preset
  presetSelect.addEventListener('change', () => applyPreset(presetSelect.value));
  savePresetBtn.addEventListener('click', saveCurrentPreset);
  deletePresetBtn.addEventListener('click', deleteCurrentPreset);

  // --- Tải dữ liệu ban đầu ---
  try {
    const [deckNames, modelNames, tagNames] = await Promise.all([
      invoke("deckNames"),
      invoke("modelNames"),
      invoke("getTags"),
      loadPresets()
    ]);

    if (!Array.isArray(deckNames) || !Array.isArray(modelNames) || !Array.isArray(tagNames)) {
      throw new Error("Dữ liệu trả về từ Anki-Connect không hợp lệ.");
    }

    console.log("Decks, models, tags loaded.");

    // Setup autocomplete cho Decks
    setupAutocomplete(
      deckInput.parentElement.parentElement, // Truy cập div.form-group chứa input
      deckInput,
      deckNames
    );

    // Setup autocomplete cho Models
    setupAutocomplete(
      modelInput.parentElement.parentElement, // Truy cập div.form-group chứa input
      modelInput,
      modelNames,
      async (selectedModel) => {
        console.log(`Model selected via autocomplete: ${selectedModel}`);
        await createFieldsForModel(selectedModel, showStatus);
      }
    );

    // Setup datalist cho Tags (dùng datalist chuẩn của HTML)
    const tagDatalist = document.getElementById("tags-datalist"); // Sửa ID nếu cần
    tagDatalist.innerHTML = "";
    tagNames.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      tagDatalist.appendChild(option);
    });

    // Khôi phục deck/model cuối cùng
    const lastUsed = await chrome.storage.local.get([LAST_USED_DECK_KEY, LAST_USED_MODEL_KEY]);
    if (lastUsed[LAST_USED_DECK_KEY]) {
      deckInput.value = lastUsed[LAST_USED_DECK_KEY];
      console.log(`Restored last used deck: ${deckInput.value}`);
    }
    if (lastUsed[LAST_USED_MODEL_KEY]) {
      modelInput.value = lastUsed[LAST_USED_MODEL_KEY];
      console.log(`Restored last used model: ${modelInput.value}`);
      // Tự động tải fields
      await createFieldsForModel(modelInput.value, showStatus);
    }

  } catch (error) {
    console.error("Failed to initialize popup:", error);
    showStatus(`Lỗi kết nối Anki-Connect: ${error.message}. Hãy chắc chắn Anki đang chạy và Anki-Connect đã được cài đặt.`, true);
  }

  // --- Gán sự kiện cho các nút ---

  // *** FIX v1.46.0: Settings Button ***
  if (openSettingsLink) {
    openSettingsLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // Ngăn event bubble lên các element cha
      console.log("Opening settings page...");
      // Giả sử background script có listener để mở options page
      chrome.runtime.sendMessage({ action: "openOptionsPage" }).catch(err => {
          console.error("Error sending message to open options page:", err);
          showStatus("Không thể mở trang cài đặt.", true);
      });
    });
  } else {
    console.error("Could not find #open-settings-link");
  }


  // --- Format toolbar listeners ---
  // (Sử dụng 'mousedown' và 'preventDefault' để tránh mất focus)
  document.getElementById('format-bold')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('bold'); });
  document.getElementById('format-italic')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('italic'); });
  document.getElementById('format-underline')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('underline'); });
  document.getElementById('format-remove')?.addEventListener('mousedown', (e) => { e.preventDefault(); applyFormat('removeFormat'); });
  document.getElementById('format-cloze')?.addEventListener('mousedown', (e) => { e.preventDefault(); addCloze(); }); // Sửa lại tên ID nếu cần

  // Color pickers
  document.getElementById('format-forecolor')?.addEventListener('input', (e) => { // ID nút có thể khác
    if (!activeElement) return;
    activeElement.focus();
    applyFormat('foreColor', e.target.value);
  });
  document.getElementById('format-backcolor')?.addEventListener('input', (e) => { // ID nút có thể khác
    if (!activeElement) return;
    activeElement.focus();
    applyFormat('backColor', e.target.value);
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    if (!activeElement || activeElement.tagName !== 'DIV' || !activeElement.isContentEditable) return; // Chỉ áp dụng cho div contenteditable

    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); applyFormat('bold'); break;
        case 'i': e.preventDefault(); applyFormat('italic'); break;
        case 'u': e.preventDefault(); applyFormat('underline'); break;
        case 'c':
          if (e.shiftKey) { e.preventDefault(); addCloze(); }
          break;
      }
    }
  });

  // Nút Thêm Note
  addNoteBtn.addEventListener("click", async () => {
    statusMessage.style.display = "none";
    statusMessage.textContent = "";

    const deckName = deckInput.value;
    const modelName = modelInput.value;
    const currentTags = tagsInput.value // Sửa ID nếu cần
      .split(/[\s,]+/)
      .filter((tag) => tag.length > 0);

    if (!deckName) { showStatus("Vui lòng chọn Deck", true); deckInput.focus(); return; }
    if (!modelName) { showStatus("Vui lòng chọn Note Type", true); modelInput.focus(); return; }

    await addNoteToAnki(deckName, modelName, currentTags, showStatus);
  });

  // Lắng nghe nội dung từ context menu
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fillField") { // Đổi tên action nếu cần
      console.log("Received message to fill field:", message);
      const { fieldName, content, contentType } = message; // Đổi fieldName nếu cần

      const targetDiv = document.querySelector(`.field-input-div[data-field="${fieldName}"]`);

      if (targetDiv) {
        console.log(`Found target field: ${fieldName}`);

        let contentToInsert = "";
        if (contentType === 'image') {
          contentToInsert = `<img src="${content}">`;
        } else { // text, audio (sound:...), link
          contentToInsert = escapeHTML(content);
        }

        targetDiv.focus();
        document.execCommand('insertHTML', false, contentToInsert);
        targetDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

        const fieldGroup = targetDiv.closest(".field-group");
        if (fieldGroup && fieldGroup.classList.contains("collapsed")) {
          toggleFieldCollapse(fieldGroup); // Hàm này cần được định nghĩa
        }

        showStatus(`Đã thêm nội dung vào field "${fieldName}"`);
        sendResponse({ success: true });
      } else {
        console.warn(`Field "${fieldName}" not found in UI.`);
        showStatus(`Field "${fieldName}" không tìm thấy.`, true);
        sendResponse({ success: false, error: "Field not found" });
      }
    }
    // `return true;` nếu bạn cần gửi response bất đồng bộ
  });

}); // --- End of DOMContentLoaded ---

// --- Autocomplete Function ---
/**
 * Thiết lập autocomplete
 * @param {HTMLElement} containerElement - Element cha chứa input và suggestions
 * @param {HTMLInputElement} inputElement - Ô input
 * @param {string[]} suggestionsArray - Danh sách gợi ý
 * @param {function(string)} [selectCallback] - Callback khi chọn
 */
function setupAutocomplete(containerElement, inputElement, suggestionsArray, selectCallback = null) {
  let suggestionsContainer = containerElement.querySelector(".suggestions-container");
  if (!suggestionsContainer) {
    console.error("Suggestions container not found within:", containerElement);
    return;
  }

  let activeSuggestionIndex = -1;

  const filterAndShowSuggestions = () => {
    const value = inputElement.value.toLowerCase();
    const keywords = value.split(/\s+/).filter(Boolean);
    suggestionsContainer.innerHTML = "";
    activeSuggestionIndex = -1;

    // Chỉ hiển thị khi input đang focus HOẶC có giá trị
    const shouldShow = document.activeElement === inputElement || value.length > 0;
    if (!shouldShow) {
        suggestionsContainer.style.display = "none";
        return;
    }

    const filtered = suggestionsArray.filter((item) => {
      const target = item.toLowerCase();
      return keywords.every(keyword => target.includes(keyword));
    });

    filtered.forEach((item) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.textContent = item;
      // *** FIX v1.46.0: Bỏ click listener ở đây ***
      // div.addEventListener("click", () => { ... });
      suggestionsContainer.appendChild(div);
    });

    suggestionsContainer.style.display = filtered.length > 0 ? "block" : "none";
  };

  const highlightSuggestion = () => {
    const items = suggestionsContainer.querySelectorAll(".suggestion-item");
    items.forEach((item, index) => {
      if (index === activeSuggestionIndex) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  };

  inputElement.addEventListener("input", filterAndShowSuggestions);
  inputElement.addEventListener("focus", filterAndShowSuggestions);
  inputElement.addEventListener("keydown", (e) => {
    const items = suggestionsContainer.querySelectorAll(".suggestion-item");
    if (suggestionsContainer.style.display === 'none' || items.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
        highlightSuggestion();
        break;
      case "ArrowUp":
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
        highlightSuggestion();
        break;
      case "Enter":
        e.preventDefault();
        if (activeSuggestionIndex > -1) {
          const selectedText = items[activeSuggestionIndex].textContent;
          inputElement.value = selectedText;
          suggestionsContainer.style.display = "none";
          if (selectCallback) selectCallback(selectedText);
        } else {
          // Nếu không có gì highlight, chỉ ẩn list
           suggestionsContainer.style.display = "none";
        }
        break;
      case "Escape":
         suggestionsContainer.style.display = "none";
         break;
    }
  });

  // *** FIX v1.46.0: Sử dụng mousedown trên container ***
  suggestionsContainer.addEventListener('mousedown', (e) => {
    // Luôn ngăn input mất focus khi tương tác với danh sách gợi ý
    e.preventDefault();

    let target = e.target;
    // Tìm element .suggestion-item gần nhất được click
    while (target && target !== suggestionsContainer) {
      if (target.classList.contains('suggestion-item')) {
        const selectedText = target.textContent;
        inputElement.value = selectedText;
        suggestionsContainer.style.display = "none"; // Ẩn danh sách
        if (selectCallback) selectCallback(selectedText); // Gọi callback
        return; // Kết thúc xử lý
      }
      target = target.parentElement;
    }
    // Nếu click vào scrollbar hoặc khoảng trống, không làm gì cả (chỉ preventDefault)
  });


  // Đóng khi click ra ngoài input và suggestion container
  document.addEventListener("click", (e) => {
    if (e.target !== inputElement && !containerElement.contains(e.target)) {
      suggestionsContainer.style.display = "none";
    }
  });
}


// --- Các hàm khác (giữ nguyên từ v1.43.0) ---

// (Hàm này cần được cập nhật nếu cấu trúc HTML thay đổi)
function toggleFieldCollapse(fieldGroupOrHeader) {
  let fieldGroup = fieldGroupOrHeader.classList?.contains('field-group')
    ? fieldGroupOrHeader
    : fieldGroupOrHeader.closest('.field-group');

  if (!fieldGroup) return;

  const isCollapsed = fieldGroup.classList.toggle("collapsed");
  const modelName = fieldGroup.dataset.model;
  const fieldName = fieldGroup.dataset.field;
  const toggleIcon = fieldGroup.querySelector(".collapse-toggle");
  const label = fieldGroup.querySelector(".field-label"); // Lấy label nếu cần

  if (toggleIcon) {
    toggleIcon.textContent = isCollapsed ? "▶" : "🔽";
  }
  if (label) {
      label.style.opacity = isCollapsed ? "0.7" : "1";
  }


  // Lưu trạng thái
  if (modelName && fieldName) {
    const key = `field_collapse_${modelName}`; // Đổi key nếu cần
    chrome.storage.local.get([key], (result) => {
      const collapsedFields = result[key] || {};
      collapsedFields[fieldName] = isCollapsed;
      chrome.storage.local.set({ [key]: collapsedFields });
    });
  }
}


function handleInputEvent(e) {
  const div = e.target;
  const fieldGroup = div.closest('.field-group');
  if (!fieldGroup) return;
  const previewContainer = fieldGroup.querySelector('.media-preview-container');
  if (previewContainer) {
    updateMediaPreview(div.innerHTML, previewContainer);
  }
}

function handleFocusEvent(e) {
  activeElement = e.target;
  console.log("Focus set on:", activeElement.dataset.field);
}

function handleBlurEvent(e) {
  // Có thể không cần làm gì ở đây nếu dùng mousedown cho toolbar
}


async function updateMediaPreview(content, previewContainer) {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    const currentPreviewId = `preview-${previewCounter++}`;
    previewContainer.dataset.previewId = currentPreviewId;

    const imgRegex = /<img\s+src="([^"]+)"[^>]*>/g;
    const audioRegex = /\[sound:([^\]]+)\]/g;
    let imgMatch = imgRegex.exec(content);
    let audioMatch = audioRegex.exec(content);

    if (!imgMatch && !audioMatch) {
        previewContainer.style.display = 'none'; return;
    }
    previewContainer.style.display = 'block';

    // Xử lý ảnh (giữ nguyên)
    while (imgMatch) {
        const filename = imgMatch[1]; if (!filename) { imgMatch = imgRegex.exec(content); continue; }
        const wrapper = document.createElement('div'); wrapper.className = 'preview-loading'; wrapper.textContent = `Đang tải ${filename}...`; previewContainer.appendChild(wrapper);
        try {
            const base64Data = await invoke('retrieveMediaFile', { filename }); if (previewContainer.dataset.previewId !== currentPreviewId) return;
            if (base64Data) {
                const mime = base64Data.startsWith('data:') ? base64Data.split(';')[0].split(':')[1] : 'image/jpeg'; const src = base64Data.startsWith('data:') ? base64Data : `data:${mime};base64,${base64Data}`;
                const img = document.createElement('img'); img.src = src; img.alt = `Preview ${filename}`; img.className = 'preview-image'; img.title = `Click để xem lớn: ${filename}`; img.addEventListener('click', (e) => { e.stopPropagation(); showImageModal(src, filename); }); wrapper.innerHTML = ''; wrapper.className = ''; wrapper.appendChild(img);
            } else { throw new Error("No base64 data received"); }
        } catch (err) { console.error(`Error loading image preview ${filename}:`, err); if (previewContainer.dataset.previewId === currentPreviewId) { wrapper.textContent = `Lỗi tải ${filename}`; wrapper.className = 'preview-error'; } }
        imgMatch = imgRegex.exec(content);
    }
    // Xử lý audio (giữ nguyên)
     while (audioMatch) {
        const filename = audioMatch[1]; if (!filename) { audioMatch = audioRegex.exec(content); continue; }
        const btn = document.createElement('button'); btn.className = 'preview-audio-button btn-secondary'; btn.textContent = '🔊 Nghe'; btn.title = `Phát file: ${filename}`;
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); if (btn.classList.contains('playing')) { stopCurrentAudio(); return; } stopCurrentAudio(); btn.disabled = true; btn.textContent = 'Đang tải...';
            try {
                const base64Data = await invoke('retrieveMediaFile', { filename }); if (previewContainer.dataset.previewId !== currentPreviewId) return;
                if (base64Data) {
                    const mime = base64Data.startsWith('data:') ? base64Data.split(';')[0].split(':')[1] : 'audio/mpeg'; const src = base64Data.startsWith('data:') ? base64Data : `data:${mime};base64,${base64Data}`;
                    const audio = new Audio(src); currentPlayingAudio = audio;
                    audio.addEventListener('play', () => { btn.textContent = '⏸️ Dừng'; btn.disabled = false; btn.classList.add('playing'); });
                    audio.addEventListener('ended', stopCurrentAudio); audio.addEventListener('error', (err) => { console.error(`Error playing audio ${filename}:`, err); showStatus(`Lỗi phát audio ${filename}`, true); stopCurrentAudio(); }); audio.play();
                } else { throw new Error("No base64 data received"); }
            } catch (err) { console.error(`Error loading audio ${filename}:`, err); showStatus(`Lỗi tải audio ${filename}: ${err.message}`, true); stopCurrentAudio(); }
        }); previewContainer.appendChild(btn);
        audioMatch = audioRegex.exec(content);
    }
}


function showImageModal(src, caption) {
    const modal = document.getElementById('image-preview-modal');
    const modalImg = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    const modalClose = document.querySelector('.modal-close-btn'); // Sửa selector nếu cần

    modalImg.src = src;
    modalCaption.textContent = caption;
    modal.style.display = 'block';

    const closeModal = () => {
        modal.style.display = 'none';
        modalClose.removeEventListener('click', closeModal);
        modal.removeEventListener('click', closeModalOutside); // Sửa tên hàm nếu cần
    };
    const closeModalOutside = (e) => { if (e.target === modal) closeModal(); };

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', closeModalOutside);
}


function stopCurrentAudio() {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.currentTime = 0;
    currentPlayingAudio = null;
    document.querySelectorAll('.preview-audio-button.playing').forEach(btn => {
      btn.classList.remove('playing');
      btn.textContent = '🔊 Nghe';
      btn.disabled = false;
    });
  }
}

function applyFormat(command, value = null) {
  if (!activeElement || activeElement.tagName !== 'DIV' || !activeElement.isContentEditable) {
      console.warn("ApplyFormat: No active contenteditable element."); return;
  }
  activeElement.focus();
  try { document.execCommand(command, false, value); }
  catch (e) { console.error(`Error executing format command '${command}':`, e); }
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}


function addCloze() {
  if (!activeElement || activeElement.tagName !== 'DIV' || !activeElement.isContentEditable) {
      console.warn("AddCloze: No active contenteditable element."); return;
  }
  activeElement.focus();
  const selection = window.getSelection();
  const clozeText = `{{c${currentClozeIndex}::${selection.toString() || ''}}}`;
  document.execCommand('insertText', false, clozeText);
  currentClozeIndex++;
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}


async function createFieldsForModel(modelName, showStatus) {
  const fieldsContainer = document.getElementById("fields-container");
  if (!modelName) { fieldsContainer.innerHTML = ""; return; }
  console.log(`Creating fields for model: ${modelName}`);
  fieldsContainer.innerHTML = '<div class="loading-spinner">Đang tải fields...</div>';

  try {
    const fieldNames = await invoke("modelFieldNames", { modelName });
    if (!Array.isArray(fieldNames)) throw new Error("Could not get field names.");

    chrome.runtime.sendMessage({ action: "updateContextMenuFields", modelName: modelName, fieldNames: fieldNames })
          .catch(err => console.warn("Could not update context menu fields:", err));

    const collapseKey = `field_collapse_${modelName}`;
    const hiddenKey = `hiddenFields_${modelName}`;
    const settings = await chrome.storage.local.get([collapseKey, hiddenKey]);
    const collapsedFields = settings[collapseKey] || {};
    const hiddenFields = settings[hiddenKey] || {}; // Phải là object {fieldName: true/false}

    fieldsContainer.innerHTML = "";

    fieldNames.forEach((fieldName) => {
      // Sửa kiểm tra hidden:
      const isHidden = hiddenFields[fieldName] === true;
      if (isHidden) { console.log(`Field "${fieldName}" is hidden.`); return; }

      const isCollapsed = collapsedFields[fieldName] || false;
      const fieldGroupId = `field-group-${fieldName.replace(/\s+/g, '-')}`;

      const fieldGroup = document.createElement("div");
      fieldGroup.className = `field-group ${isCollapsed ? "collapsed" : ""}`;
      fieldGroup.id = fieldGroupId;
      fieldGroup.dataset.field = fieldName;
      fieldGroup.dataset.model = modelName;
      // fieldGroup.dataset.viewMode = 'normal'; // Bỏ view mode

      const fieldHeader = document.createElement("div");
      fieldHeader.className = "field-header";
      // Gán listener vào header
       fieldHeader.addEventListener("click", (e) => {
           // Ngăn collapse khi click vào preview hoặc nút toggle view (nếu có)
           if (e.target.closest('.media-preview-container') || e.target.closest('.btn-toggle-view')) return;
           toggleFieldCollapse(fieldGroup); // Gọi hàm toggle
       });

      const collapseToggle = document.createElement("span");
      collapseToggle.className = "collapse-toggle";
      collapseToggle.textContent = isCollapsed ? "▶" : "🔽";
      collapseToggle.title = "Thu gọn/Mở rộng";

      const fieldLabel = document.createElement("label");
      fieldLabel.className = "field-label";
      fieldLabel.textContent = fieldName;
      // fieldLabel.htmlFor = `field-${fieldName}`; // Không cần htmlFor cho div
      if (isCollapsed) fieldLabel.style.opacity = "0.7";

      fieldHeader.appendChild(collapseToggle);
      fieldHeader.appendChild(fieldLabel);

      const inputArea = document.createElement('div');
      inputArea.className = 'field-input-area';

      const fieldDiv = document.createElement('div');
      // fieldDiv.id = `field-${fieldName}`; // Id có thể không cần nếu dùng dataset để truy vấn
      fieldDiv.className = 'field-input-div form-control';
      fieldDiv.contentEditable = 'true';
      fieldDiv.dataset.field = fieldName;
      fieldDiv.setAttribute('data-placeholder', `Nhập ${fieldName}...`); // Placeholder

      fieldDiv.addEventListener('input', handleInputEvent);
      fieldDiv.addEventListener('focus', handleFocusEvent);
      fieldDiv.addEventListener('blur', handleBlurEvent);

      const mediaPreviewContainer = document.createElement('div');
      mediaPreviewContainer.className = 'media-preview-container';

      updateMediaPreview(fieldDiv.innerHTML, mediaPreviewContainer); // Cập nhật lần đầu

      inputArea.appendChild(fieldDiv);
      inputArea.appendChild(mediaPreviewContainer);

      fieldGroup.appendChild(fieldHeader);
      fieldGroup.appendChild(inputArea);

      fieldsContainer.appendChild(fieldGroup);
    });

  } catch (error) {
    console.error(`Error creating fields for ${modelName}:`, error);
    showStatus(`Lỗi tải fields: ${error.message}`, true);
    fieldsContainer.innerHTML = `<div class="status-error">Lỗi tải fields: ${error.message}</div>`;
  }
}

async function addNoteToAnki(deckName, modelName, tags, showStatus) {
  try {
    const fields = {};
    let hasContent = false;
    const hiddenKey = `hiddenFields_${modelName}`;
    const randomIdKey = `randomIdField_${modelName}`;
    const stickyKey = `stickyFields_${modelName}`; // Thêm sticky key
    // Lấy cả 3 cài đặt cùng lúc
    const settings = await chrome.storage.local.get([hiddenKey, randomIdKey, stickyKey]);
    const hiddenFields = settings[hiddenKey] || {};
    const randomIdField = settings[randomIdKey] || null;
    const stickyFields = settings[stickyKey] || {}; // Lấy sticky fields

    let fieldNames = modelFieldsCache[modelName];
    if (!fieldNames) {
      fieldNames = await invoke("modelFieldNames", { modelName });
      modelFieldsCache[modelName] = fieldNames;
    }
     if (!Array.isArray(fieldNames)) { // Thêm kiểm tra
         throw new Error("Invalid field names received.");
     }


    fieldNames.forEach((fieldName) => {
      // Sử dụng === true để kiểm tra hidden
      if (hiddenFields[fieldName] === true) { fields[fieldName] = ""; return; }

      if (fieldName === randomIdField) {
        fields[fieldName] = generateRandomId(); hasContent = true; return;
      }

      const fieldDiv = document.querySelector(`.field-input-div[data-field="${fieldName}"]`);
      if (fieldDiv) {
        const content = fieldDiv.innerHTML; fields[fieldName] = content;
        // Kiểm tra content chặt chẽ hơn
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = content;
        if (tempDiv.textContent.trim() || tempDiv.querySelector('img, audio, video')) { // Có text hoặc media tag
             hasContent = true;
        }
      } else { fields[fieldName] = ""; } // Field không hiển thị -> rỗng
    });

    if (!hasContent) {
      showStatus("Vui lòng nhập nội dung cho ít nhất một field (ngoài field ID)", true); return;
    }

    const result = await invoke("addNote", { note: { deckName, modelName, fields, tags } });
    if (!result) throw new Error("Không thể thêm note. ID trả về là null.");

    showStatus(`Note đã được thêm thành công (ID: ${result})`);
    await chrome.storage.local.set({ [LAST_USED_DECK_KEY]: deckName, [LAST_USED_MODEL_KEY]: modelName });

    // Xóa fields không được ghim (stickyFields[fieldName] !== true)
    document.querySelectorAll(".field-input-div").forEach(fieldDiv => {
      const fieldName = fieldDiv.dataset.field;
      // Chỉ xóa nếu fieldName tồn tại VÀ không được ghim
      if (fieldName && stickyFields[fieldName] !== true) {
           fieldDiv.innerHTML = ''; // Xóa nội dung div
           // Cập nhật preview tương ứng
           const group = fieldDiv.closest('.field-group');
           const preview = group?.querySelector('.media-preview-container');
           if (preview) updateMediaPreview('', preview);
      }
    });

    // Reset cloze
    currentClozeIndex = 1;

     // Xóa tags nếu không được ghim (tạm coi 'Tags' là key ảo)
     if (stickyFields['Tags'] !== true) {
         document.getElementById('tags-input').value = ''; // Sửa ID nếu cần
     }


  } catch (error) {
    console.error("Error adding note:", error);
    showStatus(`Lỗi khi thêm note: ${error.message}`, true);
  }
}

function generateRandomId() {
  const p1 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const p2 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return p1 + p2;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

// Global preview counter (để tránh race condition khi load preview)
let previewCounter = 0;
