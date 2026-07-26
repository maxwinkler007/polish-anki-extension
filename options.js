document.addEventListener("DOMContentLoaded", async () => {
  const { geminiKey, deckName } = await chrome.storage.local.get(["geminiKey", "deckName"]);
  document.getElementById("geminiKey").value = geminiKey || "";
  document.getElementById("deckName").value = deckName || "Polish Vocab";
});

document.getElementById("save").addEventListener("click", async () => {
  const geminiKey = document.getElementById("geminiKey").value.trim();
  const deckName = document.getElementById("deckName").value.trim() || "Polish Vocab";
  await chrome.storage.local.set({ geminiKey, deckName });
  const status = document.getElementById("status");
  status.textContent = "Gespeichert ✓";
  setTimeout(() => (status.textContent = ""), 1500);
});
