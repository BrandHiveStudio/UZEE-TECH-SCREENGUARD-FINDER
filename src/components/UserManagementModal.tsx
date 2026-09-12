"use client";

import { useState, useEffect } from "react";
import { X, Users, UserPlus, Trash2, Mail, Lock, AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  createdAt: string;
  isCurrent: boolean;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New User Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to load user list");
      }
    } catch {
      setError("Network error loading users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setShowAddForm(false);
      setNewEmail("");
      setNewPassword("");
      setActionSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionSuccess(null);

    if (!newEmail.trim() || !newEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }

      setActionSuccess(`User ${newEmail} created successfully!`);
      setNewEmail("");
      setNewPassword("");
      setShowAddForm(false);
      await fetchUsers();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch {
      setError("Network error while creating user");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete access for ${email}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(userId);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete user");
        return;
      }

      setActionSuccess(`User ${email} deleted.`);
      await fetchUsers();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch {
      setError("Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-700 text-white font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Manage Authorized Users
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Administer user accounts with full access to ScreenGuard Finder
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Add User Section */}
          <div>
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-900 font-bold text-xs hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-all shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add New User Account</span>
              </button>
            ) : (
              <form onSubmit={handleAddUser} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Create New User Account
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        placeholder="newuser@example.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Password (min. 6 chars)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md disabled:opacity-60 transition-all"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Create User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* User List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Registered Accounts ({users.length})
            </h4>

            {loading ? (
              <div className="py-8 flex justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">No users found.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 flex items-center justify-between bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {u.email}
                          </span>
                          {u.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Joined {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {!u.isCurrent ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        disabled={deletingId === u.id}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title={`Delete user ${u.email}`}
                      >
                        {deletingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 italic px-2">
                        Active Session
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
