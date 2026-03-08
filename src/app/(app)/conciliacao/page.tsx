"use client";

import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileCheck,
  Lightbulb,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/formatters";

interface CostEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  source: string;
  reconciled: boolean;
  reconciledAt: string | null;
  category: { id: string; name: string; color: string };
}

interface Reconciliation {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
  totalReconciled: number;
  totalPending: number;
  notes: string | null;
  entryCount?: number;
  entries?: CostEntry[];
  user?: { name: string };
}

interface Suggestion {
  entries: {
    id: string;
    description: string;
    amount: number;
    date: string;
    source: string;
    category: { id: string; name: string; color: string };
  }[];
  matchType: string;
  confidence: number;
}

const STATUS_CONFIG = {
  DRAFT: { label: "Rascunho", className: "bg-surface-3 text-text-secondary" },
  IN_PROGRESS: { label: "Em Progresso", className: "bg-accent-blue/20 text-accent-blue" },
  COMPLETED: { label: "Concluída", className: "bg-success/20 text-success" },
};

export default function ConciliacaoPage() {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<Reconciliation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    periodStart: "",
    periodEnd: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchReconciliations = useCallback(async () => {
    try {
      const res = await fetch("/api/conciliacao");
      const json = await res.json();
      if (json.success) setReconciliations(json.data);
    } catch (error) {
      console.error("Erro ao buscar conciliações:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReconciliations();
  }, [fetchReconciliations]);

  const fetchDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/conciliacao/${id}`);
      const json = await res.json();
      if (json.success) setDetailData(json.data);
    } catch (error) {
      console.error("Erro ao buscar detalhes:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchSuggestions = async (id: string) => {
    try {
      const res = await fetch(`/api/conciliacao/${id}/suggestions`);
      const json = await res.json();
      if (json.success) {
        setSuggestions(json.data);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  };

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetailData(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedEntries(new Set());
    } else {
      setExpandedId(id);
      setSelectedEntries(new Set());
      setSuggestions([]);
      setShowSuggestions(false);
      fetchDetail(id);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    try {
      const res = await fetch("/api/conciliacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setFormData({ name: "", periodStart: "", periodEnd: "", notes: "" });
        fetchReconciliations();
      } else {
        setFormError(json.error || "Erro ao criar conciliação");
      }
    } catch {
      setFormError("Erro ao criar conciliação");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/conciliacao/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        if (expandedId === id) {
          setExpandedId(null);
          setDetailData(null);
        }
        setDeleteTarget(null);
        fetchReconciliations();
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
    }
  };

  const handleMatch = async () => {
    if (!expandedId || selectedEntries.size === 0) return;

    try {
      const res = await fetch(`/api/conciliacao/${expandedId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selectedEntries) }),
      });
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
        setSelectedEntries(new Set());
        fetchReconciliations();
      }
    } catch (error) {
      console.error("Erro ao conciliar:", error);
    }
  };

  const handleUnmatch = async (entryIds: string[]) => {
    if (!expandedId) return;

    try {
      const res = await fetch(`/api/conciliacao/${expandedId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unmatch", entryIds }),
      });
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
        fetchReconciliations();
      }
    } catch (error) {
      console.error("Erro ao desfazer conciliação:", error);
    }
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    const ids = suggestion.entries.map((e) => e.id);
    setSelectedEntries(new Set(ids));
    setShowSuggestions(false);
  };

  const toggleEntry = (id: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
      </div>
    );
  }

  const unreconciledEntries = detailData?.entries?.filter((e) => !e.reconciled) || [];
  const reconciledEntries = detailData?.entries?.filter((e) => e.reconciled) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Conciliação</h1>
          <p className="text-sm text-text-secondary">
            Gerencie e concilie seus lançamentos financeiros
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Nova Conciliação
        </button>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <GlassCard variant="strong" className="w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Nova Conciliação
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError("");
                }}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-2 hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder="Ex: Conciliação Março 2026"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">
                    Período Início
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) =>
                      setFormData({ ...formData, periodStart: e.target.value })
                    }
                    className="glass-input w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">
                    Período Fim
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) =>
                      setFormData({ ...formData, periodEnd: e.target.value })
                    }
                    className="glass-input w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Observações (opcional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Observações sobre a conciliação..."
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError("");
                  }}
                  className="rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-accent px-4 py-2 text-sm">
                  Criar Conciliação
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <GlassCard variant="strong" className="w-full max-w-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/15">
                <Trash2 className="h-5 w-5 text-danger" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">
                  Excluir conciliação
                </h3>
                <p className="text-sm text-text-muted">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <p className="mb-5 text-sm text-text-secondary">
              Tem certeza que deseja excluir{" "}
              <strong>{deleteTarget.name}</strong>? Todos os vínculos de
              conciliação serão removidos.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90"
              >
                Excluir
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Reconciliation List */}
      {reconciliations.length === 0 ? (
        <GlassCard className="py-12 text-center">
          <FileCheck className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-3 text-text-secondary">
            Nenhuma conciliação encontrada
          </p>
          <p className="text-sm text-text-muted">
            Crie sua primeira conciliação para começar
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {reconciliations.map((rec) => (
            <div key={rec.id}>
              <GlassCard className="cursor-pointer transition-all hover:border-border-glass/50">
                <div
                  className="flex items-center justify-between"
                  onClick={() => handleToggleExpand(rec.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-text-primary">
                        {rec.name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_CONFIG[rec.status].className
                        }`}
                      >
                        {STATUS_CONFIG[rec.status].label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-text-muted">
                      <span>
                        {formatDateBR(rec.periodStart)} - {formatDateBR(rec.periodEnd)}
                      </span>
                      {rec.entryCount !== undefined && (
                        <span>{rec.entryCount} lançamentos</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Conciliado</p>
                      <p className="text-sm font-medium text-success">
                        {formatBRL(rec.totalReconciled)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Pendente</p>
                      <p className="text-sm font-medium text-warning">
                        {formatBRL(rec.totalPending)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: rec.id, name: rec.name });
                        }}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                        title="Excluir conciliação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expandedId === rec.id ? (
                        <ChevronUp className="h-5 w-5 text-text-muted" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-text-muted" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Detail View */}
                {expandedId === rec.id && (
                  <div className="mt-5 border-t border-border-glass pt-5">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
                      </div>
                    ) : detailData ? (
                      <>
                        {/* Summary Bar */}
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => fetchSuggestions(rec.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-border-glass px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
                              title="Obter sugestões automáticas de conciliação baseadas em valor e data"
                            >
                              <Lightbulb className="h-4 w-4 text-warning" />
                              Sugestões
                            </button>
                            {selectedEntries.size > 0 && (
                              <button
                                onClick={handleMatch}
                                className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-sm"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Conciliar Selecionados ({selectedEntries.size})
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-text-muted">
                              Total Conciliado:{" "}
                              <span className="font-medium text-success">
                                {formatBRL(detailData.totalReconciled)}
                              </span>
                            </span>
                            <span className="text-text-muted">
                              Total Pendente:{" "}
                              <span className="font-medium text-warning">
                                {formatBRL(detailData.totalPending)}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Suggestions Panel */}
                        {showSuggestions && suggestions.length > 0 && (
                          <GlassCard
                            variant="subtle"
                            className="mb-4 border border-warning/20"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary">
                                <Lightbulb className="h-4 w-4 text-warning" />
                                Sugestões de Conciliação
                              </h4>
                              <button
                                onClick={() => setShowSuggestions(false)}
                                className="rounded p-0.5 text-text-muted hover:text-text-primary"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="space-y-2">
                              {suggestions.map((suggestion, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between rounded-lg border border-border-glass p-3"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded bg-accent-purple/15 px-1.5 py-0.5 text-xs text-accent-purple">
                                        {suggestion.confidence}% confiança
                                      </span>
                                      <span className="text-xs text-text-muted">
                                        {suggestion.matchType === "cross_source"
                                          ? "Fontes diferentes"
                                          : "Mesma fonte"}
                                      </span>
                                    </div>
                                    <div className="mt-1 space-y-0.5">
                                      {suggestion.entries.map((e) => (
                                        <p
                                          key={e.id}
                                          className="text-xs text-text-secondary"
                                        >
                                          {e.description} - {formatBRL(e.amount)} (
                                          {formatDateBR(e.date)})
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleApplySuggestion(suggestion)}
                                    className="ml-3 shrink-0 rounded-lg border border-border-glass px-3 py-1 text-xs text-text-secondary hover:bg-surface-2"
                                  >
                                    Selecionar
                                  </button>
                                </div>
                              ))}
                            </div>
                          </GlassCard>
                        )}

                        {showSuggestions && suggestions.length === 0 && (
                          <GlassCard
                            variant="subtle"
                            className="mb-4 border border-border-glass py-4 text-center"
                          >
                            <p className="text-sm text-text-muted">
                              Nenhuma sugestão encontrada para o período
                            </p>
                          </GlassCard>
                        )}

                        {/* Two Column Layout */}
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {/* Unreconciled Column */}
                          <div>
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-text-secondary">
                              <Circle className="h-4 w-4 text-warning" />
                              Não Conciliados ({unreconciledEntries.length})
                            </h4>
                            <div className="max-h-[400px] space-y-1.5 overflow-auto rounded-lg border border-border-glass p-2">
                              {unreconciledEntries.length === 0 ? (
                                <p className="py-6 text-center text-xs text-text-muted">
                                  Todos os lançamentos foram conciliados
                                </p>
                              ) : (
                                unreconciledEntries.map((entry) => (
                                  <label
                                    key={entry.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-surface-2/40 ${
                                      selectedEntries.has(entry.id)
                                        ? "bg-accent-purple/10 border border-accent-purple/30"
                                        : ""
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedEntries.has(entry.id)}
                                      onChange={() => toggleEntry(entry.id)}
                                      className="h-4 w-4 shrink-0 rounded border-border-glass accent-accent-purple"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-text-primary">
                                        {entry.description}
                                      </p>
                                      <p className="text-xs text-text-muted">
                                        {entry.category.name} - {formatDateBR(entry.date)}
                                      </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-medium text-text-primary">
                                      {formatBRL(entry.amount)}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Reconciled Column */}
                          <div>
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-text-secondary">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              Conciliados ({reconciledEntries.length})
                            </h4>
                            <div className="max-h-[400px] space-y-1.5 overflow-auto rounded-lg border border-border-glass p-2">
                              {reconciledEntries.length === 0 ? (
                                <p className="py-6 text-center text-xs text-text-muted">
                                  Nenhum lançamento conciliado ainda
                                </p>
                              ) : (
                                reconciledEntries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-surface-2/40"
                                  >
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-text-primary">
                                        {entry.description}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <span>{entry.category.name}</span>
                                        <span>-</span>
                                        <span>{formatDateBR(entry.date)}</span>
                                        {entry.reconciledAt && (
                                          <>
                                            <span>-</span>
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {formatDateBR(entry.reconciledAt)}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-sm font-medium text-success">
                                      {formatBRL(entry.amount)}
                                    </span>
                                    <button
                                      onClick={() => handleUnmatch([entry.id])}
                                      className="shrink-0 rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
                                      title="Desfazer conciliação"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </GlassCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
