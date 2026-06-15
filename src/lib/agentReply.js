// =====================================================================
// Agent reply.
//
// Calls the `agent-reply` Supabase Edge Function, which runs the Claude
// API server-side (the key never reaches the browser) and grounds the
// answer in the conversation. The user message must already be persisted
// to the conversation before this is called — the function reads history
// from the database under the caller's RLS.
//
// If the function is unavailable (e.g. ANTHROPIC_API_KEY not yet set as a
// Supabase secret), we fall back to an on-brand canned reply so the full
// UX stays exercisable.
// =====================================================================

import { supabase } from './supabase'

const CANNED = {
  rebecca:
    'Let me ground that in our governed knowledge base. The short answer is yes, with a couple of conditions worth checking before you act on it. Want me to pull the source document so you can see the exact language?',
  strategy:
    'Good question. Based on the strategy notes on file, here is the short version, and I can expand any part. The tradeoff comes down to speed versus contract size. Want me to lay out the options side by side?',
  integration:
    'Let me check how that is wired today. In short, it runs through the governed sources with a human review step at the end. I can sketch the data flow if that helps. Want the diagram?',
  academic:
    'Happy to help. Grounding this in the Learn, Do, Be model, here is a clean starting structure, and I can adjust for your group and time. Want me to turn it into a facilitator run of show?',
}

const FALLBACK =
  'Let me ground that in our governed knowledge base. Here is a starting answer, and I can go deeper on any part. What would be most useful next?'

export async function generateAgentReply({ agentId, conversationId }) {
  try {
    const { data, error } = await supabase.functions.invoke('agent-reply', {
      body: { agentId, conversationId },
    })
    if (error) throw error
    if (data?.reply) return data.reply
    throw new Error('Empty reply')
  } catch (err) {
    // Edge function not configured / unreachable — degrade gracefully.
    console.warn('agent-reply unavailable, using fallback:', err?.message || err)
    return CANNED[agentId] || FALLBACK
  }
}
