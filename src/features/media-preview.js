// src/features/media-preview.js
import { invoke } from '../api/anki-connect.js';
import { showStatus } from '../ui/status.js';

let currentPlayingAudio = null;
let previewCounter = 0;

export async function updateMediaPreview(content, previewContainer) {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    const currentPreviewId = `preview-${previewCounter++}`;
    previewContainer.dataset.previewId = currentPreviewId;

    const imgRegex = /<img\s+src="([^"]+)"[^>]*>/g;
    const audioRegex = /\[sound:([^\]]+)\]/g;
    let imgMatch = imgRegex.exec(content);
    let audioMatch = audioRegex.exec(content);

    if (!imgMatch && !audioMatch) {
        previewContainer.style.display = 'none';
        return;
    }
    previewContainer.style.display = 'block';

    while (imgMatch) {
        const filename = imgMatch[1];
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-loading';
        wrapper.textContent = `Đang tải ${filename}...`;
        previewContainer.appendChild(wrapper);
        try {
            const base64Data = await invoke('retrieveMediaFile', { filename });
            if (previewContainer.dataset.previewId !== currentPreviewId) return;
            if (base64Data) {
                const src = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
                wrapper.innerHTML = `<img src="${src}" alt="Preview ${filename}" class="preview-image" title="Click để xem lớn: ${filename}">`;
                wrapper.querySelector('img').addEventListener('click', (e) => { e.stopPropagation(); showImageModal(src, filename); });
            } else { throw new Error("No base64 data received"); }
        } catch (err) {
            if (previewContainer.dataset.previewId === currentPreviewId) {
                wrapper.textContent = `Lỗi tải ${filename}`;
                wrapper.className = 'preview-error';
            }
        }
        imgMatch = imgRegex.exec(content);
    }

    while (audioMatch) {
        const filename = audioMatch[1];
        const btn = document.createElement('button');
        btn.className = 'preview-audio-button btn-secondary';
        btn.textContent = '🔊 Nghe';
        btn.title = `Phát file: ${filename}`;
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (btn.classList.contains('playing')) {
                stopCurrentAudio();
                return;
            }
            stopCurrentAudio();
            btn.disabled = true;
            btn.textContent = 'Đang tải...';
            try {
                const base64Data = await invoke('retrieveMediaFile', { filename });
                if (previewContainer.dataset.previewId !== currentPreviewId) return;
                if (base64Data) {
                    const src = base64Data.startsWith('data:') ? base64Data : `data:audio/mpeg;base64,${base64Data}`;
                    const audio = new Audio(src);
                    currentPlayingAudio = { audio, btn };
                    audio.onplay = () => { btn.textContent = '⏸️ Dừng'; btn.disabled = false; btn.classList.add('playing'); };
                    audio.onended = stopCurrentAudio;
                    audio.onerror = () => { showStatus(`Lỗi phát audio ${filename}`, true); stopCurrentAudio(); };
                    audio.play();
                } else { throw new Error("No base64 data received"); }
            } catch (err) {
                showStatus(`Lỗi tải audio ${filename}: ${err.message}`, true);
                stopCurrentAudio();
            }
        };
        previewContainer.appendChild(btn);
        audioMatch = audioRegex.exec(content);
    }
}

function showImageModal(src, caption) {
    const modal = document.getElementById('image-preview-modal');
    const modalImg = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    const modalClose = modal.querySelector('.modal-close-btn');

    modalImg.src = src;
    modalCaption.textContent = caption;
    modal.style.display = 'block';

    const closeModal = () => modal.style.display = 'none';
    modalClose.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function stopCurrentAudio() {
  if (currentPlayingAudio) {
    currentPlayingAudio.audio.pause();
    currentPlayingAudio.audio.currentTime = 0;
    currentPlayingAudio.btn.classList.remove('playing');
    currentPlayingAudio.btn.textContent = '🔊 Nghe';
    currentPlayingAudio.btn.disabled = false;
    currentPlayingAudio = null;
  }
}