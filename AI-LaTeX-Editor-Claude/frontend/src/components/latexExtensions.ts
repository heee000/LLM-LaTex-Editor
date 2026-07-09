import { closeBrackets } from "@codemirror/autocomplete";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { latex } from "codemirror-lang-latex";

export const latexExtensions = [latex(), bracketMatching(), closeBrackets(), syntaxHighlighting(defaultHighlightStyle)];
