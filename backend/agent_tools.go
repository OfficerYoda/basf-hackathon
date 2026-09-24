package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// resultError is the sentinel summary returned by runTool when the store call
// failed; handle() uses it to mark the tool_result block as an error so the
// model can recover, and to avoid recording it as a successful action.
const resultError = ""

// agentTools is the tool catalogue advertised to Claude. Each input_schema
// mirrors the corresponding model struct so tool inputs decode straight into
// the same types the HTTP handlers use.
var agentTools = []anthropicTool{
	{
		Name:        "list_employees",
		Description: "List all employees with their departments and skills. Use to look people up or before updating/deleting.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`),
	},
	{
		Name:        "find_experts",
		Description: "Find employees who have a specific skill, sorted by rating. Provide the skill name (lowercase).",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"skill":{"type":"string"}},"required":["skill"],"additionalProperties":false}`),
	},
	{
		Name:        "create_employee",
		Description: "Create a new employee. Skills must already exist (call create_skill first if needed). Ratings are 1-10.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{
			"name":{"type":"string"},
			"email":{"type":"string"},
			"department":{"type":"string"},
			"skills":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"rating":{"type":"integer","minimum":1,"maximum":10}},"required":["name","rating"]}}
		},"required":["name","email"],"additionalProperties":false}`),
	},
	{
		Name:        "update_employee",
		Description: "Replace an existing employee's details. Provide the id and the full new set of fields (skills are replaced wholesale).",
		InputSchema: json.RawMessage(`{"type":"object","properties":{
			"id":{"type":"integer"},
			"name":{"type":"string"},
			"email":{"type":"string"},
			"department":{"type":"string"},
			"skills":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"rating":{"type":"integer","minimum":1,"maximum":10}},"required":["name","rating"]}}
		},"required":["id","name","email"],"additionalProperties":false}`),
	},
	{
		Name:        "delete_employee",
		Description: "Delete an employee by id. Fails if they are the last contributor on an article.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"id":{"type":"integer"}},"required":["id"],"additionalProperties":false}`),
	},
	{
		Name:        "list_skills",
		Description: "List all known skill definitions (name + description).",
		InputSchema: json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`),
	},
	{
		Name:        "create_skill",
		Description: "Define a new skill so it can be attached to employees and articles. Name is lowercased.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"name":{"type":"string"},"description":{"type":"string"}},"required":["name"],"additionalProperties":false}`),
	},
	{
		Name:        "list_articles",
		Description: "List knowledge-base articles with titles, skills and contributors.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`),
	},
	{
		Name:        "create_article",
		Description: "Create a knowledge-base article. Skills must already exist. contributor_ids are employee ids; the first is the primary author.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{
			"title":{"type":"string"},
			"description":{"type":"string"},
			"content":{"type":"string"},
			"skills":{"type":"array","items":{"type":"string"}},
			"contributor_ids":{"type":"array","items":{"type":"integer"}}
		},"required":["title","description","content"],"additionalProperties":false}`),
	},
}

// runTool executes one tool call against the store. It returns the tool_result
// body to feed back to Claude, a sentinel summary (resultError on failure), and
// a human-readable mutation summary (empty for read-only tools or on failure)
// that is surfaced to the user and triggers a data refresh.
func (a *agentService) runTool(ctx context.Context, name string, input json.RawMessage) (result string, sentinel string, mutation string) {
	switch name {
	case "list_employees":
		employees, err := a.data.List(ctx)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(employees), "ok", ""

	case "find_experts":
		var args struct {
			Skill string `json:"skill"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		skill := strings.ToLower(strings.TrimSpace(args.Skill))
		employees, err := a.data.List(ctx)
		if err != nil {
			return toolError(err)
		}
		var matches []Employee
		for _, e := range employees {
			for _, s := range e.Skills {
				if s.Name == skill {
					matches = append(matches, e)
					break
				}
			}
		}
		return toolJSON(matches), "ok", ""

	case "create_employee":
		var employee Employee
		if err := json.Unmarshal(input, &employee); err != nil {
			return toolError(err)
		}
		if err := employee.normalizeAndValidate(); err != nil {
			return toolError(err)
		}
		created, err := a.data.Create(ctx, employee)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(created), "ok", fmt.Sprintf("Created employee %s", created.Name)

	case "update_employee":
		var body struct {
			ID int64 `json:"id"`
			Employee
		}
		if err := json.Unmarshal(input, &body); err != nil {
			return toolError(err)
		}
		if err := body.Employee.normalizeAndValidate(); err != nil {
			return toolError(err)
		}
		updated, err := a.data.Update(ctx, body.ID, body.Employee)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(updated), "ok", fmt.Sprintf("Updated employee %s", updated.Name)

	case "delete_employee":
		var args struct {
			ID int64 `json:"id"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		if err := a.data.Delete(ctx, args.ID); err != nil {
			return toolError(err)
		}
		return fmt.Sprintf("deleted employee %d", args.ID), "ok", fmt.Sprintf("Deleted employee #%d", args.ID)

	case "list_skills":
		skills, err := a.data.ListSkills(ctx)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(skills), "ok", ""

	case "create_skill":
		var skill SkillDefinition
		if err := json.Unmarshal(input, &skill); err != nil {
			return toolError(err)
		}
		if err := skill.normalizeAndValidate(); err != nil {
			return toolError(err)
		}
		created, err := a.data.CreateSkill(ctx, skill)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(created), "ok", fmt.Sprintf("Created skill %q", created.Name)

	case "list_articles":
		articles, err := a.data.ListArticles(ctx)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(articles), "ok", ""

	case "create_article":
		var article ArticleInput
		if err := json.Unmarshal(input, &article); err != nil {
			return toolError(err)
		}
		if err := article.normalizeAndValidate(); err != nil {
			return toolError(err)
		}
		created, err := a.data.CreateArticle(ctx, article)
		if err != nil {
			return toolError(err)
		}
		return toolJSON(created), "ok", fmt.Sprintf("Created article %q", created.Title)

	default:
		return fmt.Sprintf("unknown tool %q", name), resultError, ""
	}
}

// toolJSON marshals a tool result to a JSON string for feeding back to Claude.
// Marshaling these plain structs cannot realistically fail; on the off chance
// it does, the error text is returned as the content so the model still sees
// something coherent.
func toolJSON(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("could not encode result: %v", err)
	}
	return string(data)
}

func toolError(err error) (string, string, string) {
	return err.Error(), resultError, ""
}
