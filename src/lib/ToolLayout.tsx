import type { ReactNode } from "react";

export function ToolLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 h-full p-6 overflow-auto">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
    </div>
  );
}
