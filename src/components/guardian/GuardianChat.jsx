import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Mic, Send, Square, Volume2 } from 'lucide-react';
import { askGuardian, ensureSession, loadMessages } from '@/lib/guardianChat';
import { useVoice } from '@/components/guardian/useVoice';
import { roleOf } from '@/lib/portals';
import { Textarea } from '@/components/ui/textarea';

export default function GuardianChat({ manuscript, audit, findings = [], mode = 'PAPER_EVALUATION', prompts = [], user, className = '' }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [voiceReplies, setVoiceReplies] = useState(false);
  const scrollRef = useRef(null);
  const { listening, supported, start, stop, speak } = useVoice({ onTranscript: (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)) });

  useEffect(() => {
    let alive = true;
    setMessages([]);
    ensureSession({ user, manuscriptId: manuscript?.id, mode, title: manuscript?.title })
      .then((s) => {
        if (!alive) return;
        setSession(s);
        return loadMessages(s.id);
      })
      .then((msgs) => { if (alive && msgs) setMessages(msgs); })
      .catch(() => { /* a fresh session is created on first message */ });
    return () => { alive = false; };
  }, [manuscript?.id, mode, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text) => {
    const body = (text ?? input).trim();
    if (!body || sending) return;
    setInput('');
    setError('');
    setSending(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'USER', content: body }]);
    try {
      const activeSession = session || (await ensureSession({ user, manuscriptId: manuscript?.id, mode, title: manuscript?.title }));
      if (!session) setSession(activeSession);
      const result = await askGuardian({
        session: activeSession,
        message: body,
        manuscript,
        audit,
        findings,
        user,
        role: roleOf(user),
      });
      setMessages((prev) => [...prev, result.agentMessage]);
      if (voiceReplies) speak(result.reply);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card ${className}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-[13px] font-medium text-foreground">Guardian</p>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {manuscript ? `Reviewing · ${manuscript.title.slice(0, 34)}` : 'Publication standards advice'}
          </p>
        </div>
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

      <div ref={scrollRef} className="max-h-[380px] min-h-[220px] flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-lg bg-secondary/60 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Ask about a requirement, a suggested correction, or how PP/06/2020 applies to this paper. Guardian answers
            from the Institute&apos;s standards and the corrections listed on this page.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.sender === 'USER' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[92%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${
                m.sender === 'USER'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-background text-foreground'
              }`}
            >
              {m.sender === 'USER' ? (
                m.content
              ) : (
                <div className="prose-sm max-w-none [&_p]:mb-1.5 [&_ul]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-semibold">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardian is reading the knowledge base…
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
            placeholder="Ask Guardian…"
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