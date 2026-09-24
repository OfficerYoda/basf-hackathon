# Skill Radar — developer Makefile
#
# Stack:
#   - Postgres 17            → docker compose (host port 5432)
#   - Go backend (:8080)     → runs in a golang:1.24 container (no local Go needed),
#                              reaching host services via host.docker.internal
#   - React/Vite frontend    → runs locally with npm (proxies /api + /health to :8080)
#
# Secrets live in .env (gitignored). Copy .env.example to .env and fill in
# ANTHROPIC_API_KEY (the SAP Hyperspace proxy token) to enable the assistant.
#
# Quick start:  make up   (db + backend)   then   make front   (in another terminal)
# Everything:   make dev  (db + backend, then frontend in the foreground)

SHELL := /bin/bash

# Container image / name for the Go backend
GO_IMAGE      := golang:1.24-alpine
API_CONTAINER := basf-api
PROJECT_DIR   := $(shell pwd)

# Postgres runs via docker compose on host port 5433 (5432 is taken by a
# native Postgres on this machine). See docker-compose.yml.
PG_CONTAINER := basf-pg
PG_PORT      := 5433

# Backend runtime config. Inside Docker the host is reachable at
# host.docker.internal (NOT localhost), so DB and the Hyperspace proxy are
# addressed that way here.
DB_URL   := postgres://skill_radar:skill_radar@host.docker.internal:$(PG_PORT)/skill_radar?sslmode=disable
BASE_URL := http://host.docker.internal:6655

# Pull ANTHROPIC_API_KEY out of .env without exporting the rest of the file.
API_KEY := $(shell grep -E '^ANTHROPIC_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d ' ')

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

.PHONY: db
db: ## Start Postgres (docker compose, :5433) and wait until healthy
	docker compose up -d postgres
	@echo "waiting for postgres to accept connections..."
	@until docker exec $(PG_CONTAINER) pg_isready -U skill_radar -q 2>/dev/null; do sleep 1; done
	@echo "postgres is ready on 127.0.0.1:$(PG_PORT)"

.PHONY: db-stop
db-stop: ## Stop Postgres (keeps data volume)
	docker compose stop postgres

.PHONY: db-reset
db-reset: ## Destroy Postgres AND its data volume, then restart fresh
	docker compose down
	-docker volume rm 250b9be87177ee1a92df255e7c2f146090b517f1fde59292862032c2b1f64cb2 2>/dev/null || true
	$(MAKE) db

# ---------------------------------------------------------------------------
# Backend (Go, in a container — no local Go toolchain required)
# ---------------------------------------------------------------------------

.PHONY: api
api: db ## Start the Go backend in a container on :8080 (depends on db)
	-docker rm -f $(API_CONTAINER) 2>/dev/null || true
	docker run -d --name $(API_CONTAINER) \
		--add-host host.docker.internal:host-gateway \
		-v "$(PROJECT_DIR)":/src -w /src \
		-p 127.0.0.1:8080:8080 \
		-e GOFLAGS=-mod=mod \
		-e ADDR=:8080 \
		-e ATTACHMENT_DIR=attachments \
		-e DATABASE_URL="$(DB_URL)" \
		-e BASE_URL="$(BASE_URL)" \
		-e ANTHROPIC_API_KEY="$(API_KEY)" \
		$(GO_IMAGE) sh -c "go run ./backend"
	@echo "backend starting on http://127.0.0.1:8080 (logs: make api-logs)"

.PHONY: api-logs
api-logs: ## Follow backend container logs
	docker logs -f $(API_CONTAINER)

.PHONY: api-stop
api-stop: ## Stop and remove the backend container
	-docker rm -f $(API_CONTAINER) 2>/dev/null || true

.PHONY: test
test: ## Run backend go vet + tests in the container
	docker run --rm -v "$(PROJECT_DIR)":/src -w /src \
		-e GOFLAGS=-mod=mod $(GO_IMAGE) \
		sh -c "go vet ./backend/ && go test ./backend/"

# ---------------------------------------------------------------------------
# Frontend (Vite dev server, local npm)
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install frontend dependencies
	cd frontend && npm install

.PHONY: front
front: ## Start the Vite dev server (proxies /api + /health to :8080)
	cd frontend && npm run dev

.PHONY: build
build: ## Production build of the frontend
	cd frontend && npm run build

# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

.PHONY: up
up: api ## Start db + backend in the background
	@echo ""
	@echo "db + backend are up. Now run 'make front' in another terminal."

.PHONY: dev
dev: api front ## Start db + backend (background), then frontend (foreground)

.PHONY: start
start: api ## ONE COMMAND: start db + backend + frontend; Ctrl-C stops everything
	@echo ""
	@echo "db + backend up on :8080 — starting frontend (Ctrl-C stops everything)"
	@trap '$(MAKE) --no-print-directory stop' EXIT INT TERM; \
		cd frontend && npm run dev

.PHONY: stop
stop: api-stop db-stop ## Stop backend + database

.PHONY: down
down: api-stop db-stop ## Stop backend and database (keeps data volume)
