package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestLoadEnv(t *testing.T) {
	path := t.TempDir() + "/.env"
	if err := os.WriteFile(path, []byte("# local config\nDOTENV_FILE_VALUE=loaded\nDOTENV_OVERRIDE=from-file\n"), 0600); err != nil {
		t.Fatal(err)
	}
	os.Unsetenv("DOTENV_FILE_VALUE")
	t.Cleanup(func() { os.Unsetenv("DOTENV_FILE_VALUE") })
	t.Setenv("DOTENV_OVERRIDE", "from-shell")
	if err := loadEnv(path); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("DOTENV_FILE_VALUE") != "loaded" || os.Getenv("DOTENV_OVERRIDE") != "from-shell" {
		t.Fatal(".env loading or environment precedence failed")
	}
}

type memoryStore struct {
	next           int64
	employees      map[int64]Employee
	nextArticle    int64
	articles       map[int64]Article
	nextAttachment int64
	skills         map[string]bool
}

func newMemoryStore() *memoryStore {
	return &memoryStore{next: 1, employees: map[int64]Employee{}, nextArticle: 1, articles: map[int64]Article{}, nextAttachment: 1, skills: map[string]bool{}}
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
	for _, skill := range employee.Skills {
		s.skills[skill.Name] = true
	}
	return employee, nil
}

func (s *memoryStore) Update(_ context.Context, id int64, employee Employee) (Employee, error) {
	if _, ok := s.employees[id]; !ok {
		return Employee{}, errNotFound
	}
	employee.ID = id
	s.employees[id] = employee
	for _, skill := range employee.Skills {
		s.skills[skill.Name] = true
	}
	return employee, nil
}

func (s *memoryStore) Delete(_ context.Context, id int64) error {
	if _, ok := s.employees[id]; !ok {
		return errNotFound
	}
	for _, article := range s.articles {
		for _, contributor := range article.Contributors {
			if contributor.ID == id {
				return errReferenced
			}
		}
	}
	delete(s.employees, id)
	return nil
}

func (s *memoryStore) ListArticles(context.Context) ([]Article, error) {
	result := make([]Article, 0, len(s.articles))
	for id := int64(1); id < s.nextArticle; id++ {
		if article, ok := s.articles[id]; ok {
			result = append(result, article)
		}
	}
	return result, nil
}

func (s *memoryStore) GetArticle(_ context.Context, id int64) (Article, error) {
	article, ok := s.articles[id]
	if !ok {
		return Article{}, errArticleNotFound
	}
	return article, nil
}

func (s *memoryStore) CreateArticle(_ context.Context, input ArticleInput) (Article, error) {
	article, err := s.articleFromInput(input)
	if err != nil {
		return Article{}, err
	}
	article.ID = s.nextArticle
	s.nextArticle++
	article.CreatedAt = time.Now().UTC()
	article.UpdatedAt = article.CreatedAt
	s.articles[article.ID] = article
	return article, nil
}

func (s *memoryStore) UpdateArticle(_ context.Context, id int64, input ArticleInput) (Article, error) {
	old, ok := s.articles[id]
	if !ok {
		return Article{}, errArticleNotFound
	}
	article, err := s.articleFromInput(input)
	if err != nil {
		return Article{}, err
	}
	article.ID, article.CreatedAt, article.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	article.Attachments = old.Attachments
	s.articles[id] = article
	return article, nil
}

func (s *memoryStore) DeleteArticle(_ context.Context, id int64) ([]Attachment, error) {
	article, ok := s.articles[id]
	if !ok {
		return nil, errArticleNotFound
	}
	delete(s.articles, id)
	return article.Attachments, nil
}

func (s *memoryStore) CreateAttachment(_ context.Context, attachment Attachment) (Attachment, error) {
	article, ok := s.articles[attachment.ArticleID]
	if !ok {
		return Attachment{}, errArticleNotFound
	}
	attachment.ID = s.nextAttachment
	attachment.CreatedAt = time.Now().UTC()
	s.nextAttachment++
	article.Attachments = append(article.Attachments, attachment)
	s.articles[article.ID] = article
	return attachment, nil
}

func (s *memoryStore) GetAttachment(_ context.Context, id int64) (Attachment, error) {
	for _, article := range s.articles {
		for _, attachment := range article.Attachments {
			if attachment.ID == id {
				return attachment, nil
			}
		}
	}
	return Attachment{}, errAttachmentNotFound
}

