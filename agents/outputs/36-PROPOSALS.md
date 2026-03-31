# Agent 36 — Feature Proposals
# Synthesized from Agents 33 (Competitor Gaps), 34 (Client Wants), 35 (Sitter Wants)

Generated: 2026-03-29
For review by: Carson

---

## MARKET CONTEXT

**The window is open NOW.**

Togetherwork acquired PetExec (Nov 2024) and is forcing all PetExec customers
onto Gingr. Gingr is in visible decline: support gone, bugs multiplying,
financial reports inaccurate, $2,000 surprise gateway fees. Thousands of
pet care businesses are actively looking for an alternative RIGHT NOW.

**Three strategic pillars from the research:**

1. **Sitter satisfaction is the moat.** Sitters use the software 8 hours/day.
   If they love Snout OS, they'll refuse to work for businesses on other platforms.
   (Agent 35)

2. **Emotional features build loyalty.** 47% of pet owners have separation anxiety.
   The client portal should feel like "Instagram for Pet Care" — not a business tool.
   Functional features are table stakes. (Agent 34)

3. **The competitor diaspora is a once-in-a-decade opportunity.** PetExec refugees
   need somewhere to go. Gingr is not the answer. The business that builds the
   easiest migration path captures them. (Agent 33)

---

## QUICK WINS

Low complexity, high impact. Build these first.

---

### PROPOSAL #1: Dark Mode Toggle

PROBLEM:
Pet parents check updates at night; the bright white screen at 11 PM is jarring.

WHO ASKED FOR IT:
[x] Pet owners (clients)  [ ] Pet sitters  [x] Business owners
Frequency: Mentioned in client portal research; currently stubbed in command palette

COMPETITIVE LANDSCAPE:
- Time To Pet: Doesn't have it
- Gingr: Doesn't have it
- Rover: Has it (app-level dark mode)

SNOUT OS ADVANTAGE:
Theme system already exists with 4 themes (snout, light, dark, snout-dark).
All components use CSS variable-backed design tokens. The toggle is literally
stubbed in commands.tsx — it just needs to be connected.

BUILD COMPLEXITY:
[x] Low (days)  [ ] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Free differentiation. Signals polish and modernity. No direct revenue but
reduces "this feels cheap" objections during trials.

DEPENDENCIES:
None. Theme system and tokens already exist.

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #2: Personalized Notifications Using Pet's Name

PROBLEM:
"Booking #4832 completed" doesn't feel personal. "Luna had a great walk today!" does.

WHO ASKED FOR IT:
[x] Pet owners (clients)  [ ] Pet sitters  [ ] Business owners
Frequency: Universal theme in client research — emotional connection matters

COMPETITIVE LANDSCAPE:
- Time To Pet: Generic system notifications
- Gingr: Generic system notifications
- Rover: Partially personalized (uses pet name in some contexts)

SNOUT OS ADVANTAGE:
Pet names are already on every booking (pet relation). Notification triggers
already have access to booking data. Template variable substitution exists in
automation-executor. This is a copy change, not a code change.

BUILD COMPLEXITY:
[x] Low (days)  [ ] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Increases client engagement and perceived care quality. Clients share
personalized notifications with friends ("look what my dog walker sent!").
Word-of-mouth driver.

DEPENDENCIES:
None. Pet data and template system already exist.

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #3: Access Info Surfaced on Arrival

PROBLEM:
Sitters juggle 30+ clients' lockbox codes, alarm codes, and key locations
in their head or scattered notes. At every door they're scrolling to find info.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 35 ranked this #5 (8/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: Has key management feature (separate screen)
- Gingr: No key management
- Rover: No key management (marketplace model)

SNOUT OS ADVANTAGE:
Client home access data already stored: lockbox code, alarm code, WiFi password,
entry instructions, parking. Sitter booking detail already shows client address.
Just need to surface the access card prominently at check-in time.

BUILD COMPLEXITY:
[x] Low (days)  [ ] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Sitter efficiency gain: saves 1-2 minutes per visit (no more scrolling).
At 6+ visits/day, that's 10+ minutes saved. Reduces errors (wrong code, alarm
goes off). Directly improves sitter experience.

