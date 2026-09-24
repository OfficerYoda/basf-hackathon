# Skill Radar

Kleine Go/Postgres-Anwendung zur Pflege von Mitarbeitern, ihren selbst eingeschätzten Skills und gemeinsamen Wissensartikeln.

## Start

Voraussetzungen: Go 1.24+ und Docker.

```sh
docker compose up -d
cp .env.example .env
go run ./backend seed
go run ./backend
```

Die Anwendung lädt `.env` automatisch. Die Weboberfläche läuft unter <http://localhost:8080>, der Health-Endpunkt unter <http://localhost:8080/health>. Das Schema wird beim Start automatisch angelegt. Anhänge werden im lokalen Verzeichnis aus `ATTACHMENT_DIR` gespeichert. `go run ./backend seed` ersetzt den Datenbestand reproduzierbar durch 20 Demo-Mitarbeiter, 12 Wissensartikel und sieben Anhänge.

## Entwicklung

```sh
go test ./...
go vet ./...
```

Die JSON-API liegt unter `/api/employees` und `/api/articles`. Anhänge werden per Multipart-Upload an `/api/articles/{id}/attachments` angehängt und über `/api/attachments/{id}` heruntergeladen oder gelöscht.

`GET /api/search` liefert getrennte Arrays `employees` und `articles`. `q` sucht ohne Beachtung der Groß-/Kleinschreibung in Mitarbeiternamen sowie Artikeltitel und Markdown-Inhalt. Skills werden als wiederholte Parameter übergeben, zum Beispiel `skills=python&skills=postgresql`; `mode=and` (Standard) verlangt alle, `mode=or` mindestens einen Skill. Freitext und Skill-Filter müssen beide passen. Eine Anfrage ohne Freitext und Skills liefert alle Einträge in ihrer normalen Reihenfolge.

`PUT /api/skills/{name}` legt einen Skill-Namen in der gemeinsamen Vokabular-Tabelle an (idempotent, ohne Body) — nützlich, um einen Skill für Artikel nutzbar zu machen, bevor ihn ein Mitarbeiter trägt. `DELETE /api/skills/{name}` entfernt ihn wieder; solange er noch bei einem Mitarbeiter oder Artikel hinterlegt ist, liefert das 409.
