# ChatHub Sidebar (MVP+)

Chrome-Erweiterung für **ChatGPT + Gemini** mit:

- Prompt-Bibliothek/Snippets (CRUD)
- Quick-Prompt-Leiste am Eingabebereich
- Verlauf + Suche
- Token-/Kosten-Schätzung
- Export/Import (JSON)
- Antwort-Tools (Copy/Clean/Translate/Summarize)
- Hotkey: `Ctrl+Shift+Y`

## Neu in dieser Iteration
- Prompt-Editor als Modal statt Browser-`prompt()`
- Variablen-Auflösung für Platzhalter wie `{{topic}}`, `{{tone}}`
- Robusteres Prompt-Capturing: Enter **und** Senden-Button
- Plattform-spezifische Selektoren für ChatGPT/Gemini
- Deduplizierung beim Verlauf-Capturing (verhindert Doppel-Einträge bei Enter + Button-Klick)
- Stabilerer Import: validiert/normalisiert Prompt- und Verlaufsdaten vor dem Speichern

## Installation
1. `chrome://extensions` öffnen
2. Entwicklermodus aktivieren
3. "Entpackte Erweiterung laden" → diesen Ordner wählen
