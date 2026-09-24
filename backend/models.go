package main

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
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
	ID         int64     `json:"id"`
	ArticleID  int64     `json:"article_id"`
	Filename   string    `json:"filename"`
	MIMEType   string    `json:"mime_type"`
	SizeBytes  int64     `json:"size_bytes"`
	CreatedAt  time.Time `json:"created_at"`
	StoredName string    `json:"-"`
}

type ArticleInput struct {
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Content        string   `json:"content"`
	Skills         []string `json:"skills"`
	ContributorIDs []int64  `json:"contributor_ids"`
}

type SearchResults struct {
	Employees []Employee `json:"employees"`
	Articles  []Article  `json:"articles"`
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
