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

let activeElement = null; // (v1.39.0) Theo dõi field (div contenteditable) đang focus
let currentClozeIndex = 1; // (v1.39.0) Theo dõi chỉ số cloze
let currentPlayingAudio = null; // (v1.37.0) Theo dõi audio đang phát

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
    // (v1.26.0) Ném lỗi ra ngoài để DOMContentLoaded có thể bắt
    throw error;
  }
}

// --- DOMContentLoaded (Main Entry Point) ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("AnkiVN MUAHAHA Sidebar DOMContentLoaded");

  const deckInput = document.getElementById("deck-name");
  const modelInput = document.getElementById("model-name");
  const tagsInput = document.getElementById("tags");
  const addNoteBtn = document.getElementById("add-note-btn");
  const openSettingsLink = document.getElementById("open-settings-link");
  const statusMessage = document.getElementById("status-message");
  const toggleHeaderBtn = document.getElementById('toggle-header-btn'); // (v1.42.0)

  // (v1.36.0) Preset controls
  const presetSelect = document.getElementById('preset-select');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');

  // Hàm hiển thị trạng thái
  const showStatus = (message, isError = false) => {
    console.log(`showStatus (isError: ${isError}): ${message}`);
    statusMessage.textContent = message;
    statusMessage.className = isError ? "status-error" : "status-success";
    statusMessage.style.display = "block";

    // (v1.19.0) Tự động ẩn thông báo thành công
    if (!isError) {
      setTimeout(() => {
        if (statusMessage.textContent === message) {
          statusMessage.style.display = "none";
          statusMessage.textContent = "";
        }
      }, 4000);
    }
  };

  // --- (v1.42.0) Header Collapse Logic ---
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

  // --- (v1.36.0) Preset Logic ---
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
        tags: tagsInput.value
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
        tagsInput.value = preset.tags || "";
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
      loadPresets() // (v1.36.0)
    ]);

    if (!Array.isArray(deckNames) || !Array.isArray(modelNames) || !Array.isArray(tagNames)) {
      throw new Error("Dữ liệu trả về từ Anki-Connect không hợp lệ.");
    }

    console.log("Decks, models, tags loaded.");

    // (v1.10.0) Setup autocomplete cho Decks
    setupAutocomplete(
      document.getElementById("deck-input-group"),
      deckInput,
      deckNames
    );

    // (v1.10.0) Setup autocomplete cho Models
    setupAutocomplete(
      document.getElementById("model-input-group"),
      modelInput,
      modelNames,
      async (selectedModel) => {
        // (v1.26.0) Callback khi chọn model
        console.log(`Model selected: ${selectedModel}`);
        await createFieldsForModel(selectedModel, showStatus);
      }
    );

    // Setup datalist cho Tags (dùng datalist chuẩn của HTML)
    const tagDatalist = document.getElementById("tag-suggestions");
    tagDatalist.innerHTML = "";
    tagNames.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      tagDatalist.appendChild(option);
    });

    // (v1.36.0) Khôi phục deck/model cuối cùng
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

  // (v1.26.0) Sửa lỗi nút Settings
  if (openSettingsLink) {
    openSettingsLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // (v1.46.0) Ngăn event bubble
      console.log("Opening settings page...");
      chrome.runtime.sendMessage({ action: "openOptionsPage" });
    });
  } else {
    console.error("Could not find #open-settings-link");
  }

  // (v1.39.0) Khởi tạo `activeElement` khi focus vào field
  // (Logic này giờ nằm trong `createFieldsForModel` vì field được tạo động)

  // --- Format toolbar listeners (v1.39.0) ---
  // v1.44.0: Chuyển sang 'mousedown' và 'preventDefault' để tránh mất focus
  document.getElementById('format-bold').addEventListener('mousedown', (e) => {
    e.preventDefault(); // Ngăn mất focus
    applyFormat('bold');
  });

  document.getElementById('format-italic').addEventListener('mousedown', (e) => {
    e.preventDefault(); // Ngăn mất focus
    applyFormat('italic');
  });

  document.getElementById('format-underline').addEventListener('mousedown', (e) => {
    e.preventDefault(); // Ngăn mất focus
    applyFormat('underline');
  });

  document.getElementById('format-remove').addEventListener('mousedown', (e) => {
    e.preventDefault(); // Ngăn mất focus
    applyFormat('removeFormat');
  });

  // Color pickers vẫn dùng 'input' là ổn
  document.getElementById('format-text-color').addEventListener('input', (e) => {
    if (!activeElement) return;
    activeElement.focus();
    applyFormat('foreColor', e.target.value);
  });

  document.getElementById('format-bg-color').addEventListener('input', (e) => {
    if (!activeElement) return;
    activeElement.focus();
    applyFormat('backColor', e.target.value);
  });

  // v1.44.0: Chuyển sang 'mousedown' và 'preventDefault'
  document.getElementById('cloze-button').addEventListener('mousedown', (e) => {
    e.preventDefault(); // Ngăn mất focus
    addCloze();
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    if (!activeElement) return;

    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b': // Ctrl+B
          e.preventDefault();
          applyFormat('bold');
          break;
        case 'i': // Ctrl+I
          e.preventDefault();
          applyFormat('italic');
          break;
        case 'u': // Ctrl+U
          e.preventDefault();
          applyFormat('underline');
          break;
        case 'c': // Ctrl+C (Check for Shift)
          if (e.shiftKey) { // Ctrl+Shift+C
            e.preventDefault();
            addCloze();
          }
          break;
      }
    }
  });

  // Nút Thêm Note
  addNoteBtn.addEventListener("click", async () => {
    // Ẩn thông báo lỗi cũ
    statusMessage.style.display = "none";
    statusMessage.textContent = "";

    const deckName = deckInput.value;
    const modelName = modelInput.value;
    const tags = tagsInput.value
      .split(/[\s,]+/)
      .filter((tag) => tag.length > 0);

    // Validate
    if (!deckName) {
      showStatus("Vui lòng chọn Deck", true);
      deckInput.focus();
      return;
    }
    if (!modelName) {
      showStatus("Vui lòng chọn Note Type", true);
      modelInput.focus();
      return;
    }

    await addNoteToAnki(deckName, modelName, tags, showStatus);
  });

  // (v1.25.0) Lắng nghe nội dung từ context menu
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fillField") {
      console.log("Received message to fill field:", message);
      const { fieldName, content, contentType } = message;

      // (v1.43.0) Tìm div.field-input-div
      const targetDiv = document.querySelector(`.field-input-div[data-field="${fieldName}"]`);

      if (targetDiv) {
        console.log(`Found target field: ${fieldName}`);

        // (v1.36.0) Xử lý ảnh
        let contentToInsert = "";
        if (contentType === 'image') {
          // (v1.36.0 Bug fix) content là filename
          contentToInsert = `<img src="${content}">`;
        } else if (contentType === 'text' || contentType === 'audio' || contentType === 'link') {
          // (v1.43.0) Escape HTML đặc biệt
          contentToInsert = escapeHTML(content);
        } else {
          contentToInsert = escapeHTML(content); // Mặc định
        }

        // (v1.43.0) Chèn vào contenteditable div
        // Focus để đảm bảo execCommand hoạt động
        targetDiv.focus();
        document.execCommand('insertHTML', false, contentToInsert);

        // (v1.43.0) Kích hoạt event 'input' để cập nhật preview
        targetDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

        // (v1.25.0) Tùy chọn: Tự động mở rộng field nếu nó đang thu gọn
        const fieldGroup = targetDiv.closest(".field-group");
        if (fieldGroup && fieldGroup.classList.contains("collapsed")) {
          toggleFieldCollapse(fieldGroup);
        }

        // (v1.38.0) Tùy chọn: Tự động chuyển sang view 'rendered' (đã bị loại bỏ ở v1.43.0)

        showStatus(`Đã thêm nội dung vào field "${fieldName}"`);
        sendResponse({ success: true });
      } else {
        console.warn(`Field "${fieldName}" not found in UI.`);
        showStatus(`Field "${fieldName}" không tìm thấy.`, true);
        sendResponse({ success: false, error: "Field not found" });
      }
    }
  });

}); // --- End of DOMContentLoaded ---

