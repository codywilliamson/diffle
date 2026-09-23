import type { ThemeRegistration } from "shiki/core";

// untouched tokens inherit the diff row's text color; renderers skip styling this sentinel.
export const INHERIT = "inherit";

const rule = (scope: string[], color: string, fontStyle?: string) => ({ scope, settings: { foreground: color, fontStyle } });

// textmate scopes → the D5 --syn-* tokens (defined per theme in diff.css), so one grammar pass
// serves light and dark.
export const SYNTAX_THEME: ThemeRegistration = {
  name: "diffle",
  type: "dark",
  fg: INHERIT,
  bg: "transparent",
  settings: [
    { settings: { foreground: INHERIT } },
    rule(["keyword", "storage", "keyword.control", "variable.language"], "var(--syn-keyword)"),
    rule(["keyword.operator"], INHERIT),
    rule(["string", "string.regexp", "markup.inline.raw"], "var(--syn-string)"),
    rule(["constant.numeric", "constant.language", "constant.character", "support.constant"], "var(--syn-number)"),
    rule(["comment", "punctuation.definition.comment"], "var(--syn-comment)", "italic"),
    rule(["entity.name.function", "support.function", "meta.function-call entity.name.function", "markup.heading"], "var(--syn-func)"),
    rule(["entity.other.attribute-name", "variable.other.property", "support.type.property-name", "meta.object-literal.key", "variable.parameter"], "var(--syn-attr)"),
    rule(["entity.name.type", "entity.name.class", "entity.other.inherited-class", "support.type", "support.class", "entity.name.namespace"], "var(--syn-type)"),
    rule(["entity.name.tag", "punctuation.definition.tag", "support.class.component"], "var(--syn-tag)"),
    rule(["meta.decorator", "meta.preprocessor", "keyword.control.directive", "comment.block.documentation storage.type"], "var(--syn-meta)"),
    rule(["markup.italic"], INHERIT, "italic"),
    rule(["markup.bold"], INHERIT, "bold"),
  ],
};
