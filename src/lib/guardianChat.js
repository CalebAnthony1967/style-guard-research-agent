import { apiFetch, db } from '@/lib/db';
import { logEvent } from '@/lib/auditLog';

export async function ensureSession({ user, manuscriptId, mode = 'GENERAL_CHAT', title }) {
  if (!user?.id) return null;
  const sessions = await db.chat.listSessions({ userId: user.id, limit: 20 });
  const existing = sessions.find(
    (s) => (s.manuscript_id || '') === (manuscriptId || '') && s.mode === mode,
  );
  if (existing) return existing;
  return db.chat.createSession({
    userId: user.id,
    manuscriptId: manuscriptId || null,
    mode,
    title: title || 'Guardian session',
  });
}

export async function loadMessages(sessionId) {
  if (!sessionId) return [];
  return db.chat.loadMessages(sessionId);
}

/** Guardian turn: grounded via server-side hybrid vector+BM25 RAG and Gemini tool-enabled Co-Pilot. */
export async function askGuardian({ session, message, manuscript, audit, findings, control, user, role }) {
  const messageHistory = await loadMessages(session.id);

  const history = messageHistory
    .slice(-10)
    .map((m) => `${m.sender === 'USER' ? 'Officer' : 'Guardian'}: ${m.content}`)
    .join('\n');

  await db.chat.createMessage({ sessionId: session.id, sender: 'USER', content: message });

  let reply;
  let citations = [];
  let proposedPatch = null;
  let recommendedAction = 'NONE';
  try {
    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      body: {
        message,
        mode: session?.mode || 'CO_PILOT_EDIT',
        manuscript: manuscript
          ? {
              id: manuscript.id,
              title: manuscript.title,
              paper_type: manuscript.paper_type,
              stage: manuscript.stage,
              abstract: manuscript.abstract,
              expected_outputs: manuscript.expected_outputs,
              tor_text: manuscript.tor_text,
              manuscript_text: manuscript.manuscript_text,
            }
          : null,
        audit: audit
          ? {
              overall_score: audit.overall_score,
              house_style_score: audit.house_style_score,
              policy_rigor_score: audit.policy_rigor_score,
              output_alignment_score: audit.output_alignment_score,
            }
          : null,
        control: control || null,
        findings: (findings || []).slice(0, 20),
        history,
        role,
      },
    });
    reply = res.reply;
    citations = res.citations || [];
    proposedPatch = res.proposed_patch || null;
    recommendedAction = res.recommended_action || 'NONE';
  } catch (err) {
    reply = `Guardian could not reach the reasoner: ${err.message}. The deterministic findings on this page remain valid and can be exported as a scorecard.`;
  }

  const agentMessage = await db.chat.createMessage({
    sessionId: session.id,
    sender: 'AGENT',
    content: reply,
  });

  return {
    reply,
    agentMessage,
    history: messageHistory,
    citations,
    proposedPatch,
    recommendedAction,
  };
}

export async function applyCoPilotPatch({ manuscript, patch, user }) {
  if (!manuscript?.id || !patch?.replacement_text) {
    throw new Error('No valid revision patch to apply.');
  }
  const current = manuscript.manuscript_text || '';
  const excerpt = (patch.target_excerpt || '').trim();
  let nextText;
  if (excerpt && current.includes(excerpt)) {
    nextText = current.replace(excerpt, patch.replacement_text);
  } else {
    nextText = `${current.trim()}\n\n${patch.replacement_text}`.trim();
  }

  const updated = await db.manuscripts.update(manuscript.id, {
    manuscript_text: nextText,
    revision_text: nextText,
  });

  await logEvent({
    actionType: 'COPILOT_PATCH_APPLIED',
    user,
    manuscriptId: manuscript.id,
    summary: patch.summary || `Applied Guardian Co-Pilot revision (${patch.rule_identifier || 'standards'})`,
    details: { rule_identifier: patch.rule_identifier || '' },
  });

  return updated;
}