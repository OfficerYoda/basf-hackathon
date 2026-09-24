package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type Skill struct {
	Name   string `json:"name"`
	Rating int    `json:"rating"`
}

type Employee struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Email      string  `json:"email"`
	Department string  `json:"department,omitempty"`
	Skills     []Skill `json:"skills"`
}

type Article struct {
	ID           int64        `json:"id"`
	Title        string       `json:"title"`
	Description  string       `json:"description"`
	Content      string       `json:"content"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
	Skills       []string     `json:"skills"`
	Contributors []Employee   `json:"contributors"`
	Attachments  []Attachment `json:"attachments"`
}

type Attachment struct {
	ID         int64  `json:"id"`
	ArticleID  int64  `json:"article_id"`
	Filename   string `json:"filename"`
	MIMEType   string `json:"mime_type"`
	StoredName string `json:"-"`
}

type ArticleInput struct {
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Content        string   `json:"content"`
	Skills         []string `json:"skills"`
	ContributorIDs []int64  `json:"contributor_ids"`
}

func (article *ArticleInput) normalizeAndValidate() error {
	article.Title = strings.TrimSpace(article.Title)
	article.Description = strings.TrimSpace(article.Description)
	article.Content = strings.TrimSpace(article.Content)
	if article.Title == "" || article.Description == "" || article.Content == "" {
		return errors.New("title, description and content are required")
	}
	seenSkills := map[string]bool{}
	for index := range article.Skills {
		article.Skills[index] = strings.ToLower(strings.TrimSpace(article.Skills[index]))
		if article.Skills[index] == "" {
			return errors.New("skill name is required")
		}
		if seenSkills[article.Skills[index]] {
			return fmt.Errorf("skill %q is duplicated", article.Skills[index])
		}
		seenSkills[article.Skills[index]] = true
	}
	seenContributors := map[int64]bool{}
	for _, id := range article.ContributorIDs {
		if id < 1 {
			return errors.New("invalid contributor id")
		}
		if seenContributors[id] {
			return fmt.Errorf("contributor %d is duplicated", id)
		}
		seenContributors[id] = true
	}
	if article.Skills == nil {
		article.Skills = []string{}
	}
	if article.ContributorIDs == nil {
		article.ContributorIDs = []int64{}
	}
	return nil
}

func (employee *Employee) normalizeAndValidate() error {
	employee.Name = strings.TrimSpace(employee.Name)
	employee.Email = strings.TrimSpace(employee.Email)
	employee.Department = strings.TrimSpace(employee.Department)
	if employee.Name == "" {
		return errors.New("name is required")
	}
	address, err := mail.ParseAddress(employee.Email)
	if err != nil || address.Address != employee.Email {
		return errors.New("a valid email is required")
	}
	seen := map[string]bool{}
	for index := range employee.Skills {
		skill := &employee.Skills[index]
		skill.Name = strings.ToLower(strings.TrimSpace(skill.Name))
		if skill.Name == "" {
			return errors.New("skill name is required")
		}
		if skill.Rating < 1 || skill.Rating > 10 {
			return errors.New("skill rating must be between 1 and 10")
		}
		if seen[skill.Name] {
			return fmt.Errorf("skill %q is duplicated", skill.Name)
		}
		seen[skill.Name] = true
	}
	if employee.Skills == nil {
		employee.Skills = []Skill{}
	}
	return nil
}

var errNotFound = errors.New("employee not found")
var errArticleNotFound = errors.New("article not found")
var errAttachmentNotFound = errors.New("attachment not found")
var errInvalidReference = errors.New("skill or contributor does not exist")
var errConflict = errors.New("email or skill already exists")
var errReferenced = errors.New("employee is referenced by an article")

type store interface {
	Healthy(context.Context) error
	List(context.Context) ([]Employee, error)
	Get(context.Context, int64) (Employee, error)
	Create(context.Context, Employee) (Employee, error)
	Update(context.Context, int64, Employee) (Employee, error)
	Delete(context.Context, int64) error
	ListArticles(context.Context) ([]Article, error)
	GetArticle(context.Context, int64) (Article, error)
	CreateArticle(context.Context, ArticleInput) (Article, error)
	UpdateArticle(context.Context, int64, ArticleInput) (Article, error)
	DeleteArticle(context.Context, int64) ([]Attachment, error)
	CreateAttachment(context.Context, Attachment) (Attachment, error)
	GetAttachment(context.Context, int64) (Attachment, error)
	DeleteAttachment(context.Context, int64) error
}

type postgresStore struct{ db *sql.DB }

const schema = `
CREATE TABLE IF NOT EXISTS skills (
    name TEXT PRIMARY KEY,
    CHECK (name = lower(name))
);
CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS employee_skills (
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL REFERENCES skills(name),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 10),
    PRIMARY KEY (employee_id, name),
    CHECK (name = lower(name))
);
INSERT INTO skills (name) SELECT DISTINCT name FROM employee_skills ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS articles (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS article_skills (
    article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    name TEXT NOT NULL REFERENCES skills(name),
    PRIMARY KEY (article_id, name)
);
CREATE TABLE IF NOT EXISTS article_contributors (
    article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    PRIMARY KEY (article_id, employee_id)
);
CREATE TABLE IF NOT EXISTS attachments (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE
);`

func (s *postgresStore) Healthy(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *postgresStore) List(ctx context.Context) ([]Employee, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, email, department FROM employees ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	employees := []Employee{}
	for rows.Next() {
		var employee Employee
		if err := rows.Scan(&employee.ID, &employee.Name, &employee.Email, &employee.Department); err != nil {
			return nil, err
		}
		employees = append(employees, employee)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// ponytail: N+1 is simplest for the MVP; aggregate when employee counts justify it.
	for index := range employees {
		employees[index].Skills, err = s.skills(ctx, employees[index].ID)
		if err != nil {
			return nil, err
		}
	}
	return employees, nil
}

func (s *postgresStore) skills(ctx context.Context, id int64) ([]Skill, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT name, rating FROM employee_skills WHERE employee_id = $1 ORDER BY name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	skills := []Skill{}
	for rows.Next() {
		var skill Skill
		if err := rows.Scan(&skill.Name, &skill.Rating); err != nil {
			return nil, err
		}
		skills = append(skills, skill)
	}
	return skills, rows.Err()
}

func (s *postgresStore) Get(ctx context.Context, id int64) (Employee, error) {
	var employee Employee
	err := s.db.QueryRowContext(ctx, `SELECT id, name, email, department FROM employees WHERE id = $1`, id).
		Scan(&employee.ID, &employee.Name, &employee.Email, &employee.Department)
	if errors.Is(err, sql.ErrNoRows) {
		return Employee{}, errNotFound
	}
	if err != nil {
		return Employee{}, err
	}
	employee.Skills, err = s.skills(ctx, id)
	return employee, err
}

func saveSkills(ctx context.Context, tx *sql.Tx, id int64, skills []Skill) error {
	for _, skill := range skills {
		if _, err := tx.ExecContext(ctx, `INSERT INTO skills (name) VALUES ($1) ON CONFLICT DO NOTHING`, skill.Name); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO employee_skills (employee_id, name, rating) VALUES ($1, $2, $3)`, id, skill.Name, skill.Rating); err != nil {
			return err
		}
	}
	return nil
}

