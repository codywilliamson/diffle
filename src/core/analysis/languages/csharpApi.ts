// line-level parser for public/protected c# declarations (types, members, events, delegates).

import type { Declaration } from "./declDiff";

const VISIBLE = /^(public|protected)\b/;
const EVENT = /\bevent\s+[^;=(]+?\s(\w+)\s*(?:;|\{|=|$)/;
const DELEGATE = /\bdelegate\s+.+?\s(\w+)\s*(?:<[^>]*>)?\s*\(/;
const DELEGATE_SIGNATURE = /^[^;]*?\)/;
const TYPE = /\b(class|interface|record\s+struct|record|struct|enum)\s+([A-Za-z_]\w*)/;
const CALL = /([A-Za-z_]\w*)\s*(?:<[^>(]*>)?\s*\(/;
const MEMBER_NAME = /(\w+)\s*(?:\{|=>|=|;|$)/;

const decl = (key: string, label: string): Declaration => ({ key, label });

export function parseCsharpDeclaration(raw: string): Declaration | null {
  const t = raw.trim().replace(/\s+/g, " ").replace(/\s*\{$/, "");
  const visibility = VISIBLE.exec(t)?.[1];
  if (!visibility) return null;
  const label = (kind: string, name: string): string => `${visibility} ${kind} \`${name}\``;

  const event = EVENT.exec(t);
  if (event) return decl(t, label("event", event[1]!));
  const delegate = DELEGATE.exec(t);
  if (delegate) return decl(DELEGATE_SIGNATURE.exec(t)?.[0] ?? t, label("delegate", delegate[1]!));

  const call = CALL.exec(t);
  const type = TYPE.exec(t);
  if (type && (!call || type.index < call.index)) {
    const kind = type[1]!.replace(/\s+/g, " ");
    return decl(`${kind} ${type[2]}`, label(kind, type[2]!));
  }

  const open = t.indexOf("(");
  const assign = t.search(/=>|=|\{/);
  if (call && open >= 0 && (assign < 0 || open < assign)) {
    const close = t.indexOf(")", open);
    const key = close >= 0 ? t.slice(0, close + 1) : t;
    const sig = t.slice(call.index, close >= 0 ? close + 1 : undefined);
    return decl(key, label("method", sig));
  }

  const member = MEMBER_NAME.exec(t);
  if (!member) return null;
  const key = t.slice(0, member.index + member[1]!.length);
  const kind = /\{|=>/.test(t) ? "property" : "field";
  return decl(key, label(kind, member[1]!));
}
