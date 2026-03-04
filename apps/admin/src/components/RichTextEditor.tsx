"use client";

import dynamic from "next/dynamic";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import "react-quill/dist/quill.snow.css";


const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["link", "blockquote", "code-block"],
    ["clean"],
  ],
};

const HEIGHT_CLASSES: Record<number, string> = {
  100: "[&_.ql-editor]:min-h-[100px] [&_.ql-container]:min-h-[100px]",
  120: "[&_.ql-editor]:min-h-[120px] [&_.ql-container]:min-h-[120px]",
  200: "[&_.ql-editor]:min-h-[200px] [&_.ql-container]:min-h-[200px]",
  240: "[&_.ql-editor]:min-h-[240px] [&_.ql-container]:min-h-[240px]",
  320: "[&_.ql-editor]:min-h-[320px] [&_.ql-container]:min-h-[320px]",
};

const EDITOR_BASE =
  "rounded-xl overflow-hidden border border-slate-200 bg-white [&_.ql-toolbar]:rounded-t-xl [&_.ql-toolbar]:border-slate-200 [&_.ql-container]:rounded-b-xl [&_.ql-container]:border-slate-200";

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  
  minHeight?: number;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  minHeight = 120,
  placeholder,
  className = "",
}: RichTextEditorProps) {
  const heightClass = HEIGHT_CLASSES[minHeight] ?? HEIGHT_CLASSES[120];
  return (
    <div className={`${EDITOR_BASE} ${heightClass} ${className}`.trim()}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={QUILL_MODULES}
        placeholder={placeholder}
      />
    </div>
  );
}
