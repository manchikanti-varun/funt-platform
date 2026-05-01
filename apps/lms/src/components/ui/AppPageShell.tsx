"use client";

export function AppPageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-page-shell ${className}`.trim()}>{children}</div>;
}
