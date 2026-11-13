import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function SignOffForm({ eyebrow = 'Human gate', title, description, noteLabel, actions = [], onPerform, busy, extra, tone }) {
  const [note, setNote] = useState('');

  return (
    <section className={`rounded-xl border bg-card p-5 ${tone === 'danger' ? 'border-destructive/30' : 'border-border'}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1.5 text-xl text-foreground">{title}</h2>
      {description && <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
      {extra}
      {noteLabel && (
        <Textarea
          className="mt-3 text-[12.5px]"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={noteLabel}
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.action}
            onClick={() => onPerform(a.action, { note })}
            disabled={busy}
            variant={a.variant || 'default'}
            size="sm"
            className="text-[12.5px]"
          >
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {a.label}
          </Button>
        ))}
      </div>
    </section>
  );
}