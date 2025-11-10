// src/stats/main.js
import { invoke } from '../api/anki-connect.js';

/**
 * Kiểm tra xem lỗi có phải là lỗi kết nối không
 */
function isConnectionError(error) {
    const errorMessage = error.message || error.toString();
    return errorMessage.includes('Failed to fetch') || 
           errorMessage.includes('ERR_CONNECTION_REFUSED') ||
           errorMessage.includes('NetworkError');
}

/**
 * Hiển thị thông báo lỗi kết nối
 */
function showConnectionError(element, label) {
    element.textContent = 'Không kết nối';
    element.classList.remove('loading');
    element.classList.add('error');
    element.title = `${label}: Không thể kết nối đến Anki-Connect. Vui lòng kiểm tra Anki đang chạy và addon Anki-Connect đã được cài đặt.`;
}

document.addEventListener('DOMContentLoaded', async () => {
    loadQuickStats();
    loadCollectionStats();
});

async function loadQuickStats() {
    const reviewedTodayEl = document.getElementById('stats-reviewed-today');
    const totalNotesEl = document.getElementById('stats-total-notes');

    try {
        const reviewedToday = await invoke('getNumCardsReviewedToday');
        reviewedTodayEl.textContent = `${reviewedToday} thẻ`;
        reviewedTodayEl.classList.remove('loading');
        reviewedTodayEl.classList.remove('error');
    } catch (e) {
        console.error('[Stats] Error loading reviewed today:', e);
        if (isConnectionError(e)) {
            showConnectionError(reviewedTodayEl, 'Đã ôn hôm nay');
        } else {
            reviewedTodayEl.textContent = 'Lỗi';
            reviewedTodayEl.classList.remove('loading');
            reviewedTodayEl.classList.add('error');
            reviewedTodayEl.title = `Lỗi: ${e.message || 'Không thể tải dữ liệu'}`;
        }
    }

    try {
        const noteIds = await invoke('findNotes', { query: 'deck:*' });
        totalNotesEl.textContent = `${noteIds.length} notes`;
        totalNotesEl.classList.remove('loading');
        totalNotesEl.classList.remove('error');
    } catch (e) {
        console.error('[Stats] Error loading total notes:', e);
        if (isConnectionError(e)) {
            showConnectionError(totalNotesEl, 'Tổng số Notes');
        } else {
            totalNotesEl.textContent = 'Lỗi';
            totalNotesEl.classList.remove('loading');
            totalNotesEl.classList.add('error');
            totalNotesEl.title = `Lỗi: ${e.message || 'Không thể tải dữ liệu'}`;
        }
    }
}

async function loadCollectionStats() {
    const statsContainer = document.getElementById('stats-collection-html');
    try {
        // Lấy toàn bộ HTML của trang thống kê từ Anki
        const statsHtml = await invoke('getCollectionStatsHTML', { wholeCollection: true });
        
        if (statsHtml) {
            statsContainer.innerHTML = statsHtml;
            // Xóa các phần không cần thiết (nếu muốn)
            // ví dụ: statsContainer.querySelector('h1').remove();
        } else {
            statsContainer.innerHTML = '<p class="error">Không thể tải báo cáo.</p>';
        }
    } catch (error) {
        console.error("[Stats] Error loading collection stats:", error);
        
        if (isConnectionError(error)) {
            statsContainer.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <p class="error" style="font-size: 1rem; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-triangle"></i> Không thể kết nối đến Anki-Connect
                    </p>
                    <p style="color: var(--text-color-light); font-size: 0.9rem; margin: 0;">
                        Vui lòng kiểm tra:<br>
                        • Anki đang chạy<br>
                        • Addon Anki-Connect đã được cài đặt và kích hoạt<br>
                        • Anki-Connect đang lắng nghe tại <code>http://localhost:8765</code>
                    </p>
                </div>
            `;
        } else {
            statsContainer.innerHTML = `
                <p class="error" style="padding: 20px; text-align: center;">
                    <i class="fas fa-exclamation-triangle"></i> Lỗi tải thống kê: ${error.message || 'Lỗi không xác định'}
                </p>
            `;
        }
    }
}

