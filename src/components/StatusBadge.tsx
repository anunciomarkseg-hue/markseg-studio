import { STATUS_LABEL, type PostStatus } from "@/lib/types";

const STYLES: Record<PostStatus, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  agendado: "bg-brand-blue-50 text-brand-blue-700",
  aguardando: "bg-amber-50 text-amber-700",
  publicado: "bg-emerald-50 text-emerald-700",
  falhou: "bg-rose-50 text-rose-600",
};

const DOT: Record<PostStatus, string> = {
  rascunho: "bg-slate-400",
  agendado: "bg-brand-blue",
  aguardando: "bg-amber-500",
  publicado: "bg-emerald-500",
  falhou: "bg-rose-500",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
