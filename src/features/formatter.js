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

export function addCloze() {
  if (!activeElement || !activeElement.isContentEditable) return;
  activeElement.focus();
  const selection = window.getSelection();
  const clozeText = `{{c${currentClozeIndex}::${selection.toString() || ''}}}`;
  document.execCommand('insertText', false, clozeText);
  incrementClozeIndex();
  activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}