// src/settings/main.js
import { invoke } from '../api/anki-connect.js';
import { setupAutocomplete } from '../ui/autocomplete.js';

let allModelsForSettings = [];
let currentSettingsModel = '';
let settingsStatusTimeout = null;

function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('settings-status');
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    if (settingsStatusTimeout) clearTimeout(settingsStatusTimeout);
    if (type === 'success') {
       settingsStatusTimeout = setTimeout(() => {
           if (statusElement.textContent === message) {
               statusElement.textContent = '';
               statusElement.className = 'status-message';
           }
       }, 4000);
    }
}

async function loadFieldsForSettings(modelName) {
    currentSettingsModel = modelName;
    const fieldsListContainer = document.getElementById('settings-fields-list-container');
    const stickyFieldsListContainer = document.getElementById('settings-sticky-fields-list-container');
    const randomIdSection = document.getElementById('random-id-section');
    const randomIdSelect = document.getElementById('random-id-field-select');

    fieldsListContainer.innerHTML = '<p>Đang tải fields...</p>';
    stickyFieldsListContainer.innerHTML = '<p>Đang tải fields...</p>';
    randomIdSelect.innerHTML = '<option value="">-- Không tự động tạo ID --</option>';
    randomIdSection.style.display = 'none';

    if (!modelName || !allModelsForSettings.includes(modelName)) {
        const msg = `<p><i>${!modelName ? 'Hãy chọn một Note Type hợp lệ.' : 'Tên Note Type không hợp lệ.'}</i></p>`;
        fieldsListContainer.innerHTML = msg;
        stickyFieldsListContainer.innerHTML = msg;
        return;
    }
    
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if(fieldNames === null) throw new Error("modelFieldNames returned null.");

        const hiddenFieldsKey = `hiddenFields_${modelName}`;
        const stickyFieldsKey = `stickyFields_${modelName}`;
        const randomIdFieldKey = `randomIdField_${modelName}`;
        
        const storedData = await chrome.storage.local.get([hiddenFieldsKey, stickyFieldsKey, randomIdFieldKey]);
        
        const hiddenFields = storedData[hiddenFieldsKey] || {};
        const stickyFields = storedData[stickyFieldsKey] || {};
        const selectedRandomIdField = storedData[randomIdFieldKey] || "";

        fieldsListContainer.innerHTML = '';
        stickyFieldsListContainer.innerHTML = '';

        if (fieldNames.length === 0) {
            const msg = '<p><i>Model này không có field nào.</i></p>';
            fieldsListContainer.innerHTML = msg;
            stickyFieldsListContainer.innerHTML = msg;
            return;
        }

        fieldNames.forEach(fieldName => {
            const isHidden = hiddenFields[fieldName] || false;
            const hideItemDiv = document.createElement('div');
            hideItemDiv.className = `field-checkbox-item ${isHidden ? 'checked' : ''}`;
            hideItemDiv.innerHTML = `<input type="checkbox" data-field-name="${fieldName}" ${isHidden ? 'checked' : ''} style="pointer-events: none;"><label title="${fieldName}">${fieldName}</label>`;
            hideItemDiv.addEventListener('click', () => {
                const checkbox = hideItemDiv.querySelector('input');
                checkbox.checked = !checkbox.checked;
                hideItemDiv.classList.toggle('checked', checkbox.checked);
            });
            fieldsListContainer.appendChild(hideItemDiv);

            const isSticky = stickyFields[fieldName] || false;
            const stickyItemDiv = document.createElement('div');
            stickyItemDiv.className = `field-checkbox-item sticky-item ${isSticky ? 'checked' : ''}`;
            stickyItemDiv.innerHTML = `<input type="checkbox" data-field-name="${fieldName}" ${isSticky ? 'checked' : ''} style="pointer-events: none;"><label title="${fieldName}">📌 ${fieldName}</label>`;
            stickyItemDiv.addEventListener('click', () => {
                const checkbox = stickyItemDiv.querySelector('input');
                checkbox.checked = !checkbox.checked;
                stickyItemDiv.classList.toggle('checked', checkbox.checked);
            });
            stickyFieldsListContainer.appendChild(stickyItemDiv);
            
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            randomIdSelect.appendChild(option);
        });

        if (selectedRandomIdField) { randomIdSelect.value = selectedRandomIdField; }
        randomIdSection.style.display = 'block';

    } catch (error) {
        const errorMsg = `<p style="color: red;">Lỗi tải cấu hình: ${error.message}</p>`;
        fieldsListContainer.innerHTML = errorMsg;
        stickyFieldsListContainer.innerHTML = errorMsg;
        showStatus('Lỗi tải cấu hình: ' + error.message, 'error');
        randomIdSection.style.display = 'none';
    }
}

async function saveSettings() {
    const selectedModel = document.getElementById('settings-model-search').value;
    if (!selectedModel || !allModelsForSettings.includes(selectedModel)) {
        showStatus('Tên Note Type không hợp lệ.', 'error');
        return;
    }

    try {
        const hiddenFieldsState = {};
        document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]').forEach(cb => {
            hiddenFieldsState[cb.dataset.fieldName] = cb.checked;
        });

        const stickyFieldsState = {};
        document.querySelectorAll('#settings-sticky-fields-list-container input[type="checkbox"]').forEach(cb => {
            stickyFieldsState[cb.dataset.fieldName] = cb.checked;
        });

        const selectedRandomIdField = document.getElementById('random-id-field-select').value;

        await chrome.storage.local.set({
            [`hiddenFields_${selectedModel}`]: hiddenFieldsState,
            [`stickyFields_${selectedModel}`]: stickyFieldsState,
            [`randomIdField_${selectedModel}`]: selectedRandomIdField
        });

        showStatus('Đã lưu cài đặt cho Note Type: ' + selectedModel, 'success');
    } catch (error) {
        showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    }
}

function setAllCheckboxes(containerId, checkedState) {
    document.querySelectorAll(`#${containerId} .field-checkbox-item`).forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = checkedState;
            item.classList.toggle('checked', checkedState);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        allModelsForSettings = await invoke('modelNames');
        if (!allModelsForSettings) allModelsForSettings = [];
        setupAutocomplete(
            document.querySelector('.note-type-selector .autocomplete-container'),
            document.getElementById('settings-model-search'),
            allModelsForSettings,
            loadFieldsForSettings
        );
    } catch (error) {
        showStatus('Không thể tải danh sách Note Types.', 'error');
    }

    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('select-all-fields').addEventListener('click', () => setAllCheckboxes('settings-fields-list-container', true));
    document.getElementById('deselect-all-fields').addEventListener('click', () => setAllCheckboxes('settings-fields-list-container', false));
    document.getElementById('select-all-sticky-fields').addEventListener('click', () => setAllCheckboxes('settings-sticky-fields-list-container', true));
    document.getElementById('deselect-all-sticky-fields').addEventListener('click', () => setAllCheckboxes('settings-sticky-fields-list-container', false));
});