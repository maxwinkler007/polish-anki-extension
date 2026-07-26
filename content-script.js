// content-script.js
// Detects a single-word selection, shows a small floating "Add to Anki" button
// near it. On click, asks background.js to generate a card, then shows a
// preview panel with editable Front/Back fields and a Save button.

let currentButton = null;
let currentPanel = null;

function removeButton() {
  if (currentButton) {
    currentButton.remove();
    currentButton = null;
  }
}

function removePanel() {
  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
  }
}

document.addEventListener("mouseup", (e) => {
  // ignore clicks inside our own UI
  if (e.target.closest(".pa-button") || e.target.closest(".pa-panel")) return;

  removeButton();

  const selection = window.getSelection();
  const word = selection.toString().trim();

  if (!word || /\s/.test(word) || word.length > 40) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const sentence = selection.anchorNode?.parentElement?.textContent?.trim() || "";

  const btn = document.createElement("button");
  btn.className = "pa-button";
  btn.textContent = "➕ Anki";
  btn.style.top = `${window.scrollY + rect.bottom + 6}px`;
  btn.style.left = `${window.scrollX + rect.left}px`;

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    handleGenerate(word, sentence, rect);
    removeButton();
  });

  document.body.appendChild(btn);
  currentButton = btn;
});

document.addEventListener("mousedown", (e) => {
  if (!e.target.closest(".pa-button") && !e.target.closest(".pa-panel")) {
    removeButton();
  }
});

function handleGenerate(word, sentence, rect) {
  removePanel();
  const panel = buildPanel(word, rect);
  panel.querySelector(".pa-status").textContent = `Generiere Karte für „${word}"...`;
  document.body.appendChild(panel);
  currentPanel = panel;

  chrome.runtime.sendMessage({ type: "GENERATE", word, sentence }, (response) => {
    if (!response) {
      panel.querySelector(".pa-status").textContent = "Keine Antwort vom Hintergrundskript.";
      return;
    }
    if (!response.ok) {
      panel.querySelector(".pa-status").textContent = `Fehler: ${response.error}`;
      return;
    }
    panel.querySelector(".pa-status").textContent = "";
    panel.querySelector(".pa-front").value = response.card.front;
    panel.querySelector(".pa-back").value = response.card.back;
  });
}

function buildPanel(word, rect) {
  const panel = document.createElement("div");
  panel.className = "pa-panel";
  panel.style.top = `${window.scrollY + rect.bottom + 10}px`;
  panel.style.left = `${window.scrollX + rect.left}px`;

  panel.innerHTML = `
    <div class="pa-header">Karte: <strong>${word}</strong> <span class="pa-close">✕</span></div>
    <div class="pa-status"></div>
    <label>Front</label>
    <textarea class="pa-front" rows="5"></textarea>
    <label>Back</label>
    <textarea class="pa-back" rows="3"></textarea>
    <div class="pa-actions">
      <button class="pa-save">💾 In Anki speichern</button>
    </div>
  `;

  panel.querySelector(".pa-close").addEventListener("click", removePanel);

  panel.querySelector(".pa-save").addEventListener("click", () => {
    const front = panel.querySelector(".pa-front").value;
    const back = panel.querySelector(".pa-back").value;
    const status = panel.querySelector(".pa-status");
    status.textContent = "Speichere...";

    chrome.runtime.sendMessage({ type: "SAVE_TO_ANKI", front, back }, (response) => {
      if (!response || !response.ok) {
        status.textContent = `Fehler beim Speichern: ${response ? response.error : "keine Antwort"}`;
        return;
      }
      status.textContent = "✅ Gespeichert!";
      setTimeout(removePanel, 1200);
    });
  });

  return panel;
}
