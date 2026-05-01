import { RichTextEditor } from "../../src/index.js";

const mount = document.getElementById("editor");
const htmlOutput = document.getElementById("html-output");
const jsonOutput = document.getElementById("json-output");

if (!mount || !htmlOutput || !jsonOutput) {
  throw new Error("Example DOM mount elements are missing.");
}

const editor = new RichTextEditor({
  content: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Welcome to the editor" }]
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Use / at line start to open slash commands." }]
      }
    ]
  },
  enableSlashCommands: true,
  toolbarMode: "top",
  uploadImage: async (file) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { url: URL.createObjectURL(file), alt: file.name };
  }
});

editor.init(mount);

editor.onChange(({ html, json }) => {
  htmlOutput.textContent = html;
  jsonOutput.textContent = JSON.stringify(json, null, 2);
});
