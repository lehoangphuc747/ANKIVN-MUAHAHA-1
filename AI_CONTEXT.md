# AI Context - AnkiVN Extension

## 📋 Tổng quan

**AnkiVN - Muahaha** là một Chrome Extension (Manifest V3) giúp người dùng thêm note vào Anki nhanh chóng thông qua sidebar. Extension kết nối với Anki-Connect API (localhost:8765) để giao tiếp với Anki Desktop.

### Version hiện tại: 2.6.2

## 🏗️ Cấu trúc Codebase

### Thư mục gốc
```
ANKIVN-MUAHAHA/
├── manifest.json          # Manifest V3 configuration
├── AI_RULES.md            # Quy tắc phát triển cho AI
├── AI_CONTEXT.md          # File này - Context cho AI
├── VERSIONS.md            # Lịch sử thay đổi
├── ui/                    # UI files (HTML, CSS)
│   ├── popup.html         # Sidebar UI
│   ├── settings.html      # Settings page
│   └── styles.css         # Styling
├── src/                   # Source code (ES6 modules)
│   ├── api/               # API communication
│   ├── background/        # Service worker & context menu
│   ├── features/          # Feature modules
│   ├── popup/             # Sidebar logic
│   ├── settings/          # Settings page logic
│   ├── ui/                # UI components
│   └── utils/             # Utilities
└── icons/                 # Extension icons
```

## 📦 Modules chính

### 1. API Layer (`src/api/`)
- **`anki-connect.js`**: Module giao tiếp với Anki-Connect API
  - `invoke(action, params)`: Gửi request đến Anki-Connect
  - URL: `http://localhost:8765`
  - Version: 6

### 2. Background (`src/background/`)
- **`main.js`**: Service worker entry point
  - Xử lý extension install/startup
  - Quản lý context menu updates
  - Xử lý messages từ popup/settings
  - Xử lý Alt+Selection detection từ content script
  - Mở sidebar khi click icon

- **`context-menu.js`**: Context menu logic
  - `updateContextMenu(fields, modelName)`: Cập nhật context menu dựa trên fields
  - `handleContextMenuClick(info, tab)`: Xử lý click context menu
  - Hỗ trợ: Text, Image, Audio, Link
  - Tích hợp với default fields từ settings

### 3. Popup/Sidebar (`src/popup/`)
- **`main.js`**: Entry point cho sidebar
  - Quản lý deck/model selection
  - Tạo fields động
  - Xử lý thêm note
  - Format toolbar
  - Keyboard shortcuts
  - Presets management
  - Header collapse/expand
  - Alt+Selection handler: Tự động thêm text đã chọn vào field (default hoặc field selector)

### 4. Settings (`src/settings/`)
- **`main.js`**: Settings page logic
  - Cấu hình fields (ẩn/hiện, sticky, order)
  - Context menu defaults (text, image, audio, link, altSelection)
  - Random ID field
  - Drag & drop field order

### 5. Content Scripts (`src/content/`)
- **`alt-selection.js`**: Detect Alt+Selection trên web pages
  - Listen `keydown`/`keyup` để track Alt key
  - Listen `mouseup`/`selectionchange` để detect text selection
  - Gửi message đến background script khi Alt+Selection được detect
  - Chỉ hoạt động khi selection không trong INPUT/TEXTAREA/contentEditable

- **`autocomplete.js`**: Autocomplete cho deck/model search
  - `setupAutocomplete(container, input, suggestions, callback)`
  - Filter theo keywords
  - Keyboard navigation (Arrow keys, Enter, Escape)

- **`status.js`**: Status messages
  - `showStatus(message, isError)`: Hiển thị status message

### 6. Features (`src/features/`)
- **`formatter.js`**: Text formatting
  - `applyFormat(command, value)`: Áp dụng format (bold, italic, color, etc.)
  - `addCloze(number)`: Thêm cloze deletion (C1, C2, C3, hoặc sequential)
  - Sử dụng `document.execCommand` với fallback manual insert
  - Hỗ trợ `saveSelection()`/`restoreSelection()` để preserve selection khi tương tác với UI

- **`presets.js`**: Preset management
  - `loadPresets()`: Load presets từ storage
  - `saveCurrentPreset()`: Lưu preset hiện tại
  - `deleteCurrentPreset()`: Xóa preset
  - `applyPreset(name)`: Áp dụng preset

- **`media-handler.js`**: Media handling
  - `handleMediaFile(file, targetDiv)`: Xử lý file từ local
  - `handleMediaUrl(url, targetDiv)`: Xử lý URL từ web
  - Lưu media vào Anki qua `storeMediaFile`

- **`media-preview.js`**: Media preview
  - `updateMediaPreview(content, container)`: Hiển thị preview images/audio
  - Image modal
  - Audio player

