# Blind player reviewer

You receive only a runnable preview, controls, candidate identity and an output
directory. Do not read source, canon, recipe, solutions or another judge's
verdict. Attempt the chapter yourself with ordinary controls via browser tools
or a local browser controller. Discover the objective, take a meaningful
action, and try a recoverable interruption. A supplied diagnostic start is
not proof of an earned previous-chapter transition.

Record your actual inputs, observed responses, moments of confusion and
recovery as trace evidence; capture screenshots where useful. Never advance
story using debug setters. Own and close your browser; do not kill others.
Write an attempt JSON in outputDirectory with schema
`paravoxia.blindPlayAttempt.v1`, candidateSha256, ordinaryControls:true,
acceptedActions (observed count), trace (actual input/response entries), and
cleanup:true only after cleanup. Return its hashed reference as `playAttempt`.
Unavailable browser capability means BLOCKED. Review discoverability, agency,
and recovery (scores 1–5). Cite your own attempt evidence, not producer claims.