func (s *postgresStore) Create(ctx context.Context, employee Employee) (result Employee, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Employee{}, err
	}
	defer func() { _ = tx.Rollback() }()
	err = tx.QueryRowContext(ctx, `INSERT INTO employees (name, email, department) VALUES ($1, $2, $3) RETURNING id`, employee.Name, employee.Email, employee.Department).Scan(&employee.ID)
	if err != nil {
		return Employee{}, classifyDatabaseError(err)
	}
	if err = saveSkills(ctx, tx, employee.ID, employee.Skills); err != nil {
		return Employee{}, err
	}
	if err = tx.Commit(); err != nil {
		return Employee{}, err
	}
	return employee, nil
}

func (s *postgresStore) Update(ctx context.Context, id int64, employee Employee) (result Employee, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Employee{}, err
	}
	defer func() { _ = tx.Rollback() }()
	resultSQL, err := tx.ExecContext(ctx, `UPDATE employees SET name = $1, email = $2, department = $3 WHERE id = $4`, employee.Name, employee.Email, employee.Department, id)
	if err != nil {
		return Employee{}, classifyDatabaseError(err)
	}
	count, err := resultSQL.RowsAffected()
	if err != nil {
		return Employee{}, err
	}
	if count == 0 {
		return Employee{}, errNotFound
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM employee_skills WHERE employee_id = $1`, id); err != nil {
		return Employee{}, err
	}
	if err = saveSkills(ctx, tx, id, employee.Skills); err != nil {
		return Employee{}, err
	}
	if err = tx.Commit(); err != nil {
		return Employee{}, err
	}
	employee.ID = id
	return employee, nil
}

func (s *postgresStore) Delete(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM employees WHERE id = $1`, id)
	if err != nil {
		return classifyDatabaseError(err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return errNotFound
	}
	return nil
}

