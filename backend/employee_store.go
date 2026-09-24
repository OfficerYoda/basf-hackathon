package main

import (
	"context"
	"database/sql"
	"errors"
)

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
