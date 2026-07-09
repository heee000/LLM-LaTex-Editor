import { keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { FileInfo } from "../types";
import { latexExtensions } from "./latexExtensions";

interface Props {
  file: FileInfo | null;
  onChange: (content: string) => void;
  onSave: () => void;
}

export function CodeEditor({ file, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current || !file || file.content === null) return;
    viewRef.current?.destroy();

    const state = EditorState.create({
      doc: file.content || "",
      extensions: [
        basicSetup,
        ...latexExtensions,
        placeholder("开始写 LaTeX，或先导入材料后点击生成。"),
        keymap.of([
          ...defaultKeymap,
          {
            key: "Ctrl-s",
            run: () => {
              onSave();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [file?.id]);

  if (!file) {
    return <div className="blank-surface">选择一个文件开始。</div>;
  }

  if (file.content === null) {
    return <div className="blank-surface">此文件不可直接编辑，请使用预览面板查看。</div>;
  }

  return <div className="editor-host" ref={containerRef} />;
}
