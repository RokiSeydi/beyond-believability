# Beyond Believability: Evidence-Linked Context Representations for Behaviourally Grounded Social Agents

Reproducibility repository for the paper accepted at the **Second Workshop on Large Language Models for Social Reasoning and Simulation, NeurIPS 2026**.

**Author:** Roki Seydi, University College London

---

## What this repository contains

| Folder | Contents |
|--------|----------|
| `paper/` | Camera-ready PDF and LaTeX source |
| `representations/` | Four context representations for each of the 5 participants (minimal persona, memory-reflection, behavioural graph, hybrid) |
| `heldout/` | Frozen held-out situations for each participant (Episodes 8–9) |
| `protocols/` | Agent spec, heldout protocol, evaluation rubric, retrieval spec, condition manifest, common system prompt, output schema, checksums |
| `scripts/` | Experiment runner, Park-style memory builder, blinding script, validator |
| `reviewer/` | Condition-blind scoring interface |
| `results/blinded-outputs.json` | All 400 blinded predictions (5 participants × 4 conditions × 5 repetitions × 4 situations) |
| `results/blinding-keys/` | Per-participant blinding keys (condition labels → condition names); provided for audit, not opened until scores were frozen |
| `results/scores/` | Frozen human-adjudicated scoring workbooks |

## Participants

The experiment covers 5 pseudonymised participants (A–E): one dyad (A, B) and a triad (C, D, E) from Season 4 of *Couples Therapy*. Each participant has four context representations built from Episodes 1–7 and is evaluated on 4 held-out situations from Episodes 8–9.

## Reproducing the evaluation

Development representations and held-out situations are frozen. To re-run inference:

```bash
# Validate the design (no API key required)
node scripts/validate-runner.mjs

# Dry-run the full pipeline (no API calls)
node scripts/build-park-memory.mjs --dry-run
node scripts/run-experiment.mjs --dry-run

# Live run (requires OPENAI_API_KEY)
node scripts/build-park-memory.mjs
node scripts/run-experiment.mjs
node scripts/blind-outputs.mjs
```

Progress is checkpointed; interrupted runs resume safely.

## Ethics note

This is a pseudonymised research artefact derived from broadcast television. It is not a clinical dataset or diagnostic tool. Public availability does not remove privacy, dignity or dual-use considerations. See Section 7 of the paper.
