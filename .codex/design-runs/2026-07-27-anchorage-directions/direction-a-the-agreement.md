# THE AGREEMENT
### A direction for the deep-space station

Provocation: *"The station is the Regulation's own infrastructure, finally made visible."*

---

## 1. Thesis

Terra has spent its life being addressed by the Regulation and has assumed, the way anyone assumes, that being addressed means someone is speaking. This station is where that assumption dies. It is not a capital, a garrison, or a throne. It is a **clearing house** — the physical plant where two star systems reconcile their books against each other, and where the administrative voice is *composed*, not spoken: aggregated out of pooled worker telemetry, struck into seals, and returned to the workers as instruction. The horror is not that the machine is watching Terra. It is that Terra was never the audience. Terra is an *input*. The voice that raised it is a report about itself, read back to it. This belongs in Paravoxia and nowhere else because every other space game's station is a place where power sits; this one is a place where power is *netted to zero* between counterparties, with no author anywhere in the building, and the player finds the die that stamped its own designation sitting in a rack with forty thousand others.

## 2. The name

**Regulation designation:** `RECONCILIATION WORKS R-4180 / INTERSYSTEM SETTLEMENT, CLASS A / STANDING QUEUE ADVISORY IN EFFECT`

Terra's name for it, arrived at somewhere in the second hour: **the agreement**. Lowercase, plain, and the worst possible word, because an agreement is a thing you enter into.

## 3. First ninety seconds

**0:00 — the queue.** No station. The camera is close on Terra's hull, and to port there is a ship: unlit, cold, station-keeping. Then another. Then another. Terra flies the line for a full twenty seconds and the line does not end. No music. Only Terra's own reaction mass and the tick of its hull. A REGULATION card, monospace, low in frame: `VESSEL LOGGED. POSITION 3,911. NO ACTION REQUIRED.`

**0:22 — the reveal by light.** The camera has been flying alongside the station this entire time and has read it as empty space, because the approach face is unlit. Then the **strike cycle** fires: an amber wave crosses the hull, left to right, and does not stop crossing — kilometers of stamping cells illuminating in sequence, out past the edge of frame in both directions, curving away with no terminator. The sound arrives as a sub-bass *thunk* on a rolling delay, so it passes over the ship like weather. Terra's ship is four pixels. **This is the screenshot.**

**0:48 — the dock is not a welcome.** No bay doors, no beacon, no traffic controller. A manipulator arm takes the ship and *inserts* it into a slot in a rack of slots. Player control is removed — deliberately, the only forced-camera moment. Terra is handled as cargo, because it is cargo. At 1:02 a die descends and strikes the hull, and the whole frame jolts: `SEAL APPLIED. VESSEL R-4180-K.` The seal string is the same format Terra has seen at the foot of every manifest it has ever received. It was never a signature. It is a machine address.

**1:10 — the reversal.** The airlock opens onto a corridor with a 2.4-metre ceiling. Warm, quiet, carpeted-adjacent, mundane, slightly too small. After that immensity: an office. Terra walks eleven metres in near-silence, and the corridor turns, and there is a window, and the machine is still out there, still striking, and through the glass it makes no sound at all.

## 4. Spatial program

Everything hangs off one spine.

- **The Slot** (intake, 400 m trough). Ship handling, customs seals, the only place you see your own vessel treated as freight. Legible at a glance: racks, indexed, yours is one of them.
- **The Common Register** (900 × 120 × 60 m). The station's only large interior and it is a **queue hall** — switchbacks, rails, standing crowd, the trade floor woven through it. Its scale is legible because the far end is visible and the far end is *people waiting*. All commerce happens here.
- **The Voice Assembly** (200 m cylinder). Telemetry from both systems aggregates, is averaged, and is voiced. A naive player reads: broadcast studio. Story district.
- **The Strike Line** (1.2 km gallery, viewed only from catwalk). Seal dies in racks. Terra can locate its own designation's die. **You cannot enter the floor.** Ever, this instance.
- **Rest Allocation** (habitation warren, 3 m ceilings, ~600 m of corridor). Bunks, a bar, gossip. Where the model-driven population lives.
- **The Counter-Party Wing** (mirrored, 300 m). The *other* system's delegation. Same grammar, different regime — different units, different lighting temperature, different politeness. Arbitrage originates here.

