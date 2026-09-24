package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
)

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
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stored_name TEXT NOT NULL UNIQUE
);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();`

func (s *postgresStore) Healthy(ctx context.Context) error { return s.db.PingContext(ctx) }

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
