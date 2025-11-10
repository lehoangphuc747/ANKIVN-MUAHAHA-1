# Version History

## 🐛 v2.8.8 – 2025-11-10

### 🐛 Bug Fix: **Syntax Error - Template Literal trong sourceInfo**

- **`src/popup/main.js`**: Fix syntax error do template literal nested
  - Tách `sourceInfo` template literal thành biến riêng để tránh lỗi parsing
  - Sử dụng `if` statement thay vì ternary operator cho `sourceInfo` để dễ đọc hơn
  - Áp dụng cho cả `handleAltSelection` và `showFieldSelector` functions

- **Result**: Extension giờ có thể load được, không còn syntax error

## 🎨 v2.8.7 – 2025-11-10

### 🎨 Feature: **Mở Settings trong Sidebar**

- **`ui/popup.html`**: Thêm settings view với iframe
  - Thêm `#main-content-view` wrapper cho nội dung chính
  - Thêm `#settings-view` với iframe để load `settings.html`
  - Settings view ẩn mặc định

- **`src/popup/main.js`**: Cập nhật logic mở settings
  - Thay đổi từ `chrome.runtime.openOptionsPage()` sang toggle view trong sidebar
  - Khi click Settings: ẩn main content, hiển thị settings iframe
  - Khi click lại Settings (trong settings view): ẩn settings, hiển thị main content
  - Tự động ẩn/hiện collapsible header và toolbar khi switch view
  - Cập nhật header title: "AnkiVN - Muahaha" ↔ "Cài đặt AnkiVN"
  - Cập nhật button title: "Mở Cài đặt" ↔ "Quay lại"
  - Reload iframe khi mở settings để đảm bảo dữ liệu mới nhất

- **`ui/styles.css`**: Thêm styles cho settings view
  - Styles cho `#settings-view` và `#settings-iframe`
  - Đảm bảo iframe chiếm toàn bộ không gian

- **Result**: Settings giờ mở trong sidebar, không mở tab mới, dễ dàng toggle giữa main view và settings view

## 🐛 v2.8.6 – 2025-11-10

### 🐛 Bug Fix: **Syntax Error - Indentation và Object Literal**

- **`src/popup/main.js`**: Fix syntax error do indentation sai
  - Sửa indentation của `sourceUrlCheckSameField` object literal (phải nằm trong block `if`)
  - Tách tất cả object literals trong console.log thành các biến riêng để tránh lỗi syntax
  - Đảm bảo tất cả các dấu ngoặc đều đúng

- **Result**: Extension giờ có thể load được, không còn syntax error

## 🐛 v2.8.5 – 2025-11-10

### 🐛 Bug Fix: **Event Listeners không hoạt động - Null Check và Error Handling**

- **`src/popup/main.js`**: Fix event listeners không hoạt động
  - Thêm null check cho tất cả các DOM elements trước khi sử dụng
  - Di chuyển event listener registration lên TRƯỚC phần load dữ liệu
  - Đảm bảo các nút (Settings, Add Note, Header Toggle) luôn hoạt động ngay cả khi có lỗi load dữ liệu
  - Thêm error handling và logging chi tiết
  - Thêm null check cho preset buttons và containers
  - Thêm optional chaining (`?.`) cho các element access

- **Result**: Các nút và event listeners giờ hoạt động đúng, không bị crash khi load dữ liệu lỗi

## 🐛 v2.8.4 – 2025-11-10

### 🐛 Bug Fix: **Syntax Error trong showFieldSelector**

- **`src/popup/main.js`**: Fix syntax error và thiếu cancel button event listener
  - Thêm event listener cho `cancelBtn` để đóng modal khi click "Hủy"
  - Fix logic `sourceWasAdded` để kiểm tra đúng trạng thái
  - Đảm bảo tất cả các dấu ngoặc được đóng đúng
  - Fix logic kiểm tra URL duplicate trong source field

- **Result**: Extension giờ có thể load được, cancel button hoạt động đúng

## 🎨 v2.8.3 – 2025-11-10

### 🎨 UI Optimization: **Tối giản Header Container**

- **`ui/styles.css`**: Giảm không gian của header-container
  - Giảm `margin-bottom` từ `1.2rem` xuống `0.6rem`
  - Giảm `padding-bottom` từ `0.9rem` xuống `0.4rem`
  - Giảm `padding-top` từ `16px` xuống `8px`
  - Giảm `border-bottom` từ `2px` xuống `1px`
  - Giảm `font-size` của h1 từ `1.15rem` xuống `0.95rem`
  - Thêm `line-height: 1.2` cho h1
  - Giảm `font-size` của icon buttons từ `1.3rem` xuống `1.1rem`
  - Giảm `padding` của icon buttons từ `6px 8px` xuống `4px 6px`
  - Giảm `min-width` và `min-height` từ `32px` xuống `28px`
  - Giảm `margin-left` từ `8px` xuống `6px`
  - Giảm `border-radius` từ `8px` xuống `6px`
  - Giảm `font-size` của toggle button từ `1.1rem` xuống `1rem`
  - Giảm hover `transform: scale` từ `1.1` xuống `1.05`

