# Version History

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