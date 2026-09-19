// local outbound guard: detect common credential shapes, replace the value, and withhold the
// whole unit from remote analysis. this is deliberately conservative and never logs matches.

const SECRET_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { kind: "openrouter-key", re: /sk-or-v1-[A-Za-z0-9_-]{20,}/g },
  { kind: "openai-key", re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { kind: "stripe-secret", re: /(?:sk|rk)_live_[A-Za-z0-9]{16,}/g },
  { kind: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{20,}/g },
  { kind: "github-token", re: /gh[opusr]_[A-Za-z0-9]{20,}/g },
  { kind: "aws-access-key", re: /AKIA[A-Z0-9]{16}/g },
  { kind: "google-api-key", re: /AIza[A-Za-z0-9_-]{30,}/g },
  { kind: "jwt", re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { kind: "assigned-secret", re: /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|secret|token)\b\s*[:=]\s*(?:["'][^"'\n]{12,}["']|[A-Za-z0-9_./+=-]{20,})/gi },
];

const SECRET_PATH = /(^|\/)(?:\.env(?:\.|$)|credentials?|secrets?|id_(?:rsa|ed25519))(?:\/|\.|$)/i;

export interface RedactionResult {
  text: string;
  kinds: string[];
  blocked: boolean;
}

export function redactSecrets(path: string, text: string): RedactionResult {
  const kinds = new Set<string>();
  let redacted = text;
  for (const { kind, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(redacted)) kinds.add(kind);
    re.lastIndex = 0;
    redacted = redacted.replace(re, `<redacted:${kind}>`);
  }
  if (SECRET_PATH.test(path)) kinds.add("sensitive-path");
  return { text: redacted, kinds: [...kinds], blocked: kinds.size > 0 };
}