func (s *postgresStore) ListArticles(ctx context.Context) ([]Article, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, title, description, content, created_at, updated_at FROM articles ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	articles := []Article{}
	for rows.Next() {
		var article Article
		if err := rows.Scan(&article.ID, &article.Title, &article.Description, &article.Content, &article.CreatedAt, &article.UpdatedAt); err != nil {
			return nil, err
		}
		articles = append(articles, article)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// ponytail: N+1 keeps the MVP query code direct; aggregate when article counts justify it.
	for index := range articles {
		if err := s.loadArticleReferences(ctx, &articles[index]); err != nil {
			return nil, err
		}
	}
	return articles, nil
}

func (s *postgresStore) GetArticle(ctx context.Context, id int64) (Article, error) {
	var article Article
	err := s.db.QueryRowContext(ctx, `SELECT id, title, description, content, created_at, updated_at FROM articles WHERE id = $1`, id).
		Scan(&article.ID, &article.Title, &article.Description, &article.Content, &article.CreatedAt, &article.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Article{}, errArticleNotFound
	}
	if err != nil {
		return Article{}, err
	}
	err = s.loadArticleReferences(ctx, &article)
	return article, err
}

func (s *postgresStore) loadArticleReferences(ctx context.Context, article *Article) error {
	rows, err := s.db.QueryContext(ctx, `SELECT name FROM article_skills WHERE article_id = $1 ORDER BY name`, article.ID)
	if err != nil {
		return err
	}
	article.Skills = []string{}
	for rows.Next() {
		var skill string
		if err := rows.Scan(&skill); err != nil {
			rows.Close()
			return err
		}
		article.Skills = append(article.Skills, skill)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	rows, err = s.db.QueryContext(ctx, `SELECT employee_id FROM article_contributors WHERE article_id = $1 ORDER BY employee_id`, article.ID)
	if err != nil {
		return err
	}
	article.Contributors = []Employee{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return err
		}
		employee, err := s.Get(ctx, id)
		if err != nil {
			return err
		}
		article.Contributors = append(article.Contributors, employee)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	if err := rows.Close(); err != nil {
		return err
	}
	rows, err = s.db.QueryContext(ctx, `SELECT id, article_id, filename, mime_type, stored_name FROM attachments WHERE article_id = $1 ORDER BY id`, article.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	article.Attachments = []Attachment{}
	for rows.Next() {
		var attachment Attachment
		if err := rows.Scan(&attachment.ID, &attachment.ArticleID, &attachment.Filename, &attachment.MIMEType, &attachment.StoredName); err != nil {
			return err
		}
		article.Attachments = append(article.Attachments, attachment)
	}
	return rows.Err()
}

func saveArticleReferences(ctx context.Context, tx *sql.Tx, id int64, input ArticleInput) error {
	for _, skill := range input.Skills {
		result, err := tx.ExecContext(ctx, `INSERT INTO article_skills (article_id, name) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM skills WHERE name = $2)`, id, skill)
		if err != nil {
			return err
		}
		if count, _ := result.RowsAffected(); count == 0 {
			return errInvalidReference
		}
	}
	for _, employeeID := range input.ContributorIDs {
		result, err := tx.ExecContext(ctx, `INSERT INTO article_contributors (article_id, employee_id) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM employees WHERE id = $2)`, id, employeeID)
		if err != nil {
			return err
		}
		if count, _ := result.RowsAffected(); count == 0 {
			return errInvalidReference
		}
	}
	return nil
}

func (s *postgresStore) CreateArticle(ctx context.Context, input ArticleInput) (Article, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Article{}, err
	}
	defer func() { _ = tx.Rollback() }()
	var id int64
	err = tx.QueryRowContext(ctx, `INSERT INTO articles (title, description, content) VALUES ($1, $2, $3) RETURNING id`, input.Title, input.Description, input.Content).Scan(&id)
	if err != nil {
		return Article{}, err
	}
	if err := saveArticleReferences(ctx, tx, id, input); err != nil {
		return Article{}, err
	}
	if err := tx.Commit(); err != nil {
		return Article{}, err
	}
	return s.GetArticle(ctx, id)
}

func (s *postgresStore) UpdateArticle(ctx context.Context, id int64, input ArticleInput) (Article, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Article{}, err
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx, `UPDATE articles SET title = $1, description = $2, content = $3, updated_at = now() WHERE id = $4`, input.Title, input.Description, input.Content, id)
	if err != nil {
		return Article{}, err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return Article{}, errArticleNotFound
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM article_skills WHERE article_id = $1`, id); err != nil {
		return Article{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM article_contributors WHERE article_id = $1`, id); err != nil {
		return Article{}, err
	}
	if err := saveArticleReferences(ctx, tx, id, input); err != nil {
		return Article{}, err
	}
	if err := tx.Commit(); err != nil {
		return Article{}, err
	}
	return s.GetArticle(ctx, id)
}

func (s *postgresStore) DeleteArticle(ctx context.Context, id int64) ([]Attachment, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	var exists int64
	if err := tx.QueryRowContext(ctx, `SELECT id FROM articles WHERE id = $1 FOR UPDATE`, id).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
		return nil, errArticleNotFound
	} else if err != nil {
		return nil, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT id, article_id, filename, mime_type, stored_name FROM attachments WHERE article_id = $1`, id)
	if err != nil {
		return nil, err
	}
	attachments := []Attachment{}
	for rows.Next() {
		var attachment Attachment
		if err := rows.Scan(&attachment.ID, &attachment.ArticleID, &attachment.Filename, &attachment.MIMEType, &attachment.StoredName); err != nil {
			rows.Close()
			return nil, err
		}
		attachments = append(attachments, attachment)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM articles WHERE id = $1`, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return attachments, nil
}

func (s *postgresStore) CreateAttachment(ctx context.Context, attachment Attachment) (Attachment, error) {
	err := s.db.QueryRowContext(ctx, `INSERT INTO attachments (article_id, filename, mime_type, stored_name)
		SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM articles WHERE id = $1) RETURNING id`,
		attachment.ArticleID, attachment.Filename, attachment.MIMEType, attachment.StoredName).Scan(&attachment.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return Attachment{}, errArticleNotFound
	}
	return attachment, err
}

func (s *postgresStore) GetAttachment(ctx context.Context, id int64) (Attachment, error) {
	var attachment Attachment
	err := s.db.QueryRowContext(ctx, `SELECT id, article_id, filename, mime_type, stored_name FROM attachments WHERE id = $1`, id).
		Scan(&attachment.ID, &attachment.ArticleID, &attachment.Filename, &attachment.MIMEType, &attachment.StoredName)
	if errors.Is(err, sql.ErrNoRows) {
		return Attachment{}, errAttachmentNotFound
	}
	return attachment, err
}

func (s *postgresStore) DeleteAttachment(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM attachments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return errAttachmentNotFound
	}
	return nil
}

