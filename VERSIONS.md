# Version History

## v1.0.0 – 2025-08-24
- @ToneDice created manifest.json with basic permissions and action popup
- Added background.js with minimal event listener
- Added content.js placeholder
- Added popup.html and popup.js with simple ping functionality
- Added styles.css for minimal popup styling

## v1.1.0 – 2025-08-25
- Updated manifest.json for AnkiVN extension with host permissions for localhost:8765
- Removed unnecessary permissions and content scripts

## v1.2.0 – 2025-08-26
- Redesigned popup.html with complete UI for Anki note creation
- Added deck selection dropdown, note type selection, fields container, tags input with datalist, and status message

## v1.3.0 – 2025-08-27
- Added invoke function in popup.js for communicating with Anki-Connect API
- Function handles POST requests to localhost:8765 with proper error handling

## v1.4.0 – 2025-08-28
- Added DOMContentLoaded event listener to initialize popup
- Load decks, models, and tags from Anki-Connect on popup load
- Added showStatus function for user feedback

## v1.5.0 – 2025-08-29
- Added model change event listener to dynamically create fields based on selected model
- Added createFieldsForModel function to generate input fields for each field name

## v1.6.0 – 2025-08-30
- Added addNoteToAnki function to handle note creation
- Added click event listener for add-note-btn with full validation
- Implemented note creation with fields and tags processing

## v1.7.0 – 2025-08-31
- Enhanced styles.css with modern, responsive design
- Added proper styling for form controls, buttons, and status messages
- Improved user experience with hover effects and focus states

## v1.8.0 – 2025-10-27
- Added search/filter functionality for deck and model selection inputs
- Implemented real-time filtering of dropdown options based on user input
- Enhanced user experience with searchable selection fields

## v1.9.0 – 2025-10-28
- Chuyển từ giao diện Popup sang Sidebar (API `chrome.sidePanel`).
- Cập nhật `manifest.json`: Xóa `default_popup`, thêm quyền `sidePanel` và khóa `side_panel` trỏ đến `popup.html`.
- Cập nhật `background.js`: Thêm listener `chrome.action.onClicked` để mở sidebar.
- Cập nhật `styles.css`: (Khuyến nghị) Xóa `width: 350px;` khỏi `body` để sidebar linh hoạt.

## v1.10.0 – 2025-10-28
- Nâng cấp `setupAutocomplete` trong `popup.js`:
  - Thêm sự kiện `focus` để hiển thị tất cả gợi ý khi click vào ô.
  - Thêm sự kiện `keydown` để hỗ trợ điều hướng bằng phím mũi tên (lên/xuống) và chọn bằng phím Enter.
  - Thêm logic đóng gợi ý khi click ra ngoài.
- Cập nhật `styles.css`: Thêm class `.suggestion-item.active` để tô sáng mục đang chọn bằng bàn phím.

## v1.11.0 – 2025-10-28
- Nâng cấp logic tìm kiếm trong `popup.js` (hàm `setupAutocomplete`).
- Thay vì `includes(value)`, logic mới sẽ tách `value` thành các từ khóa và kiểm tra `every(keyword => target.includes(keyword))`.
- Cho phép người dùng tìm kiếm "k quyển 1" để khớp với "(Korean) Tiếng Hàn Tổng Hợp::Quyển 1".

## v1.12.0 – 2025-10-28
- Thêm chức năng thu gọn (collapse) cho các field.
- Cập nhật `popup.js`:
    - Viết lại `createFieldsForModel` để tạo HTML mới với nút toggle và khôi phục trạng thái collapse từ `chrome.storage.local`.
    - Thêm hàm `toggleFieldCollapse` để xử lý click và lưu trạng thái vào `chrome.storage.local`.
- Cập nhật `styles.css`: Thêm các class `.field-header`, `.collapse-toggle`, và `.field-group.collapsed` để tạo kiểu và ẩn/hiện textarea.

