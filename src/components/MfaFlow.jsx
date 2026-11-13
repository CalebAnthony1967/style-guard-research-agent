import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { CodeField, MfaHeader, MfaNotice } from '@/components/MfaParts';

export default function MfaFlow({ challenge, returnTo }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const verify = async (val = code) => {
    if (busy || val.length < 6 || !challenge?.factorId || !supabase) return;
    setError(null);
    setBusy(true);
    try {
      const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: challenge.factorId,
        code: val,
      });
      if (mfaErr) throw mfaErr;
      await apiFetch('/api/auth/profile', { method: 'POST', body: {} }).catch(() => {});
      window.location.href = returnTo || '/';
    } catch (err) {
      setError(err);
      setCode('');
      setBusy(false);
    }
  };

  return (
    <div className="session-record-block">
      <MfaHeader title="Verify your identity" />
      <div className="space-y-4">
        <MfaNotice error={error} />
        <p className="text-sm text-muted-foreground text-center">
          Enter the 6-digit code from your authenticator app
        </p>
        <CodeField id="mfa-code" value={code} onChange={setCode} onComplete={verify} />
        <Button className="w-full h-12 font-medium" disabled={busy || code.length < 6} onClick={() => verify()}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {busy ? 'Verifying...' : 'Verify'}
        </Button>
        <div className="text-center">
          <a
            href={returnTo && returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}