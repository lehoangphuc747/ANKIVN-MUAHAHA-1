// background.js

// Lắng nghe sự kiện nhấp vào biểu tượng extension
chrome.action.onClicked.addListener(async (tab) => {
  // Mở side panel trong cửa sổ hiện tại
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("AnkiVN Sidebar đã sẵn sàng.");
  // Bạn có thể thiết lập quy tắc chỉ hiển thị sidebar trên các trang nhất định ở đây nếu muốn
  // chrome.sidePanel.setOptions({ path: 'popup.html' });
});