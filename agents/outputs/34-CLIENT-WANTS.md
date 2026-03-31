# Agent 34 — Pet Owner Voice
# What Pet Owners Actually Want From Their Pet Care Provider

Generated: 2026-03-29

Sources: Rover reviews (Trustpilot, App Store, SmartCustomer, BBB), Wag reviews,
PetDesk 2025 Pet Parent Research Report, BCG pet industry research, APPA 2024 report,
Pet Sitters International standards, Gizmodo Rover investigation, industry blogs,
Quora/forum discussions.

---

## THE PET OWNER'S ANXIETY

Understanding what pet owners want starts with understanding their fear:

**47% of pet owners experience separation anxiety** when away from their pets
(Certapet survey). This isn't a convenience problem — it's an emotional one.

When a pet owner hands their house key to a stranger and drives to the airport,
they're thinking:
- "Is my dog being walked or sitting in a crate?"
- "Did they give the medication at the right time?"
- "Is my cat stressed? Are they eating?"
- "What if there's an emergency and I can't be reached?"
- "Did they actually come or are they billing me for nothing?"

**Every feature a client portal offers is answering one of these anxieties.**

---

## THEME 1: PROOF OF CARE (The #1 Demand)

**What pet owners say:** "I need to SEE that my dog is happy, not just be told."

### What Owners Want

1. **Photos during every visit** — Not stock photos. Their actual pet, in their
   actual home, doing recognizable things. This is the single most requested
   feature across all review platforms.

2. **GPS walk map** — Proof the walk happened, how long it was, and the route.
   Rover and Wag both offer this. It's table stakes.

3. **Timestamped check-in/check-out** — Proof the sitter arrived on time and
   stayed the full duration. No ambiguity.

4. **Health tracking per visit** — Did the dog eat? Drink water? Poop normally?
   Any concerns? Owners of senior pets and pets with medical conditions need this.

5. **Video clips** — Short (15-30 second) clips of the pet playing, walking, or
   relaxing. Higher emotional impact than photos. Time To Pet limits to 20 seconds
   (a known complaint).

### Snout OS Status
- Check-in/check-out with GPS: EXISTS
- Visit reports with text: EXISTS
- Photo upload: PARTIAL (S3 exists, no inline camera flow)
- GPS walk map: PARTIAL (RouteMap component exists, not wired to client view)
- Health tracking: GAP (no structured health checklist per visit)
- Video clips: GAP (no video upload capability)

---

## THEME 2: COMMUNICATION WITHOUT CHASING

**What pet owners say:** "I shouldn't have to ask for an update. It should just come."

### Communication Pain Points

1. **Sitters who don't send updates** — The #1 complaint on Rover (1.2 stars on
   SmartCustomer). Owners left wondering if the visit happened at all.

2. **Scattered communication** — Updates via text, app messages, email, and phone.
   No single place to see everything about your pet's care.

3. **Delayed responses** — Owners ask a question and wait hours. For a pet with
   medication needs, this is unacceptable.

4. **No proactive alerts** — Owner finds out the sitter was late or missed a visit
   only when they manually check. No automatic "visit started" or "visit complete"
   notification.

### What Premium Communication Looks Like

- **Automatic "on my way" notification** when sitter leaves for the visit
- **"Visit started" notification** with timestamp when sitter checks in
- **Report delivered immediately** after visit ends (not hours later)
- **"Visit complete" notification** with summary, photos, and health check
- **Owner can message sitter** within the visit thread (not personal texts)
- **Emergency escalation** — if sitter doesn't check in within the expected
  window, owner is notified automatically

### Snout OS Status
- Visit started/completed notifications: EXISTS (check-in/out SSE + push)
- Automatic report delivery: EXISTS (visit report triggers notification)
- In-app messaging: EXISTS (client messages page, 8s polling)
- Emergency escalation: GAP (no "sitter didn't show up" auto-alert)
- "On my way" notification: GAP (no pre-arrival notification)

---

## THEME 3: TRUST AND VERIFICATION

**What pet owners say:** "How do I know this person is safe in my home?"

### Trust Destroyers (from Rover horror stories)

1. **No verification of experience** — Rover admits profiles are "not checked for
   truthfulness." Sitters claim experience they don't have.

2. **No accountability after incidents** — Rover's support is "completely
   unresponsive" after injuries/deaths. Owners get scripted emails.

3. **Platform liability dodge** — Both Rover and Wag's TOS say they aren't liable
   for sitter negligence. Owners feel unprotected.

4. **No way to verify the visit happened** — Without GPS tracking and timestamps,
   owners can't prove the sitter actually came.

### What Builds Trust

1. **Meet and greet before first booking** — 30-60 minute in-home meeting.
   Both owner and sitter evaluate the fit. The #1 trust-building action.

