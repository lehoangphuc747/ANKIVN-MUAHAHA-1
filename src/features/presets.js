// src/features/presets.js
import { PRESETS_KEY } from '../utils/storage.js';
import { showStatus } from '../ui/status.js';
import { createFieldsForModel } from '../ui/fields.js';

const presetSelect = document.getElementById('preset-select');
const deckInput = document.getElementById("deck-search");
const modelInput = document.getElementById("model-search");
const tagsInput = document.getElementById("tags-input");

export async function loadPresets() {
  presetSelect.innerHTML = '<option value="">-- Chọn cấu hình --</option>';
  try {
    const result = await chrome.storage.local.get(PRESETS_KEY);
    const presets = result[PRESETS_KEY] || {};
    for (const presetName in presets) {
      presetSelect.innerHTML += `<option value="${presetName}">${presetName}</option>`;
    }
  } catch (e) {
    console.error("Error loading presets:", e);
  }
}

export async function saveCurrentPreset() {
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
    showStatus(`Lỗi khi lưu preset: ${e.message}`, true);
  }
}

export async function deleteCurrentPreset() {
  const presetName = presetSelect.value;
  if (!presetName) return;
  if (!confirm(`Bạn có chắc muốn xóa preset '${presetName}'?`)) return;

  try {
    const result = await chrome.storage.local.get(PRESETS_KEY);
    const presets = result[PRESETS_KEY] || {};
    delete presets[presetName];
    await chrome.storage.local.set({ [PRESETS_KEY]: presets });
    await loadPresets();
    showStatus(`Đã xóa preset '${presetName}'`);
  } catch (e) {
    showStatus(`Lỗi khi xóa preset: ${e.message}`, true);
  }
}

export async function applyPreset(presetName) {
  if (!presetName) return;
  try {
    const result = await chrome.storage.local.get(PRESETS_KEY);
    const preset = (result[PRESETS_KEY] || {})[presetName];
    if (preset) {
      deckInput.value = preset.deckName || "";
      modelInput.value = preset.modelName || "";
      tagsInput.value = preset.tags || "";
      if (preset.modelName) {
        await createFieldsForModel(preset.modelName);
      } else {
        document.getElementById("fields-container").innerHTML = "";
      }
    }
  } catch (e) {
    showStatus(`Lỗi khi áp dụng preset: ${e.message}`, true);
  }
}