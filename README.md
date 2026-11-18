# KG & AG Lernarena – GitHub / Netlify

Eine eigenständige, mobilfähige Lernplattform zu **Kommanditgesellschaft und Aktiengesellschaft** auf Basis der bereitgestellten Unterrichtsskripte, Übungsaufgaben und Lernübersichten.

**Technik:** HTML/CSS/JavaScript ohne Frontend-Framework, Netlify Functions (Node.js) und Netlify Blobs. **Keine Supabase-Instanz, kein SQL-Editor, keine `AUTH`-Umgebungsvariable, kein fest eingebautes Passwort**. Für die Schülerinnen und Schüler ist nur die Netlify-Adresse erforderlich.

## A. In fünf Schritten veröffentlichen

1. **ZIP entpacken**. In den entpackten Ordner `KG_AG_Lernarena_Netlify` wechseln.
2. **Neues GitHub-Repository** erstellen, z. B. `kg-ag-lernarena`. Die **Inhalte** des entpackten Ordners direkt in die oberste Ebene des Repositories laden. **Nicht die ZIP selbst als einzige Datei hochladen.** `package.json`, `netlify.toml`, `public/` und `netlify/functions/` müssen direkt im Repository liegen.
3. Unter <https://app.netlify.com/> ein neues Projekt über **Add new project → Import an existing project → GitHub** erstellen und dieses Repository auswählen.
4. Die Einstellungen aus `netlify.toml` werden automatisch übernommen: **Publish directory = `public`**, **Functions directory = `netlify/functions`**. Für die statische Website gibt es **keinen Build-Befehl**. Netlify installiert die Node-Pakete anhand von `package.json` automatisch. Node 22 wird über `.nvmrc` angefordert.
5. **Deploy** ausführen. Nach der Veröffentlichung den Netlify-Link öffnen und unter „Anmelden → Konto erstellen“ einen Test-Nickname registrieren. Danach mit demselben Nickname auf einem zweiten Browser/Gerät anmelden und eine Karte lernen. Den Fortschritt prüfen.

Die Netlify-Blobs-Stores werden **bei den ersten Registrierungen und Speicherzugriffen automatisch erstellt**. Weder SQL-Befehle noch eine manuell angelegte Datenbank oder ein allgemeiner `AUTH`-Schlüssel sind nötig.

### Wenn du die Seite aktualisierst

Änderungen am Repository nach GitHub pushen; Netlify erstellt automatisch ein neues Deployment. Bei siteweiten Blobs bleiben Konten und Lernstände **über Deployments hinweg** erhalten. Bewahre die Netlify-Site als dasselbe Projekt auf; eine komplett neue Site besitzt ein anderes Blobs-Datenlager.

## B. Lernfunktionen

- **189 Fachkarten** in **11 Themenstapeln** zu KG-Gründung, Handelsregister, Haftung, Geschäftsführung, Vertretung, KG-Gewinnverteilung/OSF sowie AG-Gründung, Organe, Aktienarten, Kapitalerhöhung, Bezugsrecht, Stimmrechten, Sperrminorität, Rücklagen und AG-Gewinnverwendung.
- **Spaced Repetition**: vier Bewertungen (`Noch einmal`, `Unsicher`, `Fast sicher`, `Sicher`) mit selbst veränderbaren Intervallen, Multiplikator und Maximalabstand. Fällige Karten werden erneut angezeigt.
- **Wissensduell**: 40 zusätzliche Multiple-Choice-Fragen, jeweils acht zufällig gezogene Fragen. KG-/AG-/gemischte Duelle; ohne Zeitdruck oder als 90-Sekunden-Blitzduell mit Erklärung nach jeder Frage.
- **Gamification**: XP und Level, Antwortserien, 14 Abzeichen, Lernserie an aufeinanderfolgenden Tagen, drei täglich neu verfügbare Missionen mit XP-Boni, Levelaufstiegs-Animation, Duellstatistiken und sichtbare Stapelfortschritte. Kein öffentliches Schüler-Ranking; keine Wettbewerbsdaten anderer Lernender.
- **Eigene Stapel und Karten** erstellen, bearbeiten, verschieben oder löschen. Bestehende Karten können bearbeitet werden.
- **Export/Import**: kompletter Stand einschließlich XP, Lernintervallen und Bewertungen als JSON; einzelne Stapel/Karten als CSV oder Anki-TSV. Bei CSV/TSV wird kein Benutzerpasswort exportiert.
- **Responsive Layout**, nutzbar am Desktop, Tablet und Smartphone. PWA-/Startbildschirm-Funktion auf unterstützten Geräten. Der Gastmodus funktioniert nach Laden der App auch ohne Internet; mit Konto werden Änderungen bei verfügbarer Verbindung synchronisiert.

