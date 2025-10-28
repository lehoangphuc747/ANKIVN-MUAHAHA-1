// src/background/context-menu.js
import { invoke } from '../api/anki-connect.js';

const CONTEXT_MENU_ID_TEXT = "ankivnSendText";
const CONTEXT_MENU_ID_IMAGE = "ankivnSendImage";
const CONTEXT_MENU_ID_AUDIO = "ankivnSendAudio";
const CONTEXT_MENU_ID_LINK = "ankivnSendLink";

export async function updateContextMenu(fieldNames = [], modelName = null) {
    await chrome.contextMenus.removeAll();

    let defaults = {};
    if (modelName) {
        const defaultsKey = `contextMenuDefaults_${modelName}`;
        const data = await chrome.storage.local.get(defaultsKey);
        defaults = data[defaultsKey] || {};
    }

    const createTitle = (base, type) => defaults[type] ? `${base} đến "${defaults[type]}"` : `${base} đến Field...`;

    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_TEXT, title: createTitle("Gửi text", "text"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_IMAGE, title: createTitle("Gửi ảnh", "image"), contexts: ["image"] });
    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_AUDIO, title: createTitle("Gửi âm thanh", "audio"), contexts: ["audio"] });
    chrome.contextMenus.create({ id: CONTEXT_MENU_ID_LINK, title: createTitle("Gửi link", "link"), contexts: ["link"] });

    let visibleFields = fieldNames;
    if (modelName && Array.isArray(fieldNames) && fieldNames.length > 0) {
        try {
            const hiddenFieldsKey = `hiddenFields_${modelName}`;
            const storedData = await chrome.storage.local.get(hiddenFieldsKey);
            const hiddenFields = storedData[hiddenFieldsKey] || {};
            visibleFields = fieldNames.filter(fieldName => !hiddenFields[fieldName]);
        } catch (error) {
            console.error("Error filtering hidden fields:", error);
        }
    } else if (!Array.isArray(fieldNames) || fieldNames.length === 0) {
         visibleFields = [];
    }

    if (visibleFields.length > 0) {
        const parentIds = [CONTEXT_MENU_ID_TEXT, CONTEXT_MENU_ID_IMAGE, CONTEXT_MENU_ID_AUDIO, CONTEXT_MENU_ID_LINK];
        parentIds.forEach(parentId => chrome.contextMenus.create({ id: `separator-for-${parentId}`, parentId, type: 'separator' }));
        
        visibleFields.forEach(fieldName => {
            chrome.contextMenus.create({ id: `send-text-to-${fieldName}`, parentId: CONTEXT_MENU_ID_TEXT, title: fieldName, contexts: ["selection"] });
            chrome.contextMenus.create({ id: `send-image-to-${fieldName}`, parentId: CONTEXT_MENU_ID_IMAGE, title: fieldName, contexts: ["image"] });
            chrome.contextMenus.create({ id: `send-audio-to-${fieldName}`, parentId: CONTEXT_MENU_ID_AUDIO, title: fieldName, contexts: ["audio"] });
            chrome.contextMenus.create({ id: `send-link-to-${fieldName}`, parentId: CONTEXT_MENU_ID_LINK, title: fieldName, contexts: ["link"] });
        });
    }
    console.log("Context menu updated with defaults:", defaults);
}

async function getDefaultField(contextType) {
    const { lastSelectedModel } = await chrome.storage.local.get('lastSelectedModel');
    if (!lastSelectedModel) return null;
    
    const defaultsKey = `contextMenuDefaults_${lastSelectedModel}`;
    const data = await chrome.storage.local.get(defaultsKey);
    const defaults = data[defaultsKey] || {};
    return defaults[contextType] || null;
}

export async function handleContextMenuClick(info, tab) {
    console.log("Context menu clicked:", info);

    let targetField = null;
    let contentUrl = null;
    let contentType = null;
    let finalContentToSend = null;

    try {
        const menuItemId = info.menuItemId;
        if (menuItemId.startsWith("send-text-to-")) {
            targetField = menuItemId.substring("send-text-to-".length);
            finalContentToSend = info.selectionText;
            contentType = 'text';
        } else if (menuItemId.startsWith("send-image-to-")) {
            targetField = menuItemId.substring("send-image-to-".length);
            contentUrl = info.srcUrl;
            contentType = 'image';
        } else if (menuItemId.startsWith("send-audio-to-")) {
            targetField = menuItemId.substring("send-audio-to-".length);
            contentUrl = info.srcUrl || info.linkUrl;
            contentType = 'audio';
        } else if (menuItemId.startsWith("send-link-to-")) {
            targetField = menuItemId.substring("send-link-to-".length);
            finalContentToSend = info.linkUrl;
            contentType = 'text';
        } else if (menuItemId === CONTEXT_MENU_ID_TEXT) {
            targetField = await getDefaultField('text');
            finalContentToSend = info.selectionText;
            contentType = 'text';
        } else if (menuItemId === CONTEXT_MENU_ID_IMAGE) {
            targetField = await getDefaultField('image');
            contentUrl = info.srcUrl;
            contentType = 'image';
        } else if (menuItemId === CONTEXT_MENU_ID_AUDIO) {
            targetField = await getDefaultField('audio');
            contentUrl = info.srcUrl || info.linkUrl;
            contentType = 'audio';
        } else if (menuItemId === CONTEXT_MENU_ID_LINK) {
            targetField = await getDefaultField('link');
            finalContentToSend = info.linkUrl;
            contentType = 'text';
        }

        if (!targetField) return; // No default field set and a parent item was clicked

        if (contentType === 'image' || contentType === 'audio') {
            if (!contentUrl) return;

            let fileExtension;
            const defaultExt = contentType === 'image' ? 'webp' : 'mp3';
            const invalidCharsRegex = /[?#&=%]/;

            const pathBeforeQuery = contentUrl.split('?')[0].split('#')[0];
            const lastSegment = pathBeforeQuery.split('/').pop();
            if (lastSegment.includes('.')) {
                const potentialExt = lastSegment.split('.').pop().toLowerCase();
                if (potentialExt.length > 1 && potentialExt.length < 5 && !invalidCharsRegex.test(potentialExt)) {
                    fileExtension = potentialExt;
                }
            }

            if (!fileExtension && contentType === 'image') {
                try {
                    const urlParams = new URL(contentUrl).searchParams;
                    const formatParam = urlParams.get('fm');
                    if (formatParam && formatParam.length > 1 && formatParam.length < 5 && !invalidCharsRegex.test(formatParam)) {
                        fileExtension = formatParam.toLowerCase();
                    }
                } catch (e) { /* Ignore parsing errors */ }
            }
            
            if (!fileExtension) fileExtension = defaultExt;

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