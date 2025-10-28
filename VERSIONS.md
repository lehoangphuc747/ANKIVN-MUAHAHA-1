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