// --- (v1.43.0) Helper functions cho contenteditable ---

/**
 * Xử lý sự kiện 'input' trên div contenteditable.
 * Đồng bộ nội dung, cập nhật media preview.
 * @param {Event} e - Sự kiện input
 */
function handleInputEvent(e) {
  const div = e.target;
  const fieldGroup = div.closest('.field-group');
  if (!fieldGroup) return;

  const previewContainer = fieldGroup.querySelector('.media-preview-container');
  
  // Cập nhật media preview (nếu có)
  if (previewContainer) {
    updateMediaPreview(div.innerHTML, previewContainer);
  }
}

/**
 * Xử lý sự kiện 'focus' trên div contenteditable.
 * @param {Event} e - Sự kiện focus
 */
function handleFocusEvent(e) {
  activeElement = e.target; // (v1.43.0)
  console.log("Focus set on:", activeElement.dataset.field);
}

/**
 * Xử lý sự kiện 'blur' trên div contenteditable.
 * @param {Event} e - Sự kiện blur
 */
function handleBlurEvent(e) {
  if (activeElement === e.target) {
    // Tạm thời giữ activeElement để toolbar click hoạt động
    // Nó sẽ bị ghi đè khi focus vào element khác
    // console.log("Blur on:", e.target.dataset.field);
  }
}


