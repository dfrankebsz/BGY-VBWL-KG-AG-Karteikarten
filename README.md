# Karteikartenstudio KG & AG

Eine vollständig statische, responsive Web-App mit **189 vorgefertigten Lernkarten in 11 Themenstapeln** zu den bereitgestellten Lernskripten und Übungsaufgaben für KG- und AG-Recht.

Die Anwendung benötigt **keinen Server, keine Datenbank, keinen Login, keine npm-Pakete, keinen Build-Schritt** und lädt keine externen JavaScript- oder Bildbibliotheken. Sie kann auf GitHub versioniert und bei Netlify bereitgestellt werden.

## Funktionen

- **Spaced Repetition** mit vier Bewertungen: „Noch einmal“, „Unsicher“, „Fast sicher“, „Sicher“.
- Wiederholungsabstände für alle Bewertungen **individuell einstellbar** (Minuten, Stunden, Tage, Wochen); zusätzlicher Lernfaktor und Höchstintervall.
- Lernkarten mit Frage, Erklärung, konkretem Beispiel/Rechenweg, Merksatz und Herkunftsangabe.
- **11 vorgefertigte Stapel mit 189 Karten** (KG-Gründung, KG-Haftung, Rechte und Pflichten, KG-Gewinnverwendung, AG-Gründung, Organe, Kapitalerhöhung, Bezugsrechte, Stimmrechte, AG-Gewinnverwendung, Transfers).
- Alle vorgefertigten Karten können **bearbeitet, verschoben und gelöscht** werden; außerdem eigene Karten und Stapel anlegen.
- Suchfunktion und Filter nach neu, fällig oder selbst angelegt.
- Lernfortschritt je Stapel und letzte sieben Tage.
- **JSON**-Export/-Import eines oder aller Stapel; vollständiges JSON-Backup enthält Lernstände und Einstellungen.
- **CSV**-Export zur Bearbeitung in Excel/LibreOffice und anschließender Re-Import; Karten-IDs erhalten Änderungen an bestehenden Karten.
- **TSV**-Export für den Import in Anki (jeweils Vorderseite und Rückseite).
- Smartphone- und Desktopansicht; Tastaturbedienung mit Leertaste und 1–4.
- Service Worker für die Offline-Nutzung nach dem ersten erfolgreichen Laden über HTTPS.

## Deployment über GitHub und Netlify

1. Das ZIP-Archiv entpacken.
2. Bei GitHub ein neues Repository erstellen, z. B. `kg-ag-karteikarten`.
3. **Den Inhalt des entpackten Projektordners** ins Repository hochladen. Wichtig: `index.html` muss im Stammverzeichnis des Repositories liegen (nicht in einem zusätzlichen Unterordner).
4. In Netlify: **Add new project → Import an existing project → GitHub**.
5. Das Repository auswählen. Es ist kein Build nötig. Einstellungen:

   | Einstellung | Wert |
   |---|---|
   | Build command | **leer lassen** |
   | Publish directory | `.` (Punkt, Stammverzeichnis) |
   | Branch | `main` (oder gewählte Branch) |

6. **Deploy** starten. Netlify erzeugt eine URL wie `https://DEIN-NAME.netlify.app`.
7. Diesen Link im Lernkurs, auf Lernsax oder über QR-Code teilen.

Alternativ kannst du den entpackten Projektordner direkt per **Netlify Drop** veröffentlichen. Bei Änderungen an einem GitHub-Repository kann Netlify automatisch neu deployen.

### Einbindung in einen bestehenden Lernkurs

Wenn das Lernmanagementsystem eingebettete Seiten zulässt, ist auch eine Einbettung möglich:

```html
<iframe
  title="Karteikartenstudio KG und AG"
  src="https://DEIN-NAME.netlify.app/"
  width="100%"
  height="850"
  style="border:0; border-radius:16px;"
  loading="lazy">
</iframe>
```

Ansonsten ist ein normaler Link meist unkomplizierter. Die Einbettung hängt von den Einstellungen des Lernmanagementsystems ab.

## Datenspeicherung und Datenschutz

**Alle Lernstände, Kartenänderungen, eigenen Stapel und Einstellungen werden ausschließlich im lokalen Browser-Speicher (`localStorage`) abgelegt.**

- Es gibt **keine automatische Synchronisierung** zwischen Smartphone, Schul-PC und privatem Notebook.
- Lehrkräfte haben **keinen zentralen Einblick** in individuelle Lernstände.
- Beim Löschen der Browserdaten oder beim Wechsel des Geräts können gespeicherte Lernstände verloren gehen.
- Empfohlen: regelmäßig **Export → Alle Stapel → JSON** herunterladen. Diese Sicherung über **Import → JSON** auf einem anderen Gerät importieren.
- Bei gemeinschaftlich genutzten Schulgeräten beachten: Wenn mehrere Personen dasselbe Browserprofil benutzen, können sie dieselben lokalen Daten sehen und verändern. Vor der Nutzung sollten getrennte Browserprofile oder private Sitzungen eingesetzt werden (private Sitzungen behalten den Stand allerdings nicht langfristig).

