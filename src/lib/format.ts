const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`;
}

export function fmtDayTime(iso: string): string {
  return `${fmtDay(iso)} · ${fmtTime(iso)}`;
}

export function fmtFollowers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function relativeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return fmtDay(iso);
}

/**
 * Valor pro <input type="date"> (AAAA-MM-DD) no fuso LOCAL.
 *
 * Não use toISOString(): ele converte pra UTC e, à noite no Brasil (UTC-3),
 * devolve o dia SEGUINTE — a data apareceria errada no campo.
 */
export function dateInputValue(iso: string): string {
  const d = new Date(iso);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Valor pro <input type="time"> (HH:MM) no fuso LOCAL. */
export function timeInputValue(iso: string): string {
  return fmtTime(iso);
}
