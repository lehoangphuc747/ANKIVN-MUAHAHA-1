// src/features/formatter.js
import { activeElement, currentClozeIndex, incrementClozeIndex } from '../popup/main.js';

export function applyFormat(command, value = null) {
  if (!activeElement || !activeElement.isContentEditable) return;
  activeElement.focus();
  try {
    document.execCommand(command, false, value);
  } catch (e) {
    console.error(`Error executing format command '${command}':`, e);
  }
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

export function addCloze(clozeNumber = null) {
  if (!activeElement || !activeElement.isContentEditable) return;
  activeElement.focus();
  const selection = window.getSelection();
  let indexToUse;

  if (clozeNumber !== null && !isNaN(clozeNumber) && clozeNumber > 0) {
      indexToUse = parseInt(clozeNumber);
  } else {
      indexToUse = currentClozeIndex;
      incrementClozeIndex();
  }

  const clozeText = `{{c${indexToUse}::${selection.toString() || ''}}}`;
  try {
      document.execCommand('insertText', false, clozeText);
  } catch (e) {
      console.error("Error inserting cloze text:", e);
  }
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}