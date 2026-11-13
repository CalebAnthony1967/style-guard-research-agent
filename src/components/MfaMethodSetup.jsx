import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { CodeField, CopyKeyButton, isTouchDevice, MfaNotice } from '@/components/MfaParts';

export default function MfaMethodSetup({ onDone, onBack, signInPath = '/login' }) {
  const [totpSetup, setTotpSetup] = useState(null);
  const [step, setStep] = useState('start');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [noticeError, setNoticeError] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestedTotp = useRef(false);

  useEffect(() => {
    if (requestedTotp.current || !supabase) return;
    requestedTotp.current = true;
    setBusy(true);
    supabase.auth.mfa
      .enroll({ factorType: 'totp', friendlyName: `StyleGuard Authenticator ${Date.now()}` })
      .then(({ data, error }) => {
        if (error) throw error;
        setTotpSetup({
          factorId: data.id,
          qr_code: data.totp.qr_code,
          secret_formatted: data.totp.secret.replace(/(.{4})/g, '$1 ').trim(),
        });
      })
      .catch((err) => setNoticeError(err))
      .finally(() => setBusy(false));
  }, []);

  const verify = async (val = code) => {
    if (busy || !totpSetup?.factorId || !supabase) return;
    if (val.length !== 6) {
      setFieldError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setFieldError(null);
    setNoticeError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpSetup.factorId,
        code: val,
      });
      if (error) throw error;
      onDone?.();
    } catch (err) {
      setFieldError(err.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (backLabel, handleBack, submitLabel, handleSubmit, submitDisabled = false) => (
    <div className="grid grid-cols-2 gap-3 pt-2">
      <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={handleBack}>
        {backLabel}
      </Button>
      <Button type="button" className="h-11" disabled={busy || submitDisabled} onClick={handleSubmit}>
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );

  if (step === 'start') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">Set up your authenticator app</h2>
        <MfaNotice error={noticeError} signInPath={signInPath} />
        {!totpSetup && !noticeError && <Loader2 className="mx-auto w-6 h-6 animate-spin text-muted-foreground" />}
        {totpSetup && (isTouchDevice() ? (
          <div className="space-y-3 text-sm">
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Copy the key below.</li>
              <li>In your authenticator app, add an account and paste the key.</li>
              <li>Come back here and enter the code the app shows.</li>
            </ol>
            <code className="block rounded-lg border border-border px-3 py-3 text-center font-mono font-medium tracking-wider break-all">
              {totpSetup.secret_formatted}
            </code>
            <CopyKeyButton text={totpSetup.secret_formatted} wide />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm">
            <p className="font-medium">Scan the QR code with your authenticator app</p>
            <img
              src={totpSetup.qr_code}
              alt="QR code for authenticator app setup"
              className="w-36 h-36 rounded-lg border border-border bg-white p-1"
            />
            <p className="text-muted-foreground mt-3">Can&apos;t scan the code? Enter it manually:</p>
            <div className="flex flex-wrap items-center justify-center gap-1">
              <code className="font-mono font-medium tracking-wider break-all">{totpSetup.secret_formatted}</code>
              <CopyKeyButton text={totpSetup.secret_formatted} />
            </div>
          </div>
        ))}
        {renderActions('Cancel', onBack, 'Continue', () => setStep('code'), !totpSetup)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-center">Enter a code from your authenticator app</h2>
      <div className="flex flex-col items-center gap-2">
        <CodeField
          id="mfa-setup-code"
          value={code}
          onChange={(v) => {
            setCode(v);
            setFieldError(null);
          }}
          onComplete={verify}
          hasError={Boolean(fieldError)}
        />
        {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
        <p className="text-xs text-muted-foreground">Codes refresh every 30 seconds.</p>
      </div>
      <MfaNotice error={noticeError} signInPath={signInPath} />
      {renderActions('Back', () => { setStep('start'); setCode(''); setFieldError(null); }, 'Verify', () => verify())}
    </div>
  );
}