## C. Gastmodus und Benutzerkonten

**Gast:** ohne Anmeldung beginnen. Lernstände und Kartenänderungen landen in `localStorage` des jeweiligen Browsers. Gerätewechsel im Gastmodus nur mittels JSON-Export/-Import.

**Konto:** „Anmelden → Konto erstellen“ aufrufen, selbstgewählten Nickname (3–24 Buchstaben, Ziffern, `_` oder `-`) und Passwort (10–128 Zeichen) wählen. Ein Gaststand kann übernommen werden. Danach speichern Netlify Functions den Lernstand in Netlify Blobs. Mit Nickname und Passwort können Schülerinnen und Schüler auf einem zweiten Gerät weiterarbeiten. Ein vorhandener Gaststand kann beim Login wahlweise hinzugefügt werden.

**Keine E-Mail nötig.** Weil der Kurs bewusst nur Nickname und Passwort kennt, **gibt es keine automatische Passwort-Wiederherstellung**. Schüler sollten ihre Passwörter sicher aufbewahren und regelmäßig ein JSON-Backup exportieren.

### Synchronisation und Konflikte

- Speicherung über HTTPS und ein sicheres `HttpOnly`/`SameSite`-Sitzungscookie (30 Tage, bis zur Abmeldung); es wird kein Klartext-Passwort im Browser gespeichert.
- Im Konto werden Änderungen auch lokal zwischengespeichert; der Server wird mit Netlify Blobs synchronisiert. Bei unterbrochener Internetverbindung kann ein lokaler Entwurf erhalten bleiben.
- Ändert sich derselbe Lernstand gleichzeitig auf zwei Geräten, erkennt die App einen **Versionskonflikt**. Sie fragt, ob der lokale Stand überschrieben oder der neuere Cloud-Stand geladen werden soll. Der abweichende lokale Stand wird vorher als Browser-Backup abgelegt. Es gibt keine unsichtbare Last-Write-Wins-Übernahme.
- **Wichtig für Schüler:** Nicht gleichzeitig auf zwei Geräten verschiedene Karten bearbeiten, ohne die Synchronisation abzuwarten.

## D. Datenverarbeitung und Sicherheit

- **Netlify Blobs** speichert auf dem Server in getrennten Stores: `kgag-accounts-prod`, `kgag-sessions-prod`, `kgag-progress-prod`, `kgag-loginlimits-prod` (Vorschau-Deployments nutzen abweichende Sandbox-Stores).
- Passwörter werden **mit scrypt und einem eigenen zufälligen Salt je Nickname** gehasht. Session-Tokens sind 256-Bit-Zufallswerte; in Blobs wird nur ihr SHA-256-Hash als Schlüssel gespeichert.
- Die Cloud-Schnittstelle akzeptiert keine beliebig vom Browser angegebenen Benutzer- oder Blobs-Schlüssel. Nach Authentifizierung wird der Datensatz aus der Sitzung ermittelt.
- Registrierungen verwenden atomare `onlyIfNew`-Schreibzugriffe; Änderungen per `ETag`/`onlyIfMatch`. Blobs-Zugriffe werden **strongly consistent** ausgeführt.
- Der Login begrenzt wiederholt falsche Passworteingaben je Nickname. Cross-Origin-POST-Anfragen werden abgelehnt.
- Kein allgemeiner `AUTH`-Schlüssel und keine Umgebungsvariable für die Registrierung erforderlich. Netlify stellt die technische Zugriffsberechtigung seiner Functions auf die Blobs-Stores bereit.
- **Hinweis:** Netlify Blobs ist ein Objektspeicher, keine relationale Datenbank. Diese Lösung ist für einen überschaubaren Lernkurs gedacht. Bei sehr großer gleichzeitiger Nutzung, schulweiten Account-/Rechtemanagement-Anforderungen oder gesetzlichen Vorgaben ist eine gesonderte Prüfung von Datenschutz, Belastung, Kosten und Backupstrategie erforderlich.
- Die Betreiberseite sollte vor dem Einsatz mit Minderjährigen die eigenen schulischen Datenschutzvorgaben und Netlifys Auftragsverarbeitung/Hosting-Bedingungen prüfen.
- Die per Browser angezeigten XP sind Lernmotivation und **keine manipulationssicheren Leistungsnachweise**. Für benotete Tests darf man diese Werte nicht unkontrolliert als Prüfungsergebnis übernehmen.

