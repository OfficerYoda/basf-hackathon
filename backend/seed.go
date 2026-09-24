package main

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
)

func seed(ctx context.Context, db *sql.DB, attachmentDir string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, `TRUNCATE attachments, article_contributors, article_skills, articles, employee_skills, employees, skills RESTART IDENTITY CASCADE`); err != nil {
		return err
	}
	employees := []Employee{
		{Name: "Ada Lovelace", Email: "ada@example.com", Department: "Digitalization", Skills: []Skill{{Name: "python", Rating: 9}, {Name: "mathematics", Rating: 10}, {Name: "postgresql", Rating: 8}}},
		{Name: "Grace Hopper", Email: "grace@example.com", Department: "Engineering", Skills: []Skill{{Name: "cobol", Rating: 10}, {Name: "leadership", Rating: 8}}},
		{Name: "Linus Torvalds", Email: "linus@example.com", Department: "Infrastructure", Skills: []Skill{{Name: "linux", Rating: 10}, {Name: "git", Rating: 10}}},
	}
	for _, employee := range employees {
		var id int64
		if err = tx.QueryRowContext(ctx, `INSERT INTO employees (name, email, department) VALUES ($1, $2, $3) RETURNING id`, employee.Name, employee.Email, employee.Department).Scan(&id); err != nil {
			return err
		}
		if err = saveSkills(ctx, tx, id, employee.Skills); err != nil {
			return err
		}
	}
	articles := []ArticleInput{
		{Title: "PostgreSQL im Notfall wiederherstellen", Description: "Kurzanleitung für die Wiederherstellung der Skill-Radar-Datenbank.", Content: "# Wiederherstellung\n\n1. Backup prüfen\n2. Datenbank stoppen\n3. Restore ausführen", Skills: []string{"postgresql", "python"}, ContributorIDs: []int64{1, 2}},
		{Title: "Git-Änderungen sicher veröffentlichen", Description: "Der gemeinsame Ablauf für kleine, nachvollziehbare Änderungen.", Content: "# Git-Ablauf\n\n- Branch aktualisieren\n- Tests ausführen\n- Commit erstellen", Skills: []string{"git"}, ContributorIDs: []int64{3}},
	}
	for _, article := range articles {
		var id int64
		if err = tx.QueryRowContext(ctx, `INSERT INTO articles (title, description, content) VALUES ($1, $2, $3) RETURNING id`, article.Title, article.Description, article.Content).Scan(&id); err != nil {
			return err
		}
		if err = saveArticleReferences(ctx, tx, id, article); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	entries, err := os.ReadDir(attachmentDir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "attachment-") {
			if err := os.Remove(filepath.Join(attachmentDir, entry.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}
