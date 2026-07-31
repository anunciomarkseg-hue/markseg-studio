export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
  accent?: "blue" | "orange" | "green";
}) {
  const tint =
    accent === "orange"
      ? "bg-brand-orange-50 text-brand-orange"
      : accent === "green"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-brand-blue-50 text-brand-blue";

  return (
    <div className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${tint}`}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-bold leading-none text-ink">{value}</div>
        <div className="mt-1 text-xs font-medium text-muted">{label}</div>
      </div>
      {hint && <span className="ml-auto text-xs font-semibold text-emerald-600">{hint}</span>}
    </div>
  );
}