## v1.13.0 – 2025-10-28
- Thêm trang Cài đặt (`settings.html`, `settings.js`) để cho phép người dùng chọn ẩn các field không mong muốn cho từng Note Type.
- Cập nhật `manifest.json`: Thêm khóa `options_page`.
- Cập nhật `popup.html`: Thêm link để mở trang Cài đặt.
- Cập nhật `styles.css`: Thêm class `.field-hidden-by-setting` để ẩn field theo cài đặt.
- Cập nhật `popup.js`:
    - Hàm `createFieldsForModel` giờ sẽ đọc cài đặt ẩn từ `chrome.storage.local` và áp dụng class `.field-hidden-by-setting`.
    - Thêm listener để mở trang cài đặt khi click link.
    - Sửa logic `addNoteToAnki` để không yêu cầu nội dung ở field bị ẩn và gửi giá trị rỗng cho chúng.

## v1.14.0 – 2025-10-28
- Cập nhật trang Cài đặt (`settings.html`, `settings.js`):
    - Thay thế dropdown chọn Note Type bằng ô input autocomplete (sử dụng lại hàm `setupAutocomplete`).
- Tối ưu giao diện Sidebar (`popup.html`, `styles.css`):
    - Thay đổi layout để label ("Deck:", "Note:") và input tương ứng nằm trên cùng một hàng.

## v1.15.0 – 2025-10-28
- Tối ưu UI trang Cài đặt (`settings.html`, `settings.js`, `styles.css`):
    - Hiển thị danh sách field checkbox thành 2 cột để tiết kiệm không gian.
    - Thêm nút "Chọn tất cả" và "Bỏ chọn tất cả" để thao tác nhanh hơn.
    - Cập nhật `settings.js` để xử lý logic cho các nút mới và hiển thị 2 cột.
    - Cập nhật `settings.html` và style CSS tương ứng.

## v1.16.0 – 2025-10-28
- Cải thiện UI/UX phần chọn field ẩn trong Settings (`settings.html`, `settings.js`, `styles.css`):
    - Thay đổi cấu trúc HTML (`.field-checkbox-item`) để toàn bộ vùng chứa field (checkbox + label) đều có thể click được.
    - Thêm hiệu ứng hover rõ ràng cho từng item field.
    - Thêm visual feedback (thay đổi màu nền, màu chữ, màu checkbox) khi một field được chọn (đánh dấu là ẩn).
    - Cập nhật `settings.js` để tạo cấu trúc HTML mới và xử lý sự kiện click trên toàn bộ item.
    - Cập nhật `styles.css` để style cho `.field-checkbox-item` và các trạng thái của nó.

## v1.17.0 – 2025-10-28
- Cải thiện thêm UI/UX phần chọn field ẩn trong Settings (`styles.css`, `settings.js`):
    - Làm hiệu ứng hover rõ nét hơn (`background-color`, `border-color`).
    - Thêm hiệu ứng gạch ngang chữ và đổi màu chữ/checkbox khi field được chọn ẩn (class `.checked`).
    - Cập nhật `settings.js` để thêm/xóa class `.checked` khi click vào item field.
    - Điều chỉnh padding và bố cục flexbox trong `.field-checkbox-item` để tối ưu hiển thị.

## v1.18.0 – 2025-10-28
- Thêm tính năng tự động tạo ID ngẫu nhiên (14 chữ số) cho field được chọn.
- Cập nhật `settings.html`: Thêm khu vực chọn "Random ID Field" (dropdown) hiển thị sau khi chọn Note Type.
- Cập nhật `settings.js`:
    - Sửa `loadFieldsForSettings` để điền dữ liệu vào dropdown Random ID Field và tải/hiển thị lựa chọn đã lưu.
    - Sửa `saveSettings` để lưu lựa chọn Random ID Field vào `chrome.storage.local`.
- Cập nhật `popup.js`:
    - Thêm hàm `generateRandomId()`.
    - Sửa `addNoteToAnki` để đọc cài đặt Random ID Field từ storage, tạo ID mới và gán vào field tương ứng trước khi gửi note đến Anki.
- Cập nhật `styles.css`: Thêm style cơ bản cho khu vực Random ID trong Settings.

## v1.19.0 – 2025-10-28
- Cập nhật `popup.js`: Sửa hàm `showStatus` để thông báo thành công tự động biến mất sau 4 giây.
- Cung cấp lại toàn bộ code `popup.js` (v1.19.0 + sửa lỗi tự ẩn thông báo) để khắc phục lỗi mất chức năng autocomplete/search có thể do copy thiếu code trước đó.

