// background.js

const CONTEXT_MENU_ID_TEXT = "ankivnSendText";
const CONTEXT_MENU_ID_IMAGE = "ankivnSendImage";
const CONTEXT_MENU_ID_AUDIO = "ankivnSendAudio"; // [MỚI] Thêm ID cho Audio

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
    // [MỚI] Thêm menu gốc cho Audio
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_AUDIO,
        title: "Gửi âm thanh đến Field",
        contexts: ["audio"]
    });

    // --- Lọc các field bị ẩn ---
    let visibleFields = fieldNames;
    if (modelName && Array.isArray(fieldNames) && fieldNames.length > 0) {
        try {
            const hiddenFieldsKey = `hiddenFields_${modelName}`;
            const storedData = await chrome.storage.local.get(hiddenFieldsKey);
            const hiddenFields = storedData[hiddenFieldsKey] || {};
            visibleFields = fieldNames.filter(fieldName => !hiddenFields[fieldName]);
            console.log(`Filtered fields for model "${modelName}":`, { allFields: fieldNames, hiddenFields, visibleFields });
        } catch (error) {
            console.error("Error filtering hidden fields:", error);
            visibleFields = fieldNames; // Dùng tất cả nếu lỗi
        }
    } else if (!Array.isArray(fieldNames) || fieldNames.length === 0) {
         visibleFields = []; // Đảm bảo là mảng rỗng
    }


    // --- Tạo menu con hoặc thông báo ---
    if (visibleFields.length === 0) {
        // Thông báo nếu không có field nào
        const noFieldsTitle = modelName ? "Tất cả fields đã bị ẩn" : "Chọn Note Type trong sidebar...";
        chrome.contextMenus.create({
            id: "noVisibleFieldsText", parentId: CONTEXT_MENU_ID_TEXT,
            title: noFieldsTitle, contexts: ["selection"], enabled: false
        });
        chrome.contextMenus.create({
            id: "noVisibleFieldsImage", parentId: CONTEXT_MENU_ID_IMAGE,
            title: noFieldsTitle, contexts: ["image"], enabled: false
        });
        // [MỚI] Thêm thông báo cho Audio
        chrome.contextMenus.create({
            id: "noVisibleFieldsAudio", parentId: CONTEXT_MENU_ID_AUDIO,
            title: noFieldsTitle, contexts: ["audio"], enabled: false
        });
    } else {
        // Tạo menu con cho từng field
        visibleFields.forEach(fieldName => {
            chrome.contextMenus.create({
                id: `send-text-to-${fieldName}`,
                parentId: CONTEXT_MENU_ID_TEXT,
                title: fieldName,
                contexts: ["selection"]
            });
            chrome.contextMenus.create({
                id: `send-image-to-${fieldName}`,
                parentId: CONTEXT_MENU_ID_IMAGE,
                title: fieldName,
                contexts: ["image"]
            });
            // [MỚI] Thêm menu con cho Audio
            chrome.contextMenus.create({
                id: `send-audio-to-${fieldName}`,
                parentId: CONTEXT_MENU_ID_AUDIO,
                title: fieldName,
                contexts: ["audio"]
            });
        });
    }
    console.log("Context menu updated with visible fields:", visibleFields);
}

// --- Listener onInstalled (không đổi) ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("AnkiVN Extension installed/updated.");
    updateContextMenu([]);
});

// --- Listener onStartup (không đổi) ---
chrome.runtime.onStartup.addListener(async () => {
    console.log("Chrome started, restoring context menu.");
    try {
        const data = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
        if (data.lastSelectedModel && data.lastModelFields) {
            updateContextMenu(data.lastModelFields, data.lastSelectedModel);
        } else {
             updateContextMenu([]);
        }
    } catch (error) {
        console.error("Error restoring context menu:", error);
        updateContextMenu([]);
    }
});

