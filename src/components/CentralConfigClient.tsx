"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, ArrowLeft, CheckCircle2, AlertCircle, Mail } from "lucide-react";

type MailboxSafe = {
  id: string;
  label: string;
  email: string;
  active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
};

// Presets comuns pra facilitar (o usuário só troca e-mail + senha de app).
const PRESETS: Record<string, { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }> = {
  Gmail: { imap_host: "imap.gmail.com", imap_port: 993, smtp_host: "smtp.gmail.com", smtp_port: 465 },
  "Hostgator (cPanel)": { imap_host: "mail.SEUDOMINIO.com.br", imap_port: 993, smtp_host: "mail.SEUDOMINIO.com.br", smtp_port: 465 },
  "Hostinger (Titan)": { imap_host: "imap.titan.email", imap_port: 993, smtp_host: "smtp.titan.email", smtp_port: 465 },
  "Hostinger (hPanel)": { imap_host: "imap.hostinger.com", imap_port: 993, smtp_host: "smtp.hostinger.com", smtp_port: 465 },
};

export function CentralConfigClient() {
  const [boxes, setBoxes] = useState<MailboxSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [form, setForm] = useState({
    label: "",
    email: "",
    imap_host: "",
    imap_port: 993,
    smtp_host: "",
    smtp_port: 465,
    imap_pass: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/central/mailboxes");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBoxes(data.mailboxes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(name: string) {
    const p = PRESETS[name];
    if (p) setForm((f) => ({ ...f, ...p }));
  }

  async function addBox(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setSaving(true);
    try {
      const res = await fetch("/api/central/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não consegui salvar a caixa.");
      setBanner({ kind: "ok", text: "Caixa conectada! Clique em Sincronizar no painel pra puxar os e-mails." });
      setForm({ label: "", email: "", imap_host: "", imap_port: 993, smtp_host: "", smtp_port: 465, imap_pass: "" });
      load();
    } catch (err) {
      setBanner({ kind: "err", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function removeBox(id: string, email: string) {
    if (!window.confirm(`Remover a caixa ${email}? As conversas dela também somem.`)) return;
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/central/mailboxes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/central" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
        <Mail className="h-6 w-6 text-brand-blue" /> Caixas de e-mail
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Conecte cada e-mail (Gmail, Hostgator, Hostinger…). Use uma <b>senha de app</b> do provedor, nunca a senha
        principal.
      </p>

      {banner && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm font-medium ${
            banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {banner.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {banner.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={addBox} className="card space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold text-muted">Preencher automático:</span>
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => applyPreset(name)}
              className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
            >
              {name}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome (rótulo)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Suporte" />
          <Field label="E-mail *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="suporte@markseg.com.br" />
          <Field label="Servidor IMAP *" value={form.imap_host} onChange={(v) => setForm({ ...form, imap_host: v })} placeholder="imap.gmail.com" />
          <Field label="Porta IMAP" type="number" value={String(form.imap_port)} onChange={(v) => setForm({ ...form, imap_port: Number(v) || 993 })} />
          <Field label="Servidor SMTP *" value={form.smtp_host} onChange={(v) => setForm({ ...form, smtp_host: v })} placeholder="smtp.gmail.com" />
          <Field label="Porta SMTP" type="number" value={String(form.smtp_port)} onChange={(v) => setForm({ ...form, smtp_port: Number(v) || 465 })} />
          <div className="sm:col-span-2">
            <Field label="Senha de app *" type="password" value={form.imap_pass} onChange={(v) => setForm({ ...form, imap_pass: v })} placeholder="senha de aplicativo do provedor" />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="gradient-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Conectar caixa
        </button>
      </form>

      {/* Lista */}
      <div className="card mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Caixas conectadas ({boxes.length})</h2>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : boxes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Nenhuma caixa ainda.</p>
        ) : (
          <div className="space-y-2">
            {boxes.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{b.label}</p>
                  <p className="truncate text-xs text-muted">{b.email}</p>
                  {b.last_error ? (
                    <p className="truncate text-xs font-medium text-rose-600">Erro: {b.last_error}</p>
                  ) : (
                    <p className="text-xs text-muted">
                      {b.last_synced_at ? `Última sincronização: ${new Date(b.last_synced_at).toLocaleString("pt-BR")}` : "Ainda não sincronizada"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeBox(b.id, b.email)}
                  className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-fluid hover:bg-rose-50 hover:text-rose-600"
                  title="Remover caixa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
      />
    </div>
  );
}
