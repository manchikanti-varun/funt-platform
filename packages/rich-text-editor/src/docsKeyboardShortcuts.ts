import { Extension } from "@tiptap/core";

export const DocsKeyboardShortcuts = Extension.create({
  name: "docsKeyboardShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-0": () => this.editor.commands.setParagraph(),
      "Mod-Alt-1": () => this.editor.commands.toggleHeading({ level: 1 }),
      "Mod-Alt-2": () => this.editor.commands.toggleHeading({ level: 2 }),
      "Mod-Alt-3": () => this.editor.commands.toggleHeading({ level: 3 }),
      "Mod-Shift-8": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-7": () => this.editor.commands.toggleOrderedList(),
      "Mod-\\": () =>
        this.editor.chain().clearNodes().unsetAllMarks().resetBlockIndent().run(),
      "Mod-]": () => this.editor.commands.indentBlock(),
      "Mod-[": () => this.editor.commands.outdentBlock(),
      "Mod-Shift->": () => this.editor.commands.increaseFontSize(),
      "Mod-Shift-<": () => this.editor.commands.decreaseFontSize(),
    };
  },
});