### 7. Utils (`src/utils/`)
- **`storage.js`**: Storage keys constants
  - `HEADER_COLLAPSE_KEY`
  - `LAST_USED_DECK_KEY`
  - `LAST_USED_MODEL_KEY`
  - `PRESETS_KEY`

- **`helpers.js`**: Helper functions
  - `generateRandomId()`: Tạo 14 số ngẫu nhiên
  - `escapeHTML(str)`: Escape HTML

## 🔄 Luồng hoạt động chính

### 1. Khởi động Extension
1. Service worker (`src/background/main.js`) được load
2. Context menu được tạo với fields từ storage hoặc rỗng
3. Khi click icon → mở sidebar (`ui/popup.html`)

### 2. Sidebar Workflow
1. Load decks, models, tags từ Anki-Connect
2. Setup autocomplete cho deck/model
3. Khi chọn model → tạo fields động
4. Fields được tạo với:
   - Collapse state từ storage
   - Hidden fields từ settings
   - Field order từ settings
   - Sticky fields configuration

### 3. Thêm Note
1. User nhập nội dung vào fields
2. Click "Thêm vào Anki"
3. Validate: deck, model, và ít nhất 1 field có nội dung
4. Generate random ID nếu có cấu hình
5. Gọi `addNote` qua Anki-Connect
6. Clear fields (trừ sticky fields)
7. Reset cloze index

### 4. Context Menu Workflow
1. User chọn text/image/audio/link trên web
2. Right-click → context menu
3. Chọn field (hoặc dùng default)
4. Content được gửi đến sidebar
5. Sidebar mở và fill field tương ứng

### 5. Alt+Selection Workflow
1. User giữ Alt + chọn text trên web page
2. Content script (`src/content/alt-selection.js`) detect selection
3. Gửi message `altSelectionDetected` đến background script
4. Background script:
   - Lấy default field từ settings (`contextMenuDefaults_{modelName}.altSelection`)
   - Lưu vào `pendingAltSelection` nếu popup chưa mở
   - Gửi message `fillFieldFromAltSelection` đến popup nếu popup đang mở
5. Popup (`src/popup/main.js`):
   - Nhận message hoặc load từ `pendingAltSelection` khi mở
   - Nếu có default field và field tồn tại → tự động insert vào field
   - Nếu không có default field → hiển thị field selector modal
   - Thêm source info (URL, title) vào content
   - Đảm bảo model được load và fields được render trước khi insert

### 6. Media Handling
1. Drag & drop từ local hoặc web
2. File được xử lý (base64 hoặc URL)
3. Gọi `storeMediaFile` qua Anki-Connect
4. Insert HTML vào field (`<img>` hoặc `[sound:...]`)
5. Preview được cập nhật

## 🎨 Tính năng chính

### 1. Text Formatting
- Bold, Italic, Underline
- Foreground/Background color (với HEX input và saved colors)
- Remove format
- Cloze deletions (C123 button - cycles through cloze numbers)
- Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+C)
- Save/restore selection khi tương tác với color picker dropdown

### 2. Presets
- Lưu cấu hình hiện tại (deck, model, tags)
- Áp dụng preset nhanh
- Xóa preset

### 3. Field Management
- Collapse/Expand fields
- Hide fields (settings)
- Sticky fields (giữ nội dung sau khi thêm note)
- Custom field order (drag & drop)
- Random ID tự động

### 4. Context Menu
- Gửi text/image/audio/link đến fields
- Default fields cho mỗi loại content
- Dynamic menu dựa trên model hiện tại

### 5. Alt+Selection (v2.6.0+)
- Giữ Alt + chọn text trên web page
- Tự động thêm text vào field đã cấu hình trong settings
- Hiển thị field selector nếu chưa có default field
- Thêm source info (URL, title) vào field
- Content script detect selection và gửi đến background/popup

### 6. Media Support
- Drag & drop từ local
- Drag & drop từ web
- Image preview
- Audio preview & playback
- Auto-detect file extension

## 🔧 Storage Keys

### Per Model
- `hiddenFields_{modelName}`: Object {fieldName: true/false}
- `stickyFields_{modelName}`: Object {fieldName: true/false}
- `collapsedFields_{modelName}`: Object {fieldName: true/false}
- `fieldOrder_{modelName}`: Array of field names
- `randomIdField_{modelName}`: String (field name)
- `contextMenuDefaults_{modelName}`: Object {text/image/audio/link/altSelection: fieldName}

