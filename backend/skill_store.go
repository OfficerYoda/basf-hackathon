package main

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

func (s *postgresStore) UpsertSkill(ctx context.Context, name string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO skills (name) VALUES ($1) ON CONFLICT DO NOTHING`, name)
	return err
}

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