## E. Verzeichnisstruktur

```text
KG_AG_Lernarena_Netlify/
├── public/
│   ├── index.html              # Website
│   ├── app.js                  # Lernmodus, Editor, Quiz, XP, Cloud-Sync
│   ├── style.css               # Responsive Darstellung
│   ├── sw.js                   # Offline-Cache der öffentlichen Dateien
│   ├── manifest.webmanifest    # Installierbare Web-App
│   └── assets/
│       ├── decks.js            # 189 Unterrichts-Fachkarten
│       ├── challenges.js       # 40 Wissenstest-Fragen
│       └── icon.svg
├── netlify/functions/api.mjs    # Authentifizierung, Sessions, Cloud-Sync
├── netlify.toml                # Netlify-Konfiguration
├── package.json               # @netlify/blobs v11.1.9
├── .nvmrc                      # Node 22
└── README.md
```

## F. Lokaler Test (optional)

Mit Node.js 22 (und Internetzugang zu npm) im Projektordner:

```bash
npm install
npx netlify-cli dev
```

Anschließend die von Netlify CLI angezeigte localhost-Adresse öffnen. Netlify Dev verwendet eine lokale Blobs-Testumgebung; die Live-Konten werden dadurch nicht verändert. Für die serverseitigen Tests: `npm test`. Die Browser-E2E-Tests benötigen zusätzlich Python, Playwright und Chromium. *Ein lokaler Test ohne die Netlify-CLI oder ohne Mockserver kann keine echten Cloud-Konten verwalten.*

## G. Fachliche Hinweise

Die Inhalte der 189 Fachkarten orientieren sich an den bereitgestellten KG-/AG-Skripten, Übungsaufgaben und dem besprochenen Klausurniveau. Die 40 Zusatzfragen im Wissensduell sind ergänzende Lernfragen, **keine Original-Klausuraufgaben**. Die Anwendung ersetzt die Gesetzessammlung und Formelsammlung nicht; bei rechtlichen Fällen gilt weiterhin die genaue gesetzliche Prüfung, bei Rechenaufgaben die vollständige Herleitung.

## H. Hinweise bei Fehlern

- **Konto funktioniert nicht:** Netlify-Deployment öffnen und unter **Logs / Functions** Fehler prüfen; sicherstellen, dass Netlify die Abhängigkeit `@netlify/blobs` installiert hat.
- **Anmeldung auf zweitem Gerät führt zu leerem Stand:** zuerst prüfen, ob mit derselben Netlify-Site und identischem Nickname gearbeitet wird; am Ausgangsgerät Synchronisationsstatus prüfen; nötigenfalls JSON-Backup importieren.
- **Netlify Vorschau zeigt nicht dieselben Konten:** gewollt – Vorschau-Kontexte nutzen getrennte Sandbox-Stores.
- **Passwort vergessen:** Es gibt bewusst keinen Reset ohne E-Mail oder Administrator. Über das betroffene Gerät ggf. JSON sichern und ein neues Konto anlegen.
- **Daten kommen nach Wechsel des Netlify-Projekts nicht an:** Blobs-Stores gehören zur jeweiligen Netlify-Site. JSON-Daten aus der bisherigen Site sichern und auf der neuen importieren.

**Stand:** November 2026. Ein echter Produktivtest auf deiner späteren Netlify-Site ist erst nach deinem Deployment möglich.
