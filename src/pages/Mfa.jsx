import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { safeReturnTo } from '@/lib/authReturnTo';
import MfaManage from '@/components/MfaManage';
import { MfaHeader, MfaScreen } from '@/components/MfaParts';
import { Button } from '@/components/ui/button';

export default function Mfa() {
  const returnTo = safeReturnTo();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data?.session)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MfaScreen>
      {signedIn ? (
        <MfaManage returnTo={returnTo} />
      ) : (
        <div className="space-y-4 text-center">
          <MfaHeader
            title="Sign in required"
            description="Sign in to your KIPPRA StyleGuard account before managing two-factor authentication."
          />
          <Button asChild className="w-full h-11">
            <Link to={`/login?returnTo=${encodeURIComponent('/mfa?returnTo=' + encodeURIComponent(returnTo))}`}>
              Go to Sign In
            </Link>
          </Button>
        </div>
      )}
    </MfaScreen>
  );
}