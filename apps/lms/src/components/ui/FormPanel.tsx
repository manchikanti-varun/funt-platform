"use client";

export function FormPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel-form ${className}`.trim()}>{children}</section>;
}
