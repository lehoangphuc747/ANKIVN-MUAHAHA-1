// src/utils/helpers.js
export function generateRandomId() {
  const p1 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const p2 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return p1 + p2;
}

export function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}