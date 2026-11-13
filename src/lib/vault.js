import { sha256 } from '@/lib/hash';
import { db } from '@/lib/db';
import { logEvent } from '@/lib/auditLog';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomBlock = (len = 4) => Array.from({ length: len }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export const loadShares = async () => db.vault.listShares();

export const loadSessions = async () => db.vault.listSessions();

export async function issueKeyShares(user, custodians = ['Director, Corporate Services', 'Head of ICT', 'Internal Audit']) {
  const existing = (await db.vault.listShares()).filter((s) => s.is_active);
  await Promise.all(existing.map((s) => db.vault.deactivateShare(s.id)));

  const issued = [];
  for (let i = 0; i < 3; i += 1) {
    const code = `KG-${randomBlock()}-${randomBlock()}`;
    issued.push(code);
    await db.vault.createShare({
      label: ['Alpha', 'Beta', 'Gamma'][i],
      share_index: i + 1,
      code_hash: await sha256(code),
      issuer_email: user?.email || '',
      custodian: custodians[i] || '',
      is_active: true,
    });
  }

  await logEvent({
    actionType: 'VAULT_KEY_SHARES_ISSUED',
    user,
    summary: 'Three key shares issued to independent custodians',
    details: { custodians },
  });

  return issued;
}

export async function openBreakGlass({ user, codes, reason }) {
  const cleaned = (codes || []).map((c) => (c || '').trim().toUpperCase()).filter(Boolean);
  if (cleaned.length < 2) {
    throw new Error('Two independent key shares are required.');
  }
  if (!reason?.trim()) {
    throw new Error('State the reason for the break-glass session.');
  }

  const active = (await loadShares()).filter((s) => s.is_active);
  if (active.length < 3) {
    throw new Error('Key shares are not currently issued. Issue a fresh set first.');
  }

  const hashes = await Promise.all(cleaned.map((c) => sha256(c)));
  const matched = active.filter((s) => hashes.includes(s.code_hash));
  if (matched.length < 2) {
    throw new Error('The supplied shares did not verify against two active custodians.');
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000);
  const session = await db.vault.createSession({
    opened_by_email: user?.email || '',
    reason,
    shares_verified: matched.length,
    opened_at: now.toISOString(),
    expires_at: expires.toISOString(),
    status: 'OPEN',
  });

  await logEvent({
    actionType: 'VAULT_BREAK_GLASS_OPENED',
    user,
    summary: `Break-glass session opened with ${matched.length} key shares`,
    details: { reason, shares: matched.map((m) => m.label), expires_at: expires.toISOString() },
  });

  return session;
}