package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

//go:embed index.html
var web embed.FS

func newHandler(data store, attachmentDir string, agent *agentService) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/agent", func(response http.ResponseWriter, request *http.Request) {
		if !agent.enabled() {
			writeError(response, http.StatusServiceUnavailable, "the AI assistant is not configured on this server")
			return
		}
		transcript, ok := decodeAgentRequest(response, request)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(request.Context(), 85*time.Second)
		defer cancel()
		reply, err := agent.handle(ctx, transcript)
		if err != nil {
			writeError(response, http.StatusBadGateway, "the assistant could not complete the request")
			return
		}
		writeJSON(response, http.StatusOK, reply)
	})
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
	mux.HandleFunc("GET /api/skills", func(response http.ResponseWriter, request *http.Request) {
		skills, err := data.ListSkills(request.Context())
		if err != nil {
			writeError(response, http.StatusInternalServerError, "could not list skills")
			return
		}
		writeJSON(response, http.StatusOK, skills)
	})
	mux.HandleFunc("POST /api/skills", func(response http.ResponseWriter, request *http.Request) {
		skill, ok := decodeSkill(response, request)
		if !ok {
			return
		}
		created, err := data.CreateSkill(request.Context(), skill)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusCreated, created)
	})
	mux.HandleFunc("PUT /api/skills/{name}", func(response http.ResponseWriter, request *http.Request) {
		name := strings.ToLower(strings.TrimSpace(request.PathValue("name")))
		if name == "" {
			writeError(response, http.StatusBadRequest, "invalid skill name")
			return
		}
		update, ok := decodeSkillUpdate(response, request)
		if !ok {
			return
		}
		updated, err := data.UpdateSkill(request.Context(), name, update)
		if err != nil {
			writeStoreError(response, err)
			return
		}
		writeJSON(response, http.StatusOK, updated)
	})
	mux.HandleFunc("DELETE /api/skills/{name}", func(response http.ResponseWriter, request *http.Request) {
		name := strings.ToLower(strings.TrimSpace(request.PathValue("name")))
		if name == "" {
			writeError(response, http.StatusBadRequest, "invalid skill name")
			return
		}
		if err := data.DeleteSkill(request.Context(), name); err != nil {
			writeStoreError(response, err)
			return
		}
		response.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/search", func(response http.ResponseWriter, request *http.Request) {
		mode := strings.ToLower(strings.TrimSpace(request.URL.Query().Get("mode")))
		if mode == "" {
			mode = "and"
		}
		if mode != "and" && mode != "or" {
			writeError(response, http.StatusBadRequest, "mode must be and or or")
			return
		}
		query := strings.ToLower(strings.TrimSpace(request.URL.Query().Get("q")))
		skills := request.URL.Query()["skills"]
		filteredSkills := skills[:0]
		for _, skill := range skills {
			if skill = strings.ToLower(strings.TrimSpace(skill)); skill != "" {
				filteredSkills = append(filteredSkills, skill)
			}
		}
		skills = filteredSkills
		employees, err := data.List(request.Context())
		if err != nil {
			writeError(response, http.StatusInternalServerError, "could not search employees")
			return
		}
		articles, err := data.ListArticles(request.Context())
		if err != nil {
			writeError(response, http.StatusInternalServerError, "could not search articles")
			return
		}
		results := SearchResults{Employees: []Employee{}, Articles: []Article{}}
		for _, employee := range employees {
			names := make([]string, len(employee.Skills))
			for index, skill := range employee.Skills {
				names[index] = skill.Name
			}
			if (query == "" || strings.Contains(strings.ToLower(employee.Name), query)) && matchesSkills(names, skills, mode) {
				results.Employees = append(results.Employees, employee)
			}
		}
		for _, article := range articles {
			textMatches := query == "" || strings.Contains(strings.ToLower(article.Title), query) || strings.Contains(strings.ToLower(article.Content), query)
			if textMatches && matchesSkills(article.Skills, skills, mode) {
				results.Articles = append(results.Articles, article)
			}
		}
		writeJSON(response, http.StatusOK, results)
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
			sizeBytes, copyErr := io.Copy(file, part)
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
			attachment, err := data.CreateAttachment(request.Context(), Attachment{ArticleID: id, Filename: filename, MIMEType: contentType, SizeBytes: sizeBytes, StoredName: storedName})
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

func matchesSkills(entrySkills, selected []string, mode string) bool {
	if len(selected) == 0 {
		return true
	}
	available := make(map[string]bool, len(entrySkills))
	for _, skill := range entrySkills {
		available[skill] = true
	}
	for _, skill := range selected {
		if mode == "or" && available[skill] {
			return true
		}
		if mode == "and" && !available[skill] {
			return false
		}
	}
	return mode == "and"
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

func decodeSkill(response http.ResponseWriter, request *http.Request) (SkillDefinition, bool) {
	request.Body = http.MaxBytesReader(response, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var skill SkillDefinition
	if err := decoder.Decode(&skill); err != nil {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return SkillDefinition{}, false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return SkillDefinition{}, false
	}
	if err := skill.normalizeAndValidate(); err != nil {
		writeError(response, http.StatusBadRequest, err.Error())
		return SkillDefinition{}, false
	}
	return skill, true
}

// decodeSkillUpdate reads the body of a skill update. The name comes from the
// URL path (it is immutable), so only the description is taken from the body.
func decodeSkillUpdate(response http.ResponseWriter, request *http.Request) (SkillDefinition, bool) {
	request.Body = http.MaxBytesReader(response, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var body struct {
		Description string `json:"description"`
	}
	if err := decoder.Decode(&body); err != nil {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return SkillDefinition{}, false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return SkillDefinition{}, false
	}
	return SkillDefinition{Description: strings.TrimSpace(body.Description)}, true
}

// decodeAgentRequest reads the running chat transcript the frontend posts to
// /api/agent. Only role + text content is accepted; empty transcripts are
// rejected.
func decodeAgentRequest(response http.ResponseWriter, request *http.Request) ([]ClientMessage, bool) {
	request.Body = http.MaxBytesReader(response, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var body struct {
		Messages []ClientMessage `json:"messages"`
	}
	if err := decoder.Decode(&body); err != nil {
		writeError(response, http.StatusBadRequest, "invalid JSON")
		return nil, false
	}
	if len(body.Messages) == 0 {
		writeError(response, http.StatusBadRequest, "messages are required")
		return nil, false
	}
	for i := range body.Messages {
		body.Messages[i].Content = strings.TrimSpace(body.Messages[i].Content)
	}
	return body.Messages, true
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
	if errors.Is(err, errSkillNotFound) {
		writeError(response, http.StatusNotFound, errSkillNotFound.Error())
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
