"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ParsedTransaction {
  description: string;
  amount: number;
  date: string;
  bankTransactionId?: string;
}

interface PreviewData {
  importLogId: string;
  fileName: string;
  fileType: "OFX" | "CSV";
  transactions: ParsedTransaction[];
  totalRecords: number;
}

interface ImportLogEntry {
  id: string;
  fileName: string;
  fileType: "OFX" | "CSV";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  recordsTotal: number;
  recordsImported: number;
  recordsSkipped: number;
  errors: string | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ImportacaoPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [history, setHistory] = useState<ImportLogEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Fetch import history & categories
  // -------------------------------------------------------------------------
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/importacao");
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch {
      // silent
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/custos?pageSize=1");
      // Alternatively we could have a dedicated categories endpoint;
      // for now try to fetch them from a simple route
      const catRes = await fetch("/api/dashboard");
      const catData = await catRes.json();
      if (catData.success && catData.data?.costsByCategory) {
        // Categories might come from dashboard data; let's also try direct
      }
    } catch {
      // silent
    }

    // Fetch categories directly from the custos categories-like approach
    try {
      const res = await fetch("/api/categorias");
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch {
      // If no categories endpoint exists, provide a fallback
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchCategories();
  }, [fetchHistory, fetchCategories]);

  // -------------------------------------------------------------------------
  // File upload handler
  // -------------------------------------------------------------------------
  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setPreview(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["ofx", "csv", "qfx"].includes(ext)) {
      setError("Tipo de arquivo não suportado. Use OFX ou CSV.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/importacao", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Erro ao processar arquivo");
        return;
      }

      setPreview(data.data);
    } catch {
      setError("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Drag & drop handlers
  // -------------------------------------------------------------------------
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // -------------------------------------------------------------------------
  // Confirm import
  // -------------------------------------------------------------------------
  const handleImport = async () => {
    if (!preview || !selectedCategory) {
      setError("Selecione uma categoria antes de importar.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/importacao/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importLogId: preview.importLogId,
          transactions: preview.transactions,
          categoryId: selectedCategory,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Erro ao importar transações");
        return;
      }

      setSuccess(
        `Importação concluída! ${data.data.recordsImported} registros importados` +
          (data.data.recordsSkipped > 0
            ? `, ${data.data.recordsSkipped} ignorados`
            : "")
      );
      setPreview(null);
      setSelectedCategory("");
      fetchHistory();
    } catch {
      setError("Erro ao confirmar importação");
    } finally {
      setImporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Cancel preview
  // -------------------------------------------------------------------------
  const handleCancel = () => {
    setPreview(null);
    setError(null);
    setSuccess(null);
    setSelectedCategory("");
  };

  // -------------------------------------------------------------------------
  // Status badge helper
  // -------------------------------------------------------------------------
  const statusBadge = (status: ImportLogEntry["status"]) => {
    const styles: Record<string, string> = {
      PENDING: "bg-warning/15 text-warning",
      PROCESSING: "bg-accent-blue/15 text-accent-blue",
      COMPLETED: "bg-success/15 text-success",
      FAILED: "bg-danger/15 text-danger",
    };
    const labels: Record<string, string> = {
      PENDING: "Pendente",
      PROCESSING: "Processando",
      COMPLETED: "Concluído",
      FAILED: "Falhou",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Importação de Dados
        </h1>
        <p className="text-sm text-text-secondary">
          Importe transações de arquivos OFX ou CSV
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-danger" />
          <span className="text-sm text-danger">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-danger hover:text-danger/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
          <Check className="h-4 w-4 text-success" />
          <span className="text-sm text-success">{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-success hover:text-success/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      {!preview && (
        <GlassCard variant="strong">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all ${
              dragOver
                ? "border-accent-purple bg-accent-purple/5"
                : "border-border-glass hover:border-accent-purple/50"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="mb-3 h-10 w-10 animate-spin text-accent-purple" />
                <p className="text-sm font-medium text-text-primary">
                  Processando arquivo...
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-text-muted" />
                <p className="text-sm font-medium text-text-primary">
                  Arraste um arquivo aqui ou clique para selecionar
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Formatos aceitos: OFX, QFX, CSV
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.qfx,.csv"
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        </GlassCard>
      )}

      {/* Preview */}
      {preview && (
        <GlassCard variant="strong">
          {/* Preview header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-purple/15 p-2">
                <FileText className="h-5 w-5 text-accent-purple" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {preview.fileName}
                </p>
                <p className="text-xs text-text-muted">
                  {preview.fileType} &middot; {preview.totalRecords}{" "}
                  transações encontradas
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-2/50 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Transactions table */}
          <div className="mb-4 max-h-80 overflow-auto rounded-xl border border-border-glass">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass bg-surface-1/50">
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Descrição
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Valor
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.transactions.map((tx, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border-glass/50 last:border-0"
                  >
                    <td className="px-4 py-2.5 text-text-primary">
                      {tx.description}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-primary">
                      {formatBRL(tx.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-muted">
                      {tx.date ? formatDateBR(tx.date) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Category selector & import action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Categoria para importação
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-5">
              <button
                onClick={handleCancel}
                className="glass rounded-lg px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !selectedCategory}
                className="btn-accent flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Importar
                  </>
                )}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Import History */}
      <GlassCard>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Histórico de Importações
        </h2>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <FileText className="mb-2 h-8 w-8" />
            <p className="text-sm">Nenhuma importação realizada</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-border-glass">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass bg-surface-1/50">
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Arquivo
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Total
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Importados
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Ignorados
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border-glass/50 last:border-0"
                  >
                    <td className="px-4 py-2.5 text-text-primary">
                      {log.fileName}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-surface-2/60 px-2 py-0.5 text-xs font-medium text-text-secondary">
                        {log.fileType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{statusBadge(log.status)}</td>
                    <td className="px-4 py-2.5 text-right text-text-primary">
                      {log.recordsTotal}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-primary">
                      {log.recordsImported}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-muted">
                      {log.recordsSkipped}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-muted">
                      {formatDateBR(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
