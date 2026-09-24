# Skill Radar

Kleine Go/Postgres-Anwendung zur Pflege von Mitarbeitern und ihren selbst eingeschätzten Skills.

## Start

Voraussetzungen: Go 1.24+ und Docker.

```sh
docker compose up -d
export DATABASE_URL='postgres://skill_radar:skill_radar@localhost:5432/skill_radar?sslmode=disable'
go run ./backend seed
go run ./backend
```

Die Weboberfläche läuft unter <http://localhost:8080>, der Health-Endpunkt unter <http://localhost:8080/health>. Das Schema wird beim Start automatisch angelegt. `go run ./backend seed` ersetzt den Datenbestand reproduzierbar durch drei Demo-Mitarbeiter.

## Entwicklung

```sh
go test ./...
go vet ./...
```

Die JSON-API liegt unter `/api/employees` und unterstützt `GET`, `POST`, `PUT` und `DELETE`.
