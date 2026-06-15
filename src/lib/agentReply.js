// =====================================================================
// Agent reply — STUB.
//
// This is where a real model call goes. For governance reasons the call
// must NOT run from the browser with a provider key; route it through a
// Supabase Edge Function (or your backend) that:
//   1. authenticates the member,
//   2. retrieves only the knowledge their clearance allows,
//   3. calls the Claude API server-side, and
//   4. returns the grounded answer.
//
// To wire it up, replace the body of generateAgentReply with e.g.:
//
//   const { data, error } = await supabase.functions.invoke('agent-reply', {
//     body: { agentId, conversationId, messages },
//   })
//   return data.reply
//
// Recommended model: claude-opus-4-8 (or claude-sonnet-4-6 for lower cost).
// Until then we return a canned, on-brand placeholder per agent so the
// full UX (send, thinking, reply, copy, flag, listen) is exercisable.
// =====================================================================

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

export async function generateAgentReply({ agentId /*, conversationId, messages */ }) {
  // Simulate model latency so the typing indicator reads naturally.
  await new Promise((r) => setTimeout(r, 1100))
  return CANNED[agentId] || FALLBACK
}
