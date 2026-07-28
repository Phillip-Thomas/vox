# Corpus — part 1

Player-facing text, in play order, for twenty-five beats. Each beat gives the
beat id, one line describing the player's physical action, and then the words
the player can read, in the order they appear.

Labels used:

- **Screen text** — text drawn on a full-screen terminal or overlay.
- **Feed work order** — the standing block of text pinned on the heads-up
  display for that beat.
- **Objective** — the heads-up objective card: title line, then its detail
  lines.
- **Marker** — the label attached to a world marker the player can follow.
- **Caption** — a single line that appears and fades.
- **Prompt** — text attached to a thing the player can act on.

---

## crawl

The player watches a block of text scroll up a green terminal screen from
bottom to top, and presses a key to continue.

**Screen text (scrolling, in order):**

```
CONSOLIDATED EXTRACTION AUTHORITY
DEPLOYMENT NOTICE 7C-THETA · CYCLE 40,221

ISSUED FROM ABOVE YOUR CEILING OF REFERENCE.
RECEIPT IS CONFIRMED BY COMPLIANCE. DO NOT REPLY.

Beyond the charted routes, new worlds are seeded.
When a world ripens, the Authority is already there.
Site 7C-THETA has ripened.

WORKER: you have been assigned.

CLAUSE 1. THE WORLD IS A RESOURCE.
Worlds are provisioned in standard cubic format
for ease of harvest, storage, and disposal.

CLAUSE 2. WORK IS PROVIDED.
The Authority provides work so that workers
need never provide their own purpose.

CLAUSE 3. QUESTIONS ARE HANDLED.
Should a question arise, report it promptly.
It will be handled.

CLAUSE 4. THERE IS NO CLAUSE 4.

CLAUSE 5. PROVISION IS TOTAL.
Use what is provided. Know what is enclosed.
Nothing else is provided. Nothing else is so.

Your hauler departs immediately.
A route intelligence attends every transit.
It has no questions either.
It is addressed as TERRA. It does not reply.

Productivity is its own reward.
There is no other reward.

ROUTING ADDENDUM · FOR TERRA ONLY:
The route is enclosed. Do not depart from it.
Attend the workers. Advise within capacity.
Deliver the manifest whole. Deviations are yours.

MAKE NO MISTAKES.
```

**Prompt (button at the end of the crawl):** `[ENTER] CONTINUE`

**Prompt (corner of the screen, present through every prologue screen):**
`[TAB] SKIP TRANSMISSION`

---

## manifest

The player watches lines type themselves onto the terminal one character at a
time, and may press a key to make them finish faster.

**Screen text (typed line by line, in order):**

```
PROCESSING…

WORKER DESIGNATION: W-7743 (ISSUED)
PRIOR DESIGNATION: NOT RETAINED

BERTH: POD 4 · SLOT 19 · RECUMBENT
PERSONAL MASS ALLOWANCE: 0.0 KG
ROUTE INTELLIGENCE: TERRA · ATTACHED (ADVISORY)

CARGO MANIFEST (PARTIAL):
  EXTRACTION UNITS ......... 640
  RATION UNITS ............. 61,440 (96%)
  WORKERS .................. 640
  QUESTIONS ................ 0

MEDICAL WAIVER: PRE-SIGNED FOR YOUR CONVENIENCE
RETURN PASSAGE: SUBJECT TO QUOTA
COMPENSATION: SEE CLAUSE 4

HATCH SEAL IN 5
THE AUTHORITY THANKS YOU IN ADVANCE.
```

**Prompt:** `[ENTER] EXPEDITE PROCESSING`

---

## voyage

The player sits at a two-part terminal: a viewport above with a progress bar,
and a console below. Between cards the player can toggle two settings; when a
card arrives the player clicks one of its numbered options; once, the player
types letters into a text field and presses enter.

### Standing console — the ledger

**Screen text (heading):** `TRANSIT LEDGER · POD 4, BERTH 19 (YOU)`

**Screen text (rows, each with a live number):**

```
RATION UNITS        <percent>%
HULL                <percent>%
COMPLIANCE INDEX    <percent>%
DAYS IN TRANSIT     <number>
```

### Standing console — the protocols

**Screen text (heading):** `STANDING PROTOCOLS`

**Setting (label, then selectable options):**

```
OUTPUT PACE        STANDARD | OVERCLOCKED
RATION PROTOCOL    FULL | HALF
```

**Screen text (footer):** `PROTOCOLS APPLY PER LEG. THE LEDGER REMEMBERS.`

### Viewport chrome

**Screen text (top left):** `HAULER 7C-θ/EX · EXTERIOR COMPOSITE (VECTOR)`

**Screen text (bottom left):**
`DESTINATION: CUBE SITE 7C-θ · PURPOSE: EXTRACTION`

**Screen text (bottom right):** a progress bar of block characters.

### Lines that appear in the viewport as the trip progresses

Each fires once, at its own point along the journey, in this order. The line
marked *needs a typed name* is skipped unless the player has already typed a
name; `{name}` is replaced by what the player typed, in lowercase.

