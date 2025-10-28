// src/features/media-handler.js
import { invoke } from '../api/anki-connect.js';
import { showStatus } from '../ui/status.js';

/**
 * Handles a media file dropped from the local system.
 * @param {File} file The file object.
 * @param {HTMLElement} targetFieldDiv The contentEditable div to insert the media into.
 */
export async function handleMediaFile(file, targetFieldDiv) {
    if (!file || !targetFieldDiv) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
        showStatus(`Loại file không được hỗ trợ: ${file.type}`, true);
        return;
    }

    showStatus(`Đang xử lý file: ${file.name}...`);

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64Data = e.target.result.substring(e.target.result.indexOf(',') + 1);
                const storedFilename = await invoke('storeMediaFile', {
                    filename: file.name,
                    data: base64Data
                });

                if (!storedFilename) throw new Error("Anki-Connect không trả về tên file.");

                insertMediaIntoField(storedFilename, file.type, targetFieldDiv);
            } catch (err) {
                showStatus(`Lỗi khi lưu file media: ${err.message}`, true);
            }
        };
        reader.onerror = () => {
            showStatus(`Lỗi đọc file: ${reader.error.message}`, true);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        showStatus(`Lỗi không xác định khi xử lý file: ${error.message}`, true);
    }
}

/**
 * Handles a media URL dropped from a web page.
 * @param {string} imageUrl The URL of the media.
 * @param {HTMLElement} targetFieldDiv The contentEditable div to insert the media into.
 */
export async function handleMediaUrl(imageUrl, targetFieldDiv) {
    if (!imageUrl || !targetFieldDiv) return;

    showStatus("Đang xử lý ảnh từ URL...");

    try {
        let extension = 'webp';
        try {
            const urlPath = new URL(imageUrl).pathname;
            const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            if (lastSegment.includes('.')) {
                const potentialExt = lastSegment.split('.').pop().toLowerCase();
                if (potentialExt.length > 1 && potentialExt.length < 5) {
                    extension = potentialExt;
                }
            }
        } catch (e) { /* Ignore URL parsing errors */ }

        const filename = `ankivn_img_${Date.now()}.${extension}`;

        const storedFilename = await invoke('storeMediaFile', {
            filename: filename,
            url: imageUrl
        });

        if (!storedFilename) throw new Error("Anki-Connect không trả về tên file.");

        insertMediaIntoField(storedFilename, 'image/', targetFieldDiv);

    } catch (error) {
        showStatus(`Lỗi khi tải media từ URL: ${error.message}`, true);
    }
}

/**
 * Inserts the HTML for the stored media into the target field.
 * @param {string} filename The filename returned by Anki-Connect.
 * @param {string} mediaType The MIME type of the media (e.g., 'image/png').
 * @param {HTMLElement} targetFieldDiv The contentEditable div.
 */
function insertMediaIntoField(filename, mediaType, targetFieldDiv) {
    let mediaHtml = '';
    if (mediaType.startsWith('image/')) {
        mediaHtml = `<img src="${filename}">`;
    } else if (mediaType.startsWith('audio/')) {
        mediaHtml = `[sound:${filename}]`;
    }

    if (mediaHtml) {
        targetFieldDiv.focus();
        document.execCommand('insertHTML', false, mediaHtml);
        targetFieldDiv.dispatchEvent(new Event('input', { bubbles: true }));
        showStatus(`Đã thêm media: ${filename}`);
    }
}