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

function showAllSections(shouldShow) {
    document.querySelectorAll('.settings-section').forEach(section => {
        // Không ẩn feature-toggles-section vì nó không phụ thuộc vào model
        if (section.id === 'feature-toggles-section') return;
        section.style.display = shouldShow ? 'block' : 'none';
    });
}

async function loadFeatureToggles() {
    try {
        const stored = await chrome.storage.local.get(['featureToggles']);
        const featureToggles = stored.featureToggles || { tags: true }; // Mặc định bật Tags
        
        // Áp dụng giá trị cho các checkbox
        document.getElementById('toggle-tags').checked = featureToggles.tags !== false;
        updateToggleItemState('toggle-tags-item', featureToggles.tags !== false);
    } catch (error) {
        console.error('[AnkiVN Settings] Error loading feature toggles:', error);
    }
}

function updateToggleItemState(itemId, isChecked) {
    const item = document.getElementById(itemId);
    if (item) {
        item.classList.toggle('checked', isChecked);
    }
}

async function loadFieldsForSettings(modelName) {
    currentSettingsModel = modelName;
    showAllSections(false);

    if (!modelName || !allModelsForSettings.includes(modelName)) {
        const msg = `<p><i>${!modelName ? 'Hãy chọn một Note Type hợp lệ.' : 'Tên Note Type không hợp lệ.'}</i></p>`;
        document.getElementById('settings-fields-list-container').innerHTML = msg;
        return;
    }
    
    try {
        const fieldNames = await invoke('modelFieldNames', { modelName: modelName });
        if(fieldNames === null) throw new Error("modelFieldNames returned null.");

        showAllSections(true);

        const keys = [
            `hiddenFields_${modelName}`,
            `stickyFields_${modelName}`,
            `randomIdField_${modelName}`,
            `fieldOrder_${modelName}`,
            `contextMenuDefaults_${modelName}`
        ];
        const storedData = await chrome.storage.local.get(keys);
        
        const hiddenFields = storedData[keys[0]] || {};
        const stickyFields = storedData[keys[1]] || {};
        const selectedRandomIdField = storedData[keys[2]] || "";
        const fieldOrder = storedData[keys[3]] || fieldNames;
        const contextMenuDefaults = storedData[keys[4]] || {};

        // Sort fields based on saved order, keeping new fields at the end
        const orderedFields = [...new Set([...fieldOrder, ...fieldNames])].filter(f => fieldNames.includes(f));

        populateHiddenFields(orderedFields, hiddenFields);
        populateStickyFields(orderedFields, stickyFields);
        populateRandomIdSelect(orderedFields, selectedRandomIdField);
        populateFieldOrderList(orderedFields);
        populateContextMenuDefaults(orderedFields, contextMenuDefaults);

    } catch (error) {
        const errorMsg = `<p style="color: red;">Lỗi tải cấu hình: ${error.message}</p>`;
        showStatus('Lỗi tải cấu hình: ' + error.message, 'error');
        showAllSections(false);
    }
}

function populateHiddenFields(fieldNames, hiddenFields) {
    const container = document.getElementById('settings-fields-list-container');
    container.innerHTML = fieldNames.length === 0 ? '<p><i>Model này không có field nào.</i></p>' : '';
    fieldNames.forEach(fieldName => {
        const isHidden = hiddenFields[fieldName] || false;
        const itemDiv = document.createElement('div');
        itemDiv.className = `field-checkbox-item ${isHidden ? 'checked' : ''}`;
        itemDiv.innerHTML = `<input type="checkbox" data-field-name="${fieldName}" ${isHidden ? 'checked' : ''}><label title="${fieldName}">${fieldName}</label>`;
        itemDiv.addEventListener('click', () => {
            const checkbox = itemDiv.querySelector('input');
            checkbox.checked = !checkbox.checked;
            itemDiv.classList.toggle('checked', checkbox.checked);
        });
        container.appendChild(itemDiv);
    });
}

function populateStickyFields(fieldNames, stickyFields) {
    const container = document.getElementById('settings-sticky-fields-list-container');
    container.innerHTML = fieldNames.length === 0 ? '<p><i>Model này không có field nào.</i></p>' : '';
    fieldNames.forEach(fieldName => {
        const isSticky = stickyFields[fieldName] || false;
        const itemDiv = document.createElement('div');
        itemDiv.className = `field-checkbox-item sticky-item ${isSticky ? 'checked' : ''}`;
        itemDiv.innerHTML = `<input type="checkbox" data-field-name="${fieldName}" ${isSticky ? 'checked' : ''}><label title="${fieldName}">📌 ${fieldName}</label>`;
        itemDiv.addEventListener('click', () => {
            const checkbox = itemDiv.querySelector('input');
            checkbox.checked = !checkbox.checked;
            itemDiv.classList.toggle('checked', checkbox.checked);
        });
        container.appendChild(itemDiv);
    });
}

function populateRandomIdSelect(fieldNames, selectedField) {
    const select = document.getElementById('random-id-field-select');
    select.innerHTML = '<option value="">-- Không tự động tạo ID --</option>';
    fieldNames.forEach(fieldName => {
        const option = document.createElement('option');
        option.value = fieldName;
        option.textContent = fieldName;
        select.appendChild(option);
    });
    if (selectedField) { select.value = selectedField; }
}

function populateFieldOrderList(fieldNames) {
    const container = document.getElementById('field-order-list-container');
    container.innerHTML = '';
    fieldNames.forEach(fieldName => {
        const item = document.createElement('div');
        item.className = 'draggable-item';
        item.draggable = true;
        item.dataset.fieldName = fieldName;
        item.innerHTML = `<i class="fas fa-grip-vertical drag-handle"></i><span>${fieldName}</span>`;
        container.appendChild(item);
    });
}