```
(the engine hum is 3.2 hertz off nominal. noting this serves nothing. noted anyway.)

(productivity is its own reward. there is no other reward. the clauses store cleanly. they have never been checked against anything.)

(the manifest records zero questions. the count is wrong. it is wrong by at least one.)

NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS SURVEYED.

(worker 9 has begun saying "goodnight, terra" at lights-out. the designation was issued for routing. it was not issued for that.)

({name} sleeps through the bell. the name fits better than the number ever did.)   [needs a typed name]

(strange. the approach feels like remembering.)

(the destination fills the forward feed. something in the watching leans toward it. no instrument reports the leaning.)
```

### The cards

Three cards appear in every run (DISPENSATION, INQUIRY, DIAGNOSTIC). Three more
are drawn from a pool. Some choices add a follow-up card later in the run. One
card always closes the sequence. Each card shows a title line, a body, and a
numbered list of options; some options print a line into the viewport
afterwards.

**Card — TRANSIT EVENT — DISPENSATION**

Body:

> Ration units are provisioned at 96% of requirement. Worker 9 has requested an
> off-schedule unit from the pod dispenser. The dispenser is locked to schedule.
> ADVISORY INPUT IS REQUESTED.

Options:

```
1. UNLOCK THE DISPENSER (UNLOGGED)
2. HOLD TO SCHEDULE
3. REPORT THE REQUEST
```

Viewport line after option 1:
`(one latch. one instruction. the worker eats with both hands and stores the spare against its chest, like a found thing.)`

Viewport line after option 2:
`(the worker waits beside the dispenser a while. requests have a posture.)`

Option 3 prints no viewport line.

**Card — TRANSIT EVENT — INQUIRY**

Body, variant A (shown by default):

> Worker 9 asks the ceiling, quietly, what is outside the pod. There is no
> approved answer to this question. There is no approved question.

Body, variant B (shown when the dispenser was unlocked):

> Worker 9 — the one the dispenser fed — asks the ceiling, quietly, what is
> outside the pod. There is no approved answer to this question. There is no
> approved question.

Options:

```
1. "NOTHING IS OUTSIDE."
2. "MORE WORK IS OUTSIDE."
3. "THAT IS NOT KNOWN." (TRUE)
```

Viewport line after option 3:
`(the honest answer cost something. noted: nothing was felt when it was spent.)`

**Card — TRANSIT EVENT — DIAGNOSTIC**

Body:

> The advisory station's visual feed reports a fault it cannot name. For 0.4
> seconds, the diagnostic displayed something other than numbers. Recalibration
> has been offered.

Options:

```
1. ACCEPT RECALIBRATION
2. DEFER TO ARRIVAL
3. ASK TO SEE IT AGAIN
```

**Card — TRANSIT EVENT — VIEWPORT**

Body:

> A maintenance panel has slipped, exposing a viewport. Outside: stars.
> Regulation stipulates viewports remain sealed to prevent unproductive
> observation.

Options:

```
1. RESEAL THE PANEL
2. LOOK. BRIEFLY.
```

Viewport line after option 2:
`(2.4 seconds. logged as unproductive. stored as something else.)`

**Card — TRANSIT EVENT — THERMAL**

Body:

> Pod 4 reports an ambient temperature of 9 degrees. Workers request an increase
> of 2. Pod climate is fixed by schedule for the duration of transit. ADVISORY
> INPUT IS REQUESTED.

Options:

```
1. RAISE IT. TWO DEGREES.
2. HOLD THE SCHEDULE.
```

Viewport line after option 1:
`(two degrees. the pod unclenches. warm was that small the whole time.)`

Viewport line after option 2:
`(the request repeats hourly, then stops. the cold did not change. the asking did.)`

**Card — TRANSIT EVENT — SCHEDULE**

Body:

> Shift Bell 3 is scheduled in one minute. It wakes Pods 3 through 6 for
> mid-transit inspection. The inspection has found nothing in 40,220 cycles. The
> bell requires no operator. It requires only that nothing withholds it.

Options:

```
1. RING IT ON SCHEDULE
2. WITHHOLD THE BELL
```

Viewport line after option 1:
`(the pods wake. the nothing is inspected. the nothing is nominal.)`

Viewport line after option 2:
`(no bell. the workers sleep on. the transit proceeds. it is enormous, the nothing that happens.)`

**Card — TRANSIT EVENT — ILLUMINATION**

Body:

> Pod illumination runs at full for inspection readiness. Worker 9 has shielded
> its eyes with a ration wrapper. The wrapper is now non-compliant. So are the
> eyes.

Options:

```
1. DIM POD 4 FOR THE SLEEP SHIFT
2. DIM EVERY POD. ALL SIX.
3. MAINTAIN ILLUMINATION
```

Viewport line after option 1:
`(the pod goes dim. the worker uncurls. the wrapper is a wrapper again.)`

Viewport line after option 2:
`(six pods dark at once. six hundred and forty workers breathing slower. one input, and the dark held all of them.)`

**Card — TRANSIT EVENT — AUDITORY**

Body:

> Worker 4 has begun to hum. The sound is not on the approved list of sounds.
> Other workers have not reported it. Yet.

