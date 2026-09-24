import { api } from './client'

// AgentMessage is one turn of the running transcript sent to /api/agent. The
// backend expands these flat text turns into Claude content blocks internally.
export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

// AgentAction is a mutation the agent performed on this turn (e.g. created an
// employee). The UI shows these as chips and refreshes its data when any appear.
export interface AgentAction {
  tool: string
  summary: string
}

export interface AgentReply {
  reply: string
  actions: AgentAction[]
}

// sendAgentMessage posts the full transcript and returns the assistant's reply
// plus any actions taken. Throws ApiError (status 503) when the assistant is not
// configured on the server, so callers can fall back gracefully.
export async function sendAgentMessage(messages: AgentMessage[]): Promise<AgentReply> {
  const res = await api.post<AgentReply>('/api/agent', { messages })
  return { reply: res?.reply ?? '', actions: res?.actions ?? [] }
}
