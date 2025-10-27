// background.js

const CONTEXT_MENU_ID_TEXT = "ankivnSendText";
const CONTEXT_MENU_ID_IMAGE = "ankivnSendImage";

// --- Hàm tạo/cập nhật Context Menu ---
async function updateContextMenu(fieldNames = []) {
    // Xóa menu cũ trước khi tạo mới để tránh trùng lặp
    await chrome.contextMenus.removeAll();

    // Tạo menu gốc cho Text Selection
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_TEXT,
        title: "Gửi text đến Field",
        contexts: ["selection"] // Chỉ hiện khi bôi đen text
    });

    // Tạo menu gốc cho Image Selection
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID_IMAGE,
        title: "Gửi ảnh đến Field",
        contexts: ["image"] // Chỉ hiện khi click phải vào ảnh
    });

    // Nếu không có field nào (chưa chọn Note Type), không tạo menu con
    if (!Array.isArray(fieldNames) || fieldNames.length === 0) {
        console.log("No fields provided, skipping sub-menu creation.");
        // Có thể tạo một menu con thông báo "Vui lòng chọn Note Type trong sidebar"
        chrome.contextMenus.create({
            id: "noFieldsText",
            parentId: CONTEXT_MENU_ID_TEXT,
            title: "Chọn Note Type trong sidebar...",
            contexts: ["selection"],
            enabled: false // Không cho click
        });
         chrome.contextMenus.create({
            id: "noFieldsImage",
            parentId: CONTEXT_MENU_ID_IMAGE,
            title: "Chọn Note Type trong sidebar...",
            contexts: ["image"],
            enabled: false
        });
        return;
    }

    // Tạo menu con cho từng field
    fieldNames.forEach(fieldName => {
        // Menu con cho Text
        chrome.contextMenus.create({
            id: `send-text-to-${fieldName}`, // ID duy nhất
            parentId: CONTEXT_MENU_ID_TEXT, // Gắn vào menu gốc Text
            title: fieldName,
            contexts: ["selection"]
        });
        // Menu con cho Image
        chrome.contextMenus.create({
            id: `send-image-to-${fieldName}`, // ID duy nhất
            parentId: CONTEXT_MENU_ID_IMAGE, // Gắn vào menu gốc Image
            title: fieldName,
            contexts: ["image"]
        });
    });
    console.log("Context menu updated with fields:", fieldNames);
}

// --- Listener khi cài đặt/cập nhật extension ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("AnkiVN Extension installed/updated.");
    // Tạo menu lần đầu (chưa có field)
    updateContextMenu([]);
});

// --- Listener khi Chrome khởi động ---
// (Quan trọng để context menu xuất hiện lại sau khi khởi động lại Chrome)
chrome.runtime.onStartup.addListener(async () => {
    console.log("Chrome started, restoring context menu.");
    // Cố gắng đọc field đã lưu từ lần cuối cùng
    try {
        const data = await chrome.storage.local.get(['lastSelectedModel', 'lastModelFields']);
        if (data.lastSelectedModel && data.lastModelFields) {
            console.log("Restoring fields for model:", data.lastSelectedModel);
            updateContextMenu(data.lastModelFields);
        } else {
             console.log("No last selected model/fields found, creating default menu.");
             updateContextMenu([]); // Tạo menu mặc định nếu chưa có gì lưu
        }
    } catch (error) {
        console.error("Error restoring context menu:", error);
        updateContextMenu([]); // Tạo menu mặc định nếu lỗi
    }
});


// --- Listener nhận message từ popup.js để cập nhật fields ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateFieldsForContextMenu") {
        console.log("Received fields update from sidebar:", message.fields);
        if (Array.isArray(message.fields)) {
            updateContextMenu(message.fields);
            // Lưu lại để dùng khi khởi động Chrome
            chrome.storage.local.set({
                 lastSelectedModel: message.modelName, // Lưu cả model name
                 lastModelFields: message.fields
            }).catch(err => console.error("Error saving last fields:", err));
        } else {
            console.warn("Received invalid fields data:", message.fields);
             updateContextMenu([]); // Reset menu nếu dữ liệu không hợp lệ
        }
        // Không cần sendResponse vì đây là thông báo một chiều
    }
    // Thêm các xử lý message khác nếu cần
});


// --- Listener xử lý khi click vào context menu item ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("Context menu clicked:", info);

    let targetField = null;
    let content = null;
    let contentType = null; // 'text' or 'image'

    // Xác định field và nội dung
    if (info.menuItemId.startsWith("send-text-to-")) {
        targetField = info.menuItemId.substring("send-text-to-".length);
        content = info.selectionText; // Lấy text đã bôi đen
        contentType = 'text';
    } else if (info.menuItemId.startsWith("send-image-to-")) {
        targetField = info.menuItemId.substring("send-image-to-".length);
        content = info.srcUrl; // Lấy URL của ảnh
        contentType = 'image';
    }

    // Nếu xác định được field và content
    if (targetField && content) {
        console.log(`Sending ${contentType} to field "${targetField}":`, content);

        // Gửi message đến sidebar (popup.js)
        try {
            // Cần tìm đúng tab ID của sidebar nếu nó đang mở
            // Hoặc đơn giản là gửi cho tất cả các context của extension
             chrome.runtime.sendMessage({
                action: "fillFieldFromContextMenu",
                field: targetField,
                content: content,
                contentType: contentType // Gửi cả loại nội dung
             }, (response) => {
                 if (chrome.runtime.lastError) {
                      console.warn("Could not send message to sidebar (maybe closed?):", chrome.runtime.lastError.message);
                      // Có thể hiện thông báo lỗi cho người dùng ở đây nếu muốn
                 } else {
                      console.log("Message sent to sidebar, response:", response);
                 }
             });

            // Mở sidebar nếu nó chưa mở (tùy chọn)
            // Lấy windowId từ tab hiện tại nơi context menu được click
            const currentWindow = await chrome.windows.get(tab.windowId);
            if (currentWindow) {
                 await chrome.sidePanel.open({ windowId: currentWindow.id });
            }


        } catch (error) {
            console.error("Error sending message to sidebar:", error);
        }
    } else {
         console.warn("Could not determine target field or content from context menu click:", info);
    }
});

// Listener mở sidebar khi click icon (giữ nguyên)
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});