- **Result**: Header container giờ nhỏ gọn hơn, tiết kiệm không gian dọc

## ✨ v2.8.2 – 2025-11-10

### ✨ Feature: **Field Selector List View và Filter Droplist Fields**

- **`src/popup/main.js`**: Thay dropdown bằng list view cho field selector
  - Thay `<select>` dropdown bằng list items (clickable divs)
  - Mỗi field là một item có thể click để chọn
  - Auto-apply khi click vào field (không cần nút "Thêm")
  - Highlight field được chọn (border màu xanh, background màu nhạt)
  - Hover effects và transitions

- **`src/popup/main.js`**: Filter droplist fields
  - Gọi `modelFields` API để lấy field types
  - Filter out các fields có type là "droplist" hoặc "select"
  - Chỉ hiển thị các fields có thể edit được (text fields)
  - Log chi tiết để debug (field types, filtered fields)

- **`ui/styles.css`**: Thêm styles cho field selector list
  - `.field-selector-item`: Style cho mỗi field item
  - Hover effects: border màu xanh, background nhạt, shadow
  - Active state: selected field có border màu xanh và background
  - Scrollbar styling cho field list container
  - Transition effects

- **Features**:
  - Field selector hiển thị dưới dạng list thay vì dropdown
  - Tự động filter droplist fields (không hiển thị)
  - Click vào field để chọn và tự động apply (không cần nút "Thêm")
  - Visual feedback khi hover và select field
  - Scrollable list nếu có nhiều fields

## 🐛 v2.8.1 – 2025-11-10

### 🐛 Bug Fix: **Source Code View Toggle và Duplicate Source Info**

- **`src/popup/main.js`**: Fix Source Code View toggle không hoạt động
  - Khi activeElement là null, tìm field nào đang ở source view từ sourceViewState map
  - Set `data-keep-active` flag khi chuyển sang source view để giữ activeElement
  - Thêm event listeners cho textarea (focus/blur) để maintain activeElement
  - Đảm bảo activeElement luôn là field div, không phải textarea
  - Clear keepActive flag khi chuyển về render view

- **`src/popup/main.js`**: Fix duplicate source info khi cùng một URL
  - Check URL đã tồn tại trong field trước khi thêm source info
  - Áp dụng cho cả default field và field selector
  - Check cả khi source info ở cùng field và field riêng
  - Extract URL từ sourceInfo và check bằng `includes()`
  - Log chi tiết để debug

- **`src/popup/main.js`**: Fix field selector source field handling
  - Lấy sourceField từ settings khi dùng field selector
  - Check duplicate URL trong field selector

- Fix: Source Code View toggle giờ hoạt động đúng, có thể toggle về render view
- Fix: Source info không bị duplicate khi cùng một URL (cùng một trang web)

## ✨ v2.8.0 – 2025-11-10

### ✨ Feature: **Source Code View**

- **`ui/popup.html`**: Thêm nút Source Code View vào toolbar
  - Nút với icon `<i class="fas fa-code"></i>` trong toolbar
  - Title: "Xem/Chỉnh sửa Source Code"

- **`src/popup/main.js`**: Implement Source Code View toggle
  - Thêm `sourceViewState` Map để track source view state per field
  - Function `toggleSourceCodeView()`:
    - Chuyển từ render view sang source view: Hiển thị HTML trong textarea
    - Chuyển từ source view về render view: Apply HTML từ textarea vào field
    - Update button state (active/inactive)
    - Update media preview khi chuyển về render view
  - Function `updateSourceViewButtonState()`: Update button state dựa trên activeElement
  - Export function để fields.js có thể gọi
  - Thêm debug logs chi tiết

- **`src/ui/fields.js`**: Update focus event để update source view button state
  - Gọi `updateSourceViewButtonState()` khi field được focus

- **`ui/styles.css`**: Thêm styles cho source view
  - `.field-source-textarea`: Monospace font, background #f8f9fa, min-height 150px
  - `#toggle-source-view.active`: Active state với primary color
  - Focus states và hover effects

- **Features**:
  - Toggle giữa render view và source code view
  - Hiển thị HTML code trong textarea (editable)
  - Apply HTML code khi chuyển về render view
  - Button state reflects current view mode
  - Debug logs để track state changes
  - Update media preview khi chuyển về render view

## 🐛 v2.7.1 – 2025-11-10

### 🐛 Bug Fix: **Settings Save Button Float và Alt+Selection Tracking**

- **`ui/styles.css`**: Thêm floating button cho "Lưu Cài đặt"
  - Nút "Lưu Cài đặt" giờ fixed ở bottom-right
  - Thêm box-shadow và z-index để nổi bật
  - Thêm padding-bottom cho settings-container để tránh bị che content
  - Width auto, min-width 150px
  - Dễ bấm hơn, không cần scroll xuống cuối

- **`src/content/alt-selection.js`**: Cải thiện duplicate detection
  - Sử dụng hash của toàn bộ text thay vì chỉ substring(0, 100)
  - Hash dựa trên text length + hash code của text + URL
  - Tránh block các selection khác nhau nhưng có 100 ký tự đầu giống nhau

