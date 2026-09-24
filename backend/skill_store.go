package main

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

func (s *postgresStore) ListSkills(ctx context.Context) ([]SkillDefinition, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT name, description FROM skills ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	skills := []SkillDefinition{}
	for rows.Next() {
		var skill SkillDefinition
		if err := rows.Scan(&skill.Name, &skill.Description); err != nil {
			return nil, err
		}
		skills = append(skills, skill)
	}
	return skills, rows.Err()
}

// CreateSkill inserts a skill definition, or updates the description if the
// skill name already exists (names are frequently auto-created without a
// description via employee or article skill references).
func (s *postgresStore) CreateSkill(ctx context.Context, skill SkillDefinition) (SkillDefinition, error) {
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO skills (name, description) VALUES ($1, $2)
		 ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
		 RETURNING name, description`,
		skill.Name, skill.Description,
	).Scan(&skill.Name, &skill.Description)
	if err != nil {
		return SkillDefinition{}, classifyDatabaseError(err)
	}
	return skill, nil
}

// UpdateSkill changes a skill's description. The name is immutable (it is a
// primary key referenced by employee_skills and article_skills).
func (s *postgresStore) UpdateSkill(ctx context.Context, name string, skill SkillDefinition) (SkillDefinition, error) {
	err := s.db.QueryRowContext(ctx,
		`UPDATE skills SET description = $2 WHERE name = $1
		 RETURNING name, description`,
		name, skill.Description,
	).Scan(&skill.Name, &skill.Description)
	if errors.Is(err, sql.ErrNoRows) {
		return SkillDefinition{}, errSkillNotFound
	}
	if err != nil {
		return SkillDefinition{}, classifyDatabaseError(err)
	}
	return skill, nil
}

// UpsertSkill inserts a bare skill name if it does not already exist. Used when
// employee or article references auto-create skill definitions.
func (s *postgresStore) UpsertSkill(ctx context.Context, name string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO skills (name) VALUES ($1) ON CONFLICT DO NOTHING`, name)
	return err
}

// DeleteSkill removes a skill definition. If the skill is still referenced by
// an employee or article, the foreign-key constraint raises 23503, which we
// map to errSkillReferenced (409).
func (s *postgresStore) DeleteSkill(ctx context.Context, name string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM skills WHERE name = $1`, name)
	if err != nil {
		var postgresError *pgconn.PgError
		if errors.As(err, &postgresError) && postgresError.Code == "23503" {
			return errSkillReferenced
		}
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return errSkillNotFound
	}
	return nil
}
