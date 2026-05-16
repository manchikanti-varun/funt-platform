"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

export type AlertDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
};

export type PromptDialogOptions = {
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  optional?: boolean;
};

type DialogState =
  | ({ kind: "confirm" } & ConfirmDialogOptions & { resolve: (value: boolean) => void })
  | ({ kind: "alert" } & AlertDialogOptions & { resolve: () => void })
  | ({
      kind: "prompt";
    } & PromptDialogOptions & { resolve: (value: string | null) => void });

type AppDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions) => Promise<void>;
  prompt: (options: PromptDialogOptions) => Promise<string | null>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function DialogMessage({ message }: { message: string }) {
  const parts = message.split(/\n\n+/).filter(Boolean);
  if (parts.length <= 1) {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{message}</p>;
  }
  return (
    <div className="space-y-3">
      {parts.map((part, index) => (
        <p key={index} className="text-sm leading-relaxed text-slate-600">
          {part}
        </p>
      ))}
    </div>
  );
}

function AppDialogModal({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [promptValue, setPromptValue] = useState(
    state.kind === "prompt" ? (state.defaultValue ?? "") : ""
  );
  const [promptError, setPromptError] = useState(false);

  useEffect(() => {
    if (state.kind !== "prompt") return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    if (node instanceof HTMLInputElement) {
      node.select();
    }
  }, [state.kind]);

  const finish = () => onClose();

  const onBackdrop = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      if (state.kind === "confirm") state.resolve(false);
      else if (state.kind === "alert") state.resolve();
      else state.resolve(null);
      finish();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (state.kind === "confirm") state.resolve(false);
    else if (state.kind === "alert") state.resolve();
    else state.resolve(null);
    finish();
  };

  const submitPrompt = () => {
    if (state.kind !== "prompt") return;
    const value = promptValue.trim();
    if (!value && !state.optional) {
      setPromptError(true);
      inputRef.current?.focus();
      return;
    }
    state.resolve(value);
    finish();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={onBackdrop}
      onKeyDown={onKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {state.title}
          </h2>
        </div>

        <div className="px-5 py-4">
          {state.kind === "prompt" ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">{state.label}</span>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={promptValue}
                onChange={(event) => {
                  setPromptValue(event.target.value);
                  setPromptError(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitPrompt();
                  }
                }}
                placeholder={state.placeholder}
                className={`input w-full ${promptError ? "border-red-400 ring-red-200" : ""}`}
                autoComplete="off"
              />
              {state.optional ? (
                <span className="block text-xs text-slate-500">Optional — leave blank if not needed.</span>
              ) : null}
            </label>
          ) : (
            <DialogMessage message={state.message} />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          {state.kind === "confirm" ? (
            <>
              <Button variant="secondary" onClick={() => { state.resolve(false); finish(); }}>
                {state.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={state.variant === "danger" ? "danger" : "primary"}
                onClick={() => { state.resolve(true); finish(); }}
              >
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </>
          ) : null}
          {state.kind === "alert" ? (
            <Button variant="primary" onClick={() => { state.resolve(); finish(); }}>
              {state.confirmLabel ?? "OK"}
            </Button>
          ) : null}
          {state.kind === "prompt" ? (
            <>
              <Button variant="secondary" onClick={() => { state.resolve(null); finish(); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submitPrompt}>
                {state.confirmLabel ?? "OK"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", ...options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", ...options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      setState({ kind: "prompt", ...options, resolve });
    });
  }, []);

  const value: AppDialogContextValue = { confirm, alert, prompt };

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {state ? <AppDialogModal state={state} onClose={() => setState(null)} /> : null}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogContextValue {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return ctx;
}