- **`src/background/main.js`**: Cải thiện duplicate detection và thêm clear tracking
  - Sử dụng hash của toàn bộ text (text length + hash code + URL)
  - Giảm debounce time từ 1s xuống 500ms
  - Thêm action `clearAltSelectionTracking` để clear tracking
  - Log selection hash để debug

- **`src/popup/main.js`**: Clear tracking sau khi insert thành công
  - Gửi message `clearAltSelectionTracking` sau khi insert thành công
  - Cho phép select lại text mới sau khi đã thêm vào Anki
  - Áp dụng cho cả default field và field selector

- Fix: Nút "Lưu Cài đặt" giờ float, dễ bấm hơn
- Fix: Có thể select lại text mới sau khi đã thêm vào Anki (không bị block bởi duplicate detection)

## ✨ v2.7.0 – 2025-11-10

### ✨ Feature: **Fix Duplicate Inserts và Source Field Settings**

- **`src/content/alt-selection.js`**: Fix duplicate inserts
  - Thêm tracking `lastSentSelection` và `lastSendTime` để tránh gửi message nhiều lần
  - Thêm function `sendSelectionIfNew()` với debounce (500ms) và duplicate detection
  - Reset tracking khi Alt key được release
  - Tăng delay cho `selectionchange` (500ms) để `mouseup` xử lý trước

- **`src/background/main.js`**: Fix duplicate processing
  - Thêm tracking `lastProcessedSelection` và `lastProcessTime` để tránh xử lý cùng một selection nhiều lần
  - Debounce 1 giây và duplicate detection bằng selection hash
  - Thêm `sourceField` vào message và pending data

- **`ui/settings.html`**: Thêm setting cho source field
  - Thêm dropdown "Field cho nguồn (Source) - Alt+Selection"
  - Options: "-- Không thêm nguồn --", "-- Cùng field với text --", hoặc chọn field riêng
  - Thêm description text

- **`src/settings/main.js`**: Xử lý source field setting
  - Handle `altSelectionSource` riêng (có option "SAME")
  - Populate và save source field setting
  - Logging khi populate và save

- **`src/popup/main.js`**: Xử lý source field
  - Nhận `sourceField` từ data
  - Nếu `sourceField === 'SAME'` hoặc `null` → thêm source vào cùng field với text
  - Nếu `sourceField` là field name → thêm source vào field riêng
  - Xử lý source field trong cả default field và field selector
  - Update status message để hiển thị cả field và source field

- Fix: Không còn duplicate inserts khi Alt+Selection
- Feature: Có thể cấu hình field cho source info (cùng field hoặc field riêng)

## 🐛 v2.6.4 – 2025-11-10

### 🐛 Bug Fix: **Modal Not Closing và Default Field Not Found**

- **`src/popup/main.js`**: Fix modal không tự động đóng sau khi thêm content
  - Di chuyển việc remove overlay xuống sau khi content được thêm thành công
  - Remove overlay cả khi có lỗi
  - Thêm log khi modal được đóng

- **`src/background/main.js`**: Thêm logging chi tiết hơn cho defaults
  - Log đầy đủ defaults object (keys, values)
  - Log altSelection value riêng
  - Log full storage data để debug

- **`src/settings/main.js`**: Cải thiện logging và fix placeholder text
  - Thêm logging khi populate và save context defaults
  - Fix placeholder text cho altSelection (khác với các context type khác)
  - Log chi tiết khi set default value

- Fix: Modal giờ tự động đóng sau khi thêm content thành công
- Debug: Logs chi tiết hơn để tìm nguyên nhân default field không được load

## 🐛 v2.6.3 – 2025-11-10

### 🔍 Debug: **Enhanced Logging for Alt+Selection**

- **`src/content/alt-selection.js`**: Thêm debug logs chi tiết
  - Log khi Alt key được press/release
  - Log khi detect text selection (mouseup và selectionchange)
  - Log khi gửi message đến background
  - Log khi có lỗi

- **`src/background/main.js`**: Thêm debug logs chi tiết
  - Log khi nhận message `altSelectionDetected`
  - Log khi xử lý Alt selection (model, fields, default field)
  - Log khi store pending selection
  - Log khi gửi message đến popup
  - Log khi có lỗi

- **`src/popup/main.js`**: Thêm debug logs chi tiết
  - Log khi check pending selection trên load
  - Log khi nhận message `fillFieldFromAltSelection`
  - Log trong `handleAltSelection` (model check, field loading, field finding, content insertion)
  - Log trong field selector (modal creation, apply button click, field finding, content insertion)
  - Log tất cả các bước quan trọng với prefix `[AnkiVN Popup]`

- Tất cả logs sử dụng prefix rõ ràng: `[AnkiVN Content]`, `[AnkiVN Background]`, `[AnkiVN Popup]`
- Logs bao gồm: data objects, field names, model names, content preview, error details
- Giúp debug dễ dàng hơn khi có vấn đề với Alt+Selection

