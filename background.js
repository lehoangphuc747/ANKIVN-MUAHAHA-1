// background.js

const CONTEXT_MENU_ID_TEXT = "ankivnSendText";
const CONTEXT_MENU_ID_IMAGE = "ankivnSendImage";

// --- [THÊM MỚI] Hàm invoke (copy từ popup.js/settings.js) ---
// Hàm này cần thiết để background script gọi Anki-Connect
async function invoke(action, params = {}) {
    try {
        const response = await fetch('http://localhost:8765', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, version: 6, params: params })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        if (result.error) throw new Error(`Anki-Connect Error: ${result.error}`); // Thêm tiền tố cho rõ
        console.log(`Anki-Connect (${action}) successful:`, result.result); // Log success
        return result.result;
    } catch (error) {
        console.error(`Anki-Connect error in background (${action}):`, error);
        // Ném lỗi để hàm gọi (onClicked) có thể bắt và xử lý
        throw error;
    }
}


// --- Hàm updateContextMenu (không đổi) ---
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
// --- Listener onInstalled (không đổi) ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("AnkiVN Extension installed/updated.");
    // Tạo menu lần đầu (chưa có field)
    updateContextMenu([]);
});
// --- Listener onStartup (không đổi) ---
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
// --- Listener onMessage (nhận fields từ popup - không đổi) ---
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


// --- [HÀM ĐƯỢC CẬP NHẬT] Listener xử lý click context menu ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("Context menu clicked:", info);

    let targetField = null;
    let content = null;
    let contentType = null;
    let finalContentToSend = null; // Nội dung cuối cùng gửi tới popup

    try {
        // Xác định field và nội dung ban đầu
        if (info.menuItemId.startsWith("send-text-to-")) {
            targetField = info.menuItemId.substring("send-text-to-".length);
            content = info.selectionText;
            contentType = 'text';
            finalContentToSend = content; // Text thì gửi thẳng
        } else if (info.menuItemId.startsWith("send-image-to-")) {
            targetField = info.menuItemId.substring("send-image-to-".length);
            content = info.srcUrl; // Lấy URL ảnh
            contentType = 'image';

            // [MỚI] Gọi Anki-Connect để lưu ảnh
            if (content) {
                console.log(`Attempting to store image via Anki-Connect: ${content}`);
                // Tạo tên file gợi ý (Anki-Connect có thể đổi nếu trùng)
                let fileExtension = content.split('.').pop().split(/#|\?/)[0] || 'webp';
                // Ưu tiên webp, nếu không có thì dùng jpg
                if (!fileExtension || fileExtension.length > 5 || !/^[a-zA-Z0-9]+$/.test(fileExtension)) {
                     fileExtension = 'webp'; // Mặc định là webp nếu extension lạ
                }
                let filename = `ankivn_img_${Date.now()}.${fileExtension}`;


                try {
                    // *** THÊM filename VÀO ĐÂY ***
                    const storedFilename = await invoke('storeMediaFile', {
                        url: content,
                        filename: filename // Tham số bắt buộc
                    });
                    // *** HẾT PHẦN THÊM ***

                    if (storedFilename) {
                        finalContentToSend = `<img src="${storedFilename}">`;
                        console.log(`Image stored as "${storedFilename}". Tag: ${finalContentToSend}`);
                    } else {
                        throw new Error("storeMediaFile did not return a filename.");
                    }
                } catch (ankiconnectError) {
                    console.error("Failed to store image via Anki-Connect:", ankiconnectError);
                    // Gửi URL gốc tới popup kèm thông báo lỗi? Hoặc chỉ gửi lỗi?
                    // Quyết định: Gửi thông báo lỗi tới popup
                    finalContentToSend = `[Lỗi tải ảnh: ${ankiconnectError.message}] ${content}`; // Gửi URL kèm lỗi
                    contentType = 'text'; // Coi như text lỗi
                }
            } else {
                 console.warn("Image context menu clicked but no srcUrl found.");
                 return; // Không làm gì nếu không có URL ảnh
            }
        }

        // Nếu xác định được field và nội dung cuối cùng
        if (targetField && finalContentToSend !== null) { // Kiểm tra finalContentToSend thay vì content
            console.log(`Sending final content (${contentType}) to field "${targetField}":`, finalContentToSend);

            // Gửi message đến sidebar
             chrome.runtime.sendMessage({
                action: "fillFieldFromContextMenu",
                field: targetField,
                content: finalContentToSend, // Gửi nội dung đã xử lý (text hoặc img tag)
                contentType: contentType
             }, (response) => {
                 if (chrome.runtime.lastError) {
                      console.warn("Could not send message to sidebar:", chrome.runtime.lastError.message);
                 } else { console.log("Message sent response:", response); }
             });

            // Mở sidebar
            const currentWindow = await chrome.windows.getCurrent(); // Lấy cửa sổ hiện tại dễ hơn
            if (currentWindow) {
                 await chrome.sidePanel.open({ windowId: currentWindow.id });
            }

        } else if (!targetField) {
             console.warn("Could not determine target field from context menu click:", info);
        } else {
             // Trường hợp finalContentToSend là null (ví dụ lỗi không mong muốn)
             console.error("finalContentToSend is null, cannot send message.");
        }

    } catch (error) {
        // Bắt các lỗi khác (ví dụ lỗi khi gọi chrome.windows.getCurrent)
        console.error("Error handling context menu click:", error);
    }
});


// Listener mở sidebar khi click icon (giữ nguyên)
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});