Für **kontoübergreifende Synchronisierung, Lehrkräfte-Dashboard oder gemeinsame Klassenstände** wäre später eine Datenbank mit Authentifizierung notwendig. Das ist bewusst nicht Bestandteil dieser datensparsamen Version.

## Wiederholungslogik

Die Anwendung arbeitet **nach dem Spaced-Repetition-Prinzip**, nicht mit einer bitgenauen Implementierung des Anki-Schedulers.

Standard-Startabstände:

| Bewertung | Nächste Wiederholung |
|---|---|
| Noch einmal | 3 Minuten |
| Unsicher | 12 Stunden |
| Fast sicher | 3 Tage |
| Sicher | 7 Tage |

Bei wiederholt sicher bewerteten Karten verlängert sich das Intervall abhängig von der vorherigen Zeit und dem einstellbaren Wachstumsfaktor (Standard 1,8). „Noch einmal“ setzt die Serie zurück; bei einer laufenden Lerneinheit erscheint die Karte außerdem noch einmal am Ende der Runde (maximal zweimal zusätzlich). Die Intervalle und die Obergrenze können im Reiter **Einstellungen** geändert werden.

**Karten gelten als „sicher“**, wenn sie mindestens drei erfolgreiche Wiederholungen und mindestens sieben Tage Intervall erreicht haben.

## Arbeiten mit Stapeln und Karten

- **Neuer Stapel:** „+ Stapel“ auf der Übersicht oder in der Verwaltung.
- **Neue Karte:** „+ Karte“; Vorderseite und Rückseite sind Pflicht. Beispiel und Merksatz sind optional.
- **Karte verschieben:** „Karten verwalten → Bearbeiten → Stapel“ ändern.
- **Lernstand bewerten:** Karte öffnen, selbst antworten, „Antwort aufdecken“, 1–4 auswählen.
- **Karte exportieren:** „Export“ öffnen und Stapel + Dateiformat wählen.
- **Karten in Tabellenkalkulation bearbeiten:** Als CSV exportieren, in Excel bearbeiten, **Spalten `Karten-ID` und `Stapel-ID` nicht verändern**, erneut als Semikolon-CSV speichern, in der App importieren.
- **Anki:** TSV-Datei im Anki-Import als tabulatorgetrennte Datei mit den Feldern Vorderseite und Rückseite importieren; wenn möglich HTML-Feldformat erlauben, um Zeilenumbrüche darzustellen.

## Dateien

```text
index.html             Einstiegspunkt und Editierdialoge
style.css              Responsive Layout
app.js                 Lernlogik, Datenhaltung, Editor, Import/Export
assets/decks.js        Vorkonfigurierte Stapel und Karten (wird direkt geladen)
assets/decks.json      Gleiche Inhalte als lesbare JSON-Datenquelle
assets/icon.svg        Kleines App-Icon
manifest.webmanifest   Installierbare Web-App
sw.js                  Offline-Zwischenspeicher
netlify.toml           Netlify-Einstellungen
```

Wenn du die Basisinhalte **vor der Veröffentlichung** direkt ändern möchtest, bearbeite `assets/decks.json` und übertrage den identischen JSON-Inhalt in `assets/decks.js` hinter die Zeichenfolge `window.KG_AG_LIBRARY = `; der Abschluss ist ein Semikolon. Einfacher ist das Bearbeiten über die Oberfläche – Änderungen dort gelten allerdings zunächst nur im jeweiligen Browser und werden **nicht automatisch** ins GitHub-Repository geschrieben.

## Fachliche Grundlage

Die Karten paraphrasieren die im Gespräch bereitgestellten Kursmaterialien und Aufgaben zu Einzelunternehmen, KG-Gründung, KG-Haftung, Geschäftsführung/Vertretung, KG-Gewinnverwendung, AG-Gründung, AG-Organen, Kapitalerhöhung/Bezugsrechten/Stimmrechten sowie AG-Gewinnverwendung und offener Selbstfinanzierung. Sie orientieren sich an den dort verwendeten Rechenmodellen, Fachbegriffen und Gesetzesverweisen. Bei Rechtsfragen sind die gültige Gesetzessammlung und die konkrete Aufgabenstellung maßgeblich.

## Hinweise für Lehrkräfte

- Vor einer Klausur fachliche Karten stichprobenartig gegen die ausgegebene Gesetzessammlung und die Unterrichtsfassung des Skripts prüfen.
- Die App stellt keine rechtsverbindliche Beratung dar.
- Die Kartenauswahl ist als Ergänzung zu den vollständigen Übungsblättern gedacht; komplexe Prüfungsaufgaben bleiben wichtig.

## Technische Voraussetzungen

Aktueller Browser mit Unterstützung für `localStorage`, `dialog` und modernes JavaScript (Chrome/Edge/Firefox/Safari). Hosting über HTTPS ist für die Offline-Installation empfohlen und wird bei Netlify automatisch angeboten.
