"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition-fluid hover:bg-canvas print:hidden"
    >
      <Printer className="h-4 w-4" /> Baixar PDF
    </button>
  );
}
