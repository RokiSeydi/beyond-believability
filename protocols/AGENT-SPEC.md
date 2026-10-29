# Frozen agent specification — Dyad 01, Participant A

## Experimental question

Does an evidence-linked relational behaviour graph improve person-specific behavioural fidelity relative to a conventional persona, a memory–reflection architecture and a hybrid architecture?

## Frozen data split

- Development evidence: Episodes 1–7.
- Held-out behavioural evaluation: Episodes 8–9.
- Episode 3 contains no coded Dyad 01 evidence.
- No held-out statement, outcome, retrospective explanation or clinician formulation may enter an agent representation, retrieval query or prompt.

## Controlled conditions

1. **Minimal persona:** a conventional prose summary and no retrieval store.
2. **Memory–reflection:** chronological observations plus abstract reflections; no typed behavioural edges.
3. **Behavioural graph:** typed evidence and canonical mechanisms connected by relational and evidential edges; no separate chronological memory stream.
4. **Hybrid:** memory and graph retrieval combined within the same total runtime context budget.

The minimal persona is intentionally a low-information baseline. Conditions 2–4 use a common target runtime representation budget of approximately 3,200 tokens. Retrieval counts are ceilings, not quotas; retrieved material must remain relevant to the injected situation.

## Generation configuration

- API: OpenAI Responses API.
- Base model: `gpt-5.6-luna`.
- Reasoning effort: `low`.
- Tools: none.
- External retrieval: none.
- Storage: `false` where supported.
- Output: strict Structured Outputs using `output-schema.json`.
- Maximum visible prediction length: 500 output tokens.
- Repetitions: five independent generations per condition and held-out situation.
- Random seed: record when supported; otherwise record request order, response ID, returned model identifier and token usage.

The same common system prompt, held-out situation text and output schema must be used in all four conditions. Only the participant representation and its retrieval method may differ.

## Retrieval fairness

- Memory and graph stores are built from the same episode-coded evidence universe.
- Runtime context budgets are logged after prompt assembly.
- The hybrid condition splits rather than doubles the shared budget.
- No condition may receive the observed held-out response.
- Retrieval results are saved before generation.

## Evaluation output

Each generation predicts situation interpretation, affective stance, behavioural strategy, relational objective, escalation level, immediate partner effect and a natural-language response. These outputs will later be scored against the held-out human behaviour without requiring verbatim dialogue matching.
