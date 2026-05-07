import type { Editor } from "@tiptap/core";
import type { ToolbarCommand } from "./registry.js";

export function createDefaultToolbarCommands(editor: Editor): ToolbarCommand[] {
  return [
    {
      id: "format.bold",
      label: "Bold",
      icon: "bold",
      group: "Formatting",
      shortcut: "Mod+B",
      keywords: ["strong"],
      run: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      id: "format.italic",
      label: "Italic",
      icon: "italic",
      group: "Formatting",
      shortcut: "Mod+I",
      run: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      id: "insert.image",
      label: "Insert image",
      icon: "image-plus",
      group: "Insert",
      keywords: ["media", "photo"],
      run: () => {},
    },
    {
      id: "insert.video",
      label: "Insert video",
      icon: "video",
      group: "Insert",
      keywords: ["youtube", "vimeo", "loom"],
      run: () => {},
    },
  ];
}