// --- (v1.10.0) Autocomplete ---
/**
 * Thiết lập autocomplete cho một cặp input và suggestions container
 * @param {HTMLElement} container - Element cha (vd: .input-group)
 * @param {HTMLInputElement} input - Ô input
 * @param {string[]} suggestions - Danh sách các gợi ý
 * @param {function(string)} [onSelectCallback] - (v1.26.0) Callback khi chọn
 */
function setupAutocomplete(container, input, suggestions, onSelectCallback = null) {
  let suggestionsContainer = container.querySelector(".suggestions-container");
  if (!suggestionsContainer) {
    suggestionsContainer = document.createElement("div");
    suggestionsContainer.className = "suggestions-container";
    container.appendChild(suggestionsContainer);
  }

  let activeSuggestionIndex = -1;

  const filterSuggestions = () => {
    const value = input.value.toLowerCase();
    // (v1.11.0) Tách value thành các từ khóa
    const keywords = value.split(/\s+/).filter(Boolean);
    suggestionsContainer.innerHTML = "";
    activeSuggestionIndex = -1;

    if (keywords.length === 0 && document.activeElement !== input) {
      suggestionsContainer.style.display = "none";
      return;
    }

    const filtered = suggestions.filter((item) => {
      const target = item.toLowerCase();
      // (v1.11.0) Kiểm tra mọi từ khóa
      return keywords.every(keyword => target.includes(keyword));
    });

    filtered.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.textContent = item;
      // (v1.46.0) Bỏ "click" listener, chuyển logic vào 'mousedown' của container
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

  input.addEventListener("input", filterSuggestions);
  input.addEventListener("focus", filterSuggestions); // (v1.10.0)
  input.addEventListener("keydown", (e) => { // (v1.10.0)
    const items = suggestionsContainer.querySelectorAll(".suggestion-item");
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
      highlightSuggestion();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
      highlightSuggestion();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestionIndex > -1) {
        // (v1.46.0) Kích hoạt logic chọn bằng Enter
        const item = items[activeSuggestionIndex];
        input.value = item.textContent;
        suggestionsContainer.style.display = "none";
        if (onSelectCallback) onSelectCallback(item.textContent);
      } else {
        // (v1.46.0) Nếu không chọn gì, chỉ ẩn đi
        suggestionsContainer.style.display = "none";
      }
    }
  });

  // (v1.46.0) Sửa lỗi click và scrollbar
  // Hợp nhất logic vào mousedown
  suggestionsContainer.addEventListener('mousedown', (e) => {
    // Luôn ngăn input bị 'blur' khi click vào danh sách
    e.preventDefault(); 
    
    // Kiểm tra xem có click trúng 'suggestion-item' không
    let target = e.target;
    while (target && target !== suggestionsContainer) {
      if (target.classList.contains('suggestion-item')) {
        // Click trúng item!
        input.value = target.textContent;
        suggestionsContainer.style.display = "none";
        if (onSelectCallback) onSelectCallback(target.textContent);
        return;
      }
      target = target.parentElement;
    }
    // Nếu click vào scrollbar, nó sẽ chỉ preventDefault, không làm gì thêm
  });

  // (v1.10.0) Đóng khi click ra ngoài
  document.addEventListener("click", (e) => {
    // (v1.28.0) Sửa lỗi: kiểm tra kỹ hơn
    if (e.target !== input && !container.contains(e.target)) {
      suggestionsContainer.style.display = "none";
    }
  });
}