## 🐛 v2.6.2 – 2025-11-10

### 🐛 Bug Fix: **Alt+Selection Default Field và Field Selector**

- **`src/popup/main.js`**: Fix Alt+Selection không sử dụng default field
  - Đảm bảo model được load và fields được render trước khi xử lý
  - Kiểm tra model mismatch và tự động load model đúng
  - Thêm retry logic để tìm field nếu chưa render
  - Thêm logging để debug
  - Cải thiện error handling

- **`src/popup/main.js`**: Fix nút "Thêm" trong field selector không hoạt động
  - Sử dụng direct event listener thay vì event delegation
  - Đảm bảo model được load trước khi insert content
  - Thêm retry logic để tìm field
  - Better error handling và user feedback
  - Fix: Nút "Thêm" giờ hoạt động đúng, content được thêm vào field

- **`src/popup/main.js`**: Cải thiện handleAltSelection với default field
  - Tự động load model nếu model không khớp
  - Đảm bảo fields được render trước khi insert
  - Thêm retry logic với delay
  - Fallback sang field selector nếu default field không tồn tại
  - Better logging và error handling

- **`AI_CONTEXT.md`**: Cập nhật documentation
  - Thêm thông tin về Alt+Selection feature
  - Thêm content script section
  - Cập nhật storage keys
  - Cập nhật workflows và notes

- Fix: Alt+Selection giờ sử dụng default field đúng cách, field selector hoạt động đúng

## 🐛 v2.6.1 – 2025-11-10

### 🐛 Bug Fix: **Side Panel Open Requires User Gesture**

- **`src/background/main.js`**: Fix lỗi `sidePanel.open()` requires user gesture
  - Không tự động mở side panel từ background script
  - Chỉ lưu pending selection và hiển thị badge
  - User phải mở side panel thủ công (click extension icon)
  - Clear badge khi user mở side panel

- **`src/popup/main.js`**: Cải thiện xử lý pending selection
  - Check pending selection khi popup loads
  - Xử lý cả trường hợp không có model khi selection
  - Clear badge sau khi xử lý

- Fix: Không còn lỗi "sidePanel.open() may only be called in response to a user gesture"

## ✨ v2.6.0 – 2025-11-10

### ✨ Feature: **Alt + Selection - Thêm Text vào Field**

- **`src/content/alt-selection.js`**: Content script mới để detect Alt + text selection
  - Detect khi user bấm Alt và chọn text trên trang web
  - Bỏ qua selection trong input/textarea/contentEditable
  - Gửi message đến background script

- **`manifest.json`**: Thêm content script và permission
  - Thêm `activeTab` permission
  - Thêm content script cho tất cả URLs
  - Content script chạy ở `document_idle`

- **`src/background/main.js`**: Handle Alt selection message
  - `handleAltSelection()`: Xử lý khi có Alt selection
  - Lấy default field từ settings (contextMenuDefaults.altSelection)
  - Mở side panel và gửi message đến popup
  - Store pending selection nếu popup chưa sẵn sàng

- **`src/popup/main.js`**: UI và logic cho Alt selection
  - `handleAltSelection()`: Xử lý Alt selection
    - Nếu có default field → Thêm trực tiếp vào field đó
    - Nếu không có default field → Hiển thị field selector
  - `showFieldSelector()`: Modal để chọn field
    - Hiển thị text đã chọn (preview)
    - Dropdown để chọn field
    - Buttons Hủy/Thêm
  - Thêm source info (URL + title) khi thêm text
  - Auto-expand field nếu bị collapsed
  - Check pending selection khi popup loads

- **`ui/settings.html`**: Thêm setting cho Alt+Selection
  - Thêm select cho "Alt + Chọn text (Alt+Selection)"
  - Tích hợp với contextMenuDefaults system

- **Features**:
  - Alt + chọn text → Tự động thêm vào field (nếu có default field)
  - Alt + chọn text → Hiển thị field selector (nếu không có default field)
  - Thêm source info (URL + title) khi thêm text
  - Auto-expand field nếu bị collapsed
  - Có thể cấu hình default field trong settings
  - Bỏ qua selection trong input fields

## 🎨 v2.5.5 – 2025-11-10

### 🎨 UI Fix: **Reduce Field Input Min Height**

- **`ui/styles.css`**: Giảm min-height của `.field-input-div`
  - Từ `calc(1.5em * 2 + 1.2rem + 2px)` (2 dòng) → `calc(1.5em + 0.6rem + 2px)` (1 dòng)
  - Fields gọn hơn, chiếm ít không gian hơn
  - Vẫn có thể mở rộng khi có nhiều nội dung

## 🎨 v2.5.4 – 2025-11-10

### 🎨 UI Fix: **Inline Label Text Align**

- **`ui/styles.css`**: Đổi text-align của `.inline-label` thành `left`
  - Labels sẽ align về bên trái
  - Consistent với các label khác

## 🎨 v2.5.3 – 2025-11-10

### 🎨 UI Simplification: **Simplify Cloze Buttons**

