import { Files } from "lucide-react";

/** Shared “copy / duplicate” glyph for courses, batches, modules, assignments. */
export function DuplicateIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <Files className={className} aria-hidden />;
}
