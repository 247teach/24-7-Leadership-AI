// =====================================================================
// agent-reply — Supabase Edge Function
//
// Server-side Claude call for the Agent Hub. The Anthropic key lives in
// Supabase secrets and never reaches the browser. The function runs as the
// CALLER (their JWT is forwarded to a Supabase client), so Row Level Security
// enforces that a member can only pull history for their own conversations and
// only chat with agents their clearance allows.
//
// Request:  { agentId: string, conversationId: string }
// Response: { reply: string }
//
// Secret required:  ANTHROPIC_API_KEY  (supabase secrets set ANTHROPIC_API_KEY=...)
// =====================================================================

import Anthropic from 'npm:@anthropic-ai/sdk@0.69.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'claude-opus-4-8'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Brand-aligned system prompt. 24/7 Education house rules: warm, direct, plain
// language, no em-dashes; ground answers in the governed knowledge base; treat
// responses as internal and confidential.
function systemPrompt(agent: { name: string; description: string; clearance_label: string }) {
  return [
    `You are ${agent.name}, an internal AI agent for the 24/7 Education team.`,
    `Your focus: ${agent.description}`,
    `You serve team members at the "${agent.clearance_label}" clearance level.`,
    '',
    'Operating philosophy: Human Led, AI Facilitated. You assist; people decide.',
    "Ground your answers in 24/7 Education's governed knowledge base (policy, playbooks, strategy notes). When you are not certain, say so plainly and suggest where a person could confirm.",
    'Every response is internal and confidential.',
    '',
    'Voice: warm, direct, confident, plain language, no corporate fluff.',
    'Do not use em-dashes. Use commas, periods, or parentheses instead.',
    'Be concise. Lead with the answer, then the supporting detail.',
  ].join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  let body: { agentId?: string; conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { agentId, conversationId } = body
  if (!agentId || !conversationId) {
    return json({ error: 'agentId and conversationId are required' }, 400)
  }

  // Run as the caller so RLS gates what we can read.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Agent metadata (readable by any authenticated member).
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('name, description, clearance_label')
    .eq('id', agentId)
    .single()
  if (agentErr || !agent) return json({ error: 'Agent not found' }, 404)

  // Conversation history. RLS returns rows only if the caller owns the
  // conversation, so this doubles as an authorization check.
  const { data: history, error: histErr } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at')
  if (histErr) return json({ error: 'Could not load conversation' }, 403)
  if (!history || history.length === 0) {
    return json({ error: 'No conversation history visible to this user' }, 403)
  }

  // Map our roles to the Messages API. Drop the leading agent greeting so the
  // transcript starts on a user turn, and collapse the rest.
  const messages = history
    .map((m) => ({
      role: m.role === 'agent' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }))
    .filter((m) => m.content && m.content.trim().length > 0)

  while (messages.length && messages[0].role === 'assistant') messages.shift()
  if (messages.length === 0) return json({ error: 'Nothing to respond to yet' }, 400)

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: systemPrompt(agent),
      messages,
    })

    const reply = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim()

    if (response.stop_reason === 'refusal' || !reply) {
      return json({
        reply:
          'I am not able to answer that one. If it is about our governed knowledge, try rephrasing, or check with a teammate who owns that area.',
      })
    }

    return json({ reply })
  } catch (err) {
    console.error('Anthropic call failed:', err)
    return json({ error: 'The agent could not generate a reply right now.' }, 502)
  }
})
