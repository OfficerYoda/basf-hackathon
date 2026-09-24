package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

type memoryStore struct {
	next      int64
	employees map[int64]Employee
}

func newMemoryStore() *memoryStore {
	return &memoryStore{next: 1, employees: map[int64]Employee{}}
}

func (s *memoryStore) Healthy(context.Context) error { return nil }

func (s *memoryStore) List(context.Context) ([]Employee, error) {
	result := make([]Employee, 0, len(s.employees))
	for id := int64(1); id < s.next; id++ {
		if employee, ok := s.employees[id]; ok {
			result = append(result, employee)
		}
	}
	return result, nil
}

func (s *memoryStore) Get(_ context.Context, id int64) (Employee, error) {
	employee, ok := s.employees[id]
	if !ok {
		return Employee{}, errNotFound
	}
	return employee, nil
}

func (s *memoryStore) Create(_ context.Context, employee Employee) (Employee, error) {
	employee.ID = s.next
	s.next++
	s.employees[employee.ID] = employee
	return employee, nil
}

func (s *memoryStore) Update(_ context.Context, id int64, employee Employee) (Employee, error) {
	if _, ok := s.employees[id]; !ok {
		return Employee{}, errNotFound
	}
	employee.ID = id
	s.employees[id] = employee
	return employee, nil
}

func (s *memoryStore) Delete(_ context.Context, id int64) error {
	if _, ok := s.employees[id]; !ok {
		return errNotFound
	}
	delete(s.employees, id)
	return nil
}

func request(t *testing.T, client *http.Client, method, url string, body any) *http.Response {
	t.Helper()
	var data bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&data).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, url, &data)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func TestValidateAndNormalize(t *testing.T) {
	employee := Employee{Name: "Ada", Email: "ada@example.com", Skills: []Skill{{Name: "Go Lang", Rating: 10}}}
	if err := employee.normalizeAndValidate(); err != nil {
		t.Fatalf("valid employee rejected: %v", err)
	}
	if employee.Skills[0].Name != "go lang" {
		t.Fatalf("skill was not lowercased: %q", employee.Skills[0].Name)
	}

	employee.Skills[0].Rating = 11
	if err := employee.normalizeAndValidate(); err == nil {
		t.Fatal("rating above 10 accepted")
	}
}

func TestEmployeeLifecycle(t *testing.T) {
	server := httptest.NewServer(newHandler(newMemoryStore()))
	defer server.Close()

	createdResponse := request(t, server.Client(), http.MethodPost, server.URL+"/api/employees", Employee{
		Name: "Grace Hopper", Email: "grace@example.com", Department: "Engineering",
		Skills: []Skill{{Name: "COBOL", Rating: 9}},
	})
	defer createdResponse.Body.Close()
	if createdResponse.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d", createdResponse.StatusCode)
	}
	var created Employee
	if err := json.NewDecoder(createdResponse.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	if created.Skills[0].Name != "cobol" {
		t.Fatalf("created skill = %q", created.Skills[0].Name)
	}

	id := strconv.FormatInt(created.ID, 10)
	getResponse := request(t, server.Client(), http.MethodGet, server.URL+"/api/employees/"+id, nil)
	getResponse.Body.Close()
	if getResponse.StatusCode != http.StatusOK {
		t.Fatalf("get status = %d", getResponse.StatusCode)
	}

	updateResponse := request(t, server.Client(), http.MethodPut, server.URL+"/api/employees/"+id, Employee{
		Name: "Grace Hopper", Email: "grace@example.com", Skills: []Skill{{Name: "Compilers", Rating: 10}},
	})
	updateResponse.Body.Close()
	if updateResponse.StatusCode != http.StatusOK {
		t.Fatalf("update status = %d", updateResponse.StatusCode)
	}

	listResponse := request(t, server.Client(), http.MethodGet, server.URL+"/api/employees", nil)
	defer listResponse.Body.Close()
	var employees []Employee
	if err := json.NewDecoder(listResponse.Body).Decode(&employees); err != nil {
		t.Fatal(err)
	}
	if len(employees) != 1 || employees[0].Skills[0].Name != "compilers" {
		t.Fatalf("unexpected list: %#v", employees)
	}

	deleteResponse := request(t, server.Client(), http.MethodDelete, server.URL+"/api/employees/"+id, nil)
	deleteResponse.Body.Close()
	if deleteResponse.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status = %d", deleteResponse.StatusCode)
	}
	missingResponse := request(t, server.Client(), http.MethodGet, server.URL+"/api/employees/"+id, nil)
	missingResponse.Body.Close()
	if missingResponse.StatusCode != http.StatusNotFound {
		t.Fatalf("deleted employee status = %d", missingResponse.StatusCode)
	}
}

func TestInvalidEmployeeReturnsBadRequest(t *testing.T) {
	server := httptest.NewServer(newHandler(newMemoryStore()))
	defer server.Close()

	response := request(t, server.Client(), http.MethodPost, server.URL+"/api/employees", Employee{
		Name: "", Email: "not-an-email", Skills: []Skill{{Name: "Go", Rating: 0}},
	})
	response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d", response.StatusCode)
	}
}

func TestTrailingJSONReturnsBadRequest(t *testing.T) {
	server := httptest.NewServer(newHandler(newMemoryStore()))
	defer server.Close()

	response, err := server.Client().Post(server.URL+"/api/employees", "application/json", strings.NewReader(
		`{"name":"Ada","email":"ada@example.com","skills":[]} {}`,
	))
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d", response.StatusCode)
	}
}
