// src/ui/autocomplete.js
export function setupAutocomplete(containerElement, inputElement, suggestionsArray, selectCallback = null) {
  let suggestionsContainer = containerElement.querySelector(".suggestions-container");
  if (!suggestionsContainer) return;

  let activeSuggestionIndex = -1;

  const filterAndShowSuggestions = () => {
    const value = inputElement.value.toLowerCase();
    const keywords = value.split(/\s+/).filter(Boolean);
    suggestionsContainer.innerHTML = "";
    activeSuggestionIndex = -1;

    const filtered = suggestionsArray.filter(item => {
      const target = item.toLowerCase();
      return keywords.every(keyword => target.includes(keyword));
    });

    filtered.forEach(item => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.textContent = item;
      suggestionsContainer.appendChild(div);
    });
    suggestionsContainer.style.display = filtered.length > 0 ? "block" : "none";
  };

  const highlightSuggestion = () => {
    const items = suggestionsContainer.querySelectorAll(".suggestion-item");
    items.forEach((item, i) => item.classList.toggle("active", i === activeSuggestionIndex));
    if (items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].scrollIntoView({ block: "nearest" });
    }
  };

  inputElement.addEventListener("input", filterAndShowSuggestions);
  inputElement.addEventListener("focus", filterAndShowSuggestions);
  inputElement.addEventListener("keydown", (e) => {
    const items = suggestionsContainer.querySelectorAll(".suggestion-item");
    if (suggestionsContainer.style.display === 'none' || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
      highlightSuggestion();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
      highlightSuggestion();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestionIndex > -1) {
        items[activeSuggestionIndex].dispatchEvent(new MouseEvent('mousedown'));
      }
    } else if (e.key === "Escape") {
      suggestionsContainer.style.display = "none";
    }
  });

  suggestionsContainer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const target = e.target.closest('.suggestion-item');
    if (target) {
      const selectedText = target.textContent;
      inputElement.value = selectedText;
      suggestionsContainer.style.display = "none";
      if (selectCallback) selectCallback(selectedText);
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target !== inputElement && !containerElement.contains(e.target)) {
      suggestionsContainer.style.display = "none";
    }
  });
}