2. **Sitter performance scores visible to owner** — Not just star ratings.
   Reliability metrics: on-time rate, report completion rate, response time.

3. **Background check badge** — Visible indicator that the sitter has been
   verified. Even if the business owner handles this manually.

4. **Insurance and bonding disclosure** — Clear statement that the business
   carries liability insurance. Not buried in terms.

5. **Emergency vet authorization form** — Owner signs a form authorizing the
   sitter to seek emergency vet care. Stored in the system, accessible from
   the sitter's phone.

### Snout OS Status
- Meet and greet: EXISTS (/client/meet-greet request flow)
- SRS scores: EXISTS (but not currently visible to clients — owner-facing only)
- Background check badge: GAP (no verification badge system)
- Insurance disclosure: GAP (not in client-facing UI)
- Emergency vet auth: PARTIAL (emergency contacts stored on client profile,
  but no formal vet authorization form)

---

## THEME 4: EFFORTLESS BOOKING

**What pet owners say:** "I just want to book a walk. Why is this so complicated?"

### Booking Friction Points

1. **69% of pet parents aged 18-34 report issues booking appointments** (PetDesk
   2025 Research Report). This is the biggest demographic for pet care spending.

2. **78% believe booking at any time on any device is important** — Mobile booking
   is not optional. If the booking form doesn't work on a phone, they leave.

3. **Too many required fields** — Gingr's registration is described as "harrowing"
   with too many fields. Owners want: service type, date, done.

4. **No real-time availability** — Owner requests a date, waits for confirmation,
   gets told it's not available, starts over.

5. **Recurring booking complexity** — "I want the same walk every Tuesday and
   Thursday at 11 AM with the same walker." Setting this up should take one tap
   after the first booking, not a new form every week.

### What Premium Booking Looks Like

- **3-click booking**: Select service → pick date/time → confirm
- **Saved preferences**: "Book again" with one tap (same service, same sitter)
- **Real-time availability**: Calendar shows available slots before you pick
- **Recurring with one toggle**: "Make this weekly" checkbox on any booking
- **Waitlist**: "No slots available? Add me to the waitlist for this date."

