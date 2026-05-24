export type PromptResult = { cancelled: true } | { cancelled: false; value: string };

export type ImageInsertResult =
  | { action: "cancel" }
  | { action: "url"; url: string }
  | { action: "file"; file: File };

let activeHost: HTMLElement | null = null;

function getMount(host: HTMLElement): HTMLElement {
  return host.closest(".rte-shell") ?? host;
}

export function dismissRteDialogs(): void {
  if (!activeHost) return;
  activeHost.querySelector(".rte-dialog-backdrop")?.remove();
  activeHost = null;
}

function trapEscape(host: HTMLElement, onClose: () => void): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };
  host.ownerDocument.addEventListener("keydown", onKey, true);
  return () => host.ownerDocument.removeEventListener("keydown", onKey, true);
}

function createButton(label: string, variant: "primary" | "secondary" | "ghost" = "secondary"): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `rte-dialog-btn rte-dialog-btn-${variant}`;
  btn.textContent = label;
  return btn;
}

function openDialog(
  host: HTMLElement,
  title: string,
  body: HTMLElement,
  actions: HTMLElement,
  onDismiss?: () => void
): { close: (fireDismiss?: boolean) => void } {
  dismissRteDialogs();
  const mount = getMount(host);
  activeHost = mount;

  const backdrop = document.createElement("div");
  backdrop.className = "rte-dialog-backdrop";
  backdrop.setAttribute("role", "presentation");

  const panel = document.createElement("div");
  panel.className = "rte-dialog";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "rte-dialog-title");

  const header = document.createElement("div");
  header.className = "rte-dialog-header";

  const heading = document.createElement("h2");
  heading.id = "rte-dialog-title";
  heading.className = "rte-dialog-title";
  heading.textContent = title;

  const closeBtn = createButton("×", "ghost");
  closeBtn.className = "rte-dialog-close";
  closeBtn.setAttribute("aria-label", "Close");

  header.append(heading, closeBtn);

  const footer = document.createElement("div");
  footer.className = "rte-dialog-footer";
  footer.append(actions);

  panel.append(header, body, footer);
  backdrop.append(panel);
  mount.append(backdrop);

  let closed = false;
  const close = (fireDismiss = true) => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    if (activeHost === mount) activeHost = null;
    untrapEscape();
    if (fireDismiss) onDismiss?.();
  };

  const untrapEscape = trapEscape(host, close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  closeBtn.addEventListener("click", () => close());

  requestAnimationFrame(() => {
    const focusable = panel.querySelector<HTMLElement>("input, button, textarea");
    focusable?.focus();
  });

  return { close };
}

/** Opens the native file picker in the same user-gesture turn as `click`. */
export function pickLocalImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    document.body.appendChild(input);
    input.click();
  });
}

export function showRteAlert(host: HTMLElement, message: string): Promise<void> {
  return new Promise((resolve) => {
    const body = document.createElement("p");
    body.className = "rte-dialog-message";
    body.textContent = message;

    const ok = createButton("OK", "primary");
    const actions = document.createElement("div");
    actions.className = "rte-dialog-actions";
    actions.append(ok);

    const done = () => resolve();
    const { close } = openDialog(host, "Notice", body, actions, done);
    ok.addEventListener("click", () => close());
  });
}

export interface RtePromptOptions {
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  allowEmpty?: boolean;
  hint?: string;
}

export function showRtePrompt(host: HTMLElement, options: RtePromptOptions): Promise<PromptResult> {
  return new Promise((resolve) => {
    const body = document.createElement("div");
    body.className = "rte-dialog-body-stack";

    if (options.hint) {
      const hint = document.createElement("p");
      hint.className = "rte-dialog-hint";
      hint.textContent = options.hint;
      body.append(hint);
    }

    const label = document.createElement("label");
    label.className = "rte-dialog-label";
    label.textContent = options.label;

    const input = document.createElement("input");
    input.type = "url";
    input.className = "rte-dialog-input";
    input.placeholder = options.placeholder ?? "";
    input.value = options.defaultValue ?? "";
    input.autocomplete = "off";

    label.append(input);
    body.append(label);

    const cancel = createButton("Cancel", "secondary");
    const confirm = createButton(options.confirmLabel ?? "OK", "primary");
    const actions = document.createElement('div');
    actions.className = "rte-dialog-actions";
    actions.append(cancel, confirm);

    const cancelResult = () => resolve({ cancelled: true });
    const { close } = openDialog(host, options.title, body, actions, cancelResult);

    const submit = () => {
      const value = input.value.trim();
      if (!value && !options.allowEmpty) {
        input.focus();
        input.classList.add("rte-dialog-input-error");
        return;
      }
      close(false);
      resolve({ cancelled: false, value });
    };

    cancel.addEventListener("click", () => close());
    confirm.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
    input.addEventListener("input", () => input.classList.remove("rte-dialog-input-error"));
  });
}

export function showRteImageDialog(host: HTMLElement): Promise<ImageInsertResult> {
  return new Promise((resolve) => {
    const body = document.createElement('div');
    body.className = "rte-dialog-body-stack";

    const hint = document.createElement('p');
    hint.className = "rte-dialog-hint";
    hint.textContent =
      "Paste an image URL, or upload a file from your computer. Google Drive links work if the file is shared as “Anyone with the link”.";

    const label = document.createElement('label');
    label.className = "rte-dialog-label";
    label.textContent = "Image URL";

    const input = document.createElement('input');
    input.type = "url";
    input.className = "rte-dialog-input";
    input.placeholder = "https://example.com/image.png or Google Drive share link";
    input.autocomplete = "off";

    label.append(input);
    body.append(hint, label);

    const divider = document.createElement('div');
    divider.className = "rte-dialog-divider";
    divider.textContent = "or";
    body.append(divider);

    const uploadBtn = createButton("Upload from computer", "secondary");
    uploadBtn.className = "rte-dialog-btn rte-dialog-btn-upload";

    const uploadRow = document.createElement('div');
    uploadRow.className = "rte-dialog-upload-row";
    uploadRow.append(uploadBtn);
    body.append(uploadRow);

    const cancel = createButton("Cancel", "ghost");
    const insertUrl = createButton("Insert from URL", "primary");

    const actions = document.createElement('div');
    actions.className = "rte-dialog-actions rte-dialog-actions-split";
    actions.append(cancel, insertUrl);

    const finish = (result: ImageInsertResult) => resolve(result);
    const { close } = openDialog(host, "Insert image", body, actions, () => finish({ action: "cancel" }));

    cancel.addEventListener("click", () => close());

    insertUrl.addEventListener("click", () => {
      const url = input.value.trim();
      if (!url) {
        input.focus();
        input.classList.add("rte-dialog-input-error");
        return;
      }
      close(false);
      finish({ action: "url", url });
    });

    uploadBtn.addEventListener("click", () => {
      void pickLocalImageFile().then((file) => {
        if (!file) return;
        close(false);
        finish({ action: "file", file });
      });
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        insertUrl.click();
      }
    });
    input.addEventListener("input", () => input.classList.remove("rte-dialog-input-error"));
  });
}
