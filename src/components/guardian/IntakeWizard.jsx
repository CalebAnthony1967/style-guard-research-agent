import { useState } from 'react';
import { CheckCircle2, FileText, Loader2, Plus, Sparkles, Upload } from 'lucide-react';
import { db } from '@/lib/db';
import { sha256 } from '@/lib/hash';
import { logEvent } from '@/lib/auditLog';
import { runGuardianAudit } from '@/lib/auditEngine';
import { PAPER_TYPES } from '@/lib/portals';
import {
  RESEARCH_DIRECTORATES,
  canonicalDepartmentName,
  departmentsForDirectorate,
  directorateForDepartment,
} from '@/lib/orgChart';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STEPS = ['Sandbox upload & scan', 'Series & details', 'Outputs & TOR'];

export default function IntakeWizard({ user, onCreated }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningTor, setScanningTor] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [torFile, setTorFile] = useState(null);
  const defaultDept = canonicalDepartmentName(user?.data?.department || user?.department || RESEARCH_DIRECTORATES[0].departments[0]);
  const defaultDir = directorateForDepartment(defaultDept) || user?.data?.directorate || user?.directorate || RESEARCH_DIRECTORATES[0].name;
  const [form, setForm] = useState({
    paper_type: 'Discussion Paper',
    title: '',
    abstract: '',
    directorate: defaultDir,
    department: defaultDept,
    manuscript_text: '',
    expected_outputs: '',
    tor_text: '',
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm({
      paper_type: 'Discussion Paper',
      title: '',
      abstract: '',
      directorate: user?.data?.directorate || user?.directorate || '',
      department: user?.data?.department || user?.department || '',
      manuscript_text: '',
      expected_outputs: '',
      tor_text: '',
    });
    setFile(null);
    setTorFile(null);
    setScanSummary(null);
    setStep(0);
    setError('');
  };

  const handleManuscriptSelect = async (picked) => {
    setFile(picked);
    setError('');
    if (!picked) return;
    setScanning(true);
    try {
      const scanned = await db.storage.scanDocument(picked, {
        kind: 'manuscript',
        fallbackDirectorate: form.directorate || user?.directorate || '',
        fallbackDepartment: form.department || user?.department || '',
      });
      setForm((prev) => {
        const matchedDept = canonicalDepartmentName(scanned.department || prev.department);
        const matchedDir = directorateForDepartment(matchedDept) || scanned.directorate || prev.directorate;
        return {
          ...prev,
          paper_type: scanned.paper_type || prev.paper_type,
          title: scanned.title || prev.title,
          abstract: scanned.abstract || prev.abstract,
          directorate: matchedDir,
          department: matchedDept,
          manuscript_text: scanned.manuscript_text || prev.manuscript_text,
          expected_outputs: scanned.expected_outputs || prev.expected_outputs,
          tor_text: scanned.tor_text || prev.tor_text,
        };
      });
      setScanSummary({
        words: scanned.word_count || 0,
        sections: scanned.detected_sections || [],
      });
    } catch (err) {
      setError(`Scan warning: ${err.message}. You can still edit the extracted text manually.`);
    } finally {
      setScanning(false);
    }
  };

  const handleTorSelect = async (picked) => {
    setTorFile(picked);
    setError('');
    if (!picked) return;
    setScanningTor(true);
    try {
      const scanned = await db.storage.scanDocument(picked, { kind: 'tor' });
      setForm((prev) => ({
        ...prev,
        expected_outputs: scanned.expected_outputs || prev.expected_outputs,
        tor_text: scanned.tor_text || prev.tor_text,
      }));
    } catch (err) {
      setError(`TOR scan warning: ${err.message}`);
    } finally {
      setScanningTor(false);
    }
  };

  const wordCount = form.manuscript_text.trim() ? form.manuscript_text.trim().split(/\s+/).length : 0;

  const canNext =
    step === 0
      ? form.manuscript_text.trim().length >= 200 && !scanning
      : step === 1
        ? form.title.trim().length > 6 && Boolean(form.paper_type)
        : true;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      let fileUri = '';
      if (file) {
        fileUri = await db.storage.uploadManuscriptFile(file);
      }
      let torFileUri = '';
      if (torFile) {
        torFileUri = await db.storage.uploadTorFile(torFile);
      }

      const fileHash = await sha256(form.manuscript_text);
      const { manuscript } = await db.manuscripts.intake({
        title: form.title.trim() || file?.name?.replace(/\.[^.]+$/, '') || 'Untitled manuscript',
        paper_type: form.paper_type,
        abstract: form.abstract.trim(),
        directorate: form.directorate.trim(),
        department: form.department.trim(),
        original_filename: file?.name || '',
        mime_type: file?.type || 'application/octet-stream',
        file_uri: fileUri,
        tor_file_uri: torFileUri || null,
        file_hash_sha256: fileHash,
        manuscript_text: form.manuscript_text,
        expected_outputs: form.expected_outputs.trim(),
        tor_text: form.tor_text.trim(),
        owner_name: user?.full_name || user?.email || '',
        owner_email: user?.email || '',
        stage: 'DRAFT_SUBMITTED',
        status: 'IN_AUDIT',
      });

      await logEvent({
        actionType: 'MANUSCRIPT_INTAKE',
        user,
        manuscriptId: manuscript.id,
        summary: `Intake accepted: ${manuscript.title}`,
        details: {
          paper_type: form.paper_type,
          words: wordCount,
          uploaded: Boolean(fileUri),
          ai_scanned: Boolean(scanSummary),
        },
      });

      await runGuardianAudit(manuscript, user);

      setOpen(false);
      reset();
      onCreated?.(manuscript);
    } catch (err) {
      setError(err.message || 'Unable to save submission');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError('');
      }}
    >
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} size="sm" className="rounded-full text-[12.5px]">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New submission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New manuscript intake</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Upload your manuscript and Guardian automatically extracts title, series, abstract, sections, and TOR deliverables before running the QMS KIPPRA/QMS/RPC/2023/03 audit.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center gap-2">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${
                  idx <= step ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {idx + 1}
              </span>
              <span className={`text-[11px] ${idx === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {idx < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-[12px]">Sandbox upload (auto-scanned by Guardian)</Label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center transition-colors hover:bg-secondary/60">
                {scanning ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-[12.5px] font-medium text-foreground">
                  {scanning
                    ? `Scanning ${file?.name || 'manuscript'}… extracting title, abstract, body & deliverables`
                    : file
                      ? file.name
                      : 'Drop or choose a .docx, .pdf, .txt, .md, .xlsx, .csv or .tsv manuscript'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  stored privately · zero manual retyping needed
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".docx,.pdf,.txt,.md,.zip,.xlsx,.csv,.tsv"
                  disabled={scanning}
                  onChange={(e) => handleManuscriptSelect(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {scanSummary && (
              <div className="rounded-lg border border-primary/25 bg-accent/40 p-3 text-[12px]">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Guardian scanned {scanSummary.words.toLocaleString()} words and pre-filled all intake fields
                </p>
                {scanSummary.sections?.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Detected headings: {scanSummary.sections.slice(0, 6).join(' · ')}
                  </p>
                )}
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between">
                <Label htmlFor="text" className="text-[12px]">Extracted manuscript body</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {wordCount.toLocaleString()} words · {form.manuscript_text.trim().length} chars
                </span>
              </div>
              <Textarea
                id="text"
                rows={8}
                value={form.manuscript_text}
                onChange={(e) => setField('manuscript_text', e.target.value)}
                placeholder={'Upload a manuscript above to auto-populate, or paste manuscript text directly (minimum 200 characters)…'}
                className="mt-1.5 font-mono text-[11.5px] leading-relaxed"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-[12px]">Publication series</Label>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {PAPER_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setField('paper_type', type)}
                    className={`rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                      form.paper_type === type
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="title" className="text-[12px]">Manuscript title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Auto-filled from document scan — review or adjust"
                className="mt-1.5 text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="abstract" className="text-[12px]">Abstract</Label>
              <Textarea
                id="abstract"
                rows={4}
                value={form.abstract}
                onChange={(e) => setField('abstract', e.target.value)}
                placeholder="Auto-extracted from manuscript abstract or executive summary (~300 words)."
                className="mt-1.5 text-[12.5px]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="directorate" className="text-[12px]">Research Directorate of origin</Label>
                <select
                  id="directorate"
                  value={form.directorate}
                  onChange={(e) => {
                    const nextDir = e.target.value;
                    const list = departmentsForDirectorate(nextDir);
                    setForm((prev) => ({
                      ...prev,
                      directorate: nextDir,
                      department: list.includes(prev.department) ? prev.department : list[0] || '',
                    }));
                  }}
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground"
                >
                  {RESEARCH_DIRECTORATES.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="department" className="text-[12px]">Department of origin</Label>
                <select
                  id="department"
                  value={form.department}
                  onChange={(e) => {
                    const nextDept = e.target.value;
                    const nextDir = directorateForDepartment(nextDept) || form.directorate;
                    setForm((prev) => ({ ...prev, department: nextDept, directorate: nextDir }));
                  }}
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground"
                >
                  {departmentsForDirectorate(form.directorate).map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-[12px]">Optional Terms of Reference file (auto-scanned)</Label>
              <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-3 text-[12px] hover:bg-secondary/60">
                {scanningTor ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span>
                  {scanningTor
                    ? `Scanning ${torFile?.name}…`
                    : torFile
                      ? `${torFile.name} scanned`
                      : 'Attach a TOR .docx / .pdf / .txt file to auto-extract outputs'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".docx,.pdf,.txt,.md"
                  disabled={scanningTor}
                  onChange={(e) => handleTorSelect(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <div>
              <Label htmlFor="outputs" className="text-[12px]">Expected research outputs</Label>
              <Textarea
                id="outputs"
                rows={4}
                value={form.expected_outputs}
                onChange={(e) => setField('expected_outputs', e.target.value)}
                placeholder="One deliverable per line — pre-filled by Guardian from your paper/TOR."
                className="mt-1.5 text-[12.5px]"
              />
            </div>
            <div>
              <Label htmlFor="tor" className="text-[12px]">Terms of reference benchmark</Label>
              <Textarea
                id="tor"
                rows={3}
                value={form.tor_text}
                onChange={(e) => setField('tor_text', e.target.value)}
                placeholder="TOR questions and policy question the paper must answer."
                className="mt-1.5 text-[12.5px]"
              />
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                On submit, the manuscript enters at <span className="font-mono text-foreground">DRAFT_SUBMITTED</span> and Guardian runs the full multi-agent audit. Nothing routes to your HOD until you reach 80% with zero critical findings.
              </span>
            </p>
          </div>
        )}

        {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}

        <DialogFooter className="mt-4 gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)} disabled={busy || scanning}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue
            </Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={busy || scanning || scanningTor || form.manuscript_text.trim().length < 200}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Accept &amp; run audit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}