func (s *memoryStore) DeleteAttachment(_ context.Context, id int64) error {
	for articleID, article := range s.articles {
		for index, attachment := range article.Attachments {
			if attachment.ID == id {
				article.Attachments = append(article.Attachments[:index], article.Attachments[index+1:]...)
				s.articles[articleID] = article
				return nil
			}
		}
	}
	return errAttachmentNotFound
}

func (s *memoryStore) articleFromInput(input ArticleInput) (Article, error) {
	contributors := make([]Employee, 0, len(input.ContributorIDs))
	for _, id := range input.ContributorIDs {
		employee, ok := s.employees[id]
		if !ok {
			return Article{}, errInvalidReference
		}
		contributors = append(contributors, employee)
	}
	for _, name := range input.Skills {
		if !s.skills[name] {
			return Article{}, errInvalidReference
		}
	}
	return Article{Title: input.Title, Description: input.Description, Content: input.Content, Skills: input.Skills, Contributors: contributors}, nil
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
	employee := Employee{Name: "Ada", Email: "ada@example.com", Skills: []Skill{{Name: " Go Lang ", Rating: 10}}}
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
	server := httptest.NewServer(newHandler(newMemoryStore(), t.TempDir()))
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
	server := httptest.NewServer(newHandler(newMemoryStore(), t.TempDir()))
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
	server := httptest.NewServer(newHandler(newMemoryStore(), t.TempDir()))
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

func TestValidateArticle(t *testing.T) {
	article := ArticleInput{Title: "  PostgreSQL Runbook ", Description: " Recovery ", Content: " # Restore ", Skills: []string{"POSTGRESQL"}, ContributorIDs: []int64{1}}
	if err := article.normalizeAndValidate(); err != nil {
		t.Fatalf("valid article rejected: %v", err)
	}
	if article.Title != "PostgreSQL Runbook" || article.Skills[0] != "postgresql" {
		t.Fatalf("article was not normalized: %#v", article)
	}
	article.Content = ""
	if err := article.normalizeAndValidate(); err == nil {
		t.Fatal("empty content accepted")
	}
}

func TestArticleLifecycle(t *testing.T) {
	data := newMemoryStore()
	employee, _ := data.Create(context.Background(), Employee{Name: "Ada", Email: "ada@example.com", Skills: []Skill{{Name: "postgresql", Rating: 9}}})
	server := httptest.NewServer(newHandler(data, t.TempDir()))
	defer server.Close()

	createdResponse := request(t, server.Client(), http.MethodPost, server.URL+"/api/articles", ArticleInput{
		Title: "Restore", Description: "Database recovery", Content: "# Steps", Skills: []string{"PostgreSQL"}, ContributorIDs: []int64{employee.ID},
	})
	defer createdResponse.Body.Close()
	if createdResponse.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d", createdResponse.StatusCode)
	}
	var created Article
	if err := json.NewDecoder(createdResponse.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	if created.Skills[0] != "postgresql" || created.Contributors[0].Name != "Ada" || created.CreatedAt.IsZero() || created.UpdatedAt.IsZero() {
		t.Fatalf("unexpected article: %#v", created)
	}

	id := strconv.FormatInt(created.ID, 10)
	updateResponse := request(t, server.Client(), http.MethodPut, server.URL+"/api/articles/"+id, ArticleInput{
		Title: "Restore safely", Description: "Updated", Content: "# New steps", Skills: []string{"postgresql"}, ContributorIDs: []int64{employee.ID},
	})
	updateResponse.Body.Close()
	if updateResponse.StatusCode != http.StatusOK {
		t.Fatalf("update status = %d", updateResponse.StatusCode)
	}

	getResponse := request(t, server.Client(), http.MethodGet, server.URL+"/api/articles/"+id, nil)
	defer getResponse.Body.Close()
	var updated Article
	if err := json.NewDecoder(getResponse.Body).Decode(&updated); err != nil {
		t.Fatal(err)
	}
	if updated.Title != "Restore safely" || len(updated.Contributors) != 1 {
		t.Fatalf("unexpected update: %#v", updated)
	}

	deleteResponse := request(t, server.Client(), http.MethodDelete, server.URL+"/api/articles/"+id, nil)
	deleteResponse.Body.Close()
	if deleteResponse.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status = %d", deleteResponse.StatusCode)
	}
}

func TestArticleRejectsUnknownReferences(t *testing.T) {
	server := httptest.NewServer(newHandler(newMemoryStore(), t.TempDir()))
	defer server.Close()
	response := request(t, server.Client(), http.MethodPost, server.URL+"/api/articles", ArticleInput{
		Title: "Runbook", Description: "Recovery", Content: "# Steps", Skills: []string{"missing"}, ContributorIDs: []int64{99},
	})
	response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d", response.StatusCode)
	}
}