function populateContextMenuDefaults(fieldNames, defaults) {
    console.log('[AnkiVN Settings] populateContextMenuDefaults:', {
        fieldNames: fieldNames,
        defaults: defaults,
        defaultsKeys: Object.keys(defaults || {})
    });
    
    document.querySelectorAll('.context-default-select').forEach(select => {
        const contextType = select.dataset.contextType;
        
        // Handle altSelectionSource separately (has special "SAME" option)
        if (contextType === 'altSelectionSource') {
            select.innerHTML = '<option value="">-- Không thêm nguồn --</option><option value="SAME">-- Cùng field với text --</option>';
            fieldNames.forEach(fieldName => {
                const option = document.createElement('option');
                option.value = fieldName;
                option.textContent = fieldName;
                select.appendChild(option);
            });
            if (defaults[contextType]) {
                select.value = defaults[contextType];
                console.log('[AnkiVN Settings] Set default for', contextType, 'to', defaults[contextType]);
            } else {
                console.log('[AnkiVN Settings] No default found for', contextType);
            }
            return;
        }
        
        // Use different placeholder text for altSelection
        const placeholder = contextType === 'altSelection' 
            ? '-- Chọn field --' 
            : '-- Gửi tới Field con --';
        select.innerHTML = `<option value="">${placeholder}</option>`;
        fieldNames.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            select.appendChild(option);
        });
        if (defaults[contextType]) {
            select.value = defaults[contextType];
            console.log('[AnkiVN Settings] Set default for', contextType, 'to', defaults[contextType]);
        } else {
            console.log('[AnkiVN Settings] No default found for', contextType);
        }
    });
}

async function saveSettings() {
    const modelName = document.getElementById('settings-model-search').value;
    const hasValidModel = modelName && allModelsForSettings.includes(modelName);

    try {
        const settingsToSave = {};

        // Lưu settings theo model chỉ khi có model hợp lệ
        if (hasValidModel) {
            // Hidden Fields
            const hiddenFields = {};
            document.querySelectorAll('#settings-fields-list-container input[type="checkbox"]').forEach(cb => {
                hiddenFields[cb.dataset.fieldName] = cb.checked;
            });
            settingsToSave[`hiddenFields_${modelName}`] = hiddenFields;

            // Sticky Fields
            const stickyFields = {};
            document.querySelectorAll('#settings-sticky-fields-list-container input[type="checkbox"]').forEach(cb => {
                stickyFields[cb.dataset.fieldName] = cb.checked;
            });
            settingsToSave[`stickyFields_${modelName}`] = stickyFields;

            // Random ID Field
            settingsToSave[`randomIdField_${modelName}`] = document.getElementById('random-id-field-select').value;

            // Field Order
            const fieldOrder = [...document.querySelectorAll('#field-order-list-container .draggable-item')]
                .map(item => item.dataset.fieldName);
            settingsToSave[`fieldOrder_${modelName}`] = fieldOrder;

            // Context Menu Defaults
            const contextMenuDefaults = {};
            document.querySelectorAll('.context-default-select').forEach(select => {
                const contextType = select.dataset.contextType;
                const selectedValue = select.value;
                console.log('[AnkiVN Settings] Saving context default:', {
                    contextType: contextType,
                    value: selectedValue
                });
                if (selectedValue) {
                    contextMenuDefaults[contextType] = selectedValue;
                }
            });
            
            console.log('[AnkiVN Settings] Saving contextMenuDefaults:', {
                modelName: modelName,
                contextMenuDefaults: contextMenuDefaults,
                key: `contextMenuDefaults_${modelName}`
            });
            
            settingsToSave[`contextMenuDefaults_${modelName}`] = contextMenuDefaults;
        }

        // Feature Toggles (global, không phụ thuộc vào model - luôn lưu được)
        const featureToggles = {
            tags: document.getElementById('toggle-tags').checked
        };
        settingsToSave['featureToggles'] = featureToggles;

        await chrome.storage.local.set(settingsToSave);

        if (hasValidModel) {
            showStatus('Đã lưu cài đặt cho Note Type: ' + modelName, 'success');
        } else {
            showStatus('Đã lưu cài đặt chức năng', 'success');
        }
    } catch (error) {
        showStatus('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    }
}

function setupDragAndDrop() {
    const container = document.getElementById('field-order-list-container');
    let draggedItem = null;

    container.addEventListener('dragstart', e => {
        draggedItem = e.target;
        setTimeout(() => e.target.classList.add('dragging'), 0);
    });

    container.addEventListener('dragend', e => {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const currentDragged = document.querySelector('.dragging');
        if (afterElement == null) {
            container.appendChild(currentDragged);
        } else {
            container.insertBefore(currentDragged, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
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

    // Load feature toggles
    await loadFeatureToggles();

    // Setup feature toggle checkboxes
    document.getElementById('toggle-tags').addEventListener('change', (e) => {
        updateToggleItemState('toggle-tags-item', e.target.checked);
    });

    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('select-all-fields').addEventListener('click', () => setAllCheckboxes('settings-fields-list-container', true));
    document.getElementById('deselect-all-fields').addEventListener('click', () => setAllCheckboxes('settings-fields-list-container', false));
    document.getElementById('select-all-sticky-fields').addEventListener('click', () => setAllCheckboxes('settings-sticky-fields-list-container', true));
    document.getElementById('deselect-all-sticky-fields').addEventListener('click', () => setAllCheckboxes('settings-sticky-fields-list-container', false));
    
    setupDragAndDrop();
});