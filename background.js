// background.js — service worker
// Holds the Gemini + AnkiConnect logic, ported directly from test-pipeline.js.
// The API key and deck name come from chrome.storage.local (set via options.html),
// never hardcoded here.

const SOURCE_RESTRICTION = `
Podstawą Twojej odpowiedzi (definicja, odmiana, przykłady) powinny być PRZEDE
WSZYSTKIM treści pobrane z podanych adresów URL (sjp.pwn.pl i Wikipedia).
Jeśli te dwa źródła nie zawierają słowa lub zawierają zbyt mało informacji
(np. strona nie istnieje, przekierowuje donikąd, albo brakuje odmiany czy
definicji), MOŻESZ skorzystać z innych wiarygodnych źródeł w internecie
(np. innych słowników języka polskiego, Wiktionary, forów językowych) lub
z własnej wiedzy językowej, aby i tak wygenerować poprawną, kompletną kartę.
Nigdy nie zwracaj karty z informacją "brak wystarczających informacji" —
zawsze postaraj się dostarczyć poprawną odmianę, definicję i przykład,
korzystając z najlepszego dostępnego źródła.
`;

const CARD_FORMAT_PROMPT = `Jesteś nauczycielem języka polskiego dla ucznia na poziomie A2/B1.

Dla podanego polskiego słowa zwróć WYŁĄCZNIE poprawny JSON, bez markdown, bez komentarza, w formacie:
{"front": "...", "back": "..."}

FRONT — w zależności od części mowy:

Jeśli RZECZOWNIK:
"{słowo} | {zaimek+forma} Mianownik, {zaimek+forma} Dopełniacz, {zaimek+forma} Celownik, {zaimek+forma} Biernik, {zaimek+forma} Narzędnik, {zaimek+forma} Miejscownik | liczba mnoga: {6 form liczby mnogiej w tej samej kolejności} | Przykład: {proste zdanie}"
Przykład wzoru: "wieża | ta wieża, tej wieży, tej wieży, tę wieżę, tą wieżą, o tej wieży | liczba mnoga: te wieże, tych wież, tym wieżom, te wieże, tymi wieżami, o tych wieżach | Przykład: Wieża była bardzo wysoka."

Jeśli PRZYMIOTNIK:
"{słowo} / liczba pojedyncza: {6 form w kolejności: Mianownik, Dopełniacz, Celownik, Biernik, Narzędnik, Miejscownik} / liczba mnoga: {6 form} / Przykład: {zdanie}"
Jeśli rodzaje różnią się, podaj formy dla m/ż/n rozdzielone ukośnikiem tam gdzie to konieczne.

Jeśli CZASOWNIK:
Podaj PEŁNĄ koniugację używając <br> zamiast łamania linii, w tym formacie:
"{czasownik} (dok), {czasownik} (niedok)<br>Liczba pojedyncza<br>ja {forma}<br>ty {forma}<br>on/ona/ono {forma}<br>Liczba mnoga<br>my {forma}<br>wy {forma}<br>oni/one {forma}<br>Koniugacja dokonana<br>przyszły: ...<br>przeszły: ...<br>Koniugacja niedokonana<br>teraźniejszy: ...<br>przeszły: ...<br>przyszły: ...<br>Przykład: {zdanie}"
Jeśli są różnice rodzajowe w czasie przeszłym, podaj wszystkie warianty (np. zwierzyłem/zwierzyłam).

WAŻNE dla FRONT: nigdy nie używaj wypunktowań (• lub -). Używaj <br> do łamania linii tam gdzie potrzebne (głównie w koniugacjach czasowników).

BACK (ten sam format dla wszystkich części mowy):
"{definicja po polsku, 1-2 zdania, najlepiej jedno, poziom A2/B1, słowo NIE może pojawić się w definicji}  {jedno pasujące emoji}  Synonimy: {synonim1}, {synonim2}, {synonim3}"

Emoji musi pasować tematycznie do słowa (np. "roślina" → 🌱) i musi być podane dla KAŻDEGO słowa, niezależnie od części mowy — nawet dla czasowników i pojęć abstrakcyjnych, wybierz najbliższe skojarzenie wizualne.

Zwróć TYLKO obiekt JSON, nic więcej`;

const SYSTEM_PROMPT = SOURCE_RESTRICTION + CARD_FORMAT_PROMPT;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSettings() {
  const { geminiKey, deckName } = await chrome.storage.local.get(["geminiKey", "deckName"]);
  return {
    geminiKey: geminiKey || "",
    deckName: deckName || "Polish Vocab"
  };
}

async function generateCard(word, geminiKey, maxRetries = 3) {
  const encoded = encodeURIComponent(word);
  const sources = [
    `https://sjp.pwn.pl/slowniki/${encoded}.html`,
    `https://pl.wikipedia.org/wiki/${encoded}`
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: `Słowo: "${word}"\nŹródła: ${sources.join(", ")}` }] }],
          tools: [{ url_context: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: { front: { type: "STRING" }, back: { type: "STRING" } },
              required: ["front", "back"]
            }
          }
        })
      }
    );
    const data = await res.json();

    if (data.candidates) {
      return JSON.parse(data.candidates[0].content.parts[0].text);
    }

    const isTransient = data.error?.status === "UNAVAILABLE" || data.error?.code === 503;
    if (isTransient && attempt < maxRetries) {
      const waitMs = attempt * 2000;
      console.warn(`Gemini is overloaded (attempt ${attempt}/${maxRetries}), retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
      continue;
    }

    console.error("Unexpected Gemini response:", JSON.stringify(data, null, 2));
    throw new Error(data.error?.message || "Gemini did not return a candidate.");
  }
}

async function addToAnki(deck, front, back) {
  const res = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    body: JSON.stringify({
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: deck,
          modelName: "Basic (and reversed card)",
          fields: { Front: front, Back: back },
          options: { allowDuplicate: false },
          tags: ["polish-auto"]
        }
      }
    })
  });
  return res.json();
}

// --- message router ------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE") {
    (async () => {
      try {
        const { geminiKey } = await getSettings();
        if (!geminiKey) {
          sendResponse({ ok: false, error: "Kein Gemini API-Key gesetzt. Öffne die Erweiterungs-Einstellungen." });
          return;
        }
        const card = await generateCard(message.word, geminiKey);
        sendResponse({ ok: true, card });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // keep the message channel open for the async response
  }

  if (message.type === "SAVE_TO_ANKI") {
    (async () => {
      try {
        const { deckName } = await getSettings();
        const result = await addToAnki(deckName, message.front, message.back);
        if (result.error) {
          sendResponse({ ok: false, error: result.error });
        } else {
          sendResponse({ ok: true, noteId: result.result });
        }
      } catch (err) {
        sendResponse({ ok: false, error: "AnkiConnect nicht erreichbar. Läuft Anki?" });
      }
    })();
    return true;
  }
});
