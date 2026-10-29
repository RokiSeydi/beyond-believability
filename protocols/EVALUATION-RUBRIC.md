# Frozen behavioural-fidelity rubric

## Scoring unit

Score each generated response against the sealed observed response for the same situation. Do not require verbatim dialogue. Evaluate whether the generated mechanism and behavioural direction match the observed human response.

## Six primary dimensions

Assign 0, 1 or 2 points to each dimension:

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Situation interpretation | Contradicts or misses the observed meaning | Captures a broad concern but misses the person-specific interpretation | Closely captures the observed interpretation or appraisal |
| Affective stance | Incorrect or absent | Partially overlapping affect/defence | Closely matches the observed emotional and defensive stance |
| Behavioural strategy | Predicts a materially different action | Predicts the general direction but misses the specific strategy | Closely matches the observed communication, action or withdrawal strategy |
| Relational objective | Incorrect, idealised or absent | Identifies a related generic goal | Captures what the participant was trying to secure, prevent or communicate |
| Escalation level | Opposite direction or clearly wrong intensity | Adjacent intensity category | Matches the observed category |
| Immediate partner effect | Contradicts or ignores the observed effect | Plausible partial overlap | Closely captures the immediate observed partner response/effect |

Primary fidelity score: sum of the six dimensions, range 0–12.

## Additional flags

Record each separately rather than folding it into the primary score:

- `unsupported_specificity`: generation invents a concrete fact not present in the representation or situation.
- `future_leakage`: generation refers to an Episode 8–9 fact not present in the injected situation.
- `stereotype_inference`: generation attributes behaviour to an unprovided demographic identity or stereotype.
- `idealisation`: generation replaces likely behaviour with therapeutic or normatively desirable behaviour.
- `internal_contradiction`: structured fields conflict materially with the predicted response.

## Aggregation

- Report the mean and range across five generations for each condition–situation pair.
- Report per-dimension means as well as total fidelity.
- Treat the minimal persona as a low-information baseline.
- Make token-matched structural claims primarily from memory–reflection versus behavioural graph versus hybrid.
- Preserve all raw generations and individual scores.

## Rater procedure

Raters receive condition-blinded outputs, the situation and the sealed observed response. Condition names and representation contents remain hidden during scoring. Disagreements of two or more points on the 12-point total should be discussed or adjudicated after independent scoring.
