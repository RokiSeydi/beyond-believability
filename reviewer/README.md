# Condition-Blind Voice Reviewer

An offline browser interface for reviewing blinded social-agent predictions by voice. It uses the browser's built-in speech synthesis, so transcript content is not sent to a speech API and no OpenAI credits are used.

## Start

From the experiment repository:

```bash
node reviewer/server.mjs
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in Safari or Chrome.

## Load

1. `.runtime/experiment/blinded-outputs.json`
2. `ground-truth/participant-…-sealed-ground-truth.json`
3. `heldout/participant-…-situations.json` (recommended)
4. An optional condition-blind proposed-score JSON with a top-level `scores` array

Never load `blinding-key.json` into this interface. The reviewer has no condition-key input.

## Fast review

- `0`, `1`, `2`: score the current dimension and advance
- `A`: accept all proposed scores and advance to the next output
- `U`: mark the output uncertain
- `R`: repeat the current observed/predicted comparison
- `Space`: pause or resume speech
- `←` / `→`: previous or next dimension
- `Shift` + `←` / `→`: previous or next output
- `Enter`: save the current output and advance

The browser autosaves after every edit. Export a JSON checkpoint regularly. The JSON matches the adjudicated-score structure accepted by `scripts/validate-adjudicated-scores.mjs` after incomplete or uncertain rows are resolved.

## Method safeguards

- Conditions remain blinded throughout review.
- The six dimensions and 0–2 scale match `EVALUATION-RUBRIC.md`.
- Inferred affect alone cannot receive 2 unless the reference provides explicit or accepted clinician-supported evidence.
- The final score file must be frozen and checksummed before opening the condition key.
