# Jev provider API contract

Verified against first-party documentation on 2026-09-18.

## Decision

Jev is a decision model with its own wire protocol. OpenRouter's general
OpenAI-compatible `/api/v1` claim does not make Jev callable through
`/api/v1/chat/completions` or `/api/v1/responses`. Use the dedicated alpha
Decisions endpoint:

```text
POST https://openrouter.ai/api/alpha/decisions
```

The endpoint is outside `/api/v1`; do not append `/api/alpha/decisions` to an
OpenAI SDK base URL. OpenRouter's API index names it "Decisions router," and
the endpoint reference documents the non-OpenAI `state` / `questions` body.

Sources: [OpenRouter API index](https://openrouter.ai/docs/llms.txt),
[OpenRouter Decisions reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request).

## Portable model contract

```ts
type JsonValue = null | boolean | number | string | JsonValue[] |
  { [key: string]: JsonValue };

type NoulQuestion = {
  type: "noul";
  instructions: string | JsonValue[] | { [key: string]: JsonValue };
  criteria?: { true: JsonValue; false: JsonValue };
};

type ChoiceQuestion = {
  type: "choice";
  instructions: string | JsonValue[] | { [key: string]: JsonValue };
  criteria: Record<string, JsonValue>;
};

type ScoreQuestion = {
  type: "score";
  instructions: string | JsonValue[] | { [key: string]: JsonValue };
  criteria: JsonValue[];
};

type JevInput = {
  state: string | JsonValue[] | { [key: string]: JsonValue };
  questions: Record<string, NoulQuestion | ChoiceQuestion | ScoreQuestion>;
};

type NoulAnswer = { type: "noul"; noul: number };
type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};
type ScoreAnswer = {
  type: "score";
  score: number;
  confidence?: number;
  legend?: Record<string, JsonValue>;
  probabilities?: Record<string, number>;
};

type JevResult = {
  model: string;
  answers: Record<string, NoulAnswer | ChoiceAnswer | ScoreAnswer>;
  usage: { input_tokens: number; output_tokens: number; cost?: number };
  id?: string;
  provider?: string;
};
```

Semantics: `noul` is the probability of yes from 0 to 1; a Choice selects the
highest-probability named option; Score is a probability-weighted value across
ordered zero-based levels and may fall between levels. Choice and Score
probability maps sum to 1. TypeSafe's API reference marks their confidence,
probabilities, and Score legend as required. OpenRouter's current generated SDK
marks those fields optional, so consumers should validate them before display.

Sources: [TypeSafe HTTP API](https://docs.typesafe.ai/api),
[OpenRouter official TypeScript SDK models](https://github.com/OpenRouterTeam/typescript-sdk/tree/main/src/models).

## OpenRouter transport

Environment and headers:

```text
OPENROUTER_API_KEY
Authorization: Bearer $OPENROUTER_API_KEY
Content-Type: application/json
```

Request:

```json
{
  "model": "typesafe/jev-1.13",
  "state": { "diff": "..." },
  "questions": {
    "lane": {
      "type": "choice",
      "instructions": "Which review lane applies?",
      "criteria": { "boundary": "...", "routine": "..." }
    }
  }
}
```

Documented models are `typesafe/jev-1.13` for a stable family version and
`~typesafe/jev-latest` for the floating latest alias. A successful response can
resolve to a dated model such as `typesafe/jev-1.13-20260917` and adds `id`,
`provider`, and `usage.cost` to the portable result.

Optional Decisions fields are `provider`, `session_id` (maximum 256
characters), `trace`, and `user` (maximum 256 characters). Keep these out of the
first integration unless Loupe needs provider routing or observability.

Sources: [OpenRouter Decisions reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request),
[OpenRouter TypeSafe models](https://openrouter.ai/typesafe).

## Cloudflare transport

Environment and headers:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
Authorization: Bearer $CLOUDFLARE_API_TOKEN
Content-Type: application/json
```

The token needs Workers AI access. Cloudflare's REST guide says a custom token
needs both `Workers AI - Read` and `Workers AI - Edit` permissions.

Current Jev model-page request:

```text
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run
```

```json
{
  "model": "typesafe/jev",
  "input": {
    "state": { "diff": "..." },
    "questions": { "needs_attention": {
      "type": "noul",
      "instructions": "Does this need focused human review?"
    } }
  }
}
```

In a Worker binding, the equivalent is
`env.AI.run("typesafe/jev", jevInput)`. Cloudflare documents only the floating
model identifier `typesafe/jev`; examples currently resolve to `jev-1.13.0`.

Sources: [Cloudflare Jev model page](https://developers.cloudflare.com/ai/models/typesafe/jev/),
[Workers AI REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).

## Errors and retry policy

OpenRouter Decisions returns `{ "error": { "code": number, "message": string
} }` and explicitly documents 400, 401, 402, 403, 404, 413, 429, 500, 502,
503, 524, and 529. Do not retry validation, authentication, payment,
permission, missing-resource, or payload-size errors. Retry 429 and transient
5xx/524/529 failures with a small bounded exponential backoff and jitter. Honor
`Retry-After` when present; OpenRouter documents it for 429 and 503, and for a
special 402 in-flight-budget case. Ordinary insufficient-credit 402 responses
are not retryable.

Cloudflare documents 400 validation/model errors, 403 access/plan errors, 404
invalid model, 413 oversized requests, 408 timeout/abort, and two distinct 429
conditions. Internal code `3036` means the daily allocation is exhausted and
should not be retried. Internal code `3040` means temporary capacity exhaustion
and explicitly says to try again. Retry 408, 3040, and transient transport/5xx
failures with the same bounded policy; do not retry the other listed cases.

Sources: [OpenRouter Decisions errors](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request),
[OpenRouter error and Retry-After guidance](https://openrouter.ai/docs/api_reference/errors-and-debugging),
[Workers AI errors](https://developers.cloudflare.com/workers-ai/platform/errors/).

## Documentation ambiguity

Cloudflare's Jev page shows the unified `/ai/run` request above and presents the
Jev result as a bare object. The general Workers AI REST guide shows a second,
model-in-path form (`/ai/run/{model}`) and wraps success as
`{ result, success, errors, messages }`. Until a credentialed live probe confirms
the Jev route's envelope, normalize REST success as `json.result ?? json` and
validate the resulting Jev discriminated union. The Worker binding has no such
envelope ambiguity.

OpenRouter labels the route alpha. Keep its full endpoint configurable even if
the provider/model choice is fixed.
