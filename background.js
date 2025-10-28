// background.js

const CONTEXT_MENU_ID_TEXT = "ankivnSendText";
const CONTEXT_MENU_ID_IMAGE = "ankivnSendImage";
const CONTEXT_MENU_ID_AUDIO = "ankivnSendAudio";
const CONTEXT_MENU_ID_LINK = "ankivnSendLink"; // [MỚI] Thêm ID cho Link

// --- Hàm invoke (không đổi) ---
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, version: 6, params: params })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        if (result.error) throw new Error(`Anki-Connect Error: ${result.error}`);
        console.log(`Anki-Connect (${action}) successful:`, result.result);
        return result.result;
    } catch (error) {
        console.error(`Anki-Connect error in background (${action}):`, error);
        throw error;
    }
}


// --- [CẬP NHẬT] Hàm updateContextMenu ---
async function updateContextMenu(fieldNames = [], modelName = null) {
    await chrome.contextMenus.removeAll();

    // --- Tạo menu gốc ---
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_TEXT,
        title: "Gửi text đến Field",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_IMAGE,
        title: "Gửi ảnh đến Field",
        contexts: ["image"]
    });
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_AUDIO,
        title: "Gửi âm thanh đến Field",
        contexts: ["audio"]
    });
    // [MỚI] Thêm menu gốc cho Link
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_LINK,
        title: "Gửi link đến Field",
        contexts: ["link"]
    });

    // --- Lọc các field bị ẩn ---
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


    // --- Tạo menu con hoặc thông báo ---
    if (visibleFields.length === 0) {
        const noFieldsTitle = modelName ? "Tất cả fields đã bị ẩn" : "Chọn Note Type trong sidebar...";
        chrome.contextMenus.create({
            id: "noVisibleFieldsText", parentId: CONTEXT_MENU_ID_TEXT,
            title: noFieldsTitle, contexts: ["selection"], enabled: false
        });
        chrome.contextMenus.create({
            id: "noVisibleFieldsImage", parentId: CONTEXT_MENU_ID_IMAGE,
            title: noFieldsTitle, contexts: ["image"], enabled: false
        });
        chrome.contextMenus.create({
            id: "noVisibleFieldsAudio", parentId: CONTEXT_MENU_ID_AUDIO,
            title: noFieldsTitle, contexts: ["audio"], enabled: false
        });
         // [MỚI] Thêm thông báo cho Link
        chrome.contextMenus.create({
            id: "noVisibleFieldsLink", parentId: CONTEXT_MENU_ID_LINK,
            title: noFieldsTitle, contexts: ["link"], enabled: false
        });
    } else {
        visibleFields.forEach(fieldName => {
            chrome.contextMenus.create({
                id: `send-text-to-${fieldName}`, parentId: CONTEXT_MENU_ID_TEXT,
                title: fieldName, contexts: ["selection"]
            });
            chrome.contextMenus.create({
                id: `send-image-to-${fieldName}`, parentId: CONTEXT_MENU_ID_IMAGE,
                title: fieldName, contexts: ["image"]
            });
            chrome.contextMenus.create({
                id: `send-audio-to-${fieldName}`, parentId: CONTEXT_MENU_ID_AUDIO,
                title: fieldName, contexts: ["audio"]
            });
             // [MỚI] Thêm menu con cho Link
            chrome.contextMenus.create({
                id: `send-link-to-${fieldName}`, parentId: CONTEXT_MENU_ID_LINK,
                title: fieldName, contexts: ["link"]
            });
        });
    }
    console.log("Context menu updated with visible fields:", visibleFields);
}

// --- Listeners onInstalled, onStartup, onMessage (không đổi) ---
chrome.runtime.onInstalled.addListener(() => { updateContextMenu([]); });
chrome.runtime.onStartup.addListener(async () => {
    try {
        const data = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
        updateContextMenu(data.lastModelFields || [], data.lastSelectedModel);
    } catch (error) { updateContextMenu([]); }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateFieldsForContextMenu") {
        updateContextMenu(message.fields || [], message.modelName);
        chrome.storage.local.set({
             lastSelectedModel: message.modelName,
             lastModelFields: message.fields
        }).catch(err => console.error("Error saving last fields:", err));
    }
    return true;
});


// --- [CẬP NHẬT] Listener xử lý click context menu ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("Context menu clicked:", info);

    let targetField = null;
    let contentUrl = null; // Đổi tên từ 'content' để rõ ràng hơn
    let contentType = null;
    let finalContentToSend = null;
    let storedFilename = null;

    try {
        // --- Xác định loại context và field ---
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
            contentUrl = info.srcUrl || info.linkUrl; // Lấy cả linkUrl phòng trường hợp audio nằm trong link
            contentType = 'audio';
        } else if (info.menuItemId.startsWith("send-link-to-")) { // [MỚI] Xử lý link
            targetField = info.menuItemId.substring("send-link-to-".length);
            finalContentToSend = info.linkUrl;
            contentType = 'text'; // Gửi link dưới dạng text
        }

        // --- Xử lý media (Image/Audio) ---
        if (contentType === 'image' || contentType === 'audio') {
            if (!contentUrl) {
                console.warn(`Context menu (${contentType}) clicked but no srcUrl/linkUrl found.`);
                return;
            }
            console.log(`Attempting to store ${contentType} via Anki-Connect: ${contentUrl}`);

            // Tạo tên file
            let fileExtension = contentUrl.split('.').pop().split(/#|\?/)[0] || 'tmp';
            if (!fileExtension || fileExtension.length > 5 || !/^[a-zA-Z0-9]+$/.test(fileExtension)) {
                 if (contentType === 'image') fileExtension = 'webp';
                 else if (contentType === 'audio') fileExtension = 'mp3';
            }
            let filename = `ankivn_${contentType}_${Date.now()}.${fileExtension}`;

            try {
                // Gọi storeMediaFile
                storedFilename = await invoke('storeMediaFile', { url: contentUrl, filename: filename });
                if (!storedFilename) throw new Error("storeMediaFile did not return a filename.");

                if (contentType === 'image') {
                    finalContentToSend = storedFilename; // Chỉ gửi tên file
                } else if (contentType === 'audio') {
                    finalContentToSend = `[sound:${storedFilename}]`; // Tạo thẻ sound
                    contentType = 'text'; // Gửi dưới dạng text
                }
                console.log(`Media stored as "${storedFilename}". Content to send: ${finalContentToSend}`);

            } catch (ankiconnectError) {
                console.error(`Failed to store ${contentType}:`, ankiconnectError);
                finalContentToSend = `[Lỗi tải ${contentType}: ${ankiconnectError.message}] ${contentUrl}`;
                contentType = 'text';
            }
        }

        // --- Gửi message đến sidebar ---
        if (targetField && finalContentToSend !== null) {
            console.log(`Sending final content (type: ${contentType}) to field "${targetField}":`, finalContentToSend);

            chrome.runtime.sendMessage({
                action: "fillFieldFromContextMenu",
                field: targetField,
                content: finalContentToSend,
                contentType: contentType // 'text', 'image'
             }, (response) => {
                 if (chrome.runtime.lastError) console.warn("Could not send message:", chrome.runtime.lastError.message);
                 else console.log("Message sent response:", response);
             });

            // Mở sidebar
            const currentWindow = await chrome.windows.getCurrent();
            if (currentWindow) await chrome.sidePanel.open({ windowId: currentWindow.id });

        } else if (!targetField) {
             console.warn("Could not determine target field:", info);
        }

    } catch (error) {
        console.error("Error handling context menu click:", error);
    }
});


// Listener mở sidebar khi click icon (không đổi)
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