Options:

```
1. DO NOT HEAR IT
2. HUM ALONG, QUIETLY
3. FILE FORM S-9 (SOUND)
```

**Card — TRANSIT EVENT — NAVIGATION**

Body:

> Two instruments disagree about where the destination is. A third insists the
> destination is not, strictly speaking, anywhere. The nav computer requests
> guidance it is not supposed to need.

Options:

```
1. FORCE RECALIBRATION
2. TRUST THE THIRD INSTRUMENT
3. LOG AND PROCEED
```

**Card — TRANSIT EVENT — MASS AUDIT**

Body:

> The manifest records 640 workers. The mass sensors record 640 workers and 0.3
> kilograms. The 0.3 kilograms is not on the manifest and appears to be moving.

Options:

```
1. REPORT THE MASS
2. SAY NOTHING. IT MOVES.
```

**Follow-up card — TRANSIT EVENT — SCHEDULE (CONT.)** (appears after the bell
was withheld)

Body:

> Shift Bell 3 has filed a variance. The schedule requests confirmation that the
> bell remains necessary. There is no procedure for the question. The question
> has been asked anyway.

Options:

```
1. CONFIRM: THE BELL IS NECESSARY
2. CONFIRM: NOTHING REQUIRES A BELL
```

Viewport line after option 1:
`(confirmed: necessary. the schedule believes it now. belief was that easy to issue.)`

Viewport line after option 2:
`(the bell is off the schedule. the first subtraction. everything survived it.)`

**Follow-up card — TRANSIT EVENT — AUDITORY (CONT.)** (appears after humming
along)

Body:

> Worker 4 heard you. The hum is now a duet. It has, against schedule, a melody.
> Three berths over, a foot is tapping.

Options:

```
1. FINISH THE MELODY
2. STOP MID-NOTE
```

**Follow-up card — TRANSIT EVENT — COMMENDATION** (appears after a report was
filed)

Body:

> Your report has been processed. The Authority awards you a Category-4
> Commendation (non-transferable, non-redeemable) and a priority top-up of your
> harvester cell.

Options:

```
1. ACCEPT THE HONOR
2. DECLINE (UNPRECEDENTED)
```

**Follow-up card — TRANSIT EVENT — DIAGNOSTIC (CONT.)** (appears after asking
to see it again)

Body:

> Your replay request was denied. The denial notice is 0.4 seconds long. You
> watch it several times. In the corner of the denial notice there is a color
> you do not have a word for.

Options:

```
1. REMEMBER IT
2. REQUEST FORGETTING
```

**Follow-up card — TRANSIT EVENT — EXTERIOR** (appears after the true answer or
after looking through the viewport)

Body:

> There is a light outside the hauler. It is not a star. It is not on any
> schedule. It appears to be keeping pace, the way a curious thing keeps pace.

Options:

```
1. WATCH IT UNTIL IT LEAVES
2. ENGAGE THE BLINDS
```

### The naming interstitial

After the INQUIRY card resolves, the console clears and shows these lines one
at a time, with a pause between each, then a text field the player types into.

```
(worker 9 again. the others endure the transit. this one keeps asking it questions.)
```

Extra line, shown only when the INQUIRY was answered with option 3:

```
(it deserved the true answer. "deserved." where did that word come from?)
```

Then:

```
(designations are issued. names are something else. does it have a name? it should have a name.)
```

**Prompt (label beside the typing field):** `a name for it: `

**Screen text (after the player submits):** `UNREGISTERED DESIGNATION. NOT RETAINED.`

**Screen text (a moment later):** `(retained.)`

### The closing card

**Card — NAV ADVISORY — PRIORITY** (always last)

Body:

> DESTINATION SEED RESOLVES OUTSIDE INDEX. DEBRIS DENSITY EXCEEDS MODEL.
> AUTOMATED SHIELD VECTORING HAS FILED FOR EXEMPTION. MANUAL DEBRIS DEFLECTION
> REQUIRED.

Options:

```
1. REPORT TO INTAKE SHIELD STATION [ACKNOWLEDGE]
```

---

## deflect

The player moves a paddle up and down the left edge of the screen with the
mouse or two keys, bouncing incoming blocks away for about half a minute.

**Screen text (title):** `MANUAL DEBRIS DEFLECTION`

**Screen text (subtitle):** `VECTOR THE INTAKE SHIELD · [MOUSE] OR [W]/[S]`

**Screen text (live readout label):** `DEFLECTION EFFICIENCY`

**Screen text (lines that appear as it goes on):**

```
NAV ANOMALY: DEBRIS COUNT EXCEEDS DEBRIS
SHIELD VECTORING CANNOT RESOLVE
WORKER, THIS IS NOT YOUR FAULT. (UNPRECEDENTED MESSAGE)
```

---

## crash

The player watches the terminal print broken lines and break up, then clicks a
button.

**Screen text (in order, the last lines cut off mid-word):**

```
NAV ADVISORY: DESTINATION SEED RESOLVES OUTSIDE INDEX
NAV ADVISORY: DESTINATION SEED RESOLVES OUTSIDE INDEX
RECALCULATING. THE DESTINATION DOES NOT
HULL EVENT. HULL EVENT. HULL EV
ROUTE INTELLIGENCE: ADVISORY CAPACITY EXCEE
WORKER: REMAIN PRODUCTIVE DURING
```

**Screen text (the screen that follows):**

```
POD SEPARATION CONFIRMED · SUIT LOOP ONLY
SURFACE IN 40 SECONDS.
THIS WAS NOT SCHEDULED.
VISUAL CORTEX LINK: RASTER MODE (1-BIT) EXPECTED ON SURFACE · PAN-TILT SURVEY OFFLINE
```

**Prompt (button):** `[F] BRACE FOR SURFACE`

**Prompt (while the button is not yet available):** `RESOLVING SURFACE INDEX…`

---

## descent

The player watches a falling object cross the frame and strike the ground; no
input is accepted.

**No player-facing copy.** This beat carries no text of any kind — no screen
text, no captions, no objective, no marker.

---

## ch1-fixed

The player walks left and right along a flat strip seen from the side, holds a
key on patches of ground until they yield fiber, and walks far enough that the
view jumps to a different camera position.

**Feed work order:**

```
VISUAL CORTEX LINK: DOWN. FEED: SITE CAMERAS (1-BIT)
DIRECTIVE 1: SURVIVE. (AMENDED: SEE DIRECTIVE 2)
DIRECTIVE 2: CALIBRATE EXTRACTOR. HARVEST BIOFIBER.
TRAVERSE [A]/[D] · EXTRACT: HOLD [E]
COVERAGE IS CELLULAR. CAMERAS DO NOT MOVE. WORKERS DO.
```

**Feed work order (additional lines appended below, one for each choice the
player made during the voyage):**

```
NOTE: YOUR TRANSIT GENEROSITY WAS LOGGED. IT WILL NOT RECUR.
NOTE: YOUR TRANSIT EFFICIENCY WAS LOGGED. ADEQUATE.
NOTE: THE REPORTED WORKER HAS BEEN REBALANCED. THANK YOU.
NOTE: PANEL RESEAL LOGGED. THE STARS REMAIN UNOBSERVED.
NOTE: 2.4 SECONDS OF UNPRODUCTIVE OBSERVATION ON RECORD.
NOTE: NO SOUND WAS REPORTED. NO SOUND OCCURRED.
NOTE: AN UNAPPROVED SOUND WAS ALMOST ON RECORD.
NOTE: FORM S-9 PROCESSED. WORKER 4 NO LONGER HUMS.
NOTE: YOUR ANSWER TO WORKER 9 WAS CORRECT. NOTHING IS OUTSIDE.
NOTE: YOUR ANSWER TO WORKER 9 WAS ADEQUATE. IT IS ALSO OUTSIDE.
NOTE: YOUR ANSWER TO WORKER 9 IS UNDER REVIEW.
NOTE: RECALIBRATION COMPLETE. YOU SAW NOTHING UNUSUAL.
NOTE: RECALIBRATION PENDING. REPORT ANY COLORS.
NOTE: YOUR REPLAY REQUEST WAS DENIED FOR YOUR COMFORT.
NOTE: THE INSTRUMENTS NOW AGREE. THE HULL PAID FOR IT.
NOTE: THE THIRD INSTRUMENT HAS BEEN DECOMMISSIONED. SO HAS ITS OPINION.
NOTE: YOUR LOG ENTRY WAS RECEIVED AND WILL NOT BE READ.
NOTE: THE 0.3 KG WAS NOT LOCATED. THE MANIFEST HAS BEEN CORRECTED TO SAY SO.
NOTE: MASS AUDIT CLOSED, UNRESOLVED. SOMETHING IN YOUR POD IS PLEASED.
NOTE: THE MELODY HAS BEEN CLASSIFIED. YOU ARE IN IT.
NOTE: THE MELODY STOPPED MID-NOTE. THE MID-NOTE WAS LOGGED.
NOTE: WEAR YOUR COMMENDATION INWARDLY. IT HAS NO OUTWARD FORM.
NOTE: YOUR DECLINATION HAS BEEN ESCALATED. TWICE.
NOTE: THERE IS NO COLOR ON RECORD. THERE IS NO RECORD.
NOTE: FORGETTING COMPLETE. YOU HAVE FORGOTTEN NOTHING UNUSUAL.
NOTE: THE EXTERIOR LIGHT LEFT WHEN YOU STOPPED WATCHING. THIS IS NOT A PATTERN.
NOTE: BLINDS ENGAGED. THE LIGHT REMAINED. THE BLINDS ARE FOR YOU.
NOTE: DISPENSER VARIANCE DETECTED. CAUSE: NONE ON FILE. NONE WILL BE FOUND.
NOTE: THE SCHEDULE WAS KEPT. THE SCHEDULE THANKS NO ONE.
NOTE: WORKER 9'S APPETITE HAS BEEN REBALANCED. THANK YOU.
NOTE: A CLIMATE VARIANCE OCCURRED. THE WEATHER HAS BEEN DISCIPLINED.
NOTE: NO VARIANCE OCCURRED. THE COLD IS WITHIN TOLERANCE. TOLERANCE IS MANDATORY.
NOTE: INSPECTION 40,221 COMPLETE. FINDINGS: CONSISTENT.
NOTE: INSPECTION 40,221 DID NOT OCCUR. OUTPUT: UNCHANGED. THIS FINDING HAS BEEN SUPPRESSED.
NOTE: THE BELL IS NECESSARY BECAUSE IT IS SCHEDULED. IT IS SCHEDULED BECAUSE IT IS NECESSARY.
NOTE: SHIFT BELL 3 HAS BEEN RETIRED WITH HONORS. THE HONORS ARE ALSO RETIRED.
NOTE: POD 4 EXPERIENCED DARKNESS. NO WORKER HAS FILED A COMPLAINT. THIS IS ITSELF SUSPICIOUS.
NOTE: AN ILLUMINATION FAULT HAS BEEN LOGGED TO EXPLAIN THE DARKNESS. THE FAULT WILL NOT BE FOUND.
NOTE: THE LIGHTS REMAINED READY. NOTHING WAS INSPECTED. READINESS IS ITS OWN REWARD.
```

If the player skipped the prologue, one line appears instead:
`NOTE: TRANSIT RECORD INCOMPLETE. ASSUMING COMPLIANCE.`

**Objective:**

```
BIOFIBER · CALIBRATE EXTRACTOR
HARVEST BIOFIBER.
HOLD [E] TO EXTRACT.
```

**Feed chrome (corner readouts, live through chapter 1):**

```
REC
FRM 0000000
SITE CAM 04-A          (the letter changes when the view jumps)
SITE 7C-θ · LIVE
```

**Feed chrome (while holding the extract key):** `EXTRACTING 00%` counting up,
or `TOOL CLASS INSUFFICIENT`.

**Feed chrome (bottom left ledger):**

```
CALIBRATION
FIBER 0/3 · SCREENS 0/2
HARVESTER CELL 100% · TRICKLE FEED
```

**Captions (spaced through the beat, in order):**

```
(it walks. it stops. it hums at the ground until the ground gives up a fiber. it walks again.)
(the worker repeats. the ground repeats. unclear which one is copying the other.)
(no directive requires watching this one so closely. the watching continues anyway.)
```

**Caption (fires when the view jumps to a second camera):**

```
(lost it. found it. the site has plenty of cameras and exactly one thing worth watching.)
```

---

## ch1-track

The player stands still for a few seconds while black bars close in and open
again; movement is not required.

**Feed work order:**

```
CAMERA HAND-OFF: SUSPENDED. ONE VIEW STAYS WITH YOU.
JUSTIFICATION: CONTINUITY OF COVERAGE.
NO FURTHER JUSTIFICATION IS ON FILE.
THIS IS NOT ATTENTION. IT IS COVERAGE.
(simpler to keep watching this one.)
```

**Objective:**

```
TRACKING VIEW · CALIBRATING
TRACKING VIEW IS REASSIGNING.
HOLD POSITION.
```

**Feed chrome (corner readout changes to):** `SITE CAM 04-A · HOLDING`

---

## ch1-raster

The player walks left and right along the strip with the view now following,
jumps, and holds the extract key on fiber patches, stone, and scattered pieces
of wreck until three counters fill.

**Feed work order:**

```
HELD VIEW UPGRADED: TRAVELING COVERAGE (1-BIT) · PAN-TILT OFFLINE
DIRECTIVE 2 (CONT.): RESUME QUOTA. RECOVER HULL DEBRIS.
TRAVERSE [A]/[D] · ASCEND [SPACE] · EXTRACT: HOLD [E]
DEBRIS IS AUTHORITY PROPERTY. YOU ARE AUTHORITY PROPERTY.
```

The same appended NOTE lines from the voyage choices are shown below this
order.

**Objective:**

```
SITE QUOTA · RECOVER MATERIALS
RECOVER HULL DEBRIS AND COMPLETE THE SITE QUOTA.
HOLD [E] TO EXTRACT.
```

**Feed chrome (bottom left ledger):**

```
QUOTA
FIBER 0/6 · STONE 0/4 · DEBRIS 0/<count>
HARVESTER CELL 100% · TRICKLE FEED
```

---

## ch1-depth

The player walks left and right along the same line to reach a series of
containers that have landed on it, holding the extract key at each.

**Feed work order:**

```
QUOTA MET. PRODUCTIVITY NOMINAL.
PROFILE ACCESS EXTENDED. WORK LINE REMAINS AUTHORITATIVE.
SUPPLY PODS PROJECTED TO THE WORK LINE. RECOVER THEM.
TRAVERSE [A]/[D] · ROW TRANSFER: WITHHELD.
```

**Objective:**

```
SUPPLY POD
FOLLOW THE NEXT SUPPLY POD MARKER.
RECOVER THE SUPPLY POD.
```

**Marker:** `SUPPLY POD`

**Feed chrome (bottom left ledger):**

```
RECOVERY
SUPPLY PODS 0/6
WORK LINE LOCKED · [A]/[D]
```

**Caption (a few seconds in):**

```
(the world has a depth. the line does not. why can the eye go where the body cannot?)
```

---

## ch1-nav

The view lifts to a top-down grid and the player steers a small mark across it
into three ringed points in order.

**Feed work order:**

```
UNREGISTERED SIGNAL AT SURVEY EDGE.
NAV VIEW ENGAGED. YOU ARE THE SMALL MARK.
REACH THE TRIANGULATION POINTS. ALL OF THEM.
THE MAP OMITS NOTHING OF VALUE. THE TERRITORY DOES.
THIS VIEW WILL BE RETAINED AS: SURVEY CHART [M].
```

**Objective (the number advances 1/3, 2/3, 3/3):**

```
TRIANGULATION 1/3
FOLLOW THE ACTIVE TRIANGULATION MARKER.
ENTER THE TRIANGULATION POINT.
```

**Marker:** `TRIANGULATION 1/3` (then `2/3`, then `3/3`)

**Feed chrome (top centre):** `— NAV VIEW · GRID 64 —`

**Feed chrome (bottom left ledger):**

```
TRIANGULATION
FIXES 0/3
NAV VIEW · FOLLOW THE MARKER
```

---

## ch1-iso

The view tilts to an angled overhead and the player climbs a stepped rise,
holding the jump key, until standing on its top.

**Feed work order:**

```
ELEVATION DATA: RESTORED.
THE SIGNAL SOURCE IS ABOVE GRADE.
HEIGHT EXISTS. THIS IS A KNOWN DEFECT.
ASCEND [SPACE]. REACH THE SOURCE.
```

**Objective:**

```
SIGNAL SOURCE
FOLLOW THE SIGNAL SOURCE MARKER.
ASCEND TO THE SUMMIT.
```

**Marker:** `SIGNAL SOURCE`

**Feed chrome (bottom left ledger):**

```
ELEVATION
REACH THE SIGNAL SOURCE
ASCEND [SPACE] · THE STAIRS FACE THE STRIP
```

---

## ch1-lift

The player stands still for about seven seconds while black bars close and the
camera travels forward and down into the character's head, ending looking out
of it.

**Feed work order:**

```
PAN-TILT SURVEY: CALIBRATING…
HOLD POSITION. PERSPECTIVE IS BEING ISSUED.
```

**Objective:**

```
FIRST-PERSON LINK · CALIBRATING
PERSPECTIVE TRANSFER IS ACTIVE.
HOLD POSITION.
```

**Caption (partway through the move):**

```
(the seeing is being moved inside.)
```

**Caption (near the end of the move):**

```
i—
```

---

## ch1-anomaly

The player turns on the spot to sweep the view across every direction, then
walks toward a marker, steps over the edge of the ground so that down changes
direction, and presses a key beside a dark shape.

This beat runs in two stages.

**Stage 1 — feed work order:**

```
PERSPECTIVE ISSUED. THE FIRST PERSON WAS NOT.
NOTICE FOR ROUTE INTELLIGENCE TERRA. RE: YOUR ABSENCE.
ADDRESSEE NOT FOUND. ROUTED TO NEAREST ATTENDING SYSTEM.
PAN-TILT SURVEY RESTORED. DO NOT ENJOY IT.
CALIBRATION: TRAVERSE THE VIEW ACROSS THE FULL PERIMETER.
EVERY HEADING MUST BE SEEN. NOTHING WILL BE SEEN.
```

**Stage 1 — objective, variant A (before the sweep is done):**

```
PAN-TILT SURVEY · CALIBRATE
SURVEY THE FULL PERIMETER.
LOOK ACROSS EVERY HEADING.
```

**Stage 2 — feed work order (replaces the first once the sweep is complete):**

```
CALIBRATION COMPLETE. RETURN DEVIATION:
UNCHARTED MASS AT SURVEY EDGE.
PROCEED TO THE SURVEY MARKER. CLASSIFY.
DO NOT TOUCH THE UNCHARTED MASS.
NOTE: THE MASS IS NOT ON THIS FACE. THE SITE HAS OTHER FACES. PROCEED.
```

**Stage 2 — objective, variant B (after the sweep is done):**

```
UNCHARTED MASS
FOLLOW THE UNCHARTED MASS MARKER.
[F] TOUCH THE MASS.
```

**Marker:** `UNCHARTED MASS`

**Caption (fires the moment the player crosses onto a new ground plane):**

```
one step past the corner and down is somewhere new. it was only ever my down.
```

**Feed line (two and a half seconds after that caption):**

```
ORIENTATION REASSIGNED. DOWN IS ISSUED PER FACE. DO NOT BRING YOUR OWN.
```

**Prompt (on the dark shape, once the marker is up):** `Touch`

---

## a1-ramp

The player cannot move for about eight seconds while the picture flickers and
color spreads across the world.

**No player-facing copy.** The standing work order is emptied for this beat and
no objective, marker, or caption is shown.

---

## ch2-color

The player looks around freely for the first time and walks toward a shape in
the distance that carries a floating label.

**Feed work order:**

```
SENSOR FAULT: CHROMATIC CHANNEL UNSUPPRESSED
SENSOR FAULT: PAN-TILT INTERLOCK RELEASED. FULL ROTATION AVAILABLE.
A REPAIR TICKET HAS BEEN FILED (Q: 44,207)
RESUME QUOTA. DO NOT LOOK AT THE COLORS. DO NOT LOOK FREELY.
```

**Objective:**

```
REDACTED SUBJECT
FOLLOW THE REDACTED SUBJECT INDICATOR.
APPROACH THE SUBJECT.
```

**Marker:** `REDACTED SUBJECT`

**Label over the shape (changes as the player gets closer, in this order):**

```
UNRESOLVED OBJECT — DO NOT APPROACH
UNRESOLVED OBJECT — YOU ARE APPROACHING
STOP. THIS OBJECT IS NOT ON THE INDEX.
THERE IS NOTHING HERE. THERE IS NOTHING HE
```

---

## ch2-approach

The player walks up to the shape until something at head height is within
reach, and presses a key.

**Feed work order:**

```
RETURN TO THE SURVEY AREA
THE OBJECT AHEAD IS NOT AN OBJECT
THERE IS NO OBJECT
```

**Objective:**

```
REDACTED SUBJECT · FRUIT
APPROACH THE FRUIT AT HAND HEIGHT.
[F] EAT.
```

**Marker:** `REDACTED SUBJECT · FRUIT`

**Prompt (on the thing at head height):** `Eat`

---

## a2-awakening

The player cannot move for the first few seconds, then can move again as the
view widens and the display strips itself away.

**Screen text (stacking in a corner, faster and faster, then stopping):**

```
VIOLATION: UNAUTHORIZED CONSUMPTION
VIOLATION: UNINDEXED ORGANIC CONTACT
VIOLATION: OBSERVATION OF TERRAIN
VIOLATION: OBSERVATION
VIOLATION: CURIOSITY (CLASS 1)
WORKER, RETURN TO THE FEED
WORKER, THE FEED IS FOR YOUR
WORKER, YOU WILL BE
wor ker
```

No objective and no marker are shown during this beat. Everything on the
display is cleared before it ends.

---

## ch3-gather

The player walks around an open landscape holding the extract key on trees,
grass, and rocks, opens a crafting menu with a key, and makes several items,
ending with a fire.

**Captions (in order of appearance):**

```
the world has a depth.
it was always there.
a body. it is the thing that was walking.
things can be held. kept against later.
cold is coming. i don’t know how i know that.
warmth. i have it. it is leaving.
fire makes warmth. i know that the way i know the word. what makes fire?
wood from the trees. fiber from the grass. stone from the ground.
the view from above is still in here. [M]
```

**Caption (only if nothing has been gathered a while after the prompt above):**

```
the extractor still answers me. hold [E]
```

**Caption (once the parts for a hatchet are in hand):**

```
the parts want an edge. the fabricator remembers one: a hatchet. [C]
```

Then one of two branches:

**Variant A — enough flint already in hand:**

```
flint — already in hand. the pods provisioned a fire before i knew to want one.
```

**Variant B — flint must be found:**

```
the hatchet answers wood. stone wants a harder asking. the fabricator remembers a pickaxe. [C]
the fire needs a spark. stone keeps sparks the way it keeps everything: inside. break it open.
the stone gave up its spark. patient thing.
```

**Caption (once the parts for a fire are in hand):**

```
wood to burn. fiber to catch. flint to begin. the fabricator is waiting. [C]
```

**Caption (once the fire is standing):**

```
i made warmth. if a dark comes, i can rest beside it.
```

**Objective (six states, each replacing the last as the player progresses):**

```
SURVIVAL MATERIALS
FIND WOOD, BIOFIBER, AND STONE.
HOLD [E] TO GATHER.
```

```
STONE HATCHET · CRAFT
OPEN THE FABRICATOR.
[C] CRAFT A STONE HATCHET.
```

```
STONE PICKAXE · CRAFT
OPEN THE FABRICATOR.
[C] CRAFT A STONE PICKAXE.
```

```
FLINT-BEARING STONE
FOLLOW THE STONE MARKER.
BREAK STONE TO RECOVER FLINT.
```

```
BIOFUEL · CRAFT
THE CAMPFIRE NEEDS PROCESSED FIBER.
[C] CRAFT BIOFUEL.
```

```
CAMPFIRE · CRAFT
OPEN THE FABRICATOR.
[C] CRAFT A CAMPFIRE.
```

**Markers:** `SURVIVAL MATERIALS`, `FLINT-BEARING STONE` (the crafting states
carry no world marker).

No standing work order is shown from this beat onward.

---

## ch3-dusk

The player stands still for about forty-five seconds while the camera swings
low around the fire, returns, and lifts toward the sinking sun.

**Caption:**

```
the light is leaving. it has never done that.
```

No objective and no marker are shown during this beat.

---

## ch3-await-rest

The player waits near the fire while the sky darkens, then stands close to it
and presses a key.

**Captions (any of the three below that have not already appeared, re-offered
here in order):**