DEPENDENCIES:
Client home access fields (already exist on profile).

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #4: "On My Way" Notification Step

PROBLEM:
Clients don't know when the sitter is coming until they check in. A pre-arrival
heads-up reduces anxiety ("they're actually showing up").

WHO ASKED FOR IT:
[x] Pet owners (clients)  [ ] Pet sitters  [ ] Business owners
Frequency: Agent 34 identified this as a gap in the visit lifecycle

COMPETITIVE LANDSCAPE:
- Time To Pet: Doesn't have it
- Gingr: Doesn't have it
- Rover: Has it (sitter taps "on my way")

SNOUT OS ADVANTAGE:
Notification trigger system already fires on check-in/check-out. Adding a
pre-arrival step is one more trigger in the chain. Sitter taps "On my way"
on their today view → client gets "Your sitter is heading to [Pet name]!"

BUILD COMPLEXITY:
[x] Low (days)  [ ] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Closes a trust gap with Rover. Small effort, high emotional impact.
Pet owners cited this as a premium differentiator.

DEPENDENCIES:
Sitter today view (exists). Notification triggers (exists).

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

## DIFFERENTIATORS

Things that make Snout OS meaningfully better than TTP/Gingr.
Medium-High complexity. Unique positioning.

---

### PROPOSAL #5: Gingr/PetExec Migration Import Tool

PROBLEM:
Thousands of PetExec businesses are being forced onto Gingr. Migrations are
failing, taking weeks, with data loss and $2,000 surprise fees. They need
somewhere to go.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [ ] Pet sitters  [x] Business owners
Frequency: Agent 33 ranked this #1 (10/10 score). Active diaspora RIGHT NOW.

COMPETITIVE LANDSCAPE:
- Time To Pet: No import tool
- Gingr: Their own migration tool is broken
- Rover: Not a business management platform

SNOUT OS ADVANTAGE:
This is a land grab. The businesses being forced to migrate have:
- Client lists (names, phones, emails, addresses)
- Pet records (species, breed, age, notes)
- Booking history
- Sitter rosters
All exportable as CSV from PetExec. Snout OS schema can receive all of it.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Each business acquired is a monthly subscription. If 100 PetExec businesses
migrate at $50/mo, that's $60K ARR. The migration tool is a customer
acquisition channel.

DEPENDENCIES:
CSV parsing, field mapping UI, data validation. No new models needed — Client,
Pet, Sitter, Booking models already exist.

RECOMMENDATION: Build Now (TIME-SENSITIVE — window closes as businesses settle elsewhere)

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #6: Visit Report Quick-Fill Templates

PROBLEM:
Sitters doing 5+ visits/day spend 30-60 minutes writing reports. It's the
#1 daily time sink after driving.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 35 ranked this #1 (10/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: Free-text reports only
- Gingr: Report cards with limited customization
- Rover: Structured cards with checkboxes (best in class currently)

SNOUT OS ADVANTAGE:
AI daily delight already generates polished reports. Adding quick-fill templates
combines the speed of checkboxes with the personalization of AI. Sitter taps
checkboxes → AI generates a client-facing narrative. 15 seconds of input,
premium output.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Sitter retention: saves 30-60 min/day. The single biggest quality-of-life
improvement. Sitters who save time are sitters who stay. Also produces
better client-facing reports → higher client satisfaction.

DEPENDENCIES:
Report model (exists). AI daily delight (exists). Need: template definitions,
checkbox UI component, AI narrative generation from structured input.

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #7: Real-Time Visit Proof (GPS Track + Photos + Timestamps)

PROBLEM:
Pet owners can't verify visits happened, how long they lasted, or what
the sitter actually did. This is the #1 trust issue.

WHO ASKED FOR IT:
[x] Pet owners (clients)  [ ] Pet sitters  [x] Business owners
Frequency: Agent 34 ranked this #1 (10/10 score). Universal across all reviews.

COMPETITIVE LANDSCAPE:
- Time To Pet: GPS on check-in/out, photos in reports
- Gingr: No GPS tracking
- Rover: GPS walk map, photos, timestamps (best in class)

