"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, FormPanel, PageHeader, Button, useAppDialog } from "@/components/ui";

interface Trainer {
  id: string;
  username: string;
  name: string;
  email: string;
  mobile: string;
  status: string;
}

export default function FranchiseTrainersPage() {
  const dialog = useAppDialog();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  async function loadTrainers() {
    setLoading(true);
    const res = await api<{ trainers: Trainer[] }>("/api/franchise/trainers");
    if (res.success && res.data?.trainers) setTrainers(res.data.trainers);
    setLoading(false);
  }

  useEffect(() => { loadTrainers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !username.trim() || !email.trim() || !mobile.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    const res = await api("/api/franchise/trainers", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password: password.trim(),
      }),
    });
    setSubmitting(false);

    if (res.success) {
      setShowForm(false);
      setName(""); setUsername(""); setEmail(""); setMobile(""); setPassword("");
      loadTrainers();
    } else {
      setError(res.message ?? "Failed to create trainer");
    }
  }

  async function toggleStatus(trainer: Trainer) {
    const newStatus = trainer.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const action = newStatus === "SUSPENDED" ? "suspend" : "activate";
    const ok = await dialog.confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} trainer`,
      message: `Are you sure you want to ${action} ${trainer.name}?`,
      confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
      variant: newStatus === "SUSPENDED" ? "danger" : "default",
    });
    if (!ok) return;

    const res = await api(`/api/franchise/trainers/${trainer.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.success) loadTrainers();
  }

  return (
    <AppPageShell>
      <PageHeader
        title="My Trainers"
        subtitle="Manage trainers for your franchise center."
        actions={
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Trainer"}
          </Button>
        }
      />

      {showForm && (
        <FormPanel className="mt-6">
          <form onSubmit={handleCreate} className="space-y-4 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">New Trainer</h3>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input mt-1 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Username *</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input mt-1 w-full" required placeholder="e.g., trainer.rahul@funt" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mobile *</label>
                <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="input mt-1 w-full" required />
              </div>
            </div>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-slate-700">Password *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1 w-full" required minLength={8} />
            </div>

            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create Trainer"}
            </Button>
          </form>
        </FormPanel>
      )}

      <DataPanel className="mt-6">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : trainers.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <p className="font-medium">No trainers yet</p>
            <p className="mt-1">Add trainers who will teach at your center.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Name</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Username</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Email</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Mobile</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {trainers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{t.name}</td>
                    <td className="px-5 py-4 text-sm font-mono text-slate-600">{t.username}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.email}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.mobile}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggleStatus(t)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          t.status === "ACTIVE"
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        }`}
                      >
                        {t.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
