# Loupe Radar UI design

> Proposed direction after the three-variant prototype. Radar remains optional and
> advisory; the existing inspect, comment, return, refresh, resolve, approve loop stays intact.

## Job

A developer opening a large agent-generated diff needs to answer three questions quickly:

1. Where should I begin?
2. Why did this code earn attention?
3. What exact evidence did Loupe and Jev use?

Radar succeeds when it shortens orientation while keeping the diff, reviewer judgment,
and existing comment workflow primary. It must not turn Loupe into a metrics dashboard.

## Selected composition

Combine the strongest parts of the prototypes:

- **Review map from variant C** for whole-diff orientation.
- **Inline proof marks from variant A** while reading code.
- **Evidence ledger from variant B** as an on-demand drawer, not a permanent column.

The review map appears below the top bar when Radar is ready and the diff has several
review units. It is a narrow index, not a second navigation system. Each file segment
contains ordered unit marks with lane labels available to assistive technology. Selecting
a mark navigates to its hunk and makes it the active proof mark.

The file tree retains its current structure. Each file gains one narrow lane mark and a
unit count. Its row subtitle may state the highest-priority reason. Existing change badges,
deltas, comment status, active state, viewed state, and filtering remain intact.

The hunk header owns the selected unit's compact evidence: lane, exact diagnostic or
boundary, and Jev attention. An expanded proof note appears beneath the relevant code only
when the unit is selected. It states the review reason in deterministic language and lists
the evidence sources. It does not generate a finding or suggestion.

The **Evidence** action opens a right drawer containing exact deterministic results,
probability distributions, context sufficiency, packet provenance, truncation/redaction,
cache status, model version, and question-set version. The drawer can reveal the canonical
outbound packet. Closing it returns focus to the triggering proof mark.

## Hierarchy

1. Changed code and human comments.
2. Verified findings and configured boundaries.
3. Selected Radar proof mark and its reason.
4. Review map and remaining attention marks.
5. Routine/noise classifications and provider metadata.

Use Loupe's existing proof-desk palette. Vermilion remains reviewer action. Proof Blue
marks semantic attention and keyboard focus. Oxide signals exact failures, gold signals
configured boundaries, moss signals routine evidence, and neutral ink signals collapsed
noise. Every color has a text label or shape cue.

## Review lanes

Use names rather than a composite risk score:

- **Verified finding** — an exact new analyzer result on the change.
- **Boundary review** — configured security, data, interface, deployment, or lifetime boundary.
- **Semantic attention** — Jev or context uncertainty raised the unit.
- **Routine review** — no higher evidence lane.
- **Noise candidate** — generated, moved, or formatting-heavy material; still reachable.
- **Local blocker** — unsafe outbound content, unreadable state, or invalid required evidence.

Jev may raise a unit but never lower a deterministic lane. Uncertainty increases attention.

## Primary flow

1. Loupe renders the ordinary diff immediately.
2. Deterministic evidence populates lane marks progressively without reordering code.
3. The review map becomes available and announces its unit counts.
4. Jev enrichment updates relevant marks in place and names its provider/model provenance.
5. The reviewer selects the first mark, reads the code, and expands evidence only as needed.
6. Comments remain ordinary Loupe comments with human-authored text and exact anchors.
7. Refresh invalidates changed unit hashes, retains stable evidence for unchanged units, and
   labels stale results until replacement analysis finishes.

`[` and `]` are proposed for previous/next proof mark after final shortcut review. Existing
`j` and `k` continue to navigate files in repository order; Radar must not silently reorder them.

## States

- **Off:** a compact top-bar action explains optional BYOK analysis.
- **Setup required:** show environment-variable instructions; never collect an API key in the browser.
- **Deterministic scan:** diff remains usable; marks appear as local evidence completes.
- **Jev analysis:** local lanes remain usable; remote enrichment shows bounded progress.
- **Ready:** counts, provenance, cache state, and analysis timestamp are visible.
- **Cached:** visually identical to ready with an explicit cached label.
- **Stale after refresh:** affected units show stale labels and cannot be routed downward.
- **Provider failure:** retain deterministic lanes and offer retry; never blank the map.
- **Local blocker:** identify the unsent unit and why transmission was blocked.
- **No attention signals:** state that analysis completed and preserve normal review order.
- **Empty diff:** keep Loupe's existing empty behavior; do not render Radar chrome.

## Responsive behavior

Desktop uses the narrow review map, existing file tree, central diff, and an on-demand
right drawer. Tablet shortens file labels in the map and overlays the evidence drawer.
On mobile the map becomes a horizontally scrollable unit strip, the existing file tree
remains a drawer, and evidence becomes a full-height sheet. Proof marks and lane filters
have 44px targets. Code retains priority over summary text.

## Accessibility and trust

- Lane, source, cache, truncation, and confidence states use text in addition to color.
- The review map is a labelled list of buttons in review order, not a canvas-only chart.
- Probability bars expose textual names and percentages.
- Analysis progress uses a polite live region; failures use explicit recovery copy.
- Evidence disclosure carries `aria-expanded`; drawers trap focus and restore it on close.
- Reduced motion removes map and proof-note transitions without delaying state updates.
- The outbound preview names provider, model, paths, bytes, redactions, and exclusions.
- The exact packet and versioned question set remain inspectable from every result.

## Performance boundaries

Do not block first diff paint on Radar. Compute deterministic evidence in bounded tasks,
cache by canonical unit hash, and render unit details lazily. Map updates must not move the
reader's scroll position. Large files stay metadata-only until explicitly loaded. Provider
errors and timeouts never block comments, feedback return, rereview, or approval.

## Demo

Append `?radar-demo=1` to a Loupe review URL to load the client-only demonstration. It
exercises the combined production components with realistic lanes, provider states,
packet provenance, blocker cases, light/dark themes, and responsive behavior. Demo
comments and viewed state stay local and never write to the active Review Record.