SNOUT OS ADVANTAGE:
Check-in/check-out GPS already captured. RouteMap component exists. S3 photo
storage exists. The pieces exist — they need to be assembled into a client-facing
"Visit Card" that auto-generates after check-out.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Closes the gap with Rover on the #1 feature pet owners evaluate. Justifies
premium pricing ("you can SEE every visit"). Makes the service feel premium
vs competitors where you're trusting on faith.

DEPENDENCIES:
GPS capture (exists). Photo upload (exists). RouteMap (exists). Need: client-
facing Visit Card component, auto-generation on check-out, push notification.

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #8: Pet Health Checklist Per Visit

PROBLEM:
Pet owners with senior/medical pets need structured health data, not
free-text notes. "Did they eat? Take medication? Poop normally?"

WHO ASKED FOR IT:
[x] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 34 ranked this #4 (8/10). Agent 35 ties it to report templates.

COMPETITIVE LANDSCAPE:
- Time To Pet: Free-text notes only
- Gingr: Report cards with some structure
- Rover: Structured "pee/poo/food/water" checkboxes (basic)

SNOUT OS ADVANTAGE:
Can combine structured checkboxes with AI narrative. Sitter checks 5 boxes,
client sees: "Luna ate her full breakfast, drank water normally, and had a
healthy walk with one bathroom stop. No concerns today!" Best of both worlds.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Differentiator for businesses serving senior pet owners and pets with
medical conditions. Higher perceived value → justifies premium tier.

DEPENDENCIES:
Report model (exists). Per-pet medication list on pet profile (needs field
additions). Checklist UI component (needs building).

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #9: Sitter Reliability Score Visible to Clients

PROBLEM:
Pet owners can't evaluate sitter quality beyond star ratings (easily gamed).
They want hard data: "Does this person show up on time?"

WHO ASKED FOR IT:
[x] Pet owners (clients)  [ ] Pet sitters  [x] Business owners
Frequency: Agent 34 ranked this #6 (8/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: No performance metrics visible to clients
- Gingr: No sitter performance system
- Rover: Star ratings only (1-5)

SNOUT OS ADVANTAGE:
SRS engine already computes 6 dimensions with 30-day rolling windows.
Tier system already classifies sitters. This is purely a display decision —
show a sanitized subset to clients. No computation needed.

BUILD COMPLEXITY:
[x] Low (days)  [ ] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Differentiator vs Rover's star ratings. Builds trust faster →
accelerates the "skeptical → comfortable" trust progression.
Businesses can market "verified reliability scores" as a premium feature.

DEPENDENCIES:
SRS engine (exists). Tier system (exists). Need: client-facing component
showing on-time rate, visit completion rate, response time. Design decision
on what to show vs hide.

RECOMMENDATION: Build Now

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #10: Communication Quiet Hours for Sitters

PROBLEM:
Sitters burned out from 24/7 client texts. "I need to be able to clock out."
Burnout is the #1 reason sitters leave the profession.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 35 ranked this #7 (7/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: No quiet hours feature
- Gingr: No quiet hours
- Rover: No quiet hours (marketplace model)

SNOUT OS ADVANTAGE:
Masked messaging already separates sitter personal number from work.
Adding quiet hours means: during 9 PM-7 AM, sitter push notifications
are suppressed. Messages still arrive (visible when they log in), but
the phone doesn't buzz. Auto-reply: "Your sitter is off duty."

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Sitter retention. The sitters who stay longest are the ones with
boundaries. This feature prevents the burnout spiral that costs
businesses their best people.

DEPENDENCIES:
Push notification system (exists). Sitter profile (needs quiet hours
fields). Notification dispatch (needs time-of-day check).

RECOMMENDATION: Build Next Quarter

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

## TABLE STAKES

Things TTP has that Snout OS needs to match to be competitive.

---

### PROPOSAL #11: Mileage Tracking + Tax Estimation