- **`ui/popup.html`**: Rút gọn cloze buttons
  - Xóa các buttons C1, C2, C3
  - Chỉ giữ lại 1 button "C123" (thay thế {c..})
  - Toolbar gọn gàng hơn

- **`src/popup/main.js`**: Cập nhật logic
  - Xóa event listeners cho C1, C2, C3
  - Giữ lại event listener cho C123 (sử dụng addCloze() tự động)
  - Xóa keyboard shortcuts cho C1, C2, C3
  - Giữ lại Ctrl+Shift+C cho C123

- Toolbar gọn hơn với 1 button cloze thay vì 4 buttons

## 🎨 v2.5.2 – 2025-11-10

### 🎨 UI Cleanup: **Remove Toolbar Separators**

- **`ui/popup.html`**: Loại bỏ các `<span class="toolbar-separator">|</span>`
  - Xóa tất cả separators trong toolbar
  - Toolbar gọn gàng hơn, không cần separators

## 🎨 v2.5.1 – 2025-11-10

### 🎨 UI Fix: **Remove Field Group Margin**

- **`ui/styles.css`**: Loại bỏ margin-bottom của `.field-group`
  - Comment out `margin-bottom: 0.8rem;`
  - Giảm khoảng cách giữa các fields
  - UI gọn gàng hơn

## ✨ v2.5.0 – 2025-11-10

### ✨ Feature: **Saved Colors - Lưu và Tái Sử Dụng Màu**

- **`src/utils/storage.js`**: Thêm storage keys cho saved colors
  - `SAVED_FORECOLORS_KEY`: Lưu danh sách màu chữ đã dùng
  - `SAVED_BACKCOLORS_KEY`: Lưu danh sách màu nền đã dùng

- **`ui/popup.html`**: Thêm UI cho saved colors
  - Thêm `saved-colors-section` trong color picker dropdown
  - Thêm `saved-colors-grid` để hiển thị các màu đã lưu
  - Hiển thị cả cho forecolor và backcolor

- **`ui/styles.css`**: Styling cho saved colors
  - **Saved Colors Section**: Label và grid layout
  - **Saved Colors Grid**: Grid 6 cột, scrollable, max-height 80px
  - **Saved Color Item**: 28x28px, hover effects, border cho light colors
  - **Selected State**: Highlight màu đang chọn
  - **Scrollbar**: Custom scrollbar cho grid

- **`src/popup/main.js`**: Logic cho saved colors
  - `loadSavedColors()`: Load và hiển thị saved colors từ storage
  - `renderSavedColors()`: Render saved colors vào grid
  - `saveColor()`: Lưu màu vào storage (limit 18 màu)
  - Click vào saved color → Apply ngay lập tức
  - Khi apply màu mới → Tự động lưu vào saved colors
  - Remove duplicate, add to beginning, limit to 18 colors

- Features:
  - Lưu tối đa 18 màu cho mỗi loại (forecolor và backcolor)
  - Click vào saved color để apply ngay
  - Tự động lưu khi apply màu mới
  - Hiển thị grid với scroll nếu có nhiều màu
  - Empty state khi chưa có màu nào

## 🐛 v2.4.12 – 2025-11-10

### 🐛 Bug Fix: **BackColor Not Applying Correctly**

- **`src/features/formatter.js`**: Fix backColor không apply đúng
  - `execCommand('backColor')` không hoạt động đúng trong một số trường hợp
  - Sử dụng manual approach (span với backgroundColor style) cho backColor
  - Giữ execCommand cho foreColor (hoạt động tốt)
  - Better error handling cho manual approach
  - Verify applied color sau khi apply
  - Fallback method nếu surroundContents fails

- Fix: Background color giờ được apply đúng bằng span với style.backgroundColor

## 🐛 v2.4.11 – 2025-11-10

### 🐛 Bug Fix: **Missing Import for restoreSelection**

- **`src/features/formatter.js`**: Fix import missing `restoreSelection`
  - Thêm `restoreSelection` vào import từ `main.js`
  - Fix lỗi `ReferenceError: restoreSelection is not defined`

- Fix: Import đúng function để restore selection khi apply màu

## 🐛 v2.4.10 – 2025-11-10

### 🐛 Bug Fix: **ActiveElement Lost When Clicking Apply Button**

- **`src/popup/main.js`**: Fix activeElement bị mất khi click apply button
  - Thêm `savedSelection` để lưu selection trước khi mở dropdown
  - Thêm `saveSelection()` và `restoreSelection()` functions
  - Sử dụng `data-keep-active` flag để không clear activeElement khi blur vào dropdown
  - Restore selection khi apply màu
  - Đơn giản hóa logic apply button (bỏ các check phức tạp)

- **`src/ui/fields.js`**: Không clear activeElement khi blur nếu có keepActive flag
  - Check `data-keep-active` flag trong blur handler
  - Chỉ clear activeElement nếu không có flag

- **`src/features/formatter.js`**: Sử dụng restoreSelection
  - Import và sử dụng `restoreSelection()` trong applyFormat
  - Restore selection trước khi apply màu

