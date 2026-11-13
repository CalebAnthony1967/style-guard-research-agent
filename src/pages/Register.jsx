import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Mail, User, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/db';
import { safeReturnTo } from '@/lib/authReturnTo';
import { RESEARCH_DIRECTORATES, departmentsForDirectorate } from '@/lib/orgChart';
import AuthLayout from '@/components/AuthLayout';
import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// 2FA / OTP verification code UI commented out per password-only registration policy:
// import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function Register() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [directorate, setDirectorate] = useState(RESEARCH_DIRECTORATES[0].name);
  const [department, setDepartment] = useState(RESEARCH_DIRECTORATES[0].departments[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // const [verifying, setVerifying] = useState(false);
  // const [otpCode, setOtpCode] = useState('');

  const availableDepts = departmentsForDirectorate(directorate);
  const returnTo = safeReturnTo();
  const loginPath = '/login' + (returnTo !== '/' ? '?returnTo=' + encodeURIComponent(returnTo) : '');

  // Commented out two-factor / email code confirmation screen:
  // if (verifying) {
  //   return (
  //     <AuthLayout icon={Mail} title="Verify your email" subtitle={`Enter the confirmation code sent to ${email}`}>
  //       <div className="flex justify-center mb-6">
  //         <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
  //           <InputOTPGroup>
  //             {[0, 1, 2, 3, 4, 5].map((index) => (
  //               <InputOTPSlot key={index} index={index} />
  //             ))}
  //           </InputOTPGroup>
  //         </InputOTP>
  //       </div>
  //     </AuthLayout>
  //   );
  // }

  const handleDirectorateChange = (nextDir) => {
    setDirectorate(nextDir);
    const depts = departmentsForDirectorate(nextDir);
    if (!depts.includes(department)) {
      setDepartment(depts[0] || '');
    }
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Register with your KIPPRA Directorate and Department"
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginPath} className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-11 text-sm font-medium mb-5"
        type="button"
        onClick={async () => {
          try {
            const { error: oauthErr } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin + returnTo },
            });
            if (oauthErr) throw oauthErr;
          } catch (err) {
            setError(err.message || 'Unable to sign in with Google');
          }
        }}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
            setError('Please enter at least two names (First and Last name) for official KIPPRA records.');
            return;
          }
          if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
          }
          if (!supabase) {
            setError('Authentication service is not configured.');
            return;
          }
          setLoading(true);
          try {
            const { data, error: signUpErr } = await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: window.location.origin + returnTo,
                data: {
                  full_name: fullName.trim(),
                  directorate,
                  department,
                },
              },
            });
            if (signUpErr) throw signUpErr;

            if (data?.session) {
              await apiFetch('/api/auth/profile', {
                method: 'POST',
                body: { full_name: fullName.trim(), directorate, department },
              }).catch(() => {});
              window.location.href = returnTo;
              return;
            }

            // If email confirmation is still enabled at Supabase project level, redirect cleanly to password login:
            // setVerifying(true); // OTP code verification step commented out
            toast({
              title: 'Account created',
              description: 'You may now sign in with your email and password (or ask an Administrator to confirm immediately).',
            });
            window.location.href = loginPath;
          } catch (err) {
            setError(err.message || 'Registration failed');
          } finally {
            setLoading(false);
          }
        }}
        className="space-y-3.5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full Name (Two Names)</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="e.g. Caleb Nyakeyo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-10 h-11"
              required
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="directorate">Research Directorate</Label>
            <select
              id="directorate"
              value={directorate}
              onChange={(e) => handleDirectorateChange(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
            >
              {RESEARCH_DIRECTORATES.map((d) => (
                <option key={d.name} value={d.name}>{d.short}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
            >
              {availableDepts.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@kippra.or.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-11"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-11"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}