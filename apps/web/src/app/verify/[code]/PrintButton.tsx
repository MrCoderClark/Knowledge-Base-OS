"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 print:hidden"
    >
      <Printer className="size-4" />
      Print / Save as PDF
    </button>
  );
}