- Fix: ActiveElement và selection được giữ lại khi tương tác với dropdown

## 🐛 v2.4.9 – 2025-11-10

### 🔍 Debug: **Enhanced Logging for Color Formatting**

- **`src/features/formatter.js`**: Thêm extensive logging để debug
  - Log activeElement details (tagName, className, innerHTML)
  - Log selection details (rangeCount, anchorNode, focusNode, toString)
  - Log range details (collapsed, start/end containers, offsets)
  - Log execCommand results
  - Log manual approach steps
  - Log errors với stack trace
  - Verify range is within activeElement
  - Check applied color after execCommand

- **`src/popup/main.js`**: Thêm logging khi click apply button
  - Log color value
  - Log activeElement
  - Log selection text

- Debug logging để tìm nguyên nhân màu không apply được

## 🐛 v2.4.8 – 2025-11-10

### 🐛 Bug Fix: **Color Formatting Not Working**

- **`src/features/formatter.js`**: Sửa lỗi apply màu không hoạt động
  - Kiểm tra text được chọn trước khi apply màu
  - Hiển thị thông báo nếu không có text được chọn
  - Fallback: Manual wrap selection với span có style color nếu execCommand fail
  - Xử lý trường hợp range spans multiple nodes
  - Better error handling và user feedback
  - Import showStatus để hiển thị thông báo lỗi

- Fix: Màu text và background color giờ hoạt động đúng khi có text được chọn

## 🎨 v2.4.7 – 2025-11-10

### ✨ Toolbar Alignment: **Match Header Width**

- **`ui/styles.css`**: Căn chỉnh toolbar với header
  - Thêm padding ngang 16px cho toolbar wrapper (giống container padding)
  - Thêm negative margin -16px để toolbar extend ra ngoài container padding
  - Toolbar giờ có cùng width với header content area
  - Align chính xác với header

## 🎨 v2.4.6 – 2025-11-10

### ✨ UI Text: **Simplify Button Text**

- **`ui/popup.html`**: Đơn giản hóa text button
  - Thay đổi "Thêm vào Anki" thành "Thêm"
  - Ngắn gọn, dễ đọc hơn

## 🎨 v2.4.5 – 2025-11-10

### ✨ Color Picker Dropdown: **HEX Input và Apply Button**

- **`ui/popup.html`**: Thêm dropdown cho color picker
  - Wrapper cho mỗi color button
  - Dropdown chứa: header, color picker, HEX input, Apply button
  - Dropdown hiện/ẩn khi click button

- **`ui/styles.css`**: Styling cho dropdown
  - **Color Picker Wrapper**: Position relative để chứa dropdown
  - **Dropdown**: 
    - Position absolute, slideDown animation
    - Background trắng với shadow
    - Padding và spacing hợp lý
  
  - **Color Picker**: 
    - Lớn hơn (40px) trong dropdown
    - Better hover effects
  
  - **HEX Input**: 
    - Full width trong dropdown
    - Better styling với focus states
  
  - **Apply Button**: 
    - Full width, success color scheme
    - Better hover và active states

- **`src/popup/main.js`**: Logic cho dropdown
  - Toggle dropdown khi click button
  - Close dropdown khi click outside
  - Sync giữa color picker và HEX input
  - Auto-add # prefix nếu thiếu
  - Apply màu khi click Apply button (không auto-apply)
  - Close dropdown sau khi apply
  - Visual feedback khi apply

- UX: Click button → Dropdown hiện → Chọn màu/Nhập HEX → Click Apply → Màu được apply

## 🎨 v2.4.4 – 2025-11-10

### ✨ Toolbar Simplification: **Unified Color Buttons**

- **`ui/popup.html`**: Đơn giản hóa color selection
  - Gộp thành 1 nút duy nhất cho text color và background color
  - Bỏ color group wrapper, hex input và apply button riêng
  - Color picker ẩn bên trong nút, overlay toàn bộ button
  - Mỗi nút có icon + swatch hiển thị màu hiện tại

- **`ui/styles.css`**: Styling cho unified color buttons
  - **Color Button**: 
    - Background gradient với border
    - Hover effect với highlight
    - Active state khi click
    - Position relative để chứa swatch và picker
  
  - **Color Swatch**: 
    - Hiển thị màu hiện tại ở góc button
    - Hover scale effect
    - Auto border cho light colors
  
  - **Hidden Color Picker**: 
    - Overlay toàn bộ button (opacity: 0)
    - Z-index cao để catch clicks
    - Tự động mở color picker khi click button

- **`src/popup/main.js`**: Đơn giản hóa logic
  - Auto-apply màu khi chọn (bỏ apply button)
  - Sync swatch với color picker
  - Visual feedback khi apply (scale animation)
  - Bỏ hex input sync và apply button handlers
  - Đơn giản hóa code, dễ maintain hơn

- UX đơn giản hơn: Click 1 nút → Chọn màu → Tự động apply

## 🎨 v2.4.3 – 2025-11-10

### ✨ Toolbar Optimization: **Enhanced Color Selection UI**

