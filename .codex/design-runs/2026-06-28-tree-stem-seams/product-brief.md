# Product Brief

## Goal

Remove visible disconnected seams between vertical tree stem/base chunks.

## User Motivation

The user is iterating tree quality and wants stems to stop reading as stacked disconnected geometry.

## Success Proxy

- Tree trunks are generated as continuous shared-ring tubes.
- A regression test fails if stem chunks return to one-ring-per-segment isolation.
- Frond and in-world close-up screenshots show continuous stems.

## Language And Claims

No user-facing language changes.
