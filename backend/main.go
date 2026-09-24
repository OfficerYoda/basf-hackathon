package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func loadEnv(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return fmt.Errorf("invalid environment line %q", line)
		}
		key = strings.TrimSpace(key)
		if _, exists := os.LookupEnv(key); !exists {
			if err := os.Setenv(key, strings.TrimSpace(value)); err != nil {
				return err
			}
		}
	}
	return nil
}

func main() {
	if err := loadEnv(".env"); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Fatal(err)
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	attachmentDir := os.Getenv("ATTACHMENT_DIR")
	if attachmentDir == "" {
		attachmentDir = "attachments"
	}
	if err := os.MkdirAll(attachmentDir, 0700); err != nil {
		log.Fatalf("create attachment directory: %v", err)
	}
	if _, err = db.ExecContext(ctx, schema); err != nil {
		log.Fatalf("initialize database: %v", err)
	}
	if len(os.Args) > 1 && os.Args[1] == "seed" {
		if err := seed(ctx, db, attachmentDir); err != nil {
			log.Fatal(err)
		}
		log.Println("demo data seeded")
		return
	}
	address := os.Getenv("ADDR")
	if address == "" {
		address = ":8080"
	}
	agent := newAgentService(&postgresStore{db: db}, os.Getenv("ANTHROPIC_API_KEY"), os.Getenv("BASE_URL"), os.Getenv("LLM_MODEL"))
	if !agent.enabled() {
		log.Println("ANTHROPIC_API_KEY or BASE_URL not set — /api/agent will return 503")
	}
	server := &http.Server{
		Addr:              address,
		Handler:           newHandler(&postgresStore{db: db}, attachmentDir, agent),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("listening on http://localhost%s", address)
	log.Fatal(server.ListenAndServe())
}