func TestContributorCannotBeDeleted(t *testing.T) {
	data := newMemoryStore()
	employee, _ := data.Create(context.Background(), Employee{Name: "Ada", Email: "ada@example.com", Skills: []Skill{{Name: "postgresql", Rating: 9}}})
	_, _ = data.CreateArticle(context.Background(), ArticleInput{Title: "Runbook", Description: "Recovery", Content: "# Steps", Skills: []string{"postgresql"}, ContributorIDs: []int64{employee.ID}})
	server := httptest.NewServer(newHandler(data, t.TempDir()))
	defer server.Close()

	response := request(t, server.Client(), http.MethodDelete, server.URL+"/api/employees/1", nil)
	response.Body.Close()
	if response.StatusCode != http.StatusConflict {
		t.Fatalf("status = %d", response.StatusCode)
	}
}

func TestSearchEmployeesAndArticles(t *testing.T) {
	data := newMemoryStore()
	ada, _ := data.Create(context.Background(), Employee{Name: "Ada Lovelace", Email: "ada@example.com", Skills: []Skill{{Name: "python", Rating: 9}, {Name: "postgresql", Rating: 8}}})
	grace, _ := data.Create(context.Background(), Employee{Name: "Grace Hopper", Email: "grace@example.com", Skills: []Skill{{Name: "python", Rating: 8}, {Name: "leadership", Rating: 10}}})
	_, _ = data.CreateArticle(context.Background(), ArticleInput{Title: "PostgreSQL restore", Description: "Runbook", Content: "Use pg_restore for recovery.", Skills: []string{"postgresql"}, ContributorIDs: []int64{ada.ID}})
	_, _ = data.CreateArticle(context.Background(), ArticleInput{Title: "Python mentoring", Description: "Guide", Content: "How to coach a team.", Skills: []string{"python", "leadership"}, ContributorIDs: []int64{grace.ID}})
	server := httptest.NewServer(newHandler(data, t.TempDir()))
	defer server.Close()

	tests := []struct {
		name          string
		query         string
		employeeNames []string
		articleTitles []string
	}{
		{name: "empty returns everything", employeeNames: []string{"Ada Lovelace", "Grace Hopper"}, articleTitles: []string{"PostgreSQL restore", "Python mentoring"}},
		{name: "empty skill is ignored", query: "skills=", employeeNames: []string{"Ada Lovelace", "Grace Hopper"}, articleTitles: []string{"PostgreSQL restore", "Python mentoring"}},
		{name: "text searches article titles", query: "q=PostgreSQL", articleTitles: []string{"PostgreSQL restore"}},
		{name: "text searches article content", query: "q=coach", articleTitles: []string{"Python mentoring"}},
		{name: "text matching is case insensitive", query: "q=ADA", employeeNames: []string{"Ada Lovelace"}},
		{name: "and requires every skill", query: "skills=python&skills=leadership&mode=and", employeeNames: []string{"Grace Hopper"}, articleTitles: []string{"Python mentoring"}},
		{name: "or requires any skill", query: "skills=postgresql&skills=leadership&mode=or", employeeNames: []string{"Ada Lovelace", "Grace Hopper"}, articleTitles: []string{"PostgreSQL restore", "Python mentoring"}},
		{name: "text and skills combine", query: "q=coach&skills=python&skills=leadership&mode=and", articleTitles: []string{"Python mentoring"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := request(t, server.Client(), http.MethodGet, server.URL+"/api/search?"+test.query, nil)
			defer response.Body.Close()
			if response.StatusCode != http.StatusOK {
				t.Fatalf("status = %d", response.StatusCode)
			}
			var result struct {
				Employees []Employee `json:"employees"`
				Articles  []Article  `json:"articles"`
			}
			if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
				t.Fatal(err)
			}
			employeeNames := make([]string, len(result.Employees))
			for index, employee := range result.Employees {
				employeeNames[index] = employee.Name
			}
			articleTitles := make([]string, len(result.Articles))
			for index, article := range result.Articles {
				articleTitles[index] = article.Title
			}
			if strings.Join(employeeNames, ",") != strings.Join(test.employeeNames, ",") || strings.Join(articleTitles, ",") != strings.Join(test.articleTitles, ",") {
				t.Fatalf("employees/articles = %v/%v, want %v/%v", employeeNames, articleTitles, test.employeeNames, test.articleTitles)
			}
		})
	}

	invalid := request(t, server.Client(), http.MethodGet, server.URL+"/api/search?mode=invalid", nil)
	invalid.Body.Close()
	if invalid.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid mode status = %d", invalid.StatusCode)
	}
}

