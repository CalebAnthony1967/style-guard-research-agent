import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/db';

export function useManuscriptDetail(manuscriptId) {
  const [manuscript, setManuscript] = useState(null);
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!manuscriptId) {
      setManuscript(null);
      setControl(null);
      return;
    }
    setLoading(true);
    try {
      const m = await db.manuscripts.get(manuscriptId);
      setManuscript(m);
      const ctrl = await db.qmsControl.getByManuscript(manuscriptId).catch(() => null);
      setControl(ctrl);
    } finally {
      setLoading(false);
    }
  }, [manuscriptId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { manuscript, control, loading, reload };
}