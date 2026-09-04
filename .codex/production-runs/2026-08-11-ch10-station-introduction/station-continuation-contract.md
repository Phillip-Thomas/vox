# Station continuation contract — issued component

**Owner authorization:** 2026-08-14  
**Boundary:** post-Chapter-10 station interior; Chapter 10's signed reveal remains unchanged

**Authority form:** R12 post-terminal sidecar. The `ch11`/`ch12` milestone
namespace reserves the intended chronology, but this slice does not claim new
`StoryState` beats or a signed chapter-registry entry. Its player-facing header
therefore says `STATION VISIT`, not `CHAPTER 11`.

## Causal promise

Terra docks because Tidegarden's second hearth needs one habitat-grade bonded
cell: a serialized, issued component that the world cannot grow, yield, or
fabricate. The station must actually issue that cell. A successful visit leaves
the player holding exactly one durable `bonded_cell` and an explicit instruction
to carry it back to the second hearth.

The required transaction is an issuance against the W-7743 suit record, not a
purchase made with the sandbox's unexplained credits. This keeps acquisition
guaranteed and leaves the origin of the station account unauthored.

## Movement

1. **Apron — comply.** Docking choreography completes. REGULATION reads:
   `THRUST COLD · CLAMPS ENGAGED.` / `PRESSURE EQUALIZING.` /
   `ENTRY REQUIRES A DESIGNATION RECORD · PROCEED TO COUNTER.`
2. **Counter — be recorded.** Objective: `COUNTER · PRESENT DESIGNATION`.
   The player presents the suit record, then declares `ISSUED COMPONENT`.
   The counter accepts `W-7743`, records `BONDED CELL / HABITAT GRADE`, and
   issues concourse access. One low line is permitted before the action:
   `(your body takes its place before the marker does.)`
3. **Concourse — enter a public world.** At the threshold:
   `(warmth you did not make.)` The required marker selects the deterministic
   certified-components trader, B-7073 “Bell”.
4. **Issuer — acquire.** The player presents the habitat fault. Bell explains
   only that the bond is an issuance record the core must accept, then issues
   one sealed cell against the designation recorded at the counter. Receipt:
   `CARGO RECEIPT · BONDED CELL (HABITAT) · SEAL INTACT.`
5. **Depart — carry it home.** General station trading unlocks only after the
   story cell is safe. The airlock cannot complete the story visit without it.
   Departure records the cell stowed and directs the player to Tidegarden's
   second hearth.
6. **Return — restore the hearth.** The return work order survives the station
   page seam and points first to Tidegarden, then to the already-installed
   second-hearth core. `[F] INSTALL THE SEALED CELL` consumes the one carried
   cell and records the hearth restored. Reloading may not replay the undock or
   recreate the component.

## Durable receipts

- `story:ch11-docked`
- `story:ch11-designation-presented`
- `story:ch11-registry-recorded`
- `story:ch11-concourse-entered`
- `story:ch11-habitat-fault-presented`
- `story:ch11-bonded-cell-acquired`
- `story:station-trade-unlocked`
- `story:ch11-bonded-cell-stowed`
- `story:ch11-station-departed`
- `story:ch12-bonded-cell-installed`
- `story:ch12-hearth-restored`

The cargo receipt and the actual inventory item are both required. Repeating,
reloading, or reconciling the issuance may restore a missing item after a
partial save, but may never create a second item.

## Optional vendor boundary

Other traders remain interactable and may offer authored topic buttons plus
their existing bounded shelf conversation. They cannot advance the required
movement, alter identity, grant story cargo, or answer protected cosmology.
General commodity trading is held until the bonded cell is acquired.

## Protected unknowns

- no station proper name;
- no explanation of the credit balance;
- no claim about W-7743's wider legal status;
- no W-7744 aboard or in readable station records;
- no Makers, greater threat, Terra-origin, or station-builder answer;
- no explanation of the sealed volume;
- no vendor recognition of Terra;
- no statement that the queue reflex belongs to Worker 9;
- no definition of the bond beyond an issuance record the core accepts.

Standalone `?spacestation=` remains a noncanonical, ephemeral mechanics
sandbox. This continuation is enabled only by a shipped `from=game` handoff,
the completed Chapter 10 receipts, and the exact station named by the claimed
bearing. Multiplayer authority and deployment are outside this revision.
