# Polish Word → Anki

A Chrome extension that lets you select a Polish word anywhere on the web, generates an Anki flashcard for it (definition, full declension/conjugation with both aspects for verbs, example sentence, synonyms, and a matching emoji) via the Gemini API, and saves it straight into Anki.

Built for personal use while learning Polish at an A2/B1 level.

## How it works

1. Select a single Polish word on any webpage.
2. Click the small "➕ Anki" button that appears next to it.
3. A preview panel shows the generated Front/Back card — edit it if needed.
4. Click "💾 In Anki speichern" to save it directly into your Anki deck.

Card generation grounds primarily on [sjp.pwn.pl](https://sjp.pwn.pl) and Wikipedia via Gemini's URL context tool, with a fallback to the model's general knowledge if those sources don't have enough information for a given word.

## Requirements

- [Anki](https://apps.ankiweb.net) desktop, with the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed
- A free [Google Gemini API key](https://aistudio.google.com)
- Google Chrome (or any Chromium-based browser)

## Setup

### 1. Anki

- Install the AnkiConnect add-on (code `2055492159`) via Tools → Add-ons → Get Add-ons.
- Make sure you have a deck to save cards into (default expected name: `Polish Vocab` — configurable in the extension's settings).
- Confirm you have the built-in **"Basic (and reversed card)"** note type available (Tools → Manage Note Types) — this extension uses its `Front`/`Back` fields.

### 2. AnkiConnect connection

No manual configuration needed here. `manifest.json` declares `http://127.0.0.1:8765/*` under `host_permissions`, which exempts this extension from the browser's cross-origin restrictions for that address — unlike a request from a regular webpage, Chrome doesn't block it. AnkiConnect's own `webCorsOriginList` setting (in its add-on config) exists to stop arbitrary websites from talking to your local AnkiConnect server; it isn't a barrier this extension needs to get past.

If "Save to Anki" still fails, the more likely causes are: Anki isn't running (AnkiConnect only listens while the app is open), or the deck name configured in the extension doesn't match an existing deck in Anki.

### 3. Load the extension

- Go to `chrome://extensions`
- Enable "Developer mode" (top right)
- Click "Load unpacked" and select this folder
- Copy the extension's ID for the AnkiConnect config step above

### 4. Configure the extension

- Click the extension icon in the toolbar
- Enter your Gemini API key
- Enter your Anki deck name (defaults to `Polish Vocab`)
- Click "Speichern"

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config: permissions, host permissions, script wiring |
| `content-script.js` | Detects word selection, shows the "Add to Anki" button and preview panel |
| `background.js` | Service worker: calls the Gemini API to generate cards, calls AnkiConnect to save them |
| `options.html` / `options.js` | Settings popup for the Gemini API key and deck name |
| `styles.css` | Styling for the floating button and preview panel |

## Notes

- The Gemini API key is stored locally via `chrome.storage.local` — it never appears in the code itself, so this repo is safe to keep public as-is.
- Card generation retries automatically up to 3 times on transient Gemini server overload (503/`UNAVAILABLE`) before failing.
- Requires Anki to be running (AnkiConnect only listens while the app is open).

## License

MIT
