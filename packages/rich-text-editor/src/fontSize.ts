import { Extension } from "@tiptap/core";

export const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72] as const;

export const DEFAULT_FONT_SIZE_PX = 12;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
      increaseFontSize: () => ReturnType;
      decreaseFontSize: () => ReturnType;
    };
  }
}

function parseFontSizePx(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*px/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

function nextFontSizePx(current: number, direction: 1 | -1): string {
  const sorted = [...FONT_SIZE_OPTIONS];
  if (direction > 0) {
    const next = sorted.find((s) => s > current);
    return `${next ?? sorted[sorted.length - 1]}px`;
  }
  const prev = [...sorted].reverse().find((s) => s < current);
  return `${prev ?? sorted[0]}px`;
}

export const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const style = (element as HTMLElement).style?.fontSize;
              if (style) return style;
              const data = (element as HTMLElement).getAttribute("data-font-size");
              return data ? `${data}px` : null;
            },
            renderHTML: (attributes) => {
              const size = attributes.fontSize;
              if (!size) return {};
              const px = parseFontSizePx(String(size));
              return {
                style: `font-size: ${size}`,
                "data-font-size": px != null ? String(px) : undefined,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
      increaseFontSize:
        () =>
        ({ editor, chain }) => {
          const current =
            parseFontSizePx(String(editor.getAttributes("textStyle").fontSize ?? "")) ??
            DEFAULT_FONT_SIZE_PX;
          return chain().setMark("textStyle", { fontSize: nextFontSizePx(current, 1) }).run();
        },
      decreaseFontSize:
        () =>
        ({ editor, chain }) => {
          const current =
            parseFontSizePx(String(editor.getAttributes("textStyle").fontSize ?? "")) ??
            DEFAULT_FONT_SIZE_PX;
          return chain().setMark("textStyle", { fontSize: nextFontSizePx(current, -1) }).run();
        },
    };
  },
});