// --- Listener onMessage (nhận fields từ popup - không đổi) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateFieldsForContextMenu") {
        console.log("Received fields update from sidebar:", message.modelName, message.fields);
        updateContextMenu(message.fields || [], message.modelName);
        chrome.storage.local.set({
             lastSelectedModel: message.modelName,
             lastModelFields: message.fields
        }).catch(err => console.error("Error saving last fields:", err));
    }
    // Cần giữ sendResponse nếu bạn muốn gửi phản hồi
    // sendResponse({ status: "Received" });
    return true; // Cho phép gửi phản hồi bất đồng bộ (nếu cần)
});


// --- [CẬP NHẬT] Listener xử lý click context menu ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("Context menu clicked:", info);

    let targetField = null;
    let contentUrl = null;
    let contentType = null;
    let finalContentToSend = null; // Nội dung cuối cùng gửi tới popup
    let storedFilename = null; // Tên file trả về từ Anki

    try {
        // --- Xác định loại context và field ---
        if (info.menuItemId.startsWith("send-text-to-")) {
            targetField = info.menuItemId.substring("send-text-to-".length);
            finalContentToSend = info.selectionText; // Text thì gửi thẳng
            contentType = 'text';
        } else if (info.menuItemId.startsWith("send-image-to-")) {
            targetField = info.menuItemId.substring("send-image-to-".length);
            contentUrl = info.srcUrl;
            contentType = 'image';
        } else if (info.menuItemId.startsWith("send-audio-to-")) {
            targetField = info.menuItemId.substring("send-audio-to-".length);
            contentUrl = info.srcUrl;
            contentType = 'audio';
        }

        // --- Xử lý media (Image/Audio) ---
        if (contentType === 'image' || contentType === 'audio') {
            if (!contentUrl) {
                console.warn(`Context menu (${contentType}) clicked but no srcUrl found.`);
                return;
            }
            console.log(`Attempting to store ${contentType} via Anki-Connect: ${contentUrl}`);
            
            // Tạo tên file
            let fileExtension = contentUrl.split('.').pop().split(/#|\?/)[0] || 'tmp';
            if (!fileExtension || fileExtension.length > 5 || !/^[a-zA-Z0-9]+$/.test(fileExtension)) {
                 if (contentType === 'image') fileExtension = 'webp';
                 else if (contentType === 'audio') fileExtension = 'mp3'; // Mặc định mp3 cho audio
            }
            let filename = `ankivn_${contentType}_${Date.now()}.${fileExtension}`;

            try {
                // Gọi storeMediaFile
                storedFilename = await invoke('storeMediaFile', {
                    url: contentUrl,
                    filename: filename
                });

                if (!storedFilename) throw new Error("storeMediaFile did not return a filename.");
                
                // [SỬA LỖI] Tạo nội dung dựa trên loại
                if (contentType === 'image') {
                    // [SỬA LỖI] Chỉ gửi tên file, popup.js sẽ tạo thẻ <img>
                    finalContentToSend = storedFilename;
                } else if (contentType === 'audio') {
                    // [MỚI] Tạo thẻ [sound:...] và gửi dưới dạng 'text'
                    finalContentToSend = `[sound:${storedFilename}]`;
                    contentType = 'text'; // Coi như text để popup chèn thẳng
                }
                console.log(`Media stored as "${storedFilename}". Content to send: ${finalContentToSend}`);

            } catch (ankiconnectError) {
                console.error(`Failed to store ${contentType} via Anki-Connect:`, ankiconnectError);
                finalContentToSend = `[Lỗi tải ${contentType}: ${ankiconnectError.message}] ${contentUrl}`;
                contentType = 'text'; // Gửi dưới dạng text lỗi
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
                 if (chrome.runtime.lastError) {
                      console.warn("Could not send message to sidebar:", chrome.runtime.lastError.message);
                 } else { console.log("Message sent response:", response); }
             });

            // Mở sidebar
            const currentWindow = await chrome.windows.getCurrent();
            if (currentWindow) {
                 await chrome.sidePanel.open({ windowId: currentWindow.id });
            }

        } else if (!targetField) {
             console.warn("Could not determine target field from context menu click:", info);
        }

    } catch (error) {
        console.error("Error handling context menu click:", error);
    }
});


// Listener mở sidebar khi click icon (giữ nguyên)
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
