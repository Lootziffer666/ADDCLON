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
- ✅ Export als Markdown (menschenlesbar) **und** JSON (Backup-kompatibel)
- ✅ Antwort-Tools (Copy / Clean / Translate / Summarize)
- ✅ Sidebar Toggle via Shortcut `Ctrl+Shift+Y`
- ✅ Chrome Storage lokal + optional `chrome.storage.sync`
- ✅ Eigener Tab mit Free/Pro-Limits (qualitative Übersicht)
- ✅ Manueller Free/Pro-Limit-Tracker (Restkontingent + Reset-Datum je Plattform)

### Noch offen / spätere Ausbaustufen
- ⏳ Automatische Aktualisierung der konkreten Free/Pro-Limits via Provider-Seiten
- ⏳ Themen-Tagging + Ordner für große Prompt-Bibliotheken
- ⏳ Session-Zusammenfassungen pro Chat-Verlauf

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
- Datenexport als Markdown (gut lesbar/teilbar) oder JSON.
- Import prüft und normalisiert Daten (IDs, Strings, Zahlen/Fallbacks), ungültige Einträge werden verworfen.
- Dateiname nutzt automatisch ein geschätztes **Hauptthema** statt eines generischen Chat-Namens (wenn erkennbar).

Warum weiterhin JSON?
- JSON eignet sich als stabiles Maschinenformat für verlustfreies Backup/Restore.
- JSON ist besser für spätere Migrationen oder automatisierte Verarbeitung.
- Markdown ist primär für Menschen – JSON primär für saubere Datenübernahme.

### 6) Antwort-Tools
- **Copy**: Antworttext in Zwischenablage.
- **Clean**: Grobe Bereinigung von Antworttext.
- **Translate** / **Summarize**: Hilfsaktionen für schnelle Weiterverarbeitung.

### 7) Free/Pro-Limits
- Eigener Tab mit praxisnaher Übersicht für ChatGPT/Gemini (Free vs. Pro).
- Fokus auf schneller Orientierung statt nur API-Kostenrechnung.
- Integrierter Tracker für Restkontingent (je Plattform), inkl. Plan-Auswahl und Reset-Datum.
- Beim protokollierten Senden wird der Restzähler der aktuellen Plattform automatisch um 1 reduziert.

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

## Nächste wirklich sinnvolle Schritte (praxisnah)
1. **Live-Limit-Tracker**: Provider-Limits automatisch erfassen/aktualisieren (mit Datum + Quelle).
2. **Theme-Detection**: Hauptthema pro Session zuverlässiger erkennen und als Tag speichern.
3. **Prompt-Qualitätshilfen**: One-click „Prompt verbessern“, „kürzen“, „strukturieren“.
4. **Sichere Backups**: optionale verschlüsselte Exporte für sensible Inhalte.