// --- (v1.37.0) Media Preview & Modal ---
let previewCounter = 0; // Đảm bảo ID là duy nhất

/**
 * Hiển thị modal xem ảnh
 * @param {string} src - Nguồn ảnh (base64 data)
 * @param {string} caption - Tiêu đề (tên file)
 */
function showImageModal(src, caption) {
  const modal = document.getElementById('image-preview-modal');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-caption');
  const modalClose = document.getElementById('modal-close');

  modalImg.src = src;
  modalCaption.textContent = caption;
  modal.style.display = 'block';

  const closeModal = () => {
    modal.style.display = 'none';
    modalClose.removeEventListener('click', closeModal);
    modal.removeEventListener('click', closeModalOutside);
  };

  const closeModalOutside = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', closeModalOutside);
}

/**
 * Dừng audio đang phát (nếu có)
 */
function stopCurrentAudio() {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.currentTime = 0;
    currentPlayingAudio = null;
    // Reset tất cả các nút audio
    document.querySelectorAll('.preview-audio-button.playing').forEach(btn => {
      btn.classList.remove('playing');
      btn.textContent = '🔊 Nghe';
      btn.disabled = false;
    });
  }
}

/**
 * Cập nhật media preview cho một field
 * @param {string} content - (v1.43.0) Nội dung HTML của field
 * @param {HTMLElement} previewContainer - (v1.43.0) Element chứa preview
 */