PROBLEM:
Every independent sitter uses a separate mileage app (Stride, Everlance).
"Tax season is a nightmare." The platform that handles this becomes indispensable.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [x] Pet sitters  [ ] Business owners
Frequency: Agent 35 ranked this #3 (9/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: No mileage tracking
- Gingr: No mileage tracking
- Rover: No mileage tracking
- Stride/Everlance: Dedicated mileage apps (separate from pet care)

SNOUT OS ADVANTAGE:
Check-in/check-out GPS already captures locations. Distance between
consecutive visits can be calculated automatically. No sitter effort needed.
Eliminates a separate app entirely.

BUILD COMPLEXITY:
[ ] Low (days)  [ ] Medium (1-2 weeks)  [x] High (month+)

REVENUE IMPACT:
Platform lock-in. When Snout OS handles a sitter's entire financial life
(earnings, payouts, mileage, tax estimation), switching costs become enormous.
Could justify a "Sitter Pro" tier.

DEPENDENCIES:
GPS data on check-in/check-out (exists). Distance calculation service.
Tax estimation logic (IRS standard mileage rate). Earnings dashboard
integration.

RECOMMENDATION: Build Next Quarter

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #12: Travel Buffer in Smart Scheduling

PROBLEM:
Sitters get back-to-back bookings with no travel time. Shows up late,
looks unprofessional. Cascading lateness ruins the entire day.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 35 ranked this #10 (6/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: Has travel time setting (global, not per-route)
- Gingr: No travel buffer
- Rover: No scheduling (marketplace model)

SNOUT OS ADVANTAGE:
Smart-assign already uses the availability engine. Adding a travel buffer
parameter to checkConflict() would automatically prevent back-to-back
assignments that are geographically impossible.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Reduces sitter lateness → better client experience → fewer complaints.
Practical scheduling improvement that TTP users already expect.

DEPENDENCIES:
Availability engine checkConflict (exists, already has checkTravelBuffer
parameter). Need: distance calculation between booking addresses, configurable
buffer time per org.

RECOMMENDATION: Build Next Quarter

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #13: Route Optimization for Multi-Visit Days

PROBLEM:
Sitters manually plan their driving routes between 6-8 visits per day.
Unpaid driving time is the hidden cost of the job.

WHO ASKED FOR IT:
[ ] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 35 ranked this #8 (7/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: No route optimization
- Gingr: No route optimization
- Precise Petcare: No route optimization
- Google Maps/Waze: Manual (sitter enters each address separately)

SNOUT OS ADVANTAGE:
RouteMap component already exists. Sitter today view already shows visits
in chronological order. Reordering by geographic proximity and launching
a multi-stop Maps URL is a UI-only change on top of existing data.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Saves sitters 30-60 min/day in driving. Directly increases their hourly
earnings. Strong differentiator — no competitor does this.

DEPENDENCIES:
Sitter today view (exists). Client addresses on bookings (exists).
Need: geocoding service, route optimization algorithm (or Google Directions
API integration).

RECOMMENDATION: Build Next Quarter

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

## BIG BETS

High complexity, could be category-defining if it lands.

---

### PROPOSAL #14: Unified Pet Care Timeline

PROBLEM:
Pet owners want "show me everything about my dog's care this month" in one
scrollable feed. Currently, visits, reports, messages, and health data are
siloed across separate pages.

WHO ASKED FOR IT:
[x] Pet owners (clients)  [ ] Pet sitters  [ ] Business owners
Frequency: Agent 34 ranked this #7 (7/10 score)

COMPETITIVE LANDSCAPE:
- Time To Pet: No unified timeline
- Gingr: No unified timeline
- Rover: No unified timeline

SNOUT OS ADVANTAGE:
All the data exists across models: Booking, Report, MessageEvent, PetHealthLog,
VisitEvent. The timeline is a READ query that aggregates and sorts. No new
data capture needed — just presentation.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
"Instagram for Pet Care" positioning. The timeline becomes the emotional
anchor of the client portal. Shareable with family members, vets, or on
social media. Category-defining if done beautifully.

DEPENDENCIES:
All data models (exist). Need: aggregation API route, timeline component,
date filtering, card design per event type.

RECOMMENDATION: Build Now (high visual impact, medium complexity)

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

### PROPOSAL #15: Emergency Vet Authorization Form

PROBLEM:
Pet owners worry "what happens if my dog has a seizure while I'm on a plane?"
No software platform offers digital vet authorization. It's always a paper form.

WHO ASKED FOR IT:
[x] Pet owners (clients)  [x] Pet sitters  [x] Business owners
Frequency: Agent 34 ranked this #8 (7/10). Pet Sitters International 2025
Global Standards list it as a required document.

COMPETITIVE LANDSCAPE:
- Time To Pet: No digital authorization
- Gingr: No digital authorization
- Rover: No digital authorization (relies on their "Rover Guarantee")

SNOUT OS ADVANTAGE:
Emergency contacts already stored on client profile. Vet info stored on pet
profile. The authorization form adds: dollar limit, digital signature, and
accessibility from the sitter's phone. Small data model addition, large trust impact.

BUILD COMPLEXITY:
[ ] Low (days)  [x] Medium (1-2 weeks)  [ ] High (month+)

REVENUE IMPACT:
Premium positioning. "We're the only platform where your sitter can show the
vet your authorization form on their phone." Professional-grade service that
justifies premium pricing. Marketing differentiator.

DEPENDENCIES:
Client profile (exists). Pet profile with vet info (exists). Need: VetAuthorization
model (dollar limit, signature, expiry), digital signature UI, sitter-accessible
view during visit.

RECOMMENDATION: Build Next Quarter

CARSON'S DECISION: [ ] Approve  [ ] Defer  [ ] Kill
NOTES: _______________

---

## PRIORITY SUMMARY

| Priority | Proposal | Complexity | Recommendation |
|----------|----------|------------|----------------|
| **1** | #5 Migration Import Tool | Medium | BUILD NOW (time-sensitive) |
| **2** | #6 Visit Report Templates | Medium | BUILD NOW |
| **3** | #7 Real-Time Visit Proof | Medium | BUILD NOW |
| **4** | #8 Pet Health Checklist | Medium | BUILD NOW |
| **5** | #1 Dark Mode Toggle | Low | BUILD NOW |
| **6** | #2 Personalized Notifications | Low | BUILD NOW |
| **7** | #3 Access Info on Arrival | Low | BUILD NOW |
| **8** | #4 "On My Way" Notification | Low | BUILD NOW |
| **9** | #9 Client-Facing SRS | Low | BUILD NOW |
| **10** | #14 Pet Care Timeline | Medium | BUILD NOW |
| **11** | #10 Sitter Quiet Hours | Medium | NEXT QUARTER |
| **12** | #11 Mileage Tracking | High | NEXT QUARTER |
| **13** | #12 Travel Buffer | Medium | NEXT QUARTER |
| **14** | #13 Route Optimization | Medium | NEXT QUARTER |
| **15** | #15 Vet Authorization | Medium | NEXT QUARTER |

---

## RECOMMENDED EXECUTION ORDER

**Week 1 (Quick Wins — ship momentum):**
- #1 Dark mode toggle (unstub the existing code)
- #2 Personalized notifications (template variable change)
- #3 Access info card on sitter arrival screen
- #4 "On my way" notification trigger
- #9 Client-facing SRS display

**Week 2-3 (Differentiators — competitive positioning):**
- #5 Migration import tool (time-sensitive land grab)
- #6 Visit report quick-fill templates + AI narrative

**Week 4-5 (Premium features — justify pricing):**
- #7 Real-time visit proof / Visit Card
- #8 Pet health checklist per visit
- #14 Unified pet care timeline

**Next Quarter (Table stakes + Big bets):**
- #10-#15

---

## DECISION REQUESTED

Carson: please review each proposal and mark:
- [ ] Approve — add to the build queue
- [ ] Defer — good idea, not now
- [ ] Kill — don't build this

Approved proposals will be routed to Agent 37 (Visionary Architect) for
technical design, then to the execution agents for implementation.

**The migration import tool (#5) is the most time-sensitive.** Every week we
wait, PetExec businesses settle into competitors. Recommend approving this
independently of the other proposals and starting immediately.
