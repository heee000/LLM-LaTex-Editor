import { bracketMatching } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { latex } from "codemirror-lang-latex";

export const latexExtensions = [
  latex(),
  bracketMatching(),
  closeBrackets(),
  syntaxHighlighting(defaultHighlightStyle),
];