async function updateMediaPreview(content, previewContainer) {
  if (!previewContainer) {
    console.warn("updateMediaPreview: previewContainer is null");
    return;
  }
  
  // Dọn dẹp preview cũ
  previewContainer.innerHTML = '';
  const currentPreviewId = `preview-${previewCounter++}`;
  previewContainer.dataset.previewId = currentPreviewId;

  // 1. Tìm ảnh
  // (v1.38.0) Dùng regex đơn giản hơn thay vì DOM parser
  const imgRegex = /<img\s+src="([^"]+)"[^>]*>/g;
  let imgMatch = imgRegex.exec(content);

  // 2. Tìm audio
  const audioRegex = /\[sound:([^\]]+)\]/g;
  let audioMatch = audioRegex.exec(content);

  if (!imgMatch && !audioMatch) {
    previewContainer.style.display = 'none';
    return;
  }

  previewContainer.style.display = 'block';

  // Xử lý ảnh
  while (imgMatch) {
    const filename = imgMatch[1];
    if (!filename) {
      imgMatch = imgRegex.exec(content);
      continue;
    }

    const imgPreviewWrapper = document.createElement('div');
    imgPreviewWrapper.className = 'preview-loading';
    imgPreviewWrapper.textContent = `Đang tải ${filename}...`;
    previewContainer.appendChild(imgPreviewWrapper);

    try {
      // (v1.37.0) Lấy base64
      const base64Data = await invoke('retrieveMediaFile', { filename });
      if (previewContainer.dataset.previewId !== currentPreviewId) return; // Đã có input mới

      if (base64Data) {
        const mimeType = base64Data.startsWith('data:') ? base64Data.split(';')[0].split(':')[1] : 'image/jpeg'; // Đoán mime
        const src = base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;

        const img = document.createElement('img');
        img.src = src;
        img.alt = `Preview ${filename}`;
        img.className = 'preview-image';
        img.title = `Click để xem lớn: ${filename}`;
        img.addEventListener('click', (e) => {
          e.stopPropagation(); // (v1.37.0) Ngăn collapse
          showImageModal(src, filename);
        });
        imgPreviewWrapper.innerHTML = '';
        imgPreviewWrapper.className = '';
        imgPreviewWrapper.appendChild(img);
      } else {
        throw new Error("Không nhận được dữ liệu base64");
      }
    } catch (err) {
      console.error(`Lỗi tải preview ảnh ${filename}:`, err);
      if (previewContainer.dataset.previewId === currentPreviewId) {
        imgPreviewWrapper.textContent = `Lỗi tải ${filename}`;
        imgPreviewWrapper.className = 'preview-error';
      }
    }
    imgMatch = imgRegex.exec(content);
  }

  // Xử lý audio
  while (audioMatch) {
    const filename = audioMatch[1];
    if (!filename) {
      audioMatch = audioRegex.exec(content);
      continue;
    }

    const audioButton = document.createElement('button');
    audioButton.className = 'preview-audio-button';
    audioButton.textContent = '🔊 Nghe';
    audioButton.title = `Phát file: ${filename}`;

    audioButton.addEventListener('click', async (e) => {
      e.stopPropagation(); // Ngăn collapse
      if (audioButton.classList.contains('playing')) {
        stopCurrentAudio();
        return;
      }

      stopCurrentAudio(); // Dừng file khác (nếu có)
      audioButton.disabled = true;
      audioButton.textContent = 'Đang tải...';

      try {
        const base64Data = await invoke('retrieveMediaFile', { filename });
        if (previewContainer.dataset.previewId !== currentPreviewId) return;

        if (base64Data) {
          const mimeType = base64Data.startsWith('data:') ? base64Data.split(';')[0].split(':')[1] : 'audio/mpeg';
          const src = base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;

          const audio = new Audio(src);
          currentPlayingAudio = audio; // (v1.37.0)
          
          audio.addEventListener('play', () => {
            audioButton.textContent = '⏸️ Dừng';
            audioButton.disabled = false;
            audioButton.classList.add('playing');
          });

          audio.addEventListener('ended', () => {
            stopCurrentAudio(); // Reset
          });

          audio.addEventListener('error', (err) => {
            console.error(`Lỗi phát audio ${filename}:`, err);
            showStatus(`Lỗi phát audio ${filename}`, true);
            stopCurrentAudio();
          });

          audio.play();
        } else {
          throw new Error("Không nhận được dữ liệu base64");
        }
      } catch (err) {
        console.error(`Lỗi tải audio ${filename}:`, err);
        showStatus(`Lỗi tải audio ${filename}: ${err.message}`, true);
        stopCurrentAudio(); // Reset
      }
    });
    previewContainer.appendChild(audioButton);
    audioMatch = audioRegex.exec(content);
  }
}

// --- (v1.39.0) Rich Text Formatting ---

/**
 * Áp dụng định dạng rich text cho selection
 * @param {string} command - Lệnh (vd: 'bold', 'foreColor')
 * @param {string} [value] - Giá trị (vd: '#FF0000')
 */
