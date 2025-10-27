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