func uploadAttachment(t *testing.T, client *http.Client, url, name, contentType, content string) *http.Response {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{"name": "file", "filename": name}))
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(part, content); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequest(http.MethodPost, url, &body)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func TestAttachmentLifecycleAndInvalidReferences(t *testing.T) {
	data := newMemoryStore()
	article, _ := data.CreateArticle(context.Background(), ArticleInput{Title: "Runbook", Description: "Recovery", Content: "# Steps"})
	dir := t.TempDir()
	server := httptest.NewServer(newHandler(data, dir))
	defer server.Close()

	upload := uploadAttachment(t, server.Client(), server.URL+"/api/articles/"+strconv.FormatInt(article.ID, 10)+"/attachments", "../../runbook.txt", "text/plain", "restore steps")
	defer upload.Body.Close()
	if upload.StatusCode != http.StatusCreated {
		t.Fatalf("upload status = %d", upload.StatusCode)
	}
	var attachment Attachment
	if err := json.NewDecoder(upload.Body).Decode(&attachment); err != nil {
		t.Fatal(err)
	}
	if attachment.Filename != "runbook.txt" || attachment.MIMEType != "text/plain" || attachment.SizeBytes != int64(len("restore steps")) || attachment.CreatedAt.IsZero() {
		t.Fatalf("unexpected attachment: %#v", attachment)
	}

	files, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || filepath.Base(files[0].Name()) != files[0].Name() || files[0].Name() == attachment.Filename {
		t.Fatalf("unsafe stored files: %#v", files)
	}

	articleResponse := request(t, server.Client(), http.MethodGet, server.URL+"/api/articles/1", nil)
	defer articleResponse.Body.Close()
	var withAttachment Article
	if err := json.NewDecoder(articleResponse.Body).Decode(&withAttachment); err != nil {
		t.Fatal(err)
	}
	if len(withAttachment.Attachments) != 1 || withAttachment.Attachments[0].ID != attachment.ID {
		t.Fatalf("article attachments = %#v", withAttachment.Attachments)
	}

	download := request(t, server.Client(), http.MethodGet, server.URL+"/api/attachments/"+strconv.FormatInt(attachment.ID, 10), nil)
	defer download.Body.Close()
	downloaded, _ := io.ReadAll(download.Body)
	if download.StatusCode != http.StatusOK || string(downloaded) != "restore steps" || download.Header.Get("Content-Type") != "text/plain" {
		t.Fatalf("download status/content/type = %d/%q/%q", download.StatusCode, downloaded, download.Header.Get("Content-Type"))
	}

	deleted := request(t, server.Client(), http.MethodDelete, server.URL+"/api/attachments/"+strconv.FormatInt(attachment.ID, 10), nil)
	deleted.Body.Close()
	if deleted.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status = %d", deleted.StatusCode)
	}
	files, _ = os.ReadDir(dir)
	if len(files) != 0 {
		t.Fatalf("files remain after delete: %#v", files)
	}

	missingArticle := uploadAttachment(t, server.Client(), server.URL+"/api/articles/99/attachments", "orphan.txt", "text/plain", "orphan")
	missingArticle.Body.Close()
	missingAttachment := request(t, server.Client(), http.MethodGet, server.URL+"/api/attachments/99", nil)
	missingAttachment.Body.Close()
	if missingArticle.StatusCode != http.StatusNotFound || missingAttachment.StatusCode != http.StatusNotFound {
		t.Fatalf("missing statuses = %d, %d", missingArticle.StatusCode, missingAttachment.StatusCode)
	}
	files, _ = os.ReadDir(dir)
	if len(files) != 0 {
		t.Fatalf("orphan files created: %#v", files)
	}

	secondUpload := uploadAttachment(t, server.Client(), server.URL+"/api/articles/1/attachments", "delete-with-article.txt", "text/plain", "temporary")
	secondUpload.Body.Close()
	deleteArticle := request(t, server.Client(), http.MethodDelete, server.URL+"/api/articles/1", nil)
	deleteArticle.Body.Close()
	files, _ = os.ReadDir(dir)
	if deleteArticle.StatusCode != http.StatusNoContent || len(files) != 0 {
		t.Fatalf("article delete status/files = %d/%#v", deleteArticle.StatusCode, files)
	}
}
