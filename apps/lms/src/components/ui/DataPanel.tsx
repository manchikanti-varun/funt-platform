"use client";

export function DataPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel-data ${className}`.trim()}>{children}</section>;
}
