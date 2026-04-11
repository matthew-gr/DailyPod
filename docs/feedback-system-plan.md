# Feedback & Self-Learning System — Design Plan

## Problem

The briefing quality depends on tuning that's currently manual — editing the briefing guide, adjusting prompts, telling me what worked. The system should learn from your reactions over time without requiring you to be a prompt engineer.

## Design Principles

1. **Low-friction input** — feedback should take <30 seconds
2. **Transparent learning** — you can see what the system learned and override it
3. **No black boxes** — all learned preferences stored as readable files, not opaque embeddings
4. **Additive, not destructive** — learning adds to the briefing guide, never silently removes your manual entries

---

## Feedback Inputs (3 channels)

### 1. Post-Listen Quick Rating (primary)

After each briefing, a simple CLI prompt or future mobile UI:

```
npx pnpm briefing:feedback --run-id 2026-04-10_091320_a950
```

Asks 3-4 quick questions:

```
Overall: [1-5 stars]
Meeting prep segment: [useful / ok / missed the mark]
News segment: [useful / ok / missed the mark]
What should we do differently? [free text, optional]
```

Stored as `data/artifacts/{runId}/feedback.json`:

```json
{
  "runId": "2026-04-10_091320_a950",
  "overall": 4,
  "segments": {
    "meeting-prep": "useful",
    "news": "ok",
    "priority-reflection": "useful"
  },
  "freeText": "News was too geopolitics-heavy, would have liked something on AI tooling",
  "timestamp": "2026-04-10T09:30:00Z"
}
```

### 2. Inline Script Annotations

Mark specific script lines as good/bad. Could work via the script.md file:

```markdown
**Alex**: The PHI scrubber project is stalling on scope definition. [👍]
**Jordan**: Have you considered using a pre-built HIPAA tokenization library? [👍👍]
**Alex**: The ceasefire situation continues to evolve. [👎 too vague]
```

Or via CLI:

```
npx pnpm briefing:annotate --run-id ... --line 5 --rating good --note "exactly the kind of insight I want"
```

### 3. Passive Signals (future)

- Did the user listen to the full audio or stop early? (requires a player integration)
- Did the user re-run the same day? (suggests dissatisfaction)
- Did the user manually edit the briefing guide after a run? (suggests the system missed something)

---

## Learning Layer

### What gets learned (stored in `data/learning/`)

#### `data/learning/preferences.json`

Accumulated preferences derived from feedback:

```json
{
  "updatedAt": "2026-04-10T09:30:00Z",
  "newsPreferences": {
    "moreOf": ["AI tooling", "practical tech", "SpaceX updates"],
    "lessOf": ["general geopolitics without actionable relevance"],
    "learnedFrom": ["run:2026-04-10_091320", "run:2026-04-09_192739"]
  },
  "meetingPrepPreferences": {
    "moreOf": ["concrete suggestions", "tool recommendations", "outside perspectives"],
    "lessOf": ["questions", "abstract commentary about meeting structure"],
    "learnedFrom": ["run:2026-04-10_065022"]
  },
  "tonePreferences": {
    "moreOf": ["direct", "challenging"],
    "lessOf": ["philosophical", "overly cautious"],
    "learnedFrom": []
  },
  "pacing": {
    "preferredLength": "5min",
    "tooLong": false,
    "tooShort": false
  }
}
```

#### `data/learning/examples.json`

Specific script lines the user marked as good/bad — used as few-shot examples in prompts:

```json
{
  "goodExamples": [
    {
      "line": "There are several open source LLM chat wrappers with document handling — using one would save the devs time and deliver more value for Caregivers United",
      "context": "meeting-prep",
      "note": "specific, actionable, brings outside knowledge"
    }
  ],
  "badExamples": [
    {
      "line": "The recurring nature and the number of transcripts suggest this is an active, ongoing engagement",
      "context": "meeting-prep",
      "note": "meta-commentary about the system, not useful content"
    }
  ]
}
```

### How learning feeds back into generation

#### Step 1: Preferences → Prompt Injection

Before script generation, the system loads `preferences.json` and appends to the script writer prompt:

```
LEARNED PREFERENCES (from your past feedback):
- Meeting prep: you prefer concrete suggestions and tool recommendations over questions
- News: you want more AI tooling coverage, less generic geopolitics
- Tone: be more direct and challenging

EXAMPLES OF LINES YOU LIKED:
- "There are several open source LLM chat wrappers..."

EXAMPLES OF LINES YOU DISLIKED:
- "The recurring nature and the number of transcripts suggest..."
```

This is the simplest, most transparent approach — no retraining, no fine-tuning, just prompt enrichment.

#### Step 2: Preferences → Ranking Adjustment (future)

Feedback on news stories adjusts the news ranker weights:

- User consistently rates geopolitics as "ok" but AI as "useful" → boost AI keyword weights
- User rates a meeting prep as "missed the mark" when the meeting had no transcript context → learn to flag "low context" meetings differently

#### Step 3: Periodic Guide Refresh (future)

After N runs with feedback, offer to update `personal_briefing_guide.md` with learned preferences:

```
Based on 12 runs of feedback, I'd suggest these guide updates:
- Add to News Interests: "AI developer tools and open source projects"
- Add to News to Ignore: "General ceasefire commentary without new developments"
- Update Tone: add "challenging" and "direct"

Apply these changes? [y/n]
```

This keeps the human in the loop — the system proposes, the user approves.

---

## Implementation Phases

### Phase 1: Feedback Collection (simple)

- `briefing:feedback` CLI command
- Stores per-run feedback as JSON
- No learning yet — just data collection
- ~1 day to build

### Phase 2: Prompt Enrichment (medium)

- Load accumulated feedback before script generation
- Append learned preferences and examples to prompts
- Add `data/learning/` directory with preferences + examples
- ~1-2 days to build

### Phase 3: Ranking Adjustment (medium)

- Use feedback patterns to adjust news ranker weights dynamically
- Use meeting prep feedback to tune which meetings get deep context
- ~1-2 days to build

### Phase 4: Guide Refresh (light)

- LLM analyzes accumulated feedback and proposes guide edits
- User approves/rejects via CLI
- ~0.5 day to build

### Phase 5: Passive Signals (future, requires player)

- Track listen-through rate
- Detect re-runs and guide edits
- Requires either a web player or mobile app integration
- Scope TBD

---

## Architecture

```
data/
  learning/
    preferences.json       # Accumulated preferences
    examples.json          # Good/bad script line examples
  artifacts/
    {runId}/
      feedback.json        # Per-run feedback

packages/
  feedback/
    src/
      collector.ts         # CLI feedback collection
      learner.ts           # Aggregates feedback into preferences
      prompt-enricher.ts   # Injects learning into prompts
```

The learning files are human-readable JSON that the user can edit directly. No database needed. The system is additive — it enriches prompts with context, never overwrites the user's manual guide entries.

---

## Open Questions

1. **How often to aggregate?** After every run, or batch weekly?
2. **Conflict resolution:** If manual guide says "emphasize geopolitics" but feedback says "less geopolitics" — which wins? (Proposal: feedback wins for ranking, manual guide wins for inclusion)
3. **Decay:** Should old feedback lose weight over time? (Proposal: yes, last 30 days weighted 2x vs older)
4. **Multi-segment feedback:** Is per-segment rating enough, or do we need per-line annotation from day 1?