- **`ui/popup.html`**: Cải thiện cấu trúc toolbar
  - Group các controls lại với nhau (toolbar-group)
  - Tách riêng color groups với background và border
  - Thêm color swatch indicator hiển thị màu hiện tại
  - Cải thiện layout và organization

- **`ui/styles.css`**: Tối ưu styling cho toolbar
  - **Color Groups**: 
    - Background gradient với border rõ ràng
    - Hover effect với highlight
    - Active state khi apply màu
    - Grouped layout dễ nhận biết
  
  - **Color Swatch**: 
    - Hiển thị màu hiện tại trên button icon
    - Position absolute ở góc button
    - Hover scale effect
    - Auto border cho light colors
  
  - **Color Controls**: 
    - Improved spacing và alignment
    - Color picker lớn hơn (28px)
    - HEX input rộng hơn (80px) với better styling
    - Apply button với success color scheme
  
  - **General**: 
    - Better button sizing (32px height)
    - Improved separators
    - Enhanced hover và focus states
    - Better visual hierarchy

- **`src/popup/main.js`**: Thêm logic sync màu
  - Auto-update color swatch khi màu thay đổi
  - Sync giữa color picker và HEX input
  - Auto-add # prefix nếu thiếu
  - Activate color group khi apply màu (visual feedback)
  - Initialize swatches với giá trị mặc định
  - Support light color detection cho border

- Tối ưu UX cho color selection với visual feedback rõ ràng

## 🎨 v2.4.2 – 2025-11-10

### ✨ UI Optimization: **Enhanced Visual Design**

- **`ui/styles.css`**: Tối ưu toàn diện giao diện UI
  - **Suggestions Container**: 
    - Tăng max-height từ 160px lên 200px
    - Thêm custom scrollbar với smooth scrolling
    - Cải thiện hover effects với padding shift
    - Active state với màu primary
    - Box-shadow và border radius tốt hơn
  
  - **Header**: 
    - Cải thiện spacing và border (2px)
    - Thêm gradient background nhẹ
    - Icon buttons với hover scale effect
    - Better transition và active states
  
  - **Toolbar**: 
    - Cải thiện spacing và alignment
    - Thêm hover transform effects
    - Color picker với hover scale
    - Cloze buttons với gradient background
    - Better focus states với outline
  
  - **Fields**: 
    - Cải thiện border và padding
    - Custom scrollbar cho field inputs
    - Better hover và focus states
    - Drag-over state với scale effect
    - Smooth transitions
  
  - **Buttons**: 
    - Enhanced hover effects với transform
    - Better shadows và gradients
    - Focus states với outline
    - Floating button với improved shadow
  
  - **General**: 
    - Custom scrollbar cho toàn bộ extension
    - Font smoothing (antialiased)
    - Better color contrast
    - Smooth animations cho status messages
    - Improved spacing throughout
    - Better visual hierarchy

- Không thay đổi chức năng, chỉ cải thiện UI/UX

## 📚 v2.4.1 – 2025-11-10

### 📖 Documentation: **AI Context và Rules Update**

- **`AI_CONTEXT.md`**: Tạo file context mới để AI assistant hiểu nhanh codebase
  - Tổng quan về extension và version
  - Cấu trúc codebase chi tiết
  - Mô tả các modules và chức năng
  - Luồng hoạt động chính
  - Tính năng và storage keys
  - Cách làm việc với codebase
  - Workflow khi bắt đầu task mới
  - File này giúp AI không cần đọc lại toàn bộ codebase mỗi lần chat

- **`AI_RULES.md`**: Cập nhật quy tắc phát triển
  - Thêm phần "Getting Started" với hướng dẫn đọc AI_CONTEXT.md
  - Cập nhật folder structure để phù hợp với codebase thực tế
  - Thêm quy tắc về ES6 modules
  - Thêm quy tắc về storage keys và error handling
  - Thêm phần "AnkiVN-Specific Rules"
  - Thêm workflow chi tiết khi làm việc với codebase
  - Cập nhật version tracking format

## ✨ v2.4.0 – 2025-11-07

### 🚀 Feature: **Manual Color Application**

- **New Apply Buttons**: Added "Apply" (✓) buttons next to the foreground and background color pickers.
- **Updated Behavior**: Colors are no longer applied instantly. Users now select a color using the picker or HEX input, and the color is only applied to the selected text after clicking the corresponding "Apply" button.
- This prevents accidental color changes and improves the text formatting workflow.

## ✨ v2.3.0 – 2025-11-06

### 🚀 Feature: **Enhanced Formatting Toolbar**

- **HEX Color Inputs**: Added text fields next to color pickers, allowing direct input of HEX color codes. The color picker and text field are synchronized.
- **Dedicated Cloze Buttons**: Added specific buttons for C1, C2, and C3 cloze deletions for faster access.
- **New Keyboard Shortcuts**: Added `Ctrl+Shift+1/2/3` shortcuts for the new cloze buttons.
- The generic cloze button now inserts the next sequential cloze (e.g., C4, C5...).

## 🎨 v2.2.2 – 2025-11-05

