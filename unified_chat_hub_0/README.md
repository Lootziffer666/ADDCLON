# ChatHub Sidebar (Chrome Extension, MV3)

Eine **einheitliche Sidebar für ChatGPT und Gemini** mit Prompt-Verwaltung, Verlauf, Token-/Kosten-Schätzung und Schnellaktionen direkt im Chat.

## Status

### Bereits umgesetzt
- ✅ Prompt-Bibliothek (Anlegen, Bearbeiten, Löschen, Einfügen)
- ✅ Prompt-Variablen via Platzhalter wie `{{text}}` (werden beim Einfügen abgefragt)
- ✅ Quick-Prompt-Leiste direkt am Eingabefeld (One-Click-Einfügen)
- ✅ Verlauf mit Suche
- ✅ Token-/Kosten-Schätzung pro Prompt
- ✅ Export/Import als JSON (inkl. Validierung/Normalisierung beim Import)
- ✅ Antwort-Tools (Copy / Clean / Translate / Summarize)
- ✅ Sidebar Toggle via Shortcut `Ctrl+Shift+Y`
- ✅ Chrome Storage lokal + optional `chrome.storage.sync`

### Noch offen / spätere Ausbaustufen
- ⏳ Vergleichsansicht (ein Prompt an mehrere Bots parallel)
- ⏳ Prompt-Ketten/Makros über mehrere Schritte
- ⏳ Erweiterte Modell-/Preis-Matrix statt fixer Input/Output-Werte
- ⏳ Zusätzliche Plattformen über ChatGPT/Gemini hinaus

---

## Funktionsübersicht

### 1) Prompt-Bibliothek
- Prompts als Snippets speichern und per Klick ins aktuelle Eingabefeld einfügen.
- Beim Einfügen werden vorhandene Platzhalter (`{{variable}}`) erkannt und abgefragt.

### 2) Quickbar unter dem Eingabefeld
- Häufige Prompts sind direkt am Composer verfügbar.
- Die Leiste wird bei DOM-Änderungen neu verankert, damit sie auf dynamischen UIs stabil bleibt.

### 3) Verlauf + Suche
- Eingefügte/gesendete Prompts werden protokolliert.
- Verlauf ist durchsuchbar und auf 500 Einträge begrenzt.
- Deduplizierung verhindert Doppel-Logs bei Enter + Button-Klick.

### 4) Token- und Kosten-Schätzung
- Einfache Heuristik zur Token-Schätzung (Zeichen/4).
- Kostenberechnung mit konfigurierbaren Preisen pro 1.000 Tokens.

### 5) Export / Import
- Datenexport als JSON-Datei.
- Import prüft und normalisiert Daten (IDs, Strings, Zahlen/Fallbacks), ungültige Einträge werden verworfen.

### 6) Antwort-Tools
- **Copy**: Antworttext in Zwischenablage.
- **Clean**: Grobe Bereinigung von Antworttext.
- **Translate** / **Summarize**: Hilfsaktionen für schnelle Weiterverarbeitung.

---

## Unterstützte Plattformen
- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`

---

## Installation (Entwicklermodus)
1. Repository lokal vorliegen haben.
2. In Chrome `chrome://extensions` öffnen.
3. **Entwicklermodus** aktivieren.
4. **Entpackte Erweiterung laden** klicken.
5. Ordner `unified_chat_hub_0` auswählen.

---

## Bedienung

### Sidebar öffnen
- Tastenkürzel: `Ctrl+Shift+Y`
- Oder über das Erweiterungs-Popup.

### Prompt anlegen/bearbeiten
- In der Sidebar Tab **Prompts** öffnen.
- Prompt erstellen oder bearbeiten.
- Optional Platzhalter verwenden, z. B.:

```text
Schreibe den folgenden Text professionell um:\n\n{{text}}
```

### Daten sichern
- Über Export JSON-Datei erzeugen.
- Über Import vorhandene Datei wieder einspielen.

### Preise einstellen
- Erweiterungsoptionen öffnen (`options.html` über Chrome-Erweiterungsseite).
- Input-/Output-Preis pro 1.000 Tokens setzen.

---

## Projektstruktur

```text
unified_chat_hub_0/
├─ manifest.json      # MV3-Konfiguration, Berechtigungen, Content Script, Commands
├─ content.js         # Hauptlogik: Sidebar, Prompt-CRUD, Quickbar, History, Import/Export, Tools
├─ content.css        # Sidebar/Quickbar Styling
├─ background.js      # Shortcut-Weiterleitung an aktiven Tab
├─ popup.html/.js     # kleines Popup (u.a. Sidebar-Toggle)
├─ options.html/.js   # Einstellungen: Sync + Preise
└─ README.md
```

---

## Hinweise
- Fokus ist aktuell auf **Chrome**.
- Speicherung standardmäßig lokal; Sync ist optional und hat Quoten-Limits von `chrome.storage.sync`.
- Da ChatGPT/Gemini ihre DOM-Strukturen ändern können, sind Selektoren bewusst defensiv gehalten – gelegentlich sind Anpassungen nötig.

---

## Nächste sinnvolle Schritte
1. Preisprofile pro Modell/Provider (statt globaler Input/Output-Preise)
2. Makro-Engine (Prompt-Ketten mit Variablenfluss)
3. Multi-Provider-Vergleichsansicht (parallel auslösen, nebeneinander erfassen)
4. Erweiterte Import/Export-Versionierung