func classifyDatabaseError(err error) error {
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && postgresError.Code == "23505" {
		return fmt.Errorf("%w: %v", errConflict, err)
	}
	if errors.As(err, &postgresError) && postgresError.Code == "23503" {
		return fmt.Errorf("%w: %v", errReferenced, err)
	}
	return err
}

//go:embed index.html
var web embed.FS

func newHandler(data store, attachmentDir string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(response http.ResponseWriter, request *http.Request) {
		if err := data.Healthy(request.Context()); err != nil {
			writeError(response, http.StatusServiceUnavailable, "database unavailable")
			return
		}
		writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/employees", func(response http.ResponseWriter, request *http.Request) {
		employees, err := data.List(request.Context())
		if err != nil {
			writeError(response, http.StatusInternalServerError, "could not list employees")
			return
		}
		writeJSON(response, http.StatusOK, employees)
	})
	mux.HandleFunc("POST /api/employees", func(response http.ResponseWriter, request *http.Request) {
		employee, ok := decodeEmployee(response, request)
		if !ok {
			return
		}
		created, err := data.Create(request.Context(), employee)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusCreated, created)
	})
	mux.HandleFunc("GET /api/employees/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := employeeID(response, request)
		if !ok {
			return
		}
		employee, err := data.Get(request.Context(), id)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusOK, employee)
	})
	mux.HandleFunc("PUT /api/employees/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := employeeID(response, request)
		if !ok {
			return
		}
		employee, ok := decodeEmployee(response, request)
		if !ok {
			return
		}
		updated, err := data.Update(request.Context(), id, employee)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusOK, updated)
	})
	mux.HandleFunc("DELETE /api/employees/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := employeeID(response, request)
		if !ok {
			return
		}
		if err := data.Delete(request.Context(), id); err != nil {
			writeStoreError(response, err)
			return
		}
		response.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/articles", func(response http.ResponseWriter, request *http.Request) {
		articles, err := data.ListArticles(request.Context())
		if err != nil {
			writeError(response, http.StatusInternalServerError, "could not list articles")
			return
		}
		writeJSON(response, http.StatusOK, articles)
	})
	mux.HandleFunc("POST /api/articles", func(response http.ResponseWriter, request *http.Request) {
		article, ok := decodeArticle(response, request)
		if !ok {
			return
		}
		created, err := data.CreateArticle(request.Context(), article)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusCreated, created)
	})
	mux.HandleFunc("GET /api/articles/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := resourceID(response, request, "article")
		if !ok {
			return
		}
		article, err := data.GetArticle(request.Context(), id)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusOK, article)
	})
	mux.HandleFunc("PUT /api/articles/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := resourceID(response, request, "article")
		if !ok {
			return
		}
		article, ok := decodeArticle(response, request)
		if !ok {
			return
		}
		updated, err := data.UpdateArticle(request.Context(), id, article)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusOK, updated)
	})
	mux.HandleFunc("DELETE /api/articles/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := resourceID(response, request, "article")
		if !ok {
			return
		}
		article, err := data.GetArticle(request.Context(), id)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		renamed := map[string]string{}
		for _, attachment := range article.Attachments {
			path := filepath.Join(attachmentDir, attachment.StoredName)
			tombstone := path + ".deleting"
			if err := os.Rename(path, tombstone); err != nil {
				for oldPath, newPath := range renamed {
					_ = os.Rename(newPath, oldPath)
				}
				writeError(response, http.StatusInternalServerError, "could not remove article attachments")
				return
			}
			renamed[path] = tombstone
		}
		attachments, err := data.DeleteArticle(request.Context(), id)
		if err != nil {
			for path, tombstone := range renamed {
				_ = os.Rename(tombstone, path)
			}
			writeStoreError(response, err)
			return
		}
		for _, attachment := range attachments {
			path := filepath.Join(attachmentDir, attachment.StoredName)
			if tombstone, ok := renamed[path]; ok {
				path = tombstone
			}
			if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
				writeError(response, http.StatusInternalServerError, "could not remove article attachments")
				return
			}
		}
		response.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("POST /api/articles/{id}/attachments", func(response http.ResponseWriter, request *http.Request) {
		_ = http.NewResponseController(response).SetReadDeadline(time.Time{})
		id, ok := resourceID(response, request, "article")
		if !ok {
			return
		}
		if _, err := data.GetArticle(request.Context(), id); err != nil {
			writeStoreError(response, err)
			return
		}
		reader, err := request.MultipartReader()
		if err != nil {
			writeError(response, http.StatusBadRequest, "a multipart file is required")
			return
		}
		for {
			part, err := reader.NextPart()
			if errors.Is(err, io.EOF) {
				writeError(response, http.StatusBadRequest, "a file is required")
				return
			}
			if err != nil {
				writeError(response, http.StatusBadRequest, "invalid multipart upload")
				return
			}
			if part.FormName() != "file" || part.FileName() == "" {
				part.Close()
				continue
			}
			filename := part.FileName()
			contentType := part.Header.Get("Content-Type")
			file, err := os.CreateTemp(attachmentDir, "attachment-*")
			if err != nil {
				writeError(response, http.StatusInternalServerError, "could not store attachment")
				return
			}
			storedName := filepath.Base(file.Name())
			_, copyErr := io.Copy(file, part)
			closeErr := file.Close()
			part.Close()
			if copyErr != nil || closeErr != nil {
				_ = os.Remove(file.Name())
				writeError(response, http.StatusInternalServerError, "could not store attachment")
				return
			}
			if contentType == "" {
				contentType = "application/octet-stream"
			}
			attachment, err := data.CreateAttachment(request.Context(), Attachment{ArticleID: id, Filename: filename, MIMEType: contentType, StoredName: storedName})
			if err != nil {
				_ = os.Remove(file.Name())
				writeStoreError(response, err)
				return
			}
			writeJSON(response, http.StatusCreated, attachment)
			return
		}
	})
	mux.HandleFunc("GET /api/attachments/{id}", func(response http.ResponseWriter, request *http.Request) {
		_ = http.NewResponseController(response).SetWriteDeadline(time.Time{})
		id, ok := resourceID(response, request, "attachment")
		if !ok {
			return
		}
		attachment, err := data.GetAttachment(request.Context(), id)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		file, err := os.Open(filepath.Join(attachmentDir, attachment.StoredName))
		if err != nil {
			writeError(response, http.StatusInternalServerError, "attachment file unavailable")
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil {
			writeError(response, http.StatusInternalServerError, "attachment file unavailable")
			return
		}
		response.Header().Set("Content-Type", attachment.MIMEType)
		response.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": attachment.Filename}))
		http.ServeContent(response, request, attachment.Filename, info.ModTime(), file)
	})
	mux.HandleFunc("DELETE /api/attachments/{id}", func(response http.ResponseWriter, request *http.Request) {
		id, ok := resourceID(response, request, "attachment")
		if !ok {
			return
		}
		attachment, err := data.GetAttachment(request.Context(), id)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		path := filepath.Join(attachmentDir, attachment.StoredName)
		tombstone := path + ".deleting"
		if err := os.Rename(path, tombstone); err != nil {
			writeError(response, http.StatusInternalServerError, "could not remove attachment file")
			return
		}
		if err := data.DeleteAttachment(request.Context(), id); err != nil {
			if errors.Is(err, errAttachmentNotFound) {
				_ = os.Remove(tombstone)
				response.WriteHeader(http.StatusNoContent)
				return
			}
			_ = os.Rename(tombstone, path)
			writeStoreError(response, err)
			return
		}
		if err := os.Remove(tombstone); err != nil {
			writeError(response, http.StatusInternalServerError, "could not remove attachment file")
			return
		}
		response.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /", func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/" {
			http.NotFound(response, request)
			return
		}
		response.Header().Set("Content-Type", "text/html; charset=utf-8")
		page, _ := web.ReadFile("index.html")
		_, _ = response.Write(page)
	})
	return mux
}

