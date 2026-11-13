import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import MfaMethodSetup from '@/components/MfaMethodSetup';
import { MfaHeader, MfaNotice } from '@/components/MfaParts';

export default function MfaManage({ returnTo }) {
  const [factors, setFactors] = useState(null);
  const [view, setView] = useState({ name: 'list' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      setFactors((data?.totp || []).filter((f) => f.status === 'verified'));
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeFactor = async (factorId) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (unErr) throw unErr;
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="session-record-block">
      <MfaHeader
        title="Two-factor authentication"
        description="Add an extra layer of protection when signing in. You will enter a 6-digit code from your authenticator app."
      />

      {view.name === 'setup' && (
        <MfaMethodSetup
          signInPath="/mfa"
          onDone={() => {
            setView({ name: 'list' });
            load();
          }}
          onBack={() => setView({ name: 'list' })}
        />
      )}

      {view.name === 'list' && (
        <div className="space-y-4">
          <MfaNotice error={error} signInPath="/mfa" />
          {factors === null && !error && <Loader2 className="mx-auto w-6 h-6 animate-spin text-muted-foreground" />}
          {factors !== null && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
              <Smartphone className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-[10rem]">
                <p className="font-medium">Authenticator app (TOTP)</p>
                <p className="text-sm text-muted-foreground">
                  {factors.length > 0
                    ? `${factors.length} verified authenticator ${factors.length === 1 ? 'device' : 'devices'}`
                    : 'Use Google Authenticator, 1Password, or Microsoft Authenticator.'}
                </p>
              </div>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => setView({ name: 'setup' })}>
                  {factors.length > 0 ? 'Add another' : 'Enable'}
                </Button>
                {factors[0] && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => removeFactor(factors[0].id)}
                  >
                    Disable
                  </Button>
                )}
              </div>
            </div>
          )}
          <Button
            className="w-full h-12 font-medium"
            onClick={() => {
              window.location.href = returnTo || '/settings';
            }}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
