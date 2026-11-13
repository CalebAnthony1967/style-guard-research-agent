import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Loader2, Mic, Play, RotateCcw, Send, Sparkles, Square, Volume2 } from 'lucide-react';
import { applyCoPilotPatch, askGuardian, ensureSession, loadMessages } from '@/lib/guardianChat';
import { db } from '@/lib/db';
import { useVoice } from '@/components/guardian/useVoice';
import { roleOf } from '@/lib/portals';
import { Textarea } from '@/components/ui/textarea';

export default function GuardianChat({
  manuscript,
  audit,
  findings = [],
  control = null,
  mode = 'PAPER_EVALUATION',
  prompts = [],
  user,
  onApplyPatch,
  onRunAudit,
  className = '',
}) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [turnMeta, setTurnMeta] = useState({});
  const [appliedPatches, setAppliedPatches] = useState({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [error, setError] = useState('');
  const [voiceReplies, setVoiceReplies] = useState(false);
  const scrollRef = useRef(null);
  const { listening, supported, start, stop, speak } = useVoice({
    onTranscript: (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
  });

  useEffect(() => {
    let alive = true;
    setMessages([]);
    setTurnMeta({});
    ensureSession({ user, manuscriptId: manuscript?.id, mode, title: manuscript?.title })
      .then((s) => {
        if (!alive) return;
        setSession(s);
        return loadMessages(s.id);
      })
      .then((msgs) => {
        if (alive && msgs) setMessages(msgs);
      })
      .catch(() => {
        /* a fresh session is created on first message */
      });
    return () => {
      alive = false;
    };
  }, [manuscript?.id, mode, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const startNewThread = async () => {
    if (!user?.id || sending) return;
    try {
      const fresh = await db.chat.createSession({
        userId: user.id,
        manuscriptId: manuscript?.id || null,
        mode,
        title: `${manuscript?.title || 'Guardian'} · ${new Date().toLocaleTimeString()}`,
      });
      setSession(fresh);
      setMessages([]);
      setTurnMeta({});
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async (text) => {
    const body = (text ?? input).trim();
    if (!body || sending) return;
    setInput('');
    setError('');
    setSending(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'USER', content: body }]);
    try {
      const activeSession =
        session || (await ensureSession({ user, manuscriptId: manuscript?.id, mode, title: manuscript?.title }));
      if (!session) setSession(activeSession);
      const result = await askGuardian({
        session: activeSession,
        message: body,
        manuscript,
        audit,
        findings,
        control,
        user,
        role: roleOf(user),
      });
      setMessages((prev) => [...prev, result.agentMessage]);
      if (result.agentMessage?.id) {
        setTurnMeta((prev) => ({
          ...prev,
          [result.agentMessage.id]: {
            citations: result.citations || [],
            proposedPatch: result.proposedPatch || null,
            recommendedAction: result.recommendedAction || 'NONE',
          },
        }));
      }
      if (voiceReplies) speak(result.reply);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const applyPatch = async (messageId, patch) => {
    if (!manuscript || !patch || applyingId) return;
    setApplyingId(messageId);
    setError('');
    try {
      const updated = await applyCoPilotPatch({ manuscript, patch, user });
      setAppliedPatches((prev) => ({ ...prev, [messageId]: true }));
      if (onApplyPatch) {
        await onApplyPatch(updated, patch);
      } else if (onRunAudit) {
        await onRunAudit();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Guardian Co-Pilot
          </p>
          <p className="truncate text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {manuscript ? `Reviewing · ${manuscript.title.slice(0, 34)}` : 'Publication standards advice'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={startNewThread}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
            title="Start a new conversation thread"
          >
            <RotateCcw className="h-3 w-3" /> new
          </button>
          <button
            onClick={() => setVoiceReplies((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] ${
              voiceReplies ? 'border-primary/40 bg-accent text-accent-foreground' : 'border-border text-muted-foreground'
            }`}
            title="Read replies aloud"
          >
            <Volume2 className="h-3 w-3" /> voice
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[420px] min-h-[240px] flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-lg bg-secondary/60 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Ask Guardian to explain a score, cite House Style Manual / PP/06/2020 rules, fact-check against KIPPRA E-Repository precedent, or{' '}
            <span className="font-medium text-foreground">draft &amp; apply live manuscript rewrites</span> directly to your paper.
          </div>
        )}
        {messages.map((m) => {
          const meta = turnMeta[m.id];
          const patch = meta?.proposedPatch;
          const isApplied = appliedPatches[m.id];
          return (
            <div key={m.id} className={m.sender === 'USER' ? 'flex justify-end' : 'flex flex-col items-start gap-2'}>
              <div
                className={`max-w-[94%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${
                  m.sender === 'USER'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-foreground'
                }`}
              >
                {m.sender === 'USER' ? (
                  m.content
                ) : (
                  <>
                    <div className="prose-sm max-w-none [&_p]:mb-1.5 [&_ul]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-semibold">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {meta?.citations?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                        {meta.citations.slice(0, 5).map((code) => (
                          <span
                            key={code}
                            className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {m.sender !== 'USER' && patch && manuscript && (
                <div className="w-full max-w-[94%] rounded-lg border border-primary/30 bg-accent/40 p-3 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      Co-Pilot Rewrite · <span className="font-mono text-[10.5px] text-primary">{patch.rule_identifier || 'KIPPRA'}</span>
                    </p>
                    {isApplied && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-primary">
                        <CheckCircle2 className="h-3 w-3" /> Applied
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">{patch.summary}</p>
                  {patch.target_excerpt && (
                    <p className="mt-1.5 rounded bg-background/80 p-1.5 font-mono text-[10.5px] text-destructive line-through">
                      {patch.target_excerpt.slice(0, 220)}
                    </p>
                  )}
                  <p className="mt-1 rounded bg-background/90 p-1.5 font-mono text-[10.5px] text-foreground">
                    {patch.replacement_text.slice(0, 320)}
                  </p>
                  {!isApplied && (
                    <button
                      onClick={() => applyPatch(m.id, patch)}
                      disabled={applyingId === m.id}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {applyingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Apply rewrite &amp; re-review
                    </button>
                  )}
                </div>
              )}

              {m.sender !== 'USER' && !patch && meta?.recommendedAction === 'RUN_AUDIT' && onRunAudit && (
                <button
                  onClick={onRunAudit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-accent/50 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                >
                  <Play className="h-3 w-3 text-primary" /> Run fresh compliance review
                </button>
              )}
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardian is reasoning over KIPPRA standards &amp; preparing guidance…
          </div>
        )}
        {error && <p className="text-[11.5px] text-destructive">{error}</p>}
      </div>

      {prompts.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Ask Guardian or request a rewrite (e.g. “Fix all ‘shall’ statements in policy recommendations”)…"
            className="min-h-[44px] resize-none text-[12.5px]"
          />
          {supported && (
            <button
              onClick={listening ? stop : start}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                listening ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground'
              }`}
              title={listening ? 'Stop dictation' : 'Dictate a question'}
            >
              {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}