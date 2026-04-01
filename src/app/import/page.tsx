'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper } from '@/components/layout';
import { AppPageHeader, AppCard, AppCardBody, AppCardHeader, AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { Upload, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { parse } from 'csv-parse/sync';
import { type Platform, mapRow, type MappedClientRow } from '@/lib/import/field-maps';
import { toastSuccess, toastError } from '@/lib/toast';

type Step = 'platform' | 'upload' | 'preview' | 'importing' | 'done';

const PLATFORMS: { id: Platform; label: string; description: string }[] = [
  { id: 'time-to-pet', label: 'Time To Pet', description: 'Export from Settings → Data → Export Clients' },
  { id: 'gingr', label: 'Gingr', description: 'Export from Customers → Export → CSV' },
  { id: 'petexec', label: 'PetExec', description: 'Export from Reports → Client List → Export' },
  { id: 'generic', label: 'Generic CSV', description: 'Any CSV with client names, emails, phones, and pet info' },
];

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  clients: Array<{ id: string; name: string; isNew: boolean }>;
}

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('platform');
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mappedRows, setMappedRows] = useState<(MappedClientRow & { _rowIndex: number })[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handlePlatformSelect = (p: Platform) => {
    setPlatform(p);
    setStep('upload');
  };

  const handleFileUpload = useCallback((file: File) => {
    if (!platform) return;
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const records = parse(text, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relaxQuotes: true,
          relaxColumnCount: true,
        }) as Record<string, string>[];

        if (records.length === 0) {
          setParseError('CSV file is empty or has no data rows.');
          return;
        }

        setRawRows(records);
        const mapped = records.map((row, i) => ({
          ...mapRow(row, platform),
          _rowIndex: i + 1,
        }));
        setMappedRows(mapped);
        setStep('preview');
      } catch (err: any) {
        setParseError(err?.message || 'Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  }, [platform]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileUpload(file);
    } else {
      setParseError('Please upload a CSV file');
    }
  }, [handleFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleImport = async () => {
    if (!platform || mappedRows.length === 0) return;
    setImporting(true);
    setStep('importing');

    try {
      const res = await fetch('/api/ops/import/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, rows: mappedRows }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Import failed');
      }

      const data = await res.json();
      setResult(data.data);
      setStep('done');
      toastSuccess(`Imported ${data.data.imported} clients`);
    } catch (err: any) {
      toastError(err?.message || 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // Stats for preview
  const uniqueClients = new Set(
    mappedRows
      .map(r => (r.email || r.phone || '').toLowerCase())
      .filter(Boolean)
  ).size;
  const totalPets = mappedRows.filter(r => r.petName).length;
  const warningRows = mappedRows.filter(r => !r.email && !r.phone);

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="narrow">
        <AppPageHeader
          title="Import Clients"
          subtitle="Move client and pet data into Snout with a safer, more guided migration flow."
        />

        {step !== 'done' && (
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
              <AppCardHeader title="A premium migration should feel safe" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Import is a trust moment. Owners need to know what platform they are coming from, what data will map cleanly, and what will be reviewed before anything changes in the live workspace.</p>
                <p>This flow keeps migration simple: choose the source, preview the mapping, then import only after the data looks right.</p>
              </AppCardBody>
            </AppCard>
            <AppCard>
              <AppCardHeader title="What to expect" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Supported exports map client identity, contact details, addresses, and pet records where available.</p>
                <p>Rows missing both email and phone are flagged before import so bad data does not quietly pollute the system.</p>
                <p>After import, the team can move directly into clients and bookings without starting from scratch.</p>
              </AppCardBody>
            </AppCard>
          </div>
        )}

        {/* Step: Platform selection */}
        {step === 'platform' && (
          <div className="space-y-3 mt-4">
            <p className="text-sm text-text-secondary">
              Which software are you migrating from?
            </p>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePlatformSelect(p.id)}
                className="flex w-full items-center gap-4 rounded-xl border border-border-default bg-surface-primary px-4 py-4 text-left transition hover:bg-surface-secondary hover:border-border-strong"
              >
                <FileSpreadsheet className="h-5 w-5 text-accent-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{p.label}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{p.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Upload CSV */}
        {step === 'upload' && (
          <div className="space-y-4 mt-4">
            <button
              type="button"
              onClick={() => setStep('platform')}
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            <AppCard>
              <AppCardHeader>
                <p className="font-medium text-text-primary">
                  Upload your {PLATFORMS.find(p => p.id === platform)?.label} export
                </p>
              </AppCardHeader>
              <AppCardBody>
                <div className="mb-4 rounded-xl border border-border-default bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
                  Your data is previewed before import. Nothing is written into the workspace until you confirm the mapped rows.
                </div>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-default bg-surface-secondary px-6 py-12 text-center transition hover:border-accent-primary"
                >
                  <Upload className="h-8 w-8 text-text-tertiary mb-3" />
                  <p className="text-sm font-medium text-text-primary">
                    Drag and drop your CSV file here
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">or</p>
                  <label className="mt-3 cursor-pointer rounded-lg border border-border-default bg-surface-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
                    Browse files
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
                {parseError && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-status-danger-bg px-3 py-2 text-sm text-status-danger-text">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {parseError}
                  </div>
                )}
              </AppCardBody>
            </AppCard>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4 mt-4">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border-default bg-surface-primary px-4 py-3 text-center">
                <p className="text-2xl font-bold text-text-primary">{uniqueClients}</p>
                <p className="text-xs text-text-tertiary">Clients</p>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-primary px-4 py-3 text-center">
                <p className="text-2xl font-bold text-text-primary">{totalPets}</p>
                <p className="text-xs text-text-tertiary">Pets</p>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-primary px-4 py-3 text-center">
                <p className="text-2xl font-bold text-text-primary">{rawRows.length}</p>
                <p className="text-xs text-text-tertiary">Rows</p>
              </div>
            </div>

            {warningRows.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {warningRows.length} row{warningRows.length > 1 ? 's' : ''} missing email and phone will be skipped unless corrected first
              </div>
            )}

            {/* Preview table */}
            <AppCard>
              <AppCardHeader>
                <p className="font-medium text-text-primary">Preview (first 10 rows)</p>
              </AppCardHeader>
              <AppCardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-default text-left text-xs text-text-tertiary">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Email</th>
                        <th className="pb-2 pr-3">Phone</th>
                        <th className="pb-2 pr-3">Pet</th>
                        <th className="pb-2">Species</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedRows.slice(0, 10).map((row) => (
                        <tr key={row._rowIndex} className="border-b border-border-muted last:border-0">
                          <td className="py-2 pr-3 text-text-tertiary">{row._rowIndex}</td>
                          <td className="py-2 pr-3 text-text-primary">{[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}</td>
                          <td className="py-2 pr-3 text-text-secondary">{row.email || '—'}</td>
                          <td className="py-2 pr-3 text-text-secondary">{row.phone || '—'}</td>
                          <td className="py-2 pr-3 text-text-secondary">{row.petName || '—'}</td>
                          <td className="py-2 text-text-secondary">{row.petSpecies || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mappedRows.length > 10 && (
                    <p className="mt-2 text-xs text-text-tertiary">
                      ...and {mappedRows.length - 10} more rows
                    </p>
                  )}
                </div>
              </AppCardBody>
            </AppCard>

            <Button
              variant="primary"
              size="lg"
              onClick={() => void handleImport()}
              className="w-full"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Import {uniqueClients} client{uniqueClients !== 1 ? 's' : ''} and {totalPets} pet{totalPets !== 1 ? 's' : ''}
            </Button>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
            <div className="mt-8 flex flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-primary border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-text-primary">Importing your migration...</p>
            <p className="mt-1 text-xs text-text-tertiary">
              Processing {uniqueClients} clients and {totalPets} pets with duplicate and mapping checks
            </p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className="space-y-4 mt-4">
            <div className="flex flex-col items-center rounded-xl border border-status-success-border bg-status-success-bg px-6 py-8 text-center">
              <CheckCircle className="h-10 w-10 text-status-success-text" />
              <p className="mt-3 text-lg font-semibold text-status-success-text">Import complete!</p>
              <div className="mt-2 flex gap-6 text-sm">
                <div>
                  <p className="text-2xl font-bold text-status-success-text">{result.imported}</p>
                  <p className="text-status-success-text-secondary">Imported</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-secondary">{result.skipped}</p>
                  <p className="text-text-tertiary">Already existed</p>
                </div>
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-status-danger-text">{result.errors.length}</p>
                    <p className="text-status-danger-text-secondary">Errors</p>
                  </div>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <AppCard>
                <AppCardHeader>
                  <p className="font-medium text-status-danger-text">Errors ({result.errors.length})</p>
                </AppCardHeader>
                <AppCardBody>
                  <ul className="space-y-1 text-sm">
                    {result.errors.slice(0, 20).map((err, i) => (
                      <li key={i} className="text-text-secondary">
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                    {result.errors.length > 20 && (
                      <li className="text-text-tertiary">...and {result.errors.length - 20} more</li>
                    )}
                  </ul>
                </AppCardBody>
              </AppCard>
            )}

            <div className="flex gap-3">
              <Button variant="primary" size="md" onClick={() => router.push('/clients')} className="flex-1">
                View clients
              </Button>
              <Button variant="secondary" size="md" onClick={() => { setStep('platform'); setRawRows([]); setMappedRows([]); setResult(null); }} className="flex-1">
                Import more
              </Button>
            </div>
          </div>
        )}
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
