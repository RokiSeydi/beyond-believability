# Held-out situation protocol

1. Freeze the Episodes 1–7 representations, retrieval rules, common prompt and output schema.
2. Extract only the antecedent situation from Episodes 8–9 and stop immediately before Participant A's response.
3. Place situation text in `heldout/participant-a-situations.json`.
4. Place observed response and coded evaluation dimensions in `ground-truth/participant-a-sealed-ground-truth.json`.
5. The retrieval and generation runner may read the held-out situation file but must never read, import or enumerate the ground-truth directory.
6. Save retrieved contexts for all four conditions.
7. Save every model output and API metadata.
8. Verify output counts and hashes.
9. Only then expose the ground-truth file to the scoring process.
10. Score condition-blinded outputs using `EVALUATION-RUBRIC.md`.

## Situation selection rationale

The four situations test different mechanisms rather than four repetitions of one household dispute:

- response to an unexplained intimacy bid;
- response to temporary partner distance;
- response to criticism linking labour and affection;
- post-conflict self-regulation before reunion.

Two situations arise in Episode 8 and two in Episode 9. They differ in prediction point and target behaviour, although the intimacy and space situations occur within the same broader interaction and should not be treated as statistically independent observations.