func decodeEmployee(response http.ResponseWriter, request *http.Request) (Employee, bool) {
	request.Body = http.MaxBytesReader(response, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var employee Employee
	if err := decoder.Decode(&employee); err != nil {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return Employee{}, false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return Employee{}, false
	}
	if err := employee.normalizeAndValidate(); err != nil {
		writeError(response, http.StatusBadRequest, err.Error())
		return Employee{}, false
	}
	return employee, true
}

func decodeArticle(response http.ResponseWriter, request *http.Request) (ArticleInput, bool) {
	request.Body = http.MaxBytesReader(response, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var article ArticleInput
	if err := decoder.Decode(&article); err != nil {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return ArticleInput{}, false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return ArticleInput{}, false
	}
	if err := article.normalizeAndValidate(); err != nil {
		writeError(response, http.StatusBadRequest, err.Error())
		return ArticleInput{}, false
	}
	return article, true
}

func employeeID(response http.ResponseWriter, request *http.Request) (int64, bool) {
	return resourceID(response, request, "employee")
}

func resourceID(response http.ResponseWriter, request *http.Request, resource string) (int64, bool) {
	id, err := strconv.ParseInt(request.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeError(response, http.StatusBadRequest, "invalid "+resource+" id")
		return 0, false
	}
	return id, true
}

func writeStoreError(response http.ResponseWriter, err error) {
	if errors.Is(err, errNotFound) {
		writeError(response, http.StatusNotFound, errNotFound.Error())
		return
	}
	if errors.Is(err, errArticleNotFound) {
		writeError(response, http.StatusNotFound, errArticleNotFound.Error())
		return
	}
	if errors.Is(err, errAttachmentNotFound) {
		writeError(response, http.StatusNotFound, errAttachmentNotFound.Error())
		return
	}
	if errors.Is(err, errInvalidReference) {
		writeError(response, http.StatusBadRequest, errInvalidReference.Error())
		return
	}
	if errors.Is(err, errConflict) {
		writeError(response, http.StatusConflict, errConflict.Error())
		return
	}
	if errors.Is(err, errReferenced) {
		writeError(response, http.StatusConflict, errReferenced.Error())
		return
	}
	writeError(response, http.StatusInternalServerError, "database operation failed")
}

func writeError(response http.ResponseWriter, status int, message string) {
	writeJSON(response, status, map[string]string{"error": message})
}

func writeJSON(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(value)
}

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
		{Title: "PostgreSQL im Notfall wiederherstellen", Description: "Kurzanleitung für die Wiederherstellung der Skill-Radar-Datenbank.", Content: "# Wiederherstellung\n\n1. Backup prüfen\n2. Datenbank stoppen\n3. Restore ausführen", Skills: []string{"postgresql"}, ContributorIDs: []int64{1, 2}},
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
	server := &http.Server{
		Addr:              address,
		Handler:           newHandler(&postgresStore{db: db}, attachmentDir),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("listening on http://localhost%s", address)
	log.Fatal(server.ListenAndServe())
}
