package main

import (
	"context"
	"database/sql"
	"errors"
)

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
	rows, err = s.db.QueryContext(ctx, `SELECT id, article_id, filename, mime_type, size_bytes, created_at, stored_name FROM attachments WHERE article_id = $1 ORDER BY id`, article.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	article.Attachments = []Attachment{}
	for rows.Next() {
		var attachment Attachment
		if err := rows.Scan(&attachment.ID, &attachment.ArticleID, &attachment.Filename, &attachment.MIMEType, &attachment.SizeBytes, &attachment.CreatedAt, &attachment.StoredName); err != nil {
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
	rows, err := tx.QueryContext(ctx, `SELECT id, article_id, filename, mime_type, size_bytes, created_at, stored_name FROM attachments WHERE article_id = $1`, id)
	if err != nil {
		return nil, err
	}
	attachments := []Attachment{}
	for rows.Next() {
		var attachment Attachment
		if err := rows.Scan(&attachment.ID, &attachment.ArticleID, &attachment.Filename, &attachment.MIMEType, &attachment.SizeBytes, &attachment.CreatedAt, &attachment.StoredName); err != nil {
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
	err := s.db.QueryRowContext(ctx, `INSERT INTO attachments (article_id, filename, mime_type, size_bytes, stored_name)
		SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM articles WHERE id = $1) RETURNING id, created_at`,
		attachment.ArticleID, attachment.Filename, attachment.MIMEType, attachment.SizeBytes, attachment.StoredName).Scan(&attachment.ID, &attachment.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Attachment{}, errArticleNotFound
	}
	return attachment, err
}

func (s *postgresStore) GetAttachment(ctx context.Context, id int64) (Attachment, error) {
	var attachment Attachment
	err := s.db.QueryRowContext(ctx, `SELECT id, article_id, filename, mime_type, size_bytes, created_at, stored_name FROM attachments WHERE id = $1`, id).
		Scan(&attachment.ID, &attachment.ArticleID, &attachment.Filename, &attachment.MIMEType, &attachment.SizeBytes, &attachment.CreatedAt, &attachment.StoredName)
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