## v1.20.0 – 2025-10-28
- Sửa lỗi trang Cài đặt (`settings.js`):
    - Khắc phục lỗi autocomplete không hoạt động (sửa lỗi xử lý error trong hàm `invoke`).
    - Khắc phục lỗi nút "Lưu Cài đặt" không hoạt động (cung cấp lại hàm `saveSettings` đầy đủ).
    - Thêm nhiều `console.log` để hỗ trợ debug.

## v1.21.0 – 2025-10-28
- Cải thiện UI/UX phần nhập liệu Fields trong Sidebar (`popup.js`, `styles.css`):
    - **Header Clickable:** Toàn bộ header (icon + label) của field giờ đây có thể click để thu gọn/mở rộng.
    - **Textarea `rows="2"`:** Giảm chiều cao mặc định của textarea.
    - **Visual Feedback:** Label của field sẽ hơi mờ đi khi field được thu gọn.
    - **Auto-Expand Textarea:** Textarea tự động tăng chiều cao khi nội dung vượt quá kích thước hiện tại.
    - Cập nhật `popup.js`: Viết lại `createFieldsForModel` và `toggleFieldCollapse`, thêm hàm `autoExpandTextarea`.
    - Cập nhật `styles.css`: Thay đổi style cho `.field-header`, `.collapse-toggle`, `.field-input`, `.field-group.collapsed`.

## v1.22.0 – 2025-10-28
- Sửa lỗi Autocomplete trong Sidebar (`popup.js`): Cung cấp lại code `popup.js` hoàn chỉnh để đảm bảo chức năng tìm kiếm/chọn hoạt động đúng. Thêm log debug chi tiết hơn.
- Cải thiện giao diện Button (`styles.css`):
    - Áp dụng style mới, hiện đại và tối giản hơn cho nút chính (`.btn-primary`) và nút phụ (`.btn-secondary`).
    - Sử dụng biến CSS (`:root`) để quản lý màu sắc.
    - Thêm hiệu ứng hover, active, shadow tinh tế hơn.
    - Áp dụng style `.btn-secondary` cho các nút "Chọn tất cả", "Bỏ chọn tất cả" trong Settings.
- Cập nhật `settings.js`: Đảm bảo không có lỗi và tương thích với CSS mới (không cần thay đổi logic).

## v1.23.0 – 2025-10-28
- Sửa lỗi Autocomplete trong Settings (`settings.js`): Cung cấp lại code `settings.js` hoàn chỉnh, đảm bảo hàm `setupAutocomplete` giống hệt `popup.js` và xử lý lỗi `invoke` đúng cách.
- Cải thiện giao diện Button (`styles.css`): Viết lại hoàn toàn CSS cho các nút (`.btn-primary`, `.btn-secondary`) với phong cách hiện đại, tối giản, sử dụng gradient, shadow và hiệu ứng transform. Cập nhật các biến màu CSS.

## v1.24.0 – 2025-10-28
- Di chuyển nút "Mở Cài đặt" lên header của Sidebar, cùng hàng với tiêu đề (`popup.html`, `styles.css`).
- Cập nhật `popup.html`: Thay đổi cấu trúc header, dùng icon ⚙️ cho nút cài đặt.
- Cập nhật `styles.css`: Thêm style cho `.header-container`, `h1` và `#open-settings-link` trong header mới.

## v1.25.0 – 2025-10-28
- Thêm tính năng Context Menu "Send to Field" cho text và hình ảnh.
- Cập nhật `manifest.json`: Thêm quyền `contextMenus`.
- Cập nhật `background.js`:
    - Thêm logic tạo context menu gốc (`onInstalled`, `onStartup`).
    - Thêm listener (`onMessage`) để nhận danh sách fields từ `popup.js` và cập nhật menu con động.
    - Lưu danh sách fields cuối cùng vào `storage` để khôi phục khi khởi động Chrome.
    - Thêm listener (`onClicked`) để xử lý click context menu, lấy nội dung (text/image URL) và gửi message đến `popup.js`.
    - Tùy chọn mở sidebar khi context menu được click.
