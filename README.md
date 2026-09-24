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

Die Anwendung lädt `.env` automatisch. Die Weboberfläche läuft unter <http://localhost:8080>, der Health-Endpunkt unter <http://localhost:8080/health>. Das Schema wird beim Start automatisch angelegt. Anhänge werden im lokalen Verzeichnis aus `ATTACHMENT_DIR` gespeichert. `go run ./backend seed` ersetzt den Datenbestand reproduzierbar durch drei Demo-Mitarbeiter und zwei Wissensartikel.

## Entwicklung

```sh
go test ./...
go vet ./...
```

Die JSON-API liegt unter `/api/employees` und `/api/articles`. Anhänge werden per Multipart-Upload an `/api/articles/{id}/attachments` angehängt und über `/api/attachments/{id}` heruntergeladen oder gelöscht.
