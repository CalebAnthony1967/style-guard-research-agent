import { base44 } from '@/api/base44Client';

export async function ensureSession({ user, manuscriptId, mode = 'GENERAL_CHAT', title }) {
  const page = await base44.entities.ChatSession.list({ sort: '-created_date', limit: 20 });
  const existing = (page?.items || []).find(
    (s) => (s.manuscript_id || '') === (manuscriptId || '') && s.mode === mode && (s.created_by_id || s.created_by) === (user?.id || s.created_by_id),
  );
  if (existing) return existing;
  return base44.entities.ChatSession.create({
    manuscript_id: manuscriptId || '',
    mode,
    title: title || 'Guardian session',
  });
}

export async function loadMessages(sessionId) {
  if (!sessionId) return [];
  const page = await base44.entities.ChatMessage.filter({ session_id: sessionId }, { sort: 'created_date', limit: 100 });
  return page?.items || [];
}

/** Guardian turn: grounded in the knowledge base, the manuscript and its audit. */
export async function askGuardian({ session, message, manuscript, audit, findings, user, role }) {
  const [rules, messageHistory] = await Promise.all([
    base44.entities.KnowledgeRule.list({ sort: '-updated_date', limit: 24 }),
    loadMessages(session.id),
  ]);

  const knowledge = (rules?.items || [])
    .map((r) => `[${r.rule_identifier}] ${r.rule_title}: ${(r.rule_content || '').slice(0, 320)}`)
    .join('\n');

  const manuscriptContext = manuscript
    ? `Manuscript: "${manuscript.title}" (${manuscript.paper_type}, stage ${manuscript.stage}).
Expected outputs: ${(manuscript.expected_outputs || 'none supplied').slice(0, 500)}
Latest audit: ${audit ? `${audit.overall_score}% overall; house style ${audit.house_style_score}%, policy rigour ${audit.policy_rigor_score}%, output alignment ${audit.output_alignment_score}%` : 'not yet audited'}.
Top findings: ${(findings || []).slice(0, 10).map((f) => `[${f.severity}] ${f.rule_identifier}: ${f.issue_detected}`).join(' | ') || 'none'}.
Extract: """${(manuscript.manuscript_text || '').slice(0, 2500)}"""`
    : 'No manuscript is currently selected.';

  const history = messageHistory.slice(-8).map((m) => `${m.sender === 'USER' ? 'Officer' : 'Guardian'}: ${m.content}`).join('\n');

  await base44.entities.ChatMessage.create({ session_id: session.id, sender: 'USER', content: message });

  const prompt = `You are Guardian, the compliance agent of KIPPRA StyleGuard at the Kenya Institute for Public Policy Research and Analysis. You answer with precision, cite the exact rule identifier whenever you make a compliance claim, and never invent a rule, statistic or citation. If evidence is missing, say so plainly.

Knowledge base (House Style Manual 2010, PP/06/2020, QMS control form, repository):
${knowledge || 'No rules loaded.'}

${manuscriptContext}

Conversation so far:
${history || '(new conversation)'}

Officer (${role}) asks: ${message}

Reply in under 190 words, in markdown, addressed to the officer. Where relevant: name the rule code, quote the offending phrase, and give the correction.`;

  let reply;
  try {
    reply = await base44.integrations.Core.InvokeLLM({ prompt });
  } catch (err) {
    reply = `Guardian could not reach the reasoner: ${err.message}. The deterministic findings on this page remain valid and can be exported as a scorecard.`;
  }

  const agentMessage = await base44.entities.ChatMessage.create({ session_id: session.id, sender: 'AGENT', content: reply });
  return { reply, agentMessage, history: messageHistory };
}