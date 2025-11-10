# AI Development Rules – AnkiVN Extension

This document outlines the technology stack and usage guidelines for the AnkiVN Chrome extension. Following these rules will maintain consistency, improve collaboration, and ensure the AI assistant can effectively understand, modify, and extend the codebase.

## 🚀 Getting Started

**IMPORTANT**: Trước khi bắt đầu làm việc với codebase này, AI assistant **PHẢI** đọc file `AI_CONTEXT.md` để hiểu:
- Cấu trúc codebase và các modules
- Luồng hoạt động chính
- Các tính năng hiện có
- Cách làm việc với codebase
- Storage keys và conventions

File `AI_CONTEXT.md` chứa tất cả context cần thiết để làm việc hiệu quả mà không cần đọc lại toàn bộ codebase mỗi lần.

## Tech Stack Overview

The extension is built using the following core technologies:

- Framework: None (Vanilla JavaScript, HTML, and CSS)  
- Language: JavaScript (ES6+)  
- Styling: CSS (optionally with simple CSS variables, no preprocessors)  
- Manifest: Chrome Manifest V3  
- APIs: Chrome Extension APIs (chrome.runtime, chrome.scripting, chrome.storage, etc.)  
- Optional Pages: Popup, Options, or background scripts as needed

## Library Usage Guidelines

To maintain simplicity and ensure clarity for AI assistance, follow these rules:

1. Core Extension Files  
- manifest.json: Must follow Manifest V3 syntax. Include only necessary permissions.  
- background.js / service_worker.js: For background tasks or event handling.  
- content.js: For scripts injected into web pages.  
- popup.html / popup.js: Optional; only if the extension includes a popup.  
- options.html / options.js: Optional; only if the extension has a settings page.  
- styles.css: Optional; minimal styling for popup or options page.  
Avoid generating unnecessary files or directories.

2. JavaScript Guidelines  
- Use vanilla ES6+ JavaScript với ES6 modules (import/export).  
- Avoid using React, Vue, Angular, or any UI frameworks.  
- Keep functions modular and well-commented.  
- Use async/await for asynchronous operations.  
- Avoid external libraries unless absolutely necessary; prioritize native APIs.
- **Modules**: Tất cả code trong `src/` phải sử dụng ES6 modules
- **Exports**: Export functions/constants cần thiết để tái sử dụng
- **Imports**: Import từ relative paths (../, ./)
- **Global state**: Sử dụng `chrome.storage.local` thay vì global variables khi có thể
- **Event handlers**: Sử dụng addEventListener, tránh inline handlers

3. CSS Guidelines  
- Keep styling minimal and scoped to popup/options pages.  
- Prefer CSS classes over inline styles for maintainability.  
- Avoid CSS frameworks (Tailwind, Bootstrap, etc.).  
- Global CSS variables can be used in styles.css.

4. Chrome API Usage  
- Prefer the chrome.scripting API over deprecated methods.  
- Use chrome.storage for persistent storage instead of localStorage.  
- Avoid requesting more permissions than necessary.

5. Folder Structure  
Cấu trúc thư mục hiện tại (đã refactor v2.0.0):

/ANKIVN-MUAHAHA  
  ├─ manifest.json  
  ├─ AI_RULES.md (file này)
  ├─ AI_CONTEXT.md (context cho AI - BẮT BUỘC đọc trước)
  ├─ VERSIONS.md (lịch sử thay đổi - BẮT BUỘC update)
  ├─ ui/ (UI files)
  │   ├─ popup.html (sidebar UI)
  │   ├─ settings.html (settings page)
  │   └─ styles.css (styling)
  ├─ src/ (source code - ES6 modules)
  │   ├─ api/ (Anki-Connect API)
  │   ├─ background/ (service worker)
  │   ├─ features/ (feature modules)
  │   ├─ popup/ (sidebar logic)
  │   ├─ settings/ (settings logic)
  │   ├─ ui/ (UI components)
  │   └─ utils/ (utilities)
  └─ icons/ (extension icons)

- Tất cả JavaScript sử dụng ES6 modules (import/export)
- Manifest V3 với `"type": "module"` cho service worker
- HTML files sử dụng `<script type="module">`
- VERSIONS.md là BẮT BUỘC và phải được update mỗi khi có thay đổi

6. Version Tracking – VERSIONS.md  
- **Purpose**: Keep a chronological record of all changes in the extension.  
- **Format**: Use clear entries with date, file modified, change description, and version number.
- **BẮT BUỘC**: AI phải update VERSIONS.md mỗi khi có thay đổi code
- **Format mẫu**:
  - Version number (semantic versioning: MAJOR.MINOR.PATCH)
  - Date (YYYY-MM-DD)
  - Description với emoji để dễ nhìn (✨ Feature, 🐛 Bug Fix, 🎨 UI Refinement)
  - List các file đã thay đổi
  - Mô tả chi tiết thay đổi

- AI should check VERSIONS.md before making changes to understand the current version and avoid conflicts.
- AI should update VERSIONS.md automatically whenever changes are made to any file.

7. Best Practices  
- Keep code modular and reusable.  
- Comment all significant logic for clarity (tiếng Anh cho code, tiếng Việt cho UI).  
- Avoid hardcoding values; use constants or configuration objects (storage keys trong `src/utils/storage.js`).  
- Test extension in Developer Mode in Chrome before distribution.  
- Avoid unnecessary network requests; keep scripts efficient.
- **Storage keys**: Định nghĩa trong `src/utils/storage.js` thay vì hardcode
- **Error handling**: Luôn có try-catch cho async operations
- **Status messages**: Sử dụng `showStatus()` từ `src/ui/status.js`
- **Anki-Connect**: Sử dụng `invoke()` từ `src/api/anki-connect.js`
- **UI text**: Sử dụng tiếng Việt cho tất cả UI text
- **Code comments**: Sử dụng tiếng Anh cho code comments

8. Output for AI  
- Return all files as code blocks labeled with the filename.  
- Avoid generating ZIPs, node_modules, or build files.  
- Do not include React, JSX, or other framework-related code.  
- Always update VERSIONS.md with each change.
- **Context first**: Luôn đọc `AI_CONTEXT.md` trước khi bắt đầu task
- **Check versions**: Kiểm tra `VERSIONS.md` để biết version hiện tại
- **Module structure**: Giữ nguyên cấu trúc modules hiện có
- **Storage migration**: Nếu thay đổi storage structure, cần migration logic

9. AnkiVN-Specific Rules  
- **Anki-Connect**: Extension yêu cầu Anki-Connect đang chạy (localhost:8765)
- **Sidebar**: Sử dụng Chrome Side Panel API (Manifest V3)
- **Context Menu**: Dynamic context menu dựa trên model hiện tại
- **Media handling**: Support drag & drop từ local và web
- **Field management**: Fields được tạo động dựa trên Anki model
- **Presets**: Lưu cấu hình deck/model/tags để tái sử dụng
- **Storage per model**: Nhiều settings được lưu per model (hiddenFields, stickyFields, etc.)

10. Workflow khi làm việc với codebase  
1. **Đọc AI_CONTEXT.md** để hiểu codebase (BẮT BUỘC)
2. **Đọc VERSIONS.md** để biết version hiện tại và thay đổi gần đây
3. **Xác định module/file** cần sửa dựa trên tính năng
4. **Thực hiện thay đổi** theo quy tắc trong file này
5. **Update VERSIONS.md** với thay đổi (BẮT BUỘC)
6. **Test** extension trong Chrome Developer Mode
7. **Commit** với message rõ ràng