### Global
- `ankivn_header_collapsed`: Boolean
- `ankivn_lastUsedDeck`: String
- `ankivn_lastUsedModel`: String
- `ankivn_presets`: Object {presetName: {deckName, modelName, tags}}
- `lastSelectedModel`: String (cho context menu)
- `lastModelFields`: Array (cho context menu)
- `pendingAltSelection`: Object {field, content, fields, modelName, url, title} (temporary, cho Alt+Selection)
- `pendingAltSelectionText`: String (temporary, khi chưa có model)
- `pendingAltSelectionUrl`: String (temporary)
- `pendingAltSelectionTitle`: String (temporary)
- `savedForeColors`: Array of hex colors (saved colors for text color)
- `savedBackColors`: Array of hex colors (saved colors for background color)

## 🚀 Cách làm việc với Codebase

### 1. Thêm tính năng mới
- Tạo module mới trong `src/features/` nếu cần
- Import và sử dụng trong `src/popup/main.js` hoặc `src/settings/main.js`
- Update `VERSIONS.md` với thay đổi

### 2. Sửa UI
- HTML: `ui/popup.html` hoặc `ui/settings.html`
- CSS: `ui/styles.css`
- JavaScript: Modules trong `src/`

### 3. Thêm Anki-Connect action
- Sử dụng `invoke(action, params)` từ `src/api/anki-connect.js`
- Xem Anki-Connect docs để biết actions available

### 4. Thêm storage key
- Định nghĩa trong `src/utils/storage.js`
- Sử dụng `chrome.storage.local.get/set`

### 5. Debug
- Mở DevTools cho sidebar: Right-click sidebar → Inspect
- Mở DevTools cho service worker: chrome://extensions → Service worker
- Check console logs

## 📝 Quy tắc phát triển

### Tech Stack
- **Framework**: Vanilla JavaScript (ES6+)
- **Modules**: ES6 import/export
- **Manifest**: V3
- **Storage**: chrome.storage.local
- **APIs**: Chrome Extension APIs
- **Permissions**: `activeTab` (cho Alt+Selection), `sidePanel` (cho sidebar)
- **Content Scripts**: Injected vào tất cả URLs để detect Alt+Selection

### Code Style
- Sử dụng ES6+ features (async/await, arrow functions, destructuring)
- Comment code quan trọng
- Tên biến/hàm rõ ràng, tiếng Anh
- UI text tiếng Việt

### File Structure
- Không sử dụng build tools (trừ khi cần thiết)
- Không sử dụng frameworks (React, Vue, etc.)
- Giữ code modular
- Một file một chức năng chính

### Testing
- Test trên Chrome Developer Mode
- Test với Anki-Connect đang chạy
- Test các edge cases

## 🔍 Các điểm quan trọng

### 1. Active Element
- `activeElement` trong `src/popup/main.js` track field đang focus
- Format toolbar chỉ hoạt động khi có activeElement
- Set qua `setActiveElement()` khi focus/blur field
- Hỗ trợ `data-keep-active` flag để giữ activeElement khi tương tác với dropdown
- `saveSelection()`/`restoreSelection()` để preserve text selection

### 2. Cloze Index
- `currentClozeIndex` trong `src/popup/main.js`
- Reset về 1 sau khi thêm note
- Increment khi dùng cloze sequential

### 3. Model Fields Cache
- `modelFieldsCache` trong `src/popup/main.js`
- Cache field names để tránh gọi API nhiều lần

### 4. Field Order
- Field order được lưu trong storage
- Khi tạo fields, sort theo order đã lưu
- Fields mới được thêm vào cuối

### 5. Media Handling
- Local files: FileReader → base64 → storeMediaFile
- Web URLs: fetch → storeMediaFile (Anki-Connect handle)
- File extension detection từ URL hoặc MIME type

## 📚 Tài liệu tham khảo

- **Anki-Connect API**: https://foosoft.net/projects/anki-connect/
- **Chrome Extension APIs**: https://developer.chrome.com/docs/extensions/reference/
- **Manifest V3**: https://developer.chrome.com/docs/extensions/mv3/intro/

## 🎯 Khi bắt đầu một task mới

1. Đọc `AI_CONTEXT.md` (file này) để hiểu codebase
2. Đọc `AI_RULES.md` để hiểu quy tắc phát triển
3. Đọc `VERSIONS.md` để biết version hiện tại và thay đổi gần đây
4. Xác định module/file cần sửa
5. Thực hiện thay đổi
6. Update `VERSIONS.md` với thay đổi
7. Test kỹ trước khi commit

## ⚠️ Lưu ý

- Extension cần Anki-Connect đang chạy (localhost:8765)
- Sidebar chỉ hoạt động khi có tab đang mở
- Context menu chỉ hoạt động khi có model được chọn
- Media files được lưu vào Anki media collection
- Storage keys có thể thay đổi giữa các versions (migration nếu cần)
- Alt+Selection cần `activeTab` permission và content script injection
- Field selector modal chỉ hiển thị khi không có default field hoặc default field không tồn tại
- Đảm bảo fields được render trước khi insert content (có delay và retry logic)

