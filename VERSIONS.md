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

## v1.10.0 – 2025-10-28
- Chuyển từ giao diện Popup sang Sidebar (API `chrome.sidePanel`).
- Cập nhật `manifest.json`: Xóa `default_popup`, thêm quyền `sidePanel` và khóa `side_panel` trỏ đến `popup.html`.
- Cập nhật `background.js`: Thêm listener `chrome.action.onClicked` để mở sidebar.
- Cập nhật `styles.css`: (Khuyến nghị) Xóa `width: 350px;` khỏi `body` để sidebar linh hoạt.

## v1.11.0 – 2025-10-28
- Nâng cấp `setupAutocomplete` trong `popup.js`:
  - Thêm sự kiện `focus` để hiển thị tất cả gợi ý khi click vào ô.
  - Thêm sự kiện `keydown` để hỗ trợ điều hướng bằng phím mũi tên (lên/xuống) và chọn bằng phím Enter.
  - Thêm logic đóng gợi ý khi click ra ngoài.
- Cập nhật `styles.css`: Thêm class `.suggestion-item.active` để tô sáng mục đang chọn bằng bàn phím.

## v1.12.0 – 2025-10-28
- Nâng cấp logic tìm kiếm trong `popup.js` (hàm `setupAutocomplete`).
- Thay vì `includes(value)`, logic mới sẽ tách `value` thành các từ khóa và kiểm tra `every(keyword => target.includes(keyword))`.
- Cho phép người dùng tìm kiếm "k quyển 1" để khớp với "(Korean) Tiếng Hàn Tổng Hợp::Quyển 1".

## v1.13.0 – 2025-10-28
- Thêm chức năng thu gọn (collapse) cho các field.
- Cập nhật `popup.js`:
    - Viết lại `createFieldsForModel` để tạo HTML mới với nút toggle và khôi phục trạng thái collapse từ `chrome.storage.local`.
    - Thêm hàm `toggleFieldCollapse` để xử lý click và lưu trạng thái vào `chrome.storage.local`.
- Cập nhật `styles.css`: Thêm các class `.field-header`, `.collapse-toggle`, và `.field-group.collapsed` để tạo kiểu và ẩn/hiện textarea.

## v1.14.0 – 2025-10-28
- Thêm trang Cài đặt (`settings.html`, `settings.js`) để cho phép người dùng chọn ẩn các field không mong muốn cho từng Note Type.
- Cập nhật `manifest.json`: Thêm khóa `options_page`.
- Cập nhật `popup.html`: Thêm link để mở trang Cài đặt.
- Cập nhật `styles.css`: Thêm class `.field-hidden-by-setting` để ẩn field theo cài đặt.
- Cập nhật `popup.js`:
    - Hàm `createFieldsForModel` giờ sẽ đọc cài đặt ẩn từ `chrome.storage.local` và áp dụng class `.field-hidden-by-setting`.
    - Thêm listener để mở trang cài đặt khi click link.
    - Sửa logic `addNoteToAnki` để không yêu cầu nội dung ở field bị ẩn và gửi giá trị rỗng cho chúng.

## v1.15.0 – 2025-10-28
- Cập nhật trang Cài đặt (`settings.html`, `settings.js`):
    - Thay thế dropdown chọn Note Type bằng ô input autocomplete (sử dụng lại hàm `setupAutocomplete`).
- Tối ưu giao diện Sidebar (`popup.html`, `styles.css`):
    - Thay đổi layout để label ("Deck:", "Note:") và input tương ứng nằm trên cùng một hàng.