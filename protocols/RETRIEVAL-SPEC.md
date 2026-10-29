# Frozen retrieval specification

## Shared rules

- Query: the held-out interpersonal situation text only.
- Development store: Episodes 1–7 only.
- Runtime representation ceiling: approximately 3,200 tokens for memory, graph and hybrid conditions.
- Retrieved records retain IDs, episode provenance, evidence status and evidence basis.
- Retrieval output is saved before behavioural generation.
- No retrieval stage may access the held-out observed response.

Token counts are estimated reproducibly as `ceil(UTF-8 bytes / 4)` and the estimator is logged with every retrieved context. This model-independent approximation is applied identically across conditions. The ceiling is enforced after serialisation; the final record that would exceed the ceiling is omitted.

## Memory–reflection condition

Candidate observations and reflections are ranked using the three equally weighted components in Park et al. (2023):

`score = semantic relevance + importance + recency`

- Semantic relevance: cosine similarity between the situation embedding and memory/reflection embedding, min–max normalised within the candidate set.
- Importance: an independently generated 1–10 LLM poignancy rating using the Park et al. prompt, min–max normalised within the candidate set.
- Recency: Park et al.'s `0.995` access-decay function, applied over discrete corpus-construction events rather than sandbox game hours and min–max normalised within the candidate set. Last-access positions are frozen after memory construction so randomized evaluation order cannot change later trials.
- Ceiling: at most 16 observations and six reflections, subject to the common token budget.

Park et al. min–max normalise recency, importance and relevance and set all three coefficients to 1. We preserve equal weighting. Our static, episode-based corpus does not contain sandbox game hours, so record creation and retrieval events provide the reproducible time steps for access-based recency. Importance ratings are model-generated retrieval metadata and must not be interpreted as validated psychological measurements.

The representation exposes chronological memories and abstract reflections but no typed situation→interpretation→behaviour or partner-response edges.

## Behavioural-graph condition

1. Rank canonical Participant A and dyadic nodes by semantic relevance to the situation.
2. Select at most eight canonical nodes.
3. Traverse incoming `evidence_link` edges to candidate episode evidence.
4. Traverse directly adjacent canonical and episode connections needed to preserve the retrieved pathway or immediate partner effect.
5. Rank candidate evidence using three equally weighted components:

`score = semantic relevance + topological proximity + evidence strength`

- Topological proximity: 1.0 for direct evidence of a selected canonical node, 0.5 for one additional hop and 0 otherwise.
- Evidence strength is mapped deterministically: `1.0` for direct, explicit, observed, repeated or corroborated evidence; `0.5` for supported, clinician-linked, retrospective or longitudinal synthesis; and `0.0` for provisional, probable, likely, hypothetical, untested or temporal-only connections. Original evidence labels remain in the retrieved context.
- Ceilings: eight canonical nodes, 16 episode nodes and 20 edges, subject to the common token budget.

This graph score is introduced by the present method and is not derived from Park et al. Equal coefficients are used as a neutral, prespecified choice because no validated basis currently supports privileging one graph component over another. The score ranks records for retrieval only; it does not quantify psychological importance, causal strength or confidence in a behavioural mechanism.

The serialised context includes `agent_text`, `relation_sentence`, evidence status and provenance.

## Hybrid condition

- Total ceiling: approximately 3,200 tokens.
- Memory allocation: approximately 1,400 tokens.
- Graph allocation: approximately 1,800 tokens.
- Maximums: eight memories, three reflections, five canonical nodes, eight episode nodes and ten graph edges.
- Exact duplicate evidence text retrieved by both systems is emitted once. The memory and graph sections remain visibly labelled.
- Unused space from one allocation may not automatically expand the other allocation; this prevents the hybrid condition from receiving a larger effective information budget.

## Minimal-persona condition

No retrieval is performed. The entire frozen persona is supplied. Because this is an intentionally lower-information baseline, it is not included in claims based solely on token-matched structural comparison.