### Snout OS Status
- Client self-booking: EXISTS (/client/bookings/new)
- "Book again" button: EXISTS (just added to booking detail)
- Recurring schedules: EXISTS (/client/recurring)
- Real-time availability: GAP (booking form doesn't show sitter availability)
- Waitlist: EXISTS (/waitlist routes)

---

## THEME 5: FINANCIAL TRANSPARENCY

**What pet owners say:** "I got charged and I don't know what it was for."

### Payment Pain Points

1. **Unclear pricing** — Owners don't understand why one visit costs more than
   another. Multi-pet surcharges, holiday rates, and after-hours fees are confusing.

2. **No price breakdown before booking** — Owner books, then sees the total.
   No itemized preview.

3. **Auto-charge surprise** — Card charged without clear advance notice.
   "I didn't know I'd be charged today."

4. **No receipt accessible from the app** — Owner needs to dig through email
   for Stripe receipts.

5. **Tipping awkwardness** — Owner wants to tip but the platform makes it
   complicated. Or the tip feature doesn't exist.

### Snout OS Status
- Pricing breakdown: EXISTS (pricingSnapshot on booking detail)
- Receipts: EXISTS (Stripe receipt link on completed bookings)
- Tipping: EXISTS (/tip/[amount]/[sitter] flow)
- Price preview before booking: PARTIAL (pricing engine calculates, but not
  always shown before confirmation)
- Auto-charge transparency: GAP (no "you will be charged on [date]" notification)

---

## THEME 6: THE PREMIUM PORTAL EXPERIENCE

**What pet owners say:** "I want this to feel like booking a restaurant, not
filling out a medical form."

### What Makes a Client Portal Feel Premium

1. **Beautiful visit reports** — Polished cards with photos, health status,
   and a personal note. Not a plain text email. Instagram-quality presentation.

2. **Pet profile with photos** — Owner sees their pet's profile with the cutest
   photo, health info, and care history. Feels personal.

3. **Timeline/history view** — "Show me everything that's happened with my pet
   this month." A scrollable timeline of visits, reports, photos, and milestones.

4. **Dark mode** — Yes, really. Pet parents check the app at night in bed.
   A bright white screen at 11 PM is jarring.

5. **Branded experience** — The portal should feel like the BUSINESS's brand,
   not a generic SaaS tool. Business name, colors, and tone of voice.

6. **Push notifications that feel personal** — "Luna had a great walk today!"
   not "Booking #4832 status: completed."

### Snout OS Status
- Visit reports with photos: EXISTS (client reports page with lightbox)
- Pet profiles: EXISTS (/client/pets with photo, species, breed, health log)
- Timeline view: GAP (no unified pet care timeline)
- Dark mode: GAP (theme system exists but dark mode stubbed)
- Branded experience: EXISTS (OrgBranding settings, theme tokens)
- Personal push notifications: PARTIAL (notifications exist but tone is
  system-generated, not personalized)

---

## THEME 7: EMERGENCY PREPAREDNESS

**What pet owners say:** "What happens if my dog has a seizure while I'm on a plane?"

### Emergency Needs

1. **Emergency vet authorization** — Pre-signed form authorizing the sitter to
   seek vet care up to a dollar limit. Stored digitally, accessible from phone.

2. **Emergency contact chain** — Owner → backup contact → business owner → vet.
   Automated escalation if one doesn't respond within 15 minutes.

3. **Pet medical info accessible to sitter** — Allergies, medications, vet phone
   number, nearest emergency clinic. One screen.

4. **Incident report with photos** — If something goes wrong, the sitter
   documents it immediately with photos and a structured form.

### Snout OS Status
- Emergency contacts: EXISTS (on client profile, with tap-to-call)
- Vet info: EXISTS (on pet detail page, vet name/phone)
- Incident report: EXISTS (IncidentReport model, POST endpoint)
- Emergency vet authorization: GAP (no digital authorization form)
- Automated escalation: GAP (no timed escalation chain)

---

## TOP 10 CLIENT FEATURES

Ranked by: Demand frequency x Differentiation from Rover/Wag/competitors

### 1. REAL-TIME VISIT PROOF (GPS + Photos + Timestamps) (Score: 10/10)
**Demand:** Every single pet owner review mentions wanting proof of care.
**Differentiation:** Rover has GPS and photos but hides them behind the sitter's initiative. Snout OS can make them AUTOMATIC and GUARANTEED.
**Proposal:** Automatic visit proof package: check-in GPS + timestamped photos (required, not optional) + GPS walk route + check-out GPS. Client receives a "Visit Card" within 60 seconds of check-out. No sitter effort required beyond tapping check-in/check-out and snapping 1-2 photos.

### 2. AUTOMATED VISIT NOTIFICATIONS (Score: 9/10)
**Demand:** "I shouldn't have to ask for an update" — universal complaint.
**Differentiation:** No competitor sends automatic lifecycle notifications across ALL channels (SMS + email + push + in-app). Rover sends some, Wag sends some, but none are comprehensive.
**Proposal:** Notification lifecycle: "Sitter on their way" (15 min before) → "Visit started" (check-in) → "Visit complete" (check-out) → "Visit Card ready" (report). Client chooses which they want. All channels. Zero sitter effort.

### 3. MEET AND GREET SCHEDULING (Score: 9/10)
**Demand:** The #1 trust-building action. Every professional pet care guide recommends it.
**Differentiation:** Rover has meet and greets but they're informal. No structured flow. No tracking. No outcome recording.
**Proposal:** Structured meet-and-greet flow: client requests → sitter accepts with time slots → calendar event created → after meeting, sitter notes "good fit" / "not a fit" / "needs follow-up" → client rating of sitter. Meet-and-greet completion is a trust signal shown on future bookings.

### 4. PET HEALTH CHECKLIST PER VISIT (Score: 8/10)
**Demand:** Owners of senior pets, diabetic pets, pets with anxiety. "Did they eat? Did they take their medication?"
**Differentiation:** No competitor has structured health tracking per visit. All use free-text notes.
**Proposal:** Per-visit health checklist: Ate (normal/less/more/refused), Drank (yes/no), Bathroom (normal/loose/none), Medication given (checkbox per med), Energy level (low/normal/high), Concerns (free text). One-tap checkboxes, takes 15 seconds. Client sees a clean health card, not a paragraph of text.

### 5. "BOOK AGAIN" WITH SAME SITTER (Score: 8/10)
**Demand:** "I want the same walker every time. My dog trusts her."
**Differentiation:** Rover makes you re-search and re-book. Snout OS can make it one tap.
**Proposal:** After a completed visit, client sees "Book again with [Sitter Name]" button. Pre-fills service, dates, and sitter preference. If sitter is available, instant confirmation. If not, shows next available slot or offers waitlist.

### 6. SITTER RELIABILITY VISIBLE TO CLIENT (Score: 8/10)
**Demand:** "How do I know this person shows up on time?"
**Differentiation:** Rover shows star ratings (easily gamed). Snout OS has SRS with 6 dimensions — none of which are currently visible to clients.
**Proposal:** Client-facing reliability card: On-time rate (%), Visit completion rate (%), Response time (average), Client rating (from other clients). Shown on the booking confirmation and sitter profile. Builds trust before the first visit.

### 7. UNIFIED PET CARE TIMELINE (Score: 7/10)
**Demand:** "Show me everything about my dog's care this month."
**Differentiation:** No competitor offers a chronological timeline of all care events. Each is siloed (bookings, reports, messages separately).
**Proposal:** /client/pets/[id]/timeline — scrollable feed: visit reports, health checks, photos, messages, medications given, vet visits, weight changes. Instagram-like cards. Filterable by date range. Shareable with vet or family members.

### 8. EMERGENCY VET AUTHORIZATION (Score: 7/10)
**Demand:** Every pet care professional guide recommends it. Pet Sitters International lists it in their 2025 Global Standards.
**Differentiation:** No software platform offers digital vet authorization. It's always a paper form.
**Proposal:** Digital emergency authorization form: client sets a dollar limit for vet care in their absence, signs digitally, stored on their profile. Sitter can show it to the vet on their phone. Business owner notified if vet auth is exercised. Peace of mind for everyone.

### 9. DARK MODE (Score: 7/10)
**Demand:** Pet parents check updates at night. "My screen blinds me at 11 PM."
**Differentiation:** No pet care platform offers dark mode. It's a free differentiation.
**Proposal:** Snout OS already has a theme system with 4 themes (snout, light, dark, snout-dark). The dark mode toggle is stubbed. Unstub it. Every component already uses design tokens that map to CSS variables. This is a design system toggle, not a rewrite.

### 10. PERSONALIZED NOTIFICATION TONE (Score: 6/10)
**Demand:** "Luna had a great walk today!" vs "Booking #4832 completed."
**Differentiation:** Every competitor sends generic system notifications. Personal tone is a differentiator.
**Proposal:** Use the pet's name in every notification: "[Pet name] just started their walk with [Sitter name]!" Template system with pet name interpolation. Optionally use AI daily delight tone (warm/playful/professional) for the visit completion message. Small effort, massive emotional impact.

---

## STRATEGIC INSIGHTS

### The Trust Ladder

Pet owners move through trust stages:
1. **Skeptical** → "I need to see proof this is real" (GPS, photos, timestamps)
2. **Testing** → "Let me try one visit and see" (meet and greet, trial visit)
3. **Comfortable** → "I trust this person with my keys" (recurring bookings)
4. **Loyal** → "I tell everyone about this service" (referral program)

Every feature should be mapped to a stage on this ladder. Features that
accelerate the skeptical→comfortable transition have the highest ROI.

### The Emotional vs Functional Divide

**Functional features** (booking, scheduling, payments) are table stakes.
Every competitor has them. They don't differentiate.

**Emotional features** (visit proof, personalized notifications, health
tracking, pet timeline) are where loyalty is built. Pet owners don't
switch providers because of a better booking form. They switch because
they FEEL more connected to their pet through the portal.

### The "Instagram for Pet Care" Positioning

The client portal should feel less like a business tool and more like
a social feed of their pet's daily life. Visit Cards with photos, health
summaries, and sitter notes — presented beautifully — make the owner
feel involved even when they're across the country.

---

## PROPOSALS ONLY — NO IMPLEMENTATION

This document contains pet owner community intelligence and proposals only.
Agent 36 (Feature Proposal Agent) should prioritize these against the
sitter wants (Agent 35) and competitor gaps (Agent 33).

Sources:
- [Rover Reviews — SmartCustomer (1.2 stars, 622 reviews)](https://www.smartcustomer.com/reviews/rover.com)
- [Rover Reviews — Trustpilot](https://www.trustpilot.com/review/rover.com)
- [Rover Horror Stories — Gizmodo](https://gizmodo.com/10-horror-stories-about-the-dog-sitting-app-rover-1851411920)
- [Rover BBB Complaints](https://www.bbb.org/us/wa/seattle/profile/pet-sitting/a-place-for-rover-inc-1296-22715424/complaints)
- [PetDesk 2025 Pet Parent Research Report](https://petdesk.com/pet-parent-research-report/)
- [BCG — Pet Owners Are Changing](https://www.bcg.com/publications/2025/pet-owners-changing-how-industry-respond)
- [APPA 2024 Dog and Cat Owner Insight Report](https://americanpetproducts.org/news/the-american-pet-products-association-appa-releases-2024-dog-and-cat-owner-insight-report)
- [Pet Sitters International — Global Standards 2025](https://www.petsit.com/standards)
- [Petme — Meet and Greet Guide](https://petme.social/pet-sitter-meet-and-greet-guide/)
- [Certapet — Pet Owner Separation Anxiety Survey](https://www.safewise.com/blog/8-pet-cameras-every-pet-owner-should-know-about/)
- [PetExec Owner Portal Features](https://www.petexec.net/features/owner-portal)
- [Equipaws — Same Pet Sitter Every Day](https://equipawspetservices.com/should-your-pet-have-the-same-pet-sitter-or-dog-walker-every-day/)
