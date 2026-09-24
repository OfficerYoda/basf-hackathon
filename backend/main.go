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
	"net/http"
	"net/mail"
	"os"
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
		skill.Name = strings.ToLower(skill.Name)
		if strings.TrimSpace(skill.Name) == "" {
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
var errConflict = errors.New("email or skill already exists")

type store interface {
	Healthy(context.Context) error
	List(context.Context) ([]Employee, error)
	Get(context.Context, int64) (Employee, error)
	Create(context.Context, Employee) (Employee, error)
	Update(context.Context, int64, Employee) (Employee, error)
	Delete(context.Context, int64) error
}

type postgresStore struct{ db *sql.DB }

const schema = `
CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS employee_skills (
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 10),
    PRIMARY KEY (employee_id, name),
    CHECK (name = lower(name))
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
		return err
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

func classifyDatabaseError(err error) error {
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && postgresError.Code == "23505" {
		return fmt.Errorf("%w: %v", errConflict, err)
	}
	return err
}

//go:embed index.html
var web embed.FS

func newHandler(data store) http.Handler {
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

func employeeID(response http.ResponseWriter, request *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(request.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeError(response, http.StatusBadRequest, "invalid employee id")
		return 0, false
	}
	return id, true
}

func writeStoreError(response http.ResponseWriter, err error) {
	if errors.Is(err, errNotFound) {
		writeError(response, http.StatusNotFound, errNotFound.Error())
		return
	}
	if errors.Is(err, errConflict) {
		writeError(response, http.StatusConflict, errConflict.Error())
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

func seed(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, `TRUNCATE employee_skills, employees RESTART IDENTITY CASCADE`); err != nil {
		return err
	}
	employees := []Employee{
		{Name: "Ada Lovelace", Email: "ada@example.com", Department: "Digitalization", Skills: []Skill{{Name: "python", Rating: 9}, {Name: "mathematics", Rating: 10}}},
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
	return tx.Commit()
}

func main() {
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
	if _, err = db.ExecContext(ctx, schema); err != nil {
		log.Fatalf("initialize database: %v", err)
	}
	if len(os.Args) > 1 && os.Args[1] == "seed" {
		if err := seed(ctx, db); err != nil {
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
		Handler:           newHandler(&postgresStore{db: db}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("listening on http://localhost%s", address)
	log.Fatal(server.ListenAndServe())
}
