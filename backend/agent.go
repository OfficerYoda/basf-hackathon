package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// agentService is a thin Claude client that exposes the store's operations as
// tools. It runs a server-side tool-use loop: the model decides which tools to
// call, we execute them against the store, feed results back, and repeat until
// the model produces a final text answer. The API key never leaves the server.
//
// Requests go through the Hyperspace local proxy (base URL from BASE_URL),
// which speaks the Anthropic Messages API at /anthropic/v1/messages and
// authenticates the caller with a Bearer token (the proxy holds the real
// upstream credentials).
type agentService struct {
	data    store
	apiKey  string
	baseURL string
	model   string
	http    *http.Client
}

// defaultModel is used when LLM_MODEL is unset. Point this at a current Claude
// model id that the Hyperspace proxy accepts.
const defaultModel = "claude-sonnet-4-5"

func newAgentService(data store, apiKey, baseURL, model string) *agentService {
	if model == "" {
		model = defaultModel
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	return &agentService{
		data:    data,
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
		http:    &http.Client{Timeout: 90 * time.Second},
	}
}

// enabled reports whether the agent can talk to the proxy. When false the
// handler returns 503 and the frontend falls back to local command parsing.
func (a *agentService) enabled() bool { return a != nil && a.apiKey != "" && a.baseURL != "" }

// ---- Anthropic Messages API DTOs (only the fields we use) ----

const messagesPath = "/anthropic/v1/messages"
const anthropicVersion = "2023-06-01"
const maxToolIterations = 6

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Tools     []anthropicTool    `json:"tools,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

type anthropicMessage struct {
	Role    string             `json:"role"`
	Content []anthropicContent `json:"content"`
}

// anthropicContent is a union over the block types we send/receive: text,
// tool_use (from the model) and tool_result (our reply to a tool_use).
type anthropicContent struct {
	Type string `json:"type"`
	// text
	Text string `json:"text,omitempty"`
	// tool_use
	ID    string          `json:"id,omitempty"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
	// tool_result
	ToolUseID string `json:"tool_use_id,omitempty"`
	Content   string `json:"content,omitempty"`
	IsError   bool   `json:"is_error,omitempty"`
}

type anthropicResponse struct {
	Content    []anthropicContent `json:"content"`
	StopReason string             `json:"stop_reason"`
	Error      *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// ---- Public request/response for our own /api/agent endpoint ----

// ClientMessage is the flat transcript shape the frontend sends: plain text per
// turn. We expand it into Anthropic content blocks internally.
type ClientMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AgentAction struct {
	Tool    string `json:"tool"`
	Summary string `json:"summary"`
}

type AgentReply struct {
	Reply   string        `json:"reply"`
	Actions []AgentAction `json:"actions"`
}

const systemPrompt = `You are the assistant for Orbit, an internal tool that tracks employees, their skills (rated 1-10), and knowledge-base articles for BASF.

You can search and modify this data using the provided tools. Guidelines:
- For any request that creates, updates or deletes data, use the appropriate tool. Never claim you did something without calling the tool.
- Skill names are lowercase. A skill must exist (create_skill) before it can be attached to an employee or article.
- Employee ratings are integers 1-10. Email must be valid.
- When you look things up, answer concisely in plain prose. Do not dump raw JSON at the user.
- After performing an action, confirm briefly what you did (e.g. "Created employee Jane Doe in Sales").
- If a tool returns an error, explain it plainly and suggest how to fix it.
- Keep replies short and useful; this is a command bar, not a chat bot.`

// handle runs the full tool-use loop and returns the final assistant text plus
// a list of the mutations performed (for the UI to surface and to trigger a
// data refresh).
func (a *agentService) handle(ctx context.Context, transcript []ClientMessage) (AgentReply, error) {
	if !a.enabled() {
		return AgentReply{}, errAgentDisabled
	}

	messages := make([]anthropicMessage, 0, len(transcript)+maxToolIterations)
	for _, m := range transcript {
		role := m.Role
		if role != "assistant" {
			role = "user"
		}
		messages = append(messages, anthropicMessage{
			Role:    role,
			Content: []anthropicContent{{Type: "text", Text: m.Content}},
		})
	}

	var actions []AgentAction
	for iteration := 0; iteration < maxToolIterations; iteration++ {
		resp, err := a.callClaude(ctx, messages)
		if err != nil {
			return AgentReply{}, err
		}

		// Record the assistant turn verbatim so tool_use ids line up.
		messages = append(messages, anthropicMessage{Role: "assistant", Content: resp.Content})

		if resp.StopReason != "tool_use" {
			return AgentReply{Reply: collectText(resp.Content), Actions: actions}, nil
		}

		// Execute every tool_use block and gather the results into one user turn.
		var results []anthropicContent
		for _, block := range resp.Content {
			if block.Type != "tool_use" {
				continue
			}
			output, summary, mutated := a.runTool(ctx, block.Name, block.Input)
			if mutated != "" {
				actions = append(actions, AgentAction{Tool: block.Name, Summary: mutated})
			}
			results = append(results, anthropicContent{
				Type:      "tool_result",
				ToolUseID: block.ID,
				Content:   output,
				IsError:   summary == resultError,
			})
		}
		messages = append(messages, anthropicMessage{Role: "user", Content: results})
	}

	// Ran out of iterations — return whatever text we last had.
	return AgentReply{Reply: "I wasn't able to finish that in the allotted steps. Please try rephrasing.", Actions: actions}, nil
}

var errAgentDisabled = errors.New("agent is not configured")

func (a *agentService) callClaude(ctx context.Context, messages []anthropicMessage) (anthropicResponse, error) {
	body, err := json.Marshal(anthropicRequest{
		Model:     a.model,
		MaxTokens: 1024,
		System:    systemPrompt,
		Tools:     agentTools,
		Messages:  messages,
	})
	if err != nil {
		return anthropicResponse{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+messagesPath, bytes.NewReader(body))
	if err != nil {
		return anthropicResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	res, err := a.http.Do(req)
	if err != nil {
		return anthropicResponse{}, fmt.Errorf("call proxy: %w", err)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return anthropicResponse{}, err
	}
	if res.StatusCode != http.StatusOK {
		return anthropicResponse{}, fmt.Errorf("proxy returned %d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed anthropicResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return anthropicResponse{}, err
	}
	if parsed.Error != nil {
		return anthropicResponse{}, fmt.Errorf("proxy error: %s", parsed.Error.Message)
	}
	return parsed, nil
}

func collectText(content []anthropicContent) string {
	var parts []string
	for _, block := range content {
		if block.Type == "text" && strings.TrimSpace(block.Text) != "" {
			parts = append(parts, block.Text)
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}