function applyFormat(command, value = null) {
  if (!activeElement) {
    console.warn("applyFormat: No active element to format");
    return;
  }

  // (v1.39.0) Đảm bảo focus trước khi thực thi
  activeElement.focus();

  try {
    document.execCommand(command, false, value);
  } catch (e) {
    console.error(`Error executing format command '${command}':`, e);
  }

  // (v1.43.0) Kích hoạt 'input' event để cập nhật preview
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

/**
 * (v1.39.0) Thêm định dạng cloze
 */
function addCloze() {
  if (!activeElement) {
    console.warn("addCloze: No active element");
    return;
  }

  activeElement.focus();
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) {
    // Không có gì được chọn, chèn cloze rỗng
    document.execCommand('insertText', false, `{{c${currentClozeIndex}::}}`);
  } else {
    // Bọc text được chọn
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    const clozeText = `{{c${currentClozeIndex}::${selectedText}}}`;
    
    // Dùng insertText sẽ thay thế, giống hành vi của Anki
    document.execCommand('insertText', false, clozeText);
  }

  // Tăng index
  currentClozeIndex++;

  // (v1.43.0) Kích hoạt 'input' event
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

// --- Core Logic ---

/**
 * (v1.12.0) Thu gọn/Mở rộng field
 * @param {HTMLElement} fieldGroup - Element .field-group
 */
function toggleFieldCollapse(fieldGroup) {
  if (!fieldGroup) return;
  const isCollapsed = fieldGroup.classList.toggle("collapsed");
  const modelName = fieldGroup.dataset.model;
  const fieldName = fieldGroup.dataset.field;
  const toggleIcon = fieldGroup.querySelector(".collapse-toggle");

  if (toggleIcon) {
    // (v1.32.0) Sửa logic icon
    toggleIcon.textContent = isCollapsed ? "▶" : "🔽";
  }
  
  // (v1.21.0) Label mờ đi
  const label = fieldGroup.querySelector(".field-label");
  if (label) {
    label.style.opacity = isCollapsed ? "0.7" : "1";
  }

  // (v1.12.0) Lưu trạng thái
  if (modelName && fieldName) {
    const key = `field_collapse_${modelName}`;
    chrome.storage.local.get([key], (result) => {
      const collapsedFields = result[key] || {};
      collapsedFields[fieldName] = isCollapsed;
      chrome.storage.local.set({ [key]: collapsedFields });
    });
  }
}

/**
 * (v1.21.0) Tự động mở rộng textarea (ĐÃ BỊ LOẠI BỎ ở v1.43.0, vì dùng div)
 */
// function autoExpandTextarea(textarea) { ... }

/**
 * (v1.43.0) Escape HTML
 */
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

/**
 * Tạo các input field dựa trên model
 * @param {string} modelName - Tên model
 * @param {function(string, boolean)} showStatus - Hàm hiển thị trạng thái
 */
async function createFieldsForModel(modelName, showStatus) {
  const fieldsContainer = document.getElementById("fields-container");
  if (!modelName) {
    fieldsContainer.innerHTML = "";
    return;
  }

  console.log(`Creating fields for model: ${modelName}`);
  fieldsContainer.innerHTML = '<div class="loading-spinner">Đang tải fields...</div>';

  try {
    // Lấy field names
    const fieldNames = await invoke("modelFieldNames", { modelName });
    if (!Array.isArray(fieldNames)) {
      throw new Error("Không thể lấy field names.");
    }

    // (v1.25.0) Gửi field names cho background script để cập nhật context menu
    chrome.runtime.sendMessage({
      action: "updateContextMenuFields",
      modelName: modelName,
      fieldNames: fieldNames,
    });

    // (v1.12.0 + v1.13.0) Lấy cài đặt collapse và hidden
    const collapseKey = `field_collapse_${modelName}`;
    const hiddenKey = `hiddenFields_${modelName}`;
    const settings = await chrome.storage.local.get([collapseKey, hiddenKey]);
    const collapsedFields = settings[collapseKey] || {};
    const hiddenFields = settings[hiddenKey] || [];

    fieldsContainer.innerHTML = ""; // Xóa spinner

    fieldNames.forEach((fieldName) => {
      const isHidden = hiddenFields.includes(fieldName);
      if (isHidden) {
        console.log(`Field "${fieldName}" is hidden by settings.`);
        return; // (v1.13.0) Bỏ qua field bị ẩn
      }

      const isCollapsed = collapsedFields[fieldName] || false;
      const fieldGroupId = `field-group-${fieldName.replace(/\s+/g, '-')}`;
      
      // (v1.43.0) Cấu trúc HTML mới (chỉ dùng div contenteditable)
      const fieldGroup = document.createElement("div");
      fieldGroup.className = `field-group ${isCollapsed ? "collapsed" : ""}`;
      fieldGroup.id = fieldGroupId;
      fieldGroup.dataset.field = fieldName;
      fieldGroup.dataset.model = modelName;
      fieldGroup.dataset.viewMode = 'normal'; // Mặc định là 'normal' (tên cũ, nhưng giờ là contenteditable)

      // (v1.21.0) Header
      const fieldHeader = document.createElement("div");
      fieldHeader.className = "field-header";

      const collapseToggle = document.createElement("span");
      collapseToggle.className = "collapse-toggle";
      collapseToggle.textContent = isCollapsed ? "▶" : "🔽"; // (v1.30.0)
      collapseToggle.title = "Thu gọn/Mở rộng";

      const fieldLabel = document.createElement("label");
      fieldLabel.className = "field-label";
      fieldLabel.textContent = fieldName;
      fieldLabel.htmlFor = `field-${fieldName}`;
      if (isCollapsed) fieldLabel.style.opacity = "0.7";

      // (v1.38.0) Nút Toggle View (đã bị loại bỏ ở v1.43.0)
      // (v1.39.0) Nút Toggle View (đã bị loại bỏ ở v1.43.0)

      fieldHeader.appendChild(collapseToggle);
      fieldHeader.appendChild(fieldLabel);

      // (v1.21.0) Gán sự kiện click cho toàn bộ header
      fieldHeader.addEventListener("click", (e) => {
        // (v1.37.0) Ngăn collapse khi click vào preview
        if (e.target.closest('.media-preview-container') || e.target.closest('.btn-toggle-view')) {
          return;
        }
        toggleFieldCollapse(fieldGroup);
      });

      // (v1.37.0) Input Area (chứa div và preview)
      const inputArea = document.createElement('div');
      inputArea.className = 'field-input-area';

      // (v1.43.0) Chỉ tạo div contenteditable
      const fieldDiv = document.createElement('div');
      fieldDiv.id = `field-${fieldName}`;
      fieldDiv.className = 'field-input-div form-control'; // Dùng class của textarea
      fieldDiv.contentEditable = 'true';
      fieldDiv.dataset.field = fieldName;

      // (v1.43.0) Gán các listener mới
      fieldDiv.addEventListener('input', handleInputEvent);
      fieldDiv.addEventListener('focus', handleFocusEvent);
      fieldDiv.addEventListener('blur', handleBlurEvent);
      
      // (v1.37.0) Media Preview
      const mediaPreviewContainer = document.createElement('div');
      mediaPreviewContainer.className = 'media-preview-container';
      
      // (v1.43.0) Cập nhật preview lần đầu (với nội dung rỗng)
      updateMediaPreview(fieldDiv.innerHTML, mediaPreviewContainer);

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

/**
 * Thêm note vào Anki
 * @param {string} deckName
 * @param {string} modelName
 * @param {string[]} tags
 * @param {function(string, boolean)} showStatus
 */
async function addNoteToAnki(deckName, modelName, tags, showStatus) {
  try {
    const fields = {};
    let hasContent = false;

    // (v1.13.0) Lấy cài đặt ẩn + (v1.18.0) Lấy cài đặt random ID
    const hiddenKey = `hiddenFields_${modelName}`;
    const randomIdKey = `randomIdField_${modelName}`;
    const settings = await chrome.storage.local.get([hiddenKey, randomIdKey]);
    const hiddenFields = settings[hiddenKey] || [];
    const randomIdField = settings[randomIdKey] || null;

    // Lấy field names từ cache hoặc invoke
    let fieldNames = modelFieldsCache[modelName];
    if (!fieldNames) {
      fieldNames = await invoke("modelFieldNames", { modelName });
      modelFieldsCache[modelName] = fieldNames;
    }

    // (v1.43.0) Lấy nội dung từ div.field-input-div
    fieldNames.forEach((fieldName) => {
      // (v1.13.0) Nếu field bị ẩn, gán rỗng
      if (hiddenFields.includes(fieldName)) {
        fields[fieldName] = "";
        return;
      }

      // (v1.18.0) Xử lý Random ID
      if (fieldName === randomIdField) {
        fields[fieldName] = generateRandomId();
        hasContent = true; // Coi như có nội dung
        return;
      }

      // (v1.43.0) Lấy nội dung từ `div.innerHTML`
      const fieldDiv = document.querySelector(`.field-input-div[data-field="${fieldName}"]`);
      if (fieldDiv) {
        const content = fieldDiv.innerHTML;
        fields[fieldName] = content;
        // (v1.43.0) Cập nhật check 'hasContent'
        // Kiểm tra nội dung không rỗng VÀ không phải là thẻ rỗng (vd: <br>)
        if (content.trim() && content.trim() !== '<br>') { 
          hasContent = true;
        }
      } else {
        // Trường hợp field không bị ẩn nhưng không tìm thấy (lỗi)
        console.warn(`Field div not found for: ${fieldName}. Setting empty string.`);
        fields[fieldName] = "";
      }
    });

    if (!hasContent) {
      showStatus("Vui lòng nhập nội dung cho ít nhất một field (ngoài field ID)", true);
      return;
    }

    // Gửi note
    const result = await invoke("addNote", {
      note: {
        deckName: deckName,
        modelName: modelName,
        fields: fields,
        tags: tags,
      },
    });

    if (!result) {
      throw new Error("Không thể thêm note. ID trả về là null.");
    }

    showStatus(`Note đã được thêm thành công (ID: ${result})`);

    // (v1.36.0) Lưu deck/model
    await chrome.storage.local.set({
      [LAST_USED_DECK_KEY]: deckName,
      [LAST_USED_MODEL_KEY]: modelName
    });

    // (v1.36.0) Lấy cài đặt sticky
    const stickyKey = `stickyFields_${modelName}`;
    const stickySettings = await chrome.storage.local.get(stickyKey);
    const stickyFields = stickySettings[stickyKey] || [];

    // Xóa nội dung fields (trừ những field được ghim)
    document.querySelectorAll(".field-group").forEach(fieldGroup => {
      const fieldName = fieldGroup.dataset.field;
      if (stickyFields.includes(fieldName)) {
        return; // Bỏ qua field được ghim
      }

      // (v1.43.0) Xóa nội dung div
      const fieldDiv = fieldGroup.querySelector('.field-input-div');
      if (fieldDiv) {
        fieldDiv.innerHTML = '';
      }
      
      // (v1.43.0) Cập nhật preview (để xóa preview cũ)
      const previewContainer = fieldGroup.querySelector('.media-preview-container');
      if (previewContainer) {
        updateMediaPreview('', previewContainer);
      }
    });

    // Xóa tags (trừ khi tags được ghim - logic này chưa có, tạm thời xóa)
    // (Kiểm tra nếu "Tags" nằm trong stickyFields - logic này cần xem lại)
    if (!stickyFields.includes("Tags")) { // Giả sử "Tags" là tên field ảo
        document.getElementById("tags").value = "";
    }
    
    // Reset cloze index
    currentClozeIndex = 1;

  } catch (error) {
    console.error("Error adding note:", error);
    showStatus(`Lỗi khi thêm note: ${error.message}`, true);
  }
}

/**
 * (v1.18.0) Tạo ID ngẫu nhiên
 * @returns {string} - ID ngẫu nhiên 14 chữ số
 */
function generateRandomId() {
  // Tạo 14 chữ số ngẫu nhiên
  const part1 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const part2 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return part1 + part2;
}