- Cập nhật `popup.js`:
    - Sửa `createFieldsForModel` để gửi message chứa `fieldNames` và `modelName` cho `background.js` khi Note Type thay đổi.
    - Thêm listener (`onMessage`) để nhận message từ `background.js` và điền nội dung (text hoặc thẻ `<img>` cho ảnh) vào textarea tương ứng.
    - Trigger `input` event để textarea tự động mở rộng.
    - Tùy chọn tự động mở field nếu đang bị thu gọn.

## v1.26.0 – 2025-10-28
- Sửa lỗi Sidebar (`popup.js`):
    - Khắc phục lỗi Autocomplete (tìm kiếm Deck/Note Type) không hoạt động do xử lý lỗi `invoke` chưa đúng. Hoàn trả `invoke` về trạng thái ném lỗi (throw error) và xử lý lỗi trong `DOMContentLoaded`.
    - Đảm bảo `createFieldsForModel` được gọi đúng sau khi chọn Note Type từ autocomplete.
    - Khắc phục lỗi nút Settings (⚙️) không hoạt động bằng cách thêm lại event listener bị thiếu trong `DOMContentLoaded`.
    - Thêm kiểm tra dữ liệu (`null`, `Array.isArray`) và log debug chi tiết hơn.

## v1.27.0 – 2025-10-28
- Sửa lỗi Sidebar (`popup.js`):
    - Khắc phục lỗi Autocomplete (tìm kiếm Deck/Note Type) không hoạt động do xử lý lỗi `invoke` chưa đúng. Hoàn trả `invoke` về trạng thái ném lỗi (throw error) và xử lý lỗi trong `DOMContentLoaded`.
    - Đảm bảo `createFieldsForModel` được gọi đúng sau khi chọn Note Type từ autocomplete.
    - Khắc phục lỗi nút Settings (⚙️) không hoạt động bằng cách thêm lại event listener bị thiếu trong `DOMContentLoaded`.
    - Thêm kiểm tra dữ liệu (`null`, `Array.isArray`) và log debug chi tiết hơn.

## v1.28.0 – 2025-10-28
- Sửa lỗi Autocomplete trong Sidebar (`popup.js`):
    - Khắc phục lỗi đóng danh sách gợi ý khi click vào scrollbar bằng cách thêm kiểm tra kỹ hơn trong `document.addEventListener('click', ...)`.
    - Thêm `container.addEventListener('mousedown', ...)` để ngăn input mất focus khi click vào scrollbar.
- Sửa lỗi Collapse Fields không hoạt động (`popup.js`):
    - Cập nhật hàm `toggleFieldCollapse` với kiểm tra kỹ hơn các phần tử và logic toggle chính xác.
    - Đảm bảo phần tạo `fieldHeader` trong `createFieldsForModel` có `addEventListener` chính xác.

## v1.29.0 – 2025-10-28
- Sửa lỗi hiển thị Autocomplete (`styles.css`): Đặt tường minh `background-color: #ffffff;` cho `.suggestions-container` để đảm bảo nền luôn solid trắng, không bị trong suốt.

## v1.30.0 – 2025-10-28
- Cập nhật biểu tượng collapse/expand: 
    - Sử dụng '▶' cho trạng thái collapsed (đóng)
    - Sử dụng '🔽' cho trạng thái expanded (mở)
    - Cập nhật hàm `createFieldsForModel` và `toggleFieldCollapse` trong `popup.js` để hiển thị đúng icon.

## v1.31.0 – 2025-10-28
- Nâng cấp Context Menu gửi ảnh (`background.js`):
    - Thêm hàm `invoke` vào `background.js` để gọi Anki-Connect.
    - Sửa listener `chrome.contextMenus.onClicked`: Khi chọn gửi ảnh, gọi `invoke('storeMediaFile', { url: srcUrl })` để Anki tải và lưu ảnh vào `collection.media`.
    - Tạo thẻ `<img src="filename.ext">` với tên file Anki trả về.
    - Gửi thẻ `<img>` này dưới dạng text đến `popup.js` thay vì gửi URL gốc.
    - Xử lý lỗi nếu `storeMediaFile` thất bại và gửi thông báo lỗi tới `popup.js`.
- `popup.js` không cần thay đổi listener `onMessage` vì nó đã xử lý việc chèn text vào `textarea`.