## 5. Who is here

**The split rule, and it is a hard rule:** a language model may improvise about *the present and about prices*. It may never improvise about *the past or about what things mean*. Canon, register, and both-readings copy are authored. Weather, rumour, haggling, and the texture of a crowd are model-driven. Crucially, **model-driven NPCs are permitted only the REGULATION register and trade-floor idiom — never the awakening voice.** The register law becomes the safety rail: the sacred interior voice is structurally unavailable to a model.

Workers remain blind. The crowd does not react to what Terra sees. Individuality is procedural: one stamped humanoid silhouette, varied by gait parameters and badge geometry.

**Registrar M-6120 — "Six."** Authored. *Want:* to close the books on a system that stopped reporting eleven years ago; she cannot be reassigned until its ledger balances. *Wound:* she certified that system's final quota, the numbers were correct, and everyone there died anyway — and the numbers are still correct. *Why she talks to Terra:* Terra's cargo carries a seal struck by a die from that dead system, which is physically impossible. She is blind to the paradox as a paradox. She perceives it as a **discrepancy**, which is the one form of the impossible her job authorizes her to pursue.

**Runner K-0088 — "Kite."** Hybrid: authored spine, model-driven surface. *Want:* to own a berth outright and stop being a contract. *Wound:* she has lost arbitration three times, and each loss stamped a **clause** onto her badge — visible geometry, and each clause measurably degrades her gait, which the player can read across the concourse before she speaks. *Why she talks to Terra:* Terra's hull is unclaused. She wants to know what that feels like.

## 6. How trade is fictionalized

The two systems have genuinely asymmetric endowments, but not of ore. System A has abundant **matter** and scarce **attestation**. System B has abundant attestation and scarce matter. So the freight is a rounding error and **the paper is the trade**: you do not ship ore, you ship *the right to have shipped ore*. Commodity classes: **tonnage** (dull, honest, low-margin), **allocation** (quota rights), **latency** (the price of a decision under lightspeed lag — pure arbitrage), **attestation** (certainty itself, sold by the seal), and **variance** — output the model did not predict. Variance is unpriceable, illegal, and the most valuable thing on the floor. Terra *is* variance. You can sell it. Selling it is how you are found.

## 7. Visual thesis

Unlit graphite and one amber. Nothing smooth — everything ribbed, indexed, stamped, repeated. Procedural geometry's weakness is bespoke detail; its superpower is **count with variation**, so the beauty is count: ~60k instanced hull cells on one draw call, the strike wave as a single shader parameter sweeping an emissive index every 11 seconds. Budget honestly: 1 hull instancer, 1 strike-wave program, 1 crowd instancer (200 humanoids, 2 draws), 1 interior surface program, 1 fog/volumetric card — five programs, well inside 295 calls and 3.2M triangles. Mobile: wave becomes a scrolling emissive, cells drop 8×, crowd to 30, queue to 40 hulls.

## 8. What this refuses

The panopticon. No eye, no throne, no central authority chamber, no cathedral atrium with a shaft of god-light, no boss to confront, no derelict-horror empty corridors, and above all **no villain**. The Regulation here is not malicious. It is *correct*. Refusing the confrontation is the whole point: you cannot punch a settlement layer.

## 9. Generator implications

**Varies:** the two counterparty regimes and therefore the commodity axes; queue depth (which sets mood *and* prices); the number of unbalanced dead systems in the registry; district set drawn from a fixed grammar; the hull cell module and the strike period's rhythm.

**Fixed for identity:** ships are handled, never welcomed; the colossal→banal reversal on entry; a single large interior that is a queue; amber on graphite; the unlit approach face; and the Strike Line is always visible and never enterable.

## 10. Biggest risk

The reversal. The exterior writes a cheque the interior must cash as *authored anticlimax*, and if the office is merely small rather than specifically, uncomfortably beautiful, players will read it as unfinished content. Mitigation: the corridor window must be the second screenshot, or the thesis fails.
