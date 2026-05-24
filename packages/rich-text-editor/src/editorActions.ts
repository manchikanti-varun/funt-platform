import { Extension } from "@tiptap/core";

export type RteActionsStorage = {
  insertImage: (() => Promise<void>) | null;
  openFindReplace: (() => Promise<void>) | null;
  showAlert: ((message: string) => Promise<void>) | null;
};

export const RteActionsExtension = Extension.create({
  name: "rteActions",
  addStorage() {
    return {
      insertImage: null,
      openFindReplace: null,
      showAlert: null,
    } as RteActionsStorage;
  },
});

export function getRteActionsStorage(editor: { storage: Record<string, unknown> }): RteActionsStorage | null {
  const storage = editor.storage.rteActions;
  if (!storage || typeof storage !== "object") return null;
  return storage as RteActionsStorage;
}
