"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GlassCard } from "@/components/glass/glass-card";
import {
  costEntrySchema,
  type CostEntryFormData,
} from "@/validators/cost";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import {
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Calendar,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
}

interface CostEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "FIXED" | "VARIABLE" | "ONE_TIME";
  source: "MANUAL" | "AZURE_SYNC" | "OFX_IMPORT" | "CSV_IMPORT";
  notes: string | null;
  categoryId: string;
  category: Category;
  reconciled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type SortField = "description" | "amount" | "date" | "type" | "source";
type SortOrder = "asc" | "desc";

const TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixo",
  VARIABLE: "Variavel",
  ONE_TIME: "Avulso",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  AZURE_SYNC: "Azure",
  OFX_IMPORT: "OFX",
  CSV_IMPORT: "CSV",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CustosPage() {
  // Data state
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sort state
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CostEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CostEntryFormData>({
    resolver: zodResolver(costEntrySchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: "",
      type: "VARIABLE",
      categoryId: "",
      notes: "",
      source: "MANUAL",
    },
  });

  // -------------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------------

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("pageSize", String(pagination.pageSize));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/custos?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setEntries(json.data);
        setPagination(json.pagination);
      }
    } catch (error) {
      console.error("Erro ao buscar custos:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, sortBy, sortOrder, search, categoryFilter, startDate, endDate]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categorias");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data);
      }
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [search, categoryFilter, startDate, endDate]);

  // Open "new=true" from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      openNewModal();
      window.history.replaceState({}, "", "/custos");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) {
      return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 text-text-muted" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5 text-accent-purple" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5 text-accent-purple" />
    );
  }

  // -------------------------------------------------------------------------
  // Modal helpers
  // -------------------------------------------------------------------------

  function openNewModal() {
    setEditingEntry(null);
    reset({
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      type: "VARIABLE",
      categoryId: "",
      notes: "",
      source: "MANUAL",
    });
    setModalOpen(true);
  }

  function openEditModal(entry: CostEntry) {
    setEditingEntry(entry);
    reset({
      description: entry.description,
      amount: entry.amount,
      date: entry.date.split("T")[0],
      type: entry.type,
      categoryId: entry.categoryId,
      notes: entry.notes || "",
      source: entry.source,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEntry(null);
  }

  // -------------------------------------------------------------------------
  // CRUD actions
  // -------------------------------------------------------------------------

  async function onSubmit(data: CostEntryFormData) {
    setSubmitting(true);
    try {
      const url = editingEntry
        ? `/api/custos/${editingEntry.id}`
        : "/api/custos";
      const method = editingEntry ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        closeModal();
        fetchEntries();
      }
    } catch (error) {
      console.error("Erro ao salvar custo:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/custos/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setDeletingId(null);
        fetchEntries();
      }
    } catch (error) {
      console.error("Erro ao excluir custo:", error);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Custos</h1>
          <p className="text-sm text-text-secondary">
            Gerencie todas as entradas de custos
          </p>
        </div>
        <button onClick={openNewModal} className="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          Novo Custo
        </button>
      </div>

      {/* Filters */}
      <GlassCard className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descricao..."
              className="glass-input w-full py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="min-w-[180px]">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            <Filter className="mr-1 inline h-3 w-3" />
            Categoria
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="glass-input w-full py-2 text-sm"
          >
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            <Calendar className="mr-1 inline h-3 w-3" />
            Data Inicio
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="glass-input w-full py-2 text-sm"
          />
        </div>

        {/* End date */}
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            <Calendar className="mr-1 inline h-3 w-3" />
            Data Fim
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="glass-input w-full py-2 text-sm"
          />
        </div>

        {/* Clear filters */}
        {(search || categoryFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
              setStartDate("");
              setEndDate("");
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:bg-surface-2/40 hover:text-text-secondary"
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        )}
      </GlassCard>

      {/* Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-glass">
                <th
                  onClick={() => handleSort("description")}
                  className="cursor-pointer px-5 py-3.5 text-left font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Descricao
                  <SortIcon field="description" />
                </th>
                <th className="px-5 py-3.5 text-left font-medium text-text-secondary">
                  Categoria
                </th>
                <th
                  onClick={() => handleSort("amount")}
                  className="cursor-pointer px-5 py-3.5 text-right font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Valor
                  <SortIcon field="amount" />
                </th>
                <th
                  onClick={() => handleSort("date")}
                  className="cursor-pointer px-5 py-3.5 text-left font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Data
                  <SortIcon field="date" />
                </th>
                <th
                  onClick={() => handleSort("type")}
                  className="cursor-pointer px-5 py-3.5 text-left font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Tipo
                  <SortIcon field="type" />
                </th>
                <th
                  onClick={() => handleSort("source")}
                  className="cursor-pointer px-5 py-3.5 text-left font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Fonte
                  <SortIcon field="source" />
                </th>
                <th className="px-5 py-3.5 text-right font-medium text-text-secondary">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent-purple" />
                    <p className="mt-2 text-xs text-text-muted">
                      Carregando custos...
                    </p>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-text-muted"
                  >
                    Nenhum custo encontrado
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border-glass/50 transition-colors hover:bg-surface-1/30"
                  >
                    <td className="px-5 py-3 text-text-primary">
                      <span className="font-medium">{entry.description}</span>
                      {entry.notes && (
                        <p className="mt-0.5 text-xs text-text-muted">
                          {entry.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${entry.category.color}20`,
                          color: entry.category.color,
                        }}
                      >
                        {entry.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-text-primary">
                      {formatBRL(entry.amount)}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {formatDateBR(entry.date)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-surface-2/60 px-2 py-0.5 text-xs text-text-secondary">
                        {TYPE_LABELS[entry.type] || entry.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-surface-2/60 px-2 py-0.5 text-xs text-text-secondary">
                        {SOURCE_LABELS[entry.source] || entry.source}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(entry)}
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2/50 hover:text-text-primary"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {deletingId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="rounded-lg bg-danger/15 px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/25"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-2/50"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(entry.id)}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-glass px-5 py-3">
            <p className="text-xs text-text-muted">
              Mostrando{" "}
              {(pagination.page - 1) * pagination.pageSize + 1} a{" "}
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.total
              )}{" "}
              de {pagination.total} registros
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2/50 hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  const current = pagination.page;
                  return (
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - current) <= 2
                  );
                })
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  typeof item === "string" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-xs text-text-muted"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: item }))
                      }
                      className={`min-w-[28px] rounded-lg px-2 py-1 text-xs transition-colors ${
                        pagination.page === item
                          ? "bg-accent-purple/20 font-medium text-accent-purple"
                          : "text-text-muted hover:bg-surface-2/50 hover:text-text-primary"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2/50 hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-surface-0/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Dialog */}
          <div className="glass-strong relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingEntry ? "Editar Custo" : "Novo Custo"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2/50 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Descricao *
                </label>
                <input
                  {...register("description")}
                  className="glass-input w-full py-2 text-sm"
                  placeholder="Ex: Servidor Azure, Licenca software..."
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Valor (R$) *
                  </label>
                  <input
                    {...register("amount", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0"
                    className="glass-input w-full py-2 text-sm"
                    placeholder="0,00"
                  />
                  {errors.amount && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Data *
                  </label>
                  <input
                    {...register("date")}
                    type="date"
                    className="glass-input w-full py-2 text-sm"
                  />
                  {errors.date && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.date.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Type + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Tipo *
                  </label>
                  <select
                    {...register("type")}
                    className="glass-input w-full py-2 text-sm"
                  >
                    <option value="FIXED">Fixo</option>
                    <option value="VARIABLE">Variavel</option>
                    <option value="ONE_TIME">Avulso</option>
                  </select>
                  {errors.type && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.type.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Categoria *
                  </label>
                  <select
                    {...register("categoryId")}
                    className="glass-input w-full py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.categoryId.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Observacoes
                </label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  className="glass-input w-full resize-none py-2 text-sm"
                  placeholder="Detalhes adicionais (opcional)..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2/40 hover:text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-accent flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {editingEntry ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
