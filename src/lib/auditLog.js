import { sha256 } from '@/lib/hash';
import { apiFetch, db } from '@/lib/db';
import { roleOf } from '@/lib/portals';

export async function logEvent({ actionType, user, manuscriptId, summary, details = {}, role }) {
  return apiFetch('/api/audit/log', {
    method: 'POST',
    body: {
      actionType,
      manuscriptId: manuscriptId || null,
      summary: summary || '',
      details,
      role: role || roleOf(user),
    },
  });
}

export async function verifyAuditChain() {
  const items = await db.auditLogs.list({ ascending: true, limit: 500 });
  let expectedPrev = 'GENESIS';
  const records = [];

  for (const item of items) {
    const hashOk = (await sha256(item.hash_input || '')) === item.payload_hash;
    const linkOk = item.prev_hash === expectedPrev;
    records.push({
      id: item.id,
      created_date: item.created_date,
      action_type: item.action_type,
      actor_email: item.actor_email,
      summary: item.summary,
      payload_hash: item.payload_hash,
      hash_ok: hashOk,
      link_ok: linkOk,
      verified: hashOk && linkOk,
    });
    expectedPrev = item.payload_hash;
  }

  return {
    records: records.reverse(),
    total: records.length,
    verified: records.every((r) => r.verified),
  };
}