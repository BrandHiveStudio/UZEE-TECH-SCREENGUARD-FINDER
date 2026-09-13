"use client";

import { useState, useEffect } from "react";
import { X, Users, UserPlus, Trash2, Mail, Lock, AlertCircle, CheckCircle2, Loader2, ShieldCheck, Eye, EyeOff, Key } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Change Password State
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserItem | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState("");
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const closePasswordModal = () => {
    setPasswordTargetUser(null);
    setChangePasswordVal("");
    setConfirmPasswordVal("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError(null);
  };

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
      setShowPassword(false);
      setActionSuccess(null);
      closePasswordModal();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMaxUsers = users.length >= 3;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionSuccess(null);

    if (isMaxUsers) {
      setError("User capacity reached (3/3). Delete an existing account to register a new user.");
      return;
    }

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordTargetUser) return;

    if (changePasswordVal.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (changePasswordVal !== confirmPasswordVal) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch("/api/admin/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: passwordTargetUser.id,
          newPassword: changePasswordVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to update password");
        return;
      }

      setActionSuccess(data.message || `Password updated successfully for ${passwordTargetUser.email}.`);
      closePasswordModal();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch {
      setPasswordError("Network error while updating password");
    } finally {
      setUpdatingPassword(false);
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
                Administer user accounts with full access to ScreenGuard Finder (Max 3 Users)
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
            {isMaxUsers ? (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>User capacity reached (3/3). Delete an existing account to register a new user.</span>
              </div>
            ) : !showAddForm ? (
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
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
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
              REGISTERED ACCOUNTS ({users.length}/3)
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

                    {u.isCurrent ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 italic px-1">
                          Active Session
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            closePasswordModal();
                            setPasswordTargetUser(u);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-xs font-semibold border border-brand-200/80 dark:border-brand-800 transition-all shadow-xs"
                          title="Change password for your active account"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Change Password</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            closePasswordModal();
                            setPasswordTargetUser(u);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 text-xs font-semibold border border-transparent hover:border-brand-200 dark:hover:border-brand-900 transition-all"
                          title={`Change password for ${u.email}`}
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </button>
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
                      </div>
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

      {/* Change Password Sub-Modal */}
      {passwordTargetUser && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updatingPassword) {
              closePasswordModal();
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-700 text-white font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Change Password
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[260px]">
                    {passwordTargetUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={updatingPassword}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordSubmit} className="p-5 space-y-4">
              {passwordError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={changePasswordVal}
                    onChange={(e) => setChangePasswordVal(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {changePasswordVal.length > 0 && changePasswordVal.length < 6 && (
                  <p className="text-[10px] text-amber-500 mt-1 font-medium">
                    Password must be at least 6 characters.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPasswordVal}
                    onChange={(e) => setConfirmPasswordVal(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {confirmPasswordVal.length > 0 && changePasswordVal !== confirmPasswordVal && (
                  <p className="text-[10px] text-red-500 mt-1 font-medium">
                    Passwords do not match.
                  </p>
                )}
                {confirmPasswordVal.length >= 6 && changePasswordVal === confirmPasswordVal && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Passwords match.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={updatingPassword}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    updatingPassword ||
                    changePasswordVal.length < 6 ||
                    changePasswordVal !== confirmPasswordVal
                  }
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {updatingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