### UI Refinement: **Seamless Sticky Toolbar**

- **`ui/styles.css`**: Removed the background, border, and padding from `#format-toolbar` so that its buttons sit directly on the sticky wrapper. This creates a cleaner, more integrated look without a "box-in-a-box" effect.

## 🎨 v2.2.1 – 2025-11-04

### UI Refinement: **Flush Sticky Toolbar**

- **`ui/styles.css`**: Adjusted padding and margins to make the sticky toolbar flush with the top of the sidebar on initial load.
- Removed the top padding from the main `.container` and added it to the `.header-container` to compensate.
- Simplified the layout rules for `#sticky-toolbar-wrapper` by removing negative margins.

## ✨ v2.2.0 – 2025-11-03

### 🚀 Feature: **Drag & Drop Media from Web**

- Users can now drag images directly from any website and drop them into a field in the sidebar.
- **`src/ui/fields.js`**: Added a comprehensive `drop` event handler that intelligently processes different data types (`files`, `text/html`, `text/uri-list`).
- **`src/features/media-handler.js`**: Created a new module to centralize the logic for processing media from both local files (`handleMediaFile`) and web URLs (`handleMediaUrl`). This involves calling Anki-Connect's `storeMediaFile` action.
- **`ui/styles.css`**: Added a `.drag-over` style to provide visual feedback when dragging an item over a valid field.

## 🐛 v2.1.3 – 2025-11-02

### Bug Fix: **Sticky Toolbar Position**

- **`ui/styles.css`**: Adjusted the CSS for `#sticky-toolbar-wrapper`.
- Changed `top: -1px` to `top: 0` to eliminate a 1-pixel gap that appeared above the toolbar when scrolling.
- The toolbar now sticks perfectly to the top edge of the viewport as intended.

## 🎨 v2.1.2 – 2025-11-01

### UI Refinement: **Compact Header**

- **`ui/styles.css`**: Optimized spacing for the non-sticky header area (`#non-sticky-header-content`).
- Reduced padding, margins, and element sizes for the Preset, Deck, and Note Type selectors to create a more compact layout.

## 🎨 v2.1.1 – 2025-10-31

### UI Refinement: **Compact Fields View**

- **`ui/styles.css`**: Modified the `.fields-container` to remove its background, border, and padding.
- The bottom margin was also reduced for a tighter layout.
- This change creates a cleaner, more seamless interface by reducing visual clutter around the input fields.

## ✨ v2.1.0 – 2025-10-30

### 🚀 Feature: **Advanced Customization**

This update introduces powerful new customization options in the settings page, giving users more control over their workflow.

**Settings Page Enhancements**
- **Field Order**: Users can now drag and drop fields to define a custom display order for the sidebar. This order is saved per Note Type.
- **Context Menu Defaults**: Users can set a default target field for each context menu action (Text, Image, Audio, Link). This speeds up adding content by allowing one-click sending to a predefined field.

**Functional Updates**
- The sidebar now respects the custom field order set in the settings.
- The context menu is now dynamic:
  - The main menu item (e.g., "Gửi ảnh...") will display the default target field if one is set (e.g., "Gửi ảnh đến 'Front'").
  - Clicking the main menu item directly sends the content to the default field.

## v1.0.0 – 2025-08-24
- @ToneDice created manifest.json with basic permissions and action popup
- Added background.js with minimal event listener
- Added content.js placeholder
- Added popup.html and popup.js with simple ping functionality
- Added styles.css for minimal popup styling

## v1.1.0 – 2025-08-25
- Updated manifest.json for AnkiVN extension with host permissions for localhost:8765
- Removed unnecessary permissions and content scripts

... (All previous versions remain unchanged) ...

## v1.46.00
- Fixed autocomplete and settings button click issues by rewriting click handling logic.

## 🆕 v2.0.0 – 2025-10-29

### 🚀 Major Refactor: **Modular Codebase**

This version introduces a complete reorganization of the extension's source code for better maintainability, scalability, and clarity.

**Structure**
- **`src/`**: New main directory for all JavaScript source code.
- **`ui/`**: New directory for all UI files (`popup.html`, `settings.html`, `styles.css`).
- **Modules**: The code is now split into logical modules using ES6 `import`/`export`.
  - `src/api/`: For Anki-Connect communication.
  - `src/background/`: For the service worker and context menu logic.
  - `src/features/`: For specific functionalities like presets, media preview, and formatting.
  - `src/popup/`: For the main sidebar logic.
  - `src/settings/`: For the settings page logic.
  - `src/ui/`: For UI component logic like autocomplete and field creation.
  - `src/utils/`: For shared helper functions and constants.

**manifest.json**
- Updated all file paths (`service_worker`, `side_panel`, `options_page`) to point to the new locations.
- Added `"type": "module"` to the `background` entry to enable ES6 module loading in the service worker.

**HTML Files**
- Updated `<script>` tags in `popup.html` and `settings.html` to be `type="module"` and point to the new JavaScript entry points in the `src/` directory.

This refactoring does not introduce new user-facing features but establishes a solid foundation for future development.