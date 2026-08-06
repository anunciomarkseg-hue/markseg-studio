"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Lock,
  Plus,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  Loader2,
  X,
  ExternalLink,
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Mail,
  Landmark,
  AtSign,
  Server,
  KeyRound,
  Search,
  AlertCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  SCOPE_LABEL,
  SENSITIVITY_LABEL,
  SENSITIVITY_HINT,
  SENSITIVITY_BADGE,
  CATEGORY_LABEL,
  VAULT_CATEGORIES,
  allowedSensitivities,
  type VaultViewer,
  type VaultScope,
  type Sensitivity,
  type VaultCategory,
  type VaultFolder,
  type VaultCredentialSafe,
} from "@/lib/vault";

// Ícone por categoria de acesso.
const CATEGORY_ICON: Record<VaultCategory, ComponentType<{ className?: string }>> = {
  ferramentas: Wrench,
  emails: Mail,
  bancos: Landmark,
  redes: AtSign,
  hospedagem: Server,
  outros: KeyRound,
};

// Ícone por nível de sigilo.
const SENS_ICON: Record<Sensitivity, ComponentType<{ className?: string }>> = {
  dono: ShieldAlert,
  admin: ShieldCheck,
  equipe: Users,
};

type Secret = { password: string; extra: string };

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CofreClient({
  viewer,
  configured,
}: {
  viewer: VaultViewer;
  configured: boolean;
}) {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<VaultScope>("cliente");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // cache de acessos por pasta e segredos revelados por acesso
  const [creds, setCreds] = useState<Record<string, VaultCredentialSafe[]>>({});
  const [loadingCreds, setLoadingCreds] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Record<string, Secret>>({});

  // modal de formulário
  const [modal, setModal] = useState<
    | null
    | { type: "folder-new" }
    | { type: "folder-edit"; folder: VaultFolder }
    | { type: "cred-new"; folderId: string }
    | { type: "cred-edit"; folderId: string; cred: VaultCredentialSafe }
  >(null);

  const allowed = useMemo(() => allowedSensitivities(viewer), [viewer]);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/folders");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não consegui carregar o cofre.");
      setFolders(data.folders ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (configured) loadFolders();
  }, [configured, loadFolders]);

  const loadCreds = useCallback(async (folderId: string) => {
    setLoadingCreds(folderId);
    try {
      const res = await fetch(`/api/vault/credentials?folder=${encodeURIComponent(folderId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCreds((prev) => ({ ...prev, [folderId]: data.credentials ?? [] }));
    } finally {
      setLoadingCreds(null);
    }
  }, []);

  function toggleFolder(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next && !creds[next]) loadCreds(next);
  }

  async function reveal(credId: string): Promise<Secret | null> {
    if (secrets[credId]) return secrets[credId];
    try {
      const res = await fetch(`/api/vault/credentials/${credId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não consegui revelar.");
        return null;
      }
      const secret: Secret = { password: data.password ?? "", extra: data.extra ?? "" };
      setSecrets((prev) => ({ ...prev, [credId]: secret }));
      return secret;
    } catch {
      setError("Falha de rede ao revelar.");
      return null;
    }
  }

  function hideSecret(credId: string) {
    setSecrets((prev) => {
      const next = { ...prev };
      delete next[credId];
      return next;
    });
  }

  async function deleteFolder(f: VaultFolder) {
    if (!confirm(`Apagar a pasta "${f.name}" e TODOS os acessos dentro dela? Isso não volta.`)) return;
    const res = await fetch(`/api/vault/folders/${f.id}`, { method: "DELETE" });
    if (res.ok) {
      setFolders((prev) => prev.filter((x) => x.id !== f.id));
      if (openId === f.id) setOpenId(null);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Não consegui apagar a pasta.");
    }
  }

  async function deleteCred(folderId: string, cred: VaultCredentialSafe) {
    if (!confirm(`Apagar o acesso "${cred.label}"?`)) return;
    const res = await fetch(`/api/vault/credentials/${cred.id}`, { method: "DELETE" });
    if (res.ok) {
      setCreds((prev) => ({ ...prev, [folderId]: (prev[folderId] ?? []).filter((c) => c.id !== cred.id) }));
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, count: Math.max(0, f.count - 1) } : f)));
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Não consegui apagar o acesso.");
    }
  }

  const visible = folders
    .filter((f) => f.scope === scope)
    .filter((f) => !query || f.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cabeçalho */}
      <div className="mb-6 animate-rise">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <Lock className="h-6 w-6 text-brand-blue" /> Cofre de acessos
        </h1>
        <p className="mt-1 text-sm text-muted">
          Senhas de clientes e da agência num lugar só — criptografadas e liberadas por nível de acesso.
          Você é <strong>{viewer.isOwner ? "dono" : viewer.level === "admin" ? "admin" : "editor"}</strong>.
        </p>
      </div>

      {!configured && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>Cofre ainda não configurado.</strong> Rode o bloco do{" "}
            <code>supabase/schema.sql</code> no Supabase e defina a variável{" "}
            <code>VAULT_SECRET</code> no painel da Vercel. Depois é só recarregar.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Abas: Interno x Clientes */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(["cliente", "interno"] as VaultScope[]).map((sc) => {
            const active = scope === sc;
            const Icon = sc === "interno" ? Building2 : Users;
            return (
              <button
                key={sc}
                onClick={() => {
                  setScope(sc);
                  setOpenId(null);
                }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-fluid ${
                  active ? "bg-brand-blue-50 text-brand-blue-700" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" /> {SCOPE_LABEL[sc]}
              </button>
            );
          })}
        </div>

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pasta…"
            className="w-44 rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-blue sm:w-56"
          />
        </div>

        <button
          onClick={() => setModal({ type: "folder-new" })}
          disabled={!configured}
          className="gradient-brand flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Nova pasta
        </button>
      </div>

      {/* Lista de pastas */}
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando o cofre…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-muted">
            Nenhuma pasta em <strong>{SCOPE_LABEL[scope]}</strong> ainda.
          </p>
          <button
            onClick={() => setModal({ type: "folder-new" })}
            disabled={!configured}
            className="mt-3 text-sm font-semibold text-brand-blue hover:underline disabled:opacity-40"
          >
            Criar a primeira pasta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((f) => {
            const open = openId === f.id;
            const SensIcon = SENS_ICON[f.sensitivity];
            const list = creds[f.id] ?? [];
            return (
              <div key={f.id} className="card overflow-hidden">
                {/* Cabeçalho da pasta */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => toggleFolder(f.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{f.name}</span>
                      <span className="text-xs text-muted">
                        {f.count} {f.count === 1 ? "acesso" : "acessos"}
                        {f.notes ? ` · ${f.notes}` : ""}
                      </span>
                    </span>
                  </button>

                  <span
                    className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${SENSITIVITY_BADGE[f.sensitivity]}`}
                    title={SENSITIVITY_HINT[f.sensitivity]}
                  >
                    <SensIcon className="h-3 w-3" /> {SENSITIVITY_LABEL[f.sensitivity]}
                  </span>

                  <button
                    onClick={() => setModal({ type: "folder-edit", folder: f })}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-canvas hover:text-ink"
                    title="Editar pasta"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteFolder(f)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Apagar pasta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Acessos */}
                {open && (
                  <div className="border-t border-line bg-canvas/40 px-4 py-3">
                    {loadingCreds === f.id ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando acessos…
                      </div>
                    ) : list.length === 0 ? (
                      <p className="py-3 text-sm text-muted">Nenhum acesso nessa pasta ainda.</p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map((c) => (
                          <CredRow
                            key={c.id}
                            cred={c}
                            secret={secrets[c.id]}
                            onReveal={() => reveal(c.id)}
                            onHide={() => hideSecret(c.id)}
                            onEdit={() => setModal({ type: "cred-edit", folderId: f.id, cred: c })}
                            onDelete={() => deleteCred(f.id, c)}
                          />
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => setModal({ type: "cred-new", folderId: f.id })}
                      className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue-50"
                    >
                      <Plus className="h-4 w-4" /> Adicionar acesso
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {modal?.type === "folder-new" && (
        <FolderForm
          allowed={allowed}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            loadFolders();
          }}
          scope={scope}
        />
      )}
      {modal?.type === "folder-edit" && (
        <FolderForm
          allowed={allowed}
          folder={modal.folder}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            loadFolders();
          }}
          scope={modal.folder.scope}
        />
      )}
      {modal?.type === "cred-new" && (
        <CredentialForm
          folderId={modal.folderId}
          onClose={() => setModal(null)}
          onSaved={() => {
            const fid = modal.folderId;
            setModal(null);
            loadCreds(fid);
            setFolders((prev) => prev.map((f) => (f.id === fid ? { ...f, count: f.count + 1 } : f)));
          }}
        />
      )}
      {modal?.type === "cred-edit" && (
        <CredentialForm
          folderId={modal.folderId}
          cred={modal.cred}
          onClose={() => setModal(null)}
          onSaved={() => {
            const fid = modal.folderId;
            const cid = modal.cred.id;
            setModal(null);
            hideSecret(cid);
            loadCreds(fid);
          }}
        />
      )}
    </div>
  );
}

// ── Linha de um acesso ──────────────────────────────────────────────────────
function CredRow({
  cred,
  secret,
  onReveal,
  onHide,
  onEdit,
  onDelete,
}: {
  cred: VaultCredentialSafe;
  secret: Secret | undefined;
  onReveal: () => Promise<Secret | null>;
  onHide: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = CATEGORY_ICON[cred.category];
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"user" | "pass" | null>(null);

  async function flashCopy(which: "user" | "pass", text: string) {
    if (await copyToClipboard(text)) {
      setCopied(which);
      setTimeout(() => setCopied(null), 1400);
    }
  }

  async function toggleReveal() {
    if (secret) {
      onHide();
      return;
    }
    setBusy(true);
    await onReveal();
    setBusy(false);
  }

  async function copyPassword() {
    setBusy(true);
    const s = secret ?? (await onReveal());
    setBusy(false);
    if (s) flashCopy("pass", s.password);
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-blue-50 text-brand-blue">
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{cred.label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {CATEGORY_LABEL[cred.category]}
            </span>
            {cred.url && (
              <a
                href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-brand-blue"
                title="Abrir painel"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Login */}
          {cred.username && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              <span className="truncate">{cred.username}</span>
              <button
                onClick={() => flashCopy("user", cred.username)}
                className="text-slate-400 hover:text-ink"
                title="Copiar login"
              >
                {copied === "user" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Senha */}
          <div className="mt-1.5 flex items-center gap-2">
            {cred.hasPassword ? (
              <>
                <code className="rounded-md bg-canvas px-2 py-1 font-mono text-sm text-ink">
                  {secret ? secret.password || "(vazia)" : "••••••••••"}
                </code>
                <button
                  onClick={toggleReveal}
                  disabled={busy}
                  className="text-slate-400 hover:text-ink disabled:opacity-40"
                  title={secret ? "Esconder" : "Revelar"}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : secret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={copyPassword}
                  disabled={busy}
                  className="text-slate-400 hover:text-ink disabled:opacity-40"
                  title="Copiar senha"
                >
                  {copied === "pass" ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </>
            ) : (
              <span className="text-xs italic text-slate-400">sem senha guardada</span>
            )}
          </div>

          {/* Extra / 2FA (aparece junto ao revelar) */}
          {secret && secret.extra && (
            <div className="mt-1.5 rounded-lg bg-canvas px-2 py-1 text-xs text-muted">
              <span className="font-semibold text-ink">Extra / 2FA:</span>{" "}
              <span className="whitespace-pre-wrap break-words font-mono">{secret.extra}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-canvas hover:text-ink"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            title="Apagar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Modal genérico ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-pop sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";
const labelCls = "mb-1 block text-xs font-semibold text-muted";

// ── Form de pasta ───────────────────────────────────────────────────────────
function FolderForm({
  folder,
  scope,
  allowed,
  onClose,
  onSaved,
}: {
  folder?: VaultFolder;
  scope: VaultScope;
  allowed: Sensitivity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(folder);
  const [name, setName] = useState(folder?.name ?? "");
  const [sensitivity, setSensitivity] = useState<Sensitivity>(
    folder?.sensitivity ?? allowed[0] ?? "equipe",
  );
  const [notes, setNotes] = useState(folder?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Dê um nome pra pasta.");
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/vault/folders/${folder!.id}` : "/api/vault/folders",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, name, sensitivity, notes }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não consegui salvar.");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Editar pasta" : `Nova pasta · ${SCOPE_LABEL[scope]}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
        )}
        <div>
          <label className={labelCls}>Nome da pasta</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={scope === "cliente" ? "Ex.: DBP Cleaning Services" : "Ex.: Bancos da agência"}
            className={field}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Nível de sigilo</label>
          <div className="grid gap-2">
            {allowed.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${
                  sensitivity === s ? "border-brand-blue bg-brand-blue-50" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="sens"
                  checked={sensitivity === s}
                  onChange={() => setSensitivity(s)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold text-ink">{SENSITIVITY_LABEL[s]}</span>
                  <span className="block text-xs text-muted">{SENSITIVITY_HINT[s]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Observação (opcional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} placeholder="Ex.: endereço, contato…" />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="gradient-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {editing ? "Salvar" : "Criar pasta"}
        </button>
      </form>
    </Modal>
  );
}

// ── Form de acesso ──────────────────────────────────────────────────────────
function CredentialForm({
  folderId,
  cred,
  onClose,
  onSaved,
}: {
  folderId: string;
  cred?: VaultCredentialSafe;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(cred);
  const [category, setCategory] = useState<VaultCategory>(cred?.category ?? "outros");
  const [label, setLabel] = useState(cred?.label ?? "");
  const [url, setUrl] = useState(cred?.url ?? "");
  const [username, setUsername] = useState(cred?.username ?? "");
  const [password, setPassword] = useState("");
  const [extra, setExtra] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!label.trim()) return setErr("Dê um nome pro acesso (ex.: Gmail).");
    setSaving(true);
    try {
      // Na edição, senha/extra em branco = mantém o que já está (não envia).
      const body: Record<string, unknown> = { category, label, url, username };
      if (!editing || password !== "") body.password = password;
      if (!editing || extra !== "") body.extra = extra;
      if (!editing) body.folderId = folderId;

      const res = await fetch(
        editing ? `/api/vault/credentials/${cred!.id}` : "/api/vault/credentials",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não consegui salvar.");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Editar acesso" : "Novo acesso"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as VaultCategory)} className={field}>
              {VAULT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nome do acesso</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Gmail, Meta Ads…" className={field} autoFocus />
          </div>
        </div>
        <div>
          <label className={labelCls}>Link do painel (opcional)</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={field} />
        </div>
        <div>
          <label className={labelCls}>Login / e-mail</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
        </div>
        <div>
          <label className={labelCls}>
            Senha {editing && <span className="font-normal text-slate-400">(em branco = mantém a atual)</span>}
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? "••••••••" : ""}
              className={`${field} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Extra / 2FA (opcional) {editing && <span className="font-normal text-slate-400">(em branco = mantém)</span>}
          </label>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={2}
            placeholder="Código de backup, PIN, dica de recuperação…"
            className={field}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="gradient-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {editing ? "Salvar" : "Adicionar"}
        </button>
      </form>
    </Modal>
  );
}
