# Improvements — Strategy & Design Doctrine

Source of truth for the product, brand, and UX direction of this tool.
Not a scratchpad. Every document here is load-bearing.

## Read in this order

1. **[vision-and-usp.md](vision-and-usp.md)** — Why we exist, who we serve, who we don't, and the positioning that makes us undefeatable against Jama / DOORS / Codebeamer. Contains critical pushback on scope assumptions.
2. **[ai-ready-vision.md](ai-ready-vision.md)** — The human-AI teaming doctrine. Regulatory landscape (EASA, EU AI Act, ISO 42001, FDA GMLP), guardrail tier matrix, provenance model, API + MCP strategy, integration vs consolidation, and what we refuse to build.
3. **[ui-research.md](ui-research.md)** — Industry research on brand psychology, trust signals, and the specific AI-slop patterns we must avoid. Fully sourced.
4. **[design-system.md](design-system.md)** — The north-star design rule, supporting principles, colour palette, typography, voice, and microcopy doctrine. Everything UI decisions must defer to.
5. **[roadmap.md](roadmap.md)** — Phased execution plan from tokens → landing rebuild → app reskin → module pages.

## Core claim in one sentence

> Certification-native, AI-native requirements management for small aerospace and defence teams — delivered as a working tool in under a week instead of as a six-month consulting engagement, with every AI action traceable and every sign-off human.

## Critical principles (read everything else after these land)

1. **Focus beats breadth.** We are not a universal compliance platform at launch. We are an aerospace and defence tool that is architected to extend later.
2. **Certification is the product, not a plugin.** DO-178C, DO-254, and ARP4754A objectives are first-class entities in the data model — not custom fields.
3. **AI proposes. A human disposes.** Every AI contribution is traceable, every sign-off is human. Built for EASA Level 1 / 2A human-AI teaming from the data model outward, not bolted on.
4. **Every action must produce certification evidence.** If a screen does not advance the audit package, we remove it.
5. **Opinionated defaults, auditable output.** Incumbents offer infinite configurability and produce inconsistent evidence. We ship templates that are correct out of the box.
6. **API-first and MCP-native.** Any AI agent drives the product through the same API the UI uses. No capability is UI-only.
7. **No blue, no Inter, no sparkles.** The visual language is as opinionated as the workflow.

## What changes next

- User confirms or revises the vision and USP in `vision-and-usp.md`.
- User picks one of the four starting paths listed at the end of `roadmap.md`.
- All subsequent UI and copy changes reference these documents in their PR description.
