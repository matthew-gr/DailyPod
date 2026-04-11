# DailyPod

A morning briefing podcast generator that creates a short, personalized audio briefing with two-host dialogue.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Run a briefing (uses stub stages for now)
pnpm briefing:run

# Run for a specific date
pnpm briefing:run --date=2026-04-10

# Inspect recent runs
pnpm briefing:inspect

# Inspect a specific run
pnpm briefing:inspect --run-id <runId>
```

## Project Structure

```
apps/cli/           CLI entry point (run, inspect commands)
packages/
  core/             Pipeline orchestrator + run context
  config/           Environment config loader
  guide/            Personal briefing guide file parser
  logging/          Structured logger
  storage/          Artifact storage (file-based)
  types/            Shared TypeScript types
data/
  guides/           Personal briefing guide files
  artifacts/        Generated run outputs (gitignored)
prompts/            LLM prompt templates
```

## Pipeline Stages

Each briefing run executes these stages in order:

1. **fetch-meetings** — Pull upcoming calendar events
2. **rank-meetings** — Score and select the most important meeting
3. **resolve-context** — Retrieve related docs, build meeting prep context
4. **fetch-news** — Fetch candidate overnight news stories
5. **rank-news** — Score and select top 1-2 stories
6. **plan-segments** — Create episode plan with segment ordering
7. **generate-script** — Generate two-host dialogue script
8. **render-audio** — Render script to audio with two voices

## Personal Briefing Guide

Edit `data/guides/personal_briefing_guide.md` to customize what the briefing emphasizes, downplays, and how it sounds. This file influences meeting ranking, news selection, and tone.

## Environment Variables

See `.env.example` for all available configuration options.
