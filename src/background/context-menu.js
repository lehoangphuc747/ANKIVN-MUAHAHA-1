// src/background/context-menu.js
import { invoke } from '../api/anki-connect.js';

const CONTEXT_MENU_ID_TEXT = "ankivnSendText";
const CONTEXT_MENU_ID_IMAGE = "ankivnSendImage";
const CONTEXT_MENU_ID_AUDIO = "ankivnSendAudio";
const CONTEXT_MENU_ID_LINK = "ankivnSendLink";

export async function updateContextMenu(fieldNames = [], modelName = null) {
    await chrome.contextMenus.removeAll();

    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_TEXT, title: "Gửi text đến Field", contexts: ["selection"] });
    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_IMAGE, title: "Gửi ảnh đến Field", contexts: ["image"] });
    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_AUDIO, title: "Gửi âm thanh đến Field", contexts: ["audio"] });
    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_LINK, title: "Gửi link đến Field", contexts: ["link"] });

    let visibleFields = fieldNames;
    if (modelName && Array.isArray(fieldNames) && fieldNames.length > 0) {
        try {
            const hiddenFieldsKey = `hiddenFields_${modelName}`;
            const storedData = await chrome.storage.local.get(hiddenFieldsKey);
            const hiddenFields = storedData[hiddenFieldsKey] || {};
            visibleFields = fieldNames.filter(fieldName => !hiddenFields[fieldName]);
        } catch (error) {
            console.error("Error filtering hidden fields:", error);
            visibleFields = fieldNames;
        }
    } else if (!Array.isArray(fieldNames) || fieldNames.length === 0) {
         visibleFields = [];
    }

    if (visibleFields.length === 0) {
        const noFieldsTitle = modelName ? "Tất cả fields đã bị ẩn" : "Chọn Note Type trong sidebar...";
        const parentIds = [CONTEXT_MENU_ID_TEXT, CONTEXT_MENU_ID_IMAGE, CONTEXT_MENU_ID_AUDIO, CONTEXT_MENU_ID_LINK];
        parentIds.forEach(parentId => {
            chrome.contextMenus.create({
                id: `noVisibleFields_${parentId}`, parentId: parentId,
                title: noFieldsTitle, contexts: ["all"], enabled: false
            });
        });
    } else {
        visibleFields.forEach(fieldName => {
            chrome.contextMenus.create({ id: `send-text-to-${fieldName}`, parentId: CONTEXT_MENU_ID_TEXT, title: fieldName, contexts: ["selection"] });
            chrome.contextMenus.create({ id: `send-image-to-${fieldName}`, parentId: CONTEXT_MENU_ID_IMAGE, title: fieldName, contexts: ["image"] });
            chrome.contextMenus.create({ id: `send-audio-to-${fieldName}`, parentId: CONTEXT_MENU_ID_AUDIO, title: fieldName, contexts: ["audio"] });
            chrome.contextMenus.create({ id: `send-link-to-${fieldName}`, parentId: CONTEXT_MENU_ID_LINK, title: fieldName, contexts: ["link"] });
        });
    }
    console.log("Context menu updated with visible fields:", visibleFields);
}

export async function handleContextMenuClick(info, tab) {
    console.log("Context menu clicked:", info);

    let targetField = null;
    let contentUrl = null;
    let contentType = null;
    let finalContentToSend = null;

    try {
        if (info.menuItemId.startsWith("send-text-to-")) {
            targetField = info.menuItemId.substring("send-text-to-".length);
            finalContentToSend = info.selectionText;
            contentType = 'text';
        } else if (info.menuItemId.startsWith("send-image-to-")) {
            targetField = info.menuItemId.substring("send-image-to-".length);
            contentUrl = info.srcUrl;
            contentType = 'image';
        } else if (info.menuItemId.startsWith("send-audio-to-")) {
            targetField = info.menuItemId.substring("send-audio-to-".length);
            contentUrl = info.srcUrl || info.linkUrl;
            contentType = 'audio';
        } else if (info.menuItemId.startsWith("send-link-to-")) {
            targetField = info.menuItemId.substring("send-link-to-".length);
            finalContentToSend = info.linkUrl;
            contentType = 'text';
        }

        if (contentType === 'image' || contentType === 'audio') {
            if (!contentUrl) return;
            let fileExtension = contentUrl.split('.').pop().split(/#|\?/)[0] || (contentType === 'image' ? 'webp' : 'mp3');
            let filename = `ankivn_${contentType}_${Date.now()}.${fileExtension}`;
            const storedFilename = await invoke('storeMediaFile', { url: contentUrl, filename: filename });
            if (!storedFilename) throw new Error("storeMediaFile did not return a filename.");
            finalContentToSend = contentType === 'image' ? storedFilename : `[sound:${storedFilename}]`;
            contentType = contentType === 'image' ? 'image' : 'text';
        }

        if (targetField && finalContentToSend !== null) {
            chrome.runtime.sendMessage({
                action: "fillFieldFromContextMenu",
                field: targetField,
                content: finalContentToSend,
                contentType: contentType
             });
            const currentWindow = await chrome.windows.getCurrent();
            if (currentWindow) await chrome.sidePanel.open({ windowId: currentWindow.id });
        }
    } catch (error) {
        console.error("Error handling context menu click:", error);
    }
}