import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Copy, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { safeReturnTo } from '@/lib/authReturnTo';

export function useAppInfo() {
  return { name: 'KIPPRA StyleGuard' };
}

export function MfaScreen({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8">{children}</div>
    </div>
  );
}

export function MfaHeader({ title, description }) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
        <ShieldCheck className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground min-h-[2rem]">{title}</h1>
      {description && <p className="text-muted-foreground mt-2">{description}</p>}
    </div>
  );
}

export function CodeField({ id, label = 'Enter the 6-digit code', value, onChange, onComplete, hasError = false }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block text-center font-normal text-muted-foreground">{label}</Label>
      <InputOTP
        id={id}
        maxLength={6}
        value={value}
        autoFocus
        autoComplete="one-time-code"
        containerClassName="justify-center"
        onChange={(next) => {
          onChange(next);
          if (next.length === 6) onComplete?.(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onComplete) {
            e.preventDefault();
            onComplete(value);
          }
        }}
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} className={hasError ? 'border-destructive' : undefined} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

export function ResendLine({ cooldown, disabled, onResend, error }) {
  return (
    <div className="space-y-1 text-center">
      <p className="text-sm text-muted-foreground">
        Didn&apos;t receive a code?{' '}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button type="button" disabled={disabled} onClick={onResend} className="font-semibold text-foreground hover:underline disabled:opacity-50">
            Resend
          </button>
        )}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export const INVALID_PHONE = 'Invalid phone number. Please check the number and try again.';

const COUNTRY_DIAL_CODES = new Map(
  'ke254 ug256 tz255 rw250 et251 gb44 us1 za27 ng234 gh233 in91 de49 fr33'.split(' ').map((e) => [e.slice(0, 2), e.slice(2)]),
);
const DIAL_CODES = [...new Set(COUNTRY_DIAL_CODES.values())].sort((a, b) => Number(a) - Number(b));

export function defaultDialCode() {
  const region = typeof navigator === 'undefined' ? undefined : navigator.language.split('-')[1]?.toLowerCase();
  const dialCode = region && COUNTRY_DIAL_CODES.get(region);
  return dialCode ? `+${dialCode}` : '+254';
}

export function isPlausiblePhone(fullPhone) {
  const digits = fullPhone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

const matchesSearch = (code, search) => {
  const normalized = search.replace(/\+/g, '');
  return normalized === '' || code.startsWith(normalized);
};

function DialCodePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const search = useRef('');

  const handleOpenChange = (next) => {
    if (!next && search.current) {
      const matches = DIAL_CODES.filter((code) => matchesSearch(code, search.current));
      if (matches.length === 1) onChange(`+${matches[0]}`);
      search.current = '';
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Country code" className="h-10 w-[100px] justify-between px-2.5 font-normal shadow-none">
          {value}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0" align="start" side="bottom" avoidCollisions={false}>
        <Command filter={(item, text) => (matchesSearch(item, text) ? 1 : 0)}>
          <CommandInput placeholder="Search..." className="h-9" onValueChange={(text) => { search.current = text; }} />
          <CommandList>
            <CommandEmpty>No match</CommandEmpty>
            <CommandGroup>
              {DIAL_CODES.map((code) => (
                <CommandItem key={code} value={code} onSelect={() => { onChange(`+${code}`); search.current = ''; setOpen(false); }}>
                  +{code}
                  <Check className={cn('ml-auto h-3.5 w-3.5', value === `+${code}` ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PhoneField({ countryCode, onCountryCodeChange, phoneNumber, onPhoneNumberChange, error, onSubmit }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && phoneNumber.length >= 4 && !isPlausiblePhone(`${countryCode}${phoneNumber}`);
  const message = error ?? (invalid ? INVALID_PHONE : null);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <DialCodePicker value={countryCode} onChange={onCountryCodeChange} />
        <Input
          id="mfa-phone"
          type="tel"
          autoComplete="tel-national"
          autoFocus
          value={phoneNumber}
          maxLength={15}
          placeholder="712345678"
          aria-invalid={Boolean(message)}
          onChange={(e) => { onPhoneNumberChange(e.target.value.replace(/\D/g, '')); setTouched(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(); } }}
          className={cn('h-10 flex-1', message && 'border-destructive focus-visible:ring-destructive')}
        />
      </div>
      {message
        ? <p className="text-sm text-destructive">{message}</p>
        : <p className="text-sm text-muted-foreground">Standard message and data rates may apply.</p>}
    </div>
  );
}

export function CopyKeyButton({ text, wide = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (wide) {
    return (
      <Button type="button" variant="outline" className="w-full h-11" onClick={copy}>
        {copied ? 'Copied' : 'Copy key'}
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}

export function MfaNotice({ error, signInPath = '/login' }) {
  if (!error) return null;
  const returnTo = safeReturnTo();
  return (
    <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
      {error.mustSignInAgain ? (
        <>
          Your sign-in expired.{' '}
          <a href={signInPath + (returnTo !== '/' ? '?returnTo=' + encodeURIComponent(returnTo) : '')} className="font-medium underline">
            Sign in again
          </a>
        </>
      ) : (error.message || 'Verification failed. Please try again.')}
    </div>
  );
}

export function RememberDevice({ checked, onChange }) {
  return (
    <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Remember this device for 30 days
    </label>
  );
}

export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}

export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}