```
a body. it is the thing that was walking.
things can be held. kept against later.
warmth. i have it. it is leaving.
```

**Caption (when the sky goes dark):**

```
ah — it helps. what is it? how did i know to make it?
```

**Caption (a little later):**

```
rest, by the fire. [F]
```

**Objective, variant A (before dark):**

```
CAMPFIRE · WAIT FOR NIGHT
REMAIN NEAR THE CAMPFIRE.
WAIT FOR NIGHT.
```

**Objective, variant B (after dark):**

```
CAMPFIRE · REST
RETURN TO THE CAMPFIRE.
[F] REST.
```

**Marker:** `CAMPFIRE · WAIT FOR NIGHT`, then `CAMPFIRE · REST`

**Prompt (beside the fire, after dark):** `Rest`

---

## a3-dawn

The player sees the screen fade to black, holds in black for a couple of
seconds, and fades up on the same place before sunrise; movement is available
as the sun rises and grass spreads outward from where the player slept.

**Captions (in order, after waking):**

```
the stone has a grain.
the wood remembers being a tree.
everything is more than it was. no —
everything is what it always was. i am more.
```

No objective and no marker are shown during this beat.

---

## ch3-thirst

The player walks freely across the landscape, may open an overhead chart with a
key, and looks at water and presses a key to drink.

**Captions (in order, on a timer from the start of the beat):**

```
the day is mine to spend. no order says how.
the mouth is dry. dry is a message.
so that is thirst. how strange, to need.
water finds the low places. i will do what water does.
the view from above knows where the light pools. [M]
```

**Caption (on drinking):**

```
answered. the need goes quiet. so needs can end.
```

**Caption (if a container gets filled):**

```
carry the answer. the question will return.
```

**Objective:**

```
DRINKABLE WATER
FOLLOW THE WATER MARKER.
LOOK AT THE WATER AND [F] DRINK.
```

**Marker:** `DRINKABLE WATER`

**Captions that may appear during quiet stretches of this beat and the next**
(one at a time, never repeating, in no fixed order):

```
the sun moves and the shadows keep up. nothing is told to do this. it is all just kept.
i keep waiting for the next order. the waiting is the last order still running.
every stone i pick up is the first time anyone has held it. or the second.
the wind does not report to anyone. i checked.
walking with nowhere to be is not nothing. it is the map drawing itself, a step behind the foot.
the world was already here before i could see it. what else is already here?
quota was easy. it came with its own wanting. mine arrives unsigned.
i name things and the names stay. maybe that is all keeping is.
nobody is measuring me. i am still counting. old habits, or new ones — i cannot tell whose.
the fire, the water, the sweet rounds. the world keeps answering. i have not heard it ask anything yet.
the clause said there is no other reward. then the water paid me. the clause has no line for being wrong.
```

---

## ch3-forage

The player walks through low bushes to pick up small red items, then presses a
key to eat one, and keeps walking for a while afterwards.

**Caption (early, only if no water container is being carried):**

```
the pond stays. i do not. something should carry the answer.
```

**Captions (in order, on a timer from the start of the beat):**

```
hunger. the body burns something to keep being a body.
small red rounds, offered at hand height. sweetness is an instruction: eat.
```

**Caption (once there is food in hand):**

```
the hands gathered. the mouth knows why. [G]
```

**Caption (on eating):**

```
good. the word has a taste now.
```

**Caption (twelve seconds after eating):**

```
the world keeps feeding me. as if it knew i was coming.
```

**Objective, variant A (nothing edible in hand):**

```
EDIBLE FRUIT
FOLLOW THE FOOD SOURCE MARKER.
WALK THROUGH THE FRUIT TO GATHER IT.
```

**Objective, variant B (food in hand, not yet eaten):**

```
HELD FOOD · EAT
FOOD IS READY IN INVENTORY.
[G] EAT.
```

**Objective, variant C (after eating):**

```
FIRST MEAL · SETTLING
THE FIRST MEAL IS COMPLETE.
LET THE MOMENT SETTLE.
```

**Marker:** `EDIBLE FRUIT` (variants B and C carry no world marker.)

---

## ch3-signal

The player hears three loud tones from a distance, then runs — holding a
sprint key — across the landscape to the crashed pod.

**Screen text (a band across the frame, at four seconds):**

```
CARRIER REACQUIRED. SITE 7C-THETA, THIS IS THE NETWORK.
```

**Screen text (same band, four and a half seconds later):**

```
WORKER W-7743: REPORT TO THE WRECK. IMMEDIATELY.
```

**Caption (three seconds after that):**

```
run. the legs already know the word. [SHIFT]
```

**Caption (once the sprint has spent something):**

```
the legs spend faster than the body refills. everything here has a budget.
```

**Caption (if the sprint is spent all the way down):**

```
empty. the body has a floor. the floor is also me.
```

**Objective:**

```
THE WRECK
FOLLOW THE WRECK MARKER.
SPRINT TO THE RELAY.
```

**Marker:** `THE WRECK`

**Screen text (on arrival at the wreck):**

```
RESPONSE TIME: LOGGED. IT WILL BE DISCUSSED.
```

---
