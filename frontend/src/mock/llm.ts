/** Mock LLM intent parser.
 *  Real implementation: replace `parseIntent` with a Claude tool-call request.
 *  Intent shape is identical to what the LLM tool would return. */

export type Intent =
  | { type: 'search'; query: string }
  | { type: 'navigate'; route: string; label: string }
  | { type: 'find_skill'; skill: string }
  | { type: 'create_profile' }
  | { type: 'exit_interview' }
  | { type: 'show_heatmap' }
  | { type: 'wissensbasis' }
  | { type: 'unknown'; query: string }

export interface CommandResult {
  intent: Intent
  label: string
  description: string
  icon: string
}

export function parseIntent(input: string): CommandResult | null {
  const q = input.trim().toLowerCase()
  if (q.length < 3) return null

  if (/exit.interview|i'?m\s+leaving|offboard|departing|leaving\s+the\s+company/.test(q)) {
    return {
      intent: { type: 'exit_interview' },
      label: 'Start exit interview',
      description: 'AI-guided knowledge documentation for departing employees',
      icon: '🚪',
    }
  }

  if (/create\s+(a\s+)?(my\s+)?(employee\s+)?profile|add\s+myself|register\s+me/.test(q)) {
    return {
      intent: { type: 'create_profile' },
      label: 'Document your knowledge',
      description: 'Open the AI knowledge-capture assistant',
      icon: '👤',
    }
  }

  const skillMatch = q.match(/who\s+(knows?|has|can|is\s+good\s+at|uses?)\s+(.+)$/) ||
                     q.match(/find\s+(someone\s+with\s+|expert[s]?\s+in\s+|people\s+with\s+)?(.+)$/) ||
                     q.match(/search\s+(?:for\s+)?skill[:\s]+(.+)$/)
  if (skillMatch) {
    const skill = (skillMatch[2] ?? skillMatch[1] ?? '').trim()
    return {
      intent: { type: 'find_skill', skill },
      label: `Find experts in "${skill}"`,
      description: 'Show all employees with this skill',
      icon: '↗',
    }
  }

  if (/heatmap|competenc|skill\s+map|department|browse\s+employee|all\s+employee/.test(q)) {
    return {
      intent: { type: 'show_heatmap' },
      label: 'Browse Employees',
      description: 'View employees and their skill profiles',
      icon: '∴',
    }
  }

  if (/wissensbasis|knowledge\s*base|artikel|article/.test(q)) {
    return {
      intent: { type: 'wissensbasis' },
      label: 'Open Knowledge Base',
      description: 'Browse knowledge-base articles',
      icon: '≡',
    }
  }

  if (/\b(go\s+to|open|navigate|show\s+me)\b/.test(q)) {
    if (/employee|mitarbeiter|people|team/.test(q)) {
      return {
        intent: { type: 'navigate', route: '/employees', label: 'Employees' },
        label: 'Go to Employees',
        description: 'View all employee profiles',
        icon: '∴',
      }
    }
  }

  return null
}

// isSearchIntent decides whether pressing Enter on a query should behave as a
// plain search/navigation (handled inside Spotlight) or hand off to the AI
// assistant chat. It is deliberately conservative: anything that looks like an
// action, a question, or free-form prose is treated as conversational so the
// assistant can act on it. Short keyword lookups stay in Spotlight.
export function isSearchIntent(query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  // Action verbs → the user wants the assistant to DO something.
  if (/\b(create|add|make|new|register|update|edit|change|rename|set|delete|remove|assign|draft|write|generate)\b/.test(q)) {
    return false
  }

  // Question / conversational phrasing → assistant.
  if (/[?]/.test(q)) return false
  if (/^(who|what|which|how|why|when|where|can you|could you|please|help|tell me|list|find me|give me|show all)\b/.test(q)) {
    return false
  }

  // Long free-form input is almost never a keyword lookup.
  const words = q.split(/\s+/)
  if (words.length > 5) return false

  // Otherwise treat it as a search (names, skills, short lookups).
  return true
}
