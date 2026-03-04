"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  AlertCircle,
  Edit2,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  ADMIN: { label: "Administrador", className: "bg-accent-purple/20 text-accent-purple" },
  USER: { label: "Usuário", className: "bg-accent-blue/20 text-accent-blue" },
  VIEWER: { label: "Visualizador", className: "bg-surface-3 text-text-secondary" },
};

export default function ConfiguracoesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/usuarios");
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "USER" });
    setFormError("");
    setFormSuccess("");
    setEditingUser(null);
    setShowForm(false);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "USER" });
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    try {
      if (editingUser) {
        // Update
        const body: Record<string, string> = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };
        if (formData.password) body.password = formData.password;

        const res = await fetch(`/api/usuarios/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.success) {
          setFormSuccess("Usuário atualizado com sucesso");
          fetchUsers();
          setTimeout(resetForm, 1000);
        } else {
          setFormError(json.error || "Erro ao atualizar usuário");
        }
      } else {
        // Create
        if (!formData.password) {
          setFormError("Senha é obrigatória para novos usuários");
          return;
        }

        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (json.success) {
          setFormSuccess("Usuário criado com sucesso");
          fetchUsers();
          setTimeout(resetForm, 1000);
        } else {
          setFormError(json.error || "Erro ao criar usuário");
        }
      }
    } catch {
      setFormError("Erro de conexão com o servidor");
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === session?.user?.id) {
      alert("Você não pode excluir seu próprio usuário");
      return;
    }

    if (!confirm(`Deseja realmente excluir o usuário "${user.name}"?`)) return;

    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
      } else {
        alert(json.error || "Erro ao excluir usuário");
      }
    } catch {
      alert("Erro de conexão com o servidor");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configurações</h1>
        <p className="text-sm text-text-secondary">
          Gerencie as configurações do sistema
        </p>
      </div>

      {/* General Settings */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-primary">Geral</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border-glass p-3">
            <div>
              <p className="text-sm text-text-primary">Perfil do Usuário</p>
              <p className="text-xs text-text-muted">
                {session?.user?.name} ({session?.user?.email})
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ROLE_CONFIG[(session?.user as { role?: string } | undefined)?.role || "USER"]?.className || ROLE_CONFIG.USER.className
              }`}
            >
              {ROLE_CONFIG[(session?.user as { role?: string } | undefined)?.role || "USER"]?.label || "Usuário"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* User Management - Admin Only */}
      {isAdmin && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent-purple" />
              <h2 className="text-lg font-semibold text-text-primary">
                Gerenciamento de Usuários
              </h2>
            </div>
            <button
              onClick={handleOpenCreate}
              className="btn-accent flex items-center gap-2 px-3 py-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Usuário
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-2 text-sm text-text-muted">
                Nenhum usuário encontrado
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border border-border-glass p-3 transition-colors hover:bg-surface-2/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-purple/15 text-sm font-medium text-accent-purple">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {user.name}
                      </p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ROLE_CONFIG[user.role]?.className || ROLE_CONFIG.USER.className
                      }`}
                    >
                      {ROLE_CONFIG[user.role]?.label || user.role}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-primary"
                      title="Editar usuário"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {user.id !== session?.user?.id && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* User Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <GlassCard variant="strong" className="w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                {editingUser ? (
                  <>
                    <Edit2 className="h-5 w-5" />
                    Editar Usuário
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Novo Usuário
                  </>
                )}
              </h2>
              <button
                onClick={resetForm}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-2 hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Senha {editingUser && "(deixe vazio para manter a atual)"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder={editingUser ? "Nova senha (opcional)" : "Senha"}
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Função
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="USER">Usuário</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-accent px-4 py-2 text-sm">
                  {editingUser ? "Atualizar" : "Criar Usuário"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
