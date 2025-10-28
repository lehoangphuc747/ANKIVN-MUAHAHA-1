// src/ui/status.js
let statusTimeout = null;

export function showStatus(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `status-message ${isError ? 'error' : 'success'}`;
    statusElement.style.display = 'block';

    if (statusTimeout) clearTimeout(statusTimeout);

    if (!isError) {
        statusTimeout = setTimeout(() => {
            if (statusElement.textContent === message) {
                statusElement.style.display = 'none';
            }
        }, 4000);
    }
}