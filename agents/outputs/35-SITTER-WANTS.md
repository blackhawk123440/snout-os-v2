# Agent 35 — Sitter Community Voice
# What Independent Pet Sitters and Dog Walkers Actually Want

Generated: 2026-03-29

Sources: Reddit (r/petsitting, r/dogwalkers), Pet Sitters International (petsit.com),
industry blogs (Six Figure Pet Sitting Academy, Jump Consulting, Pet Sitter Confessional),
software comparison sites, pet care business guides, community forums.

---

## THE SITTER'S DAY

Understanding what sitters need starts with understanding their day:

- **6:00 AM**: Wake up, check schedule on phone. Which dogs need morning walks?
- **6:30-9:00 AM**: First block of visits. 3-5 homes. Drive between each.
  At each stop: unlock door (lockbox? code? key?), leash up, walk, feed, clean,
  write report, take photos, lock up. Total time per visit: 30-60 min.
  Unpaid driving between: 10-20 min each.
- **9:00-11:00 AM**: Peak dog walking block. Pack walks or individual walks.
  Juggling multiple dogs, different routes, different client preferences.
- **11:00 AM-2:00 PM**: Gap. Lunch, admin time. This is when they do:
  invoicing, responding to new client inquiries, scheduling, updating availability.
- **2:00-6:00 PM**: Afternoon/evening visit block. After-work walks, feeding.
- **6:00-10:00 PM**: Overnight sits begin. Check-ins for boarding dogs.
- **Throughout the day**: Answering client texts, sending report photos,
  managing schedule changes, dealing with cancellations, chasing payments.

**The sitter's phone IS their office.** Everything that can't be done one-handed
with a dog leash in the other hand is friction.

---

## THEME 1: THE ADMIN TAX

**What sitters say:** "I got into this because I love animals, not because I love
doing paperwork at 10 PM."

### Time-Consuming Tasks (ranked by community complaints)

1. **Invoicing and chasing payments** — #1 complaint. Creating invoices manually,
   sending reminders, following up on late payments. Some sitters report spending
   2-4 hours/week on this alone.

2. **Scheduling coordination** — Back-and-forth with clients about dates, times,
   rescheduling. Multiple text threads across different platforms (iMessage, email,
   WhatsApp, the software's own chat).

3. **Visit reports** — Writing detailed notes + uploading photos after every visit.
   Clients expect it. Sitters find it tedious, especially when doing 6-8 visits/day.

4. **New client onboarding** — Getting all the info: pet names, vet info, feeding
   schedule, medications, access codes, emergency contacts. Often done via text
   messages and then manually entered into software.

5. **Tax prep** — Tracking mileage, categorizing expenses, calculating quarterly
   estimated taxes. Most sitters use a separate app (Stride, Everlance) because
   their pet care software doesn't do this.

### Snout OS Status
- Invoicing: automatic with booking creation. Payment links via Stripe.
- Scheduling: client self-service booking + owner confirmation workflow.
- Visit reports: sitter can file via `/sitter/bookings/[id]/report`.
- Onboarding: client setup wizard + pet profile creation.
- Tax prep: GAP — no mileage tracking, no expense categorization, no 1099 summary.

---

## THEME 2: MOBILE-FIRST OR NOTHING

**What sitters say:** "I'm standing in someone's kitchen with two dogs and a cat.
I need to check in, take a photo, and move to the next house in 60 seconds."

### What the Ideal Sitter Mobile Experience Looks Like

1. **One-tap check-in** — GPS auto-captured, timestamp recorded, owner notified.
   No forms. No confirmations. Just tap and it's done.

2. **Quick photo capture** — Snap photo → auto-attached to visit report → done.
   No upload screen, no progress bar, no "select from gallery" flow.

3. **Today view as the home screen** — "What visits do I have right now?" sorted
   by time, with one-tap navigation to each address (opens Maps).

4. **Offline capability** — Cell service is unreliable inside houses and apartment
   buildings. Check-in should work offline and sync when connected.

5. **Large touch targets** — Sitters are often wearing gloves (winter), holding
   leashes, or have wet hands. Buttons need to be BIG.

### Snout OS Status
- One-tap check-in: EXISTS (POST /api/bookings/[id]/check-in with GPS).
- Photo capture: PARTIAL (S3 upload exists, but no inline camera-to-report flow).
- Today view: EXISTS (/sitter/today with schedule, check-in/out buttons).
- Offline: EXISTS (PWA with Serwist, offline action queue, sync replay).
- Touch targets: DONE (44px minimum everywhere per design system).

---

## THEME 3: GETTING PAID RELIABLY

**What sitters say:** "I've been doing Mrs. Johnson's cats for three months and
she still hasn't paid the last two invoices. I feel awkward bringing it up."

### Financial Pain Points

1. **Late payments** — Clients forget, delay, or avoid paying. Sitters feel
   uncomfortable chasing money from people whose homes they enter daily.

2. **No pay-before-service option** — Sitters want the ability to require payment
   before the visit, not after. Eliminates the awkward collection conversation.

3. **Commission confusion** — For sitters working under a company (1099), the
   split is often unclear. "How much did I actually earn this week after the
   company's cut?"

4. **Tax estimation** — "How much should I set aside for quarterly taxes?"
   Sitters don't know until tax season, then get hit with a large bill.

5. **Payout delays** — Want to see earnings daily and get paid quickly, not
   wait for biweekly payroll runs. Instant payout is a Rover differentiator.

### Snout OS Status
- Automatic invoicing: EXISTS (booking creates invoice).
- Pay-before-service: PARTIAL (Stripe Checkout at booking, pay-first flow exists).
- Commission visibility: EXISTS (/sitter/earnings shows earnings per booking).
- Instant payout: EXISTS (POST /api/sitter/instant-payout via Stripe Connect).
- Tax estimation: GAP — no quarterly tax calculator or tax withholding feature.
- Mileage tracking: GAP — no automatic or manual mileage logging.

---

## THEME 4: CLIENT COMMUNICATION BOUNDARIES

**What sitters say:** "My phone buzzes at 11 PM with a client asking about tomorrow's
walk. I can't just ignore it but I also need sleep."

### Communication Issues

1. **Blurred personal/professional lines** — Clients text sitters' personal phones.
   No separation between work and life. Sitters can't "clock out."

2. **Scattered communication** — Same client sends texts, emails, app messages,
   and voicemails. Important info gets lost across channels.

3. **Repeat questions** — "What time are you coming?" "Did you feed the cat?"
   Questions that the software should answer automatically.

4. **Emergency vs routine** — No way to distinguish "my dog is having a seizure"
   from "can you also water the plants?"

### Snout OS Status
- Masked messaging: EXISTS (Twilio masked numbers, sitter personal number hidden).
- Centralized threads: EXISTS (MessageThread per client, all in one place).
- Auto-updates: EXISTS (check-in/out notifications, visit completion alerts).
- Emergency distinction: GAP — no message priority/urgency classification.

---

## THEME 5: THE LONELINESS FACTOR

**What sitters say:** "I see more dogs than humans most days. It's isolating."

### Community and Professional Development Needs

1. **Connection with other sitters** — Want to share tips, ask questions, feel
   part of a professional community. Currently relies on Facebook groups.

2. **Performance visibility** — "Am I doing well? How do I compare to others?
   What should I improve?" Sitters want feedback beyond client reviews.

3. **Career progression** — "What's my path? How do I go from doing 3 walks/day
   to running a team?" No clear trajectory in most platforms.

4. **Training and certification** — Want to level up skills (pet first aid,
   dog behavior, medication administration) with verifiable credentials.

### Snout OS Status
- Performance: EXISTS (SRS scoring, 6 dimensions, 30-day rolling window).
- Tier progression: EXISTS (Foundation → Reliant → Trusted → Preferred).
- Training: EXISTS (/sitter/training page, though content may be thin).
- Community features: GAP — no sitter-to-sitter communication or community.
- Career path visibility: PARTIAL (tier progression shows what to improve).

---

## THEME 6: KEY AND ACCESS MANAGEMENT

**What sitters say:** "I have 30 clients. That's 30 different lockbox codes,
garage door codes, alarm codes, and WiFi passwords. Where do I store all of this?"

### Access Information Needs

1. **Centralized, secure storage** — All access codes, key locations, alarm info
   in one searchable place, accessible from the field.

2. **Per-visit display** — When I arrive at a house, show me everything I need:
   door code, alarm disarm sequence, where the leash is, feeding instructions.

3. **Auto-hide sensitive info** — Don't show alarm codes on a screen that could
   be seen over my shoulder in public.

4. **Smart lock integration** — More clients are using smart locks with temporary
   codes. Software should integrate with Yale, August, etc.

### Snout OS Status
- Client home access: EXISTS (profile page stores lockbox, alarm, WiFi, entry
  instructions, parking — all fields present).
- Per-visit display: PARTIAL (booking detail shows client address + notes, but
  doesn't prominently surface access codes).
- Masked sensitive info: EXISTS (profile page uses show/hide for lockbox, alarm, WiFi).
- Smart lock integration: GAP — no integration with smart lock APIs.

---

## THEME 7: VISIT REPORTS THAT DON'T FEEL LIKE HOMEWORK

**What sitters say:** "Clients love the photos and updates. I love sending them.
I hate that it takes 10 minutes to write up each visit when I have 4 more houses
to get to."

### What Sitters Want in Reports

1. **Voice-to-text** — Dictate the report while walking to the car. Don't make
   me type on a tiny screen.

2. **Templates with quick-fill** — "Normal walk, good appetite, one poop, played
   in yard" as a one-tap template. Customize only the unusual stuff.

3. **Photo auto-attach** — Photos taken during the visit automatically attach to
   the report. No manual selection step.

4. **Health quick-checks** — Checkboxes: Ate normally? Drank water? Normal poop?
   Any concerns? Quick binary inputs instead of prose.

5. **Client-facing formatting** — The report the client sees should look polished
   even if the sitter just tapped a few checkboxes and snapped a photo.

### Snout OS Status
- Report filing: EXISTS (POST /api/sitter/bookings/[id]/report).
- AI daily delight: EXISTS (generateDailyDelight with tone options).
- Templates: GAP — no quick-fill templates or checklist-style reports.
- Voice-to-text: GAP — no speech-to-text integration.
- Photo auto-attach: GAP — photos are uploaded separately, not auto-linked.

---

## TOP 10 SITTER FEATURES

Ranked by: Demand frequency x Retention impact on sitter satisfaction

### 1. VISIT REPORT TEMPLATES WITH QUICK-FILL (Score: 10/10)
**Demand:** Every sitter doing 5+ visits/day mentions report fatigue.
**Retention:** Saves 30-60 min/day. The single biggest daily time sink after driving.
**Proposal:** Predefined templates: "Standard walk", "Feeding visit", "Overnight check".
Each has checkboxes (ate, drank, pooped, played) + one free-text "highlights" field +
photo slots. Client sees a polished card. Sitter spent 30 seconds.

### 2. PAY-BEFORE-SERVICE ENFORCEMENT (Score: 9/10)
**Demand:** Late payment is the #1 financial frustration. Sitters feel powerless.
**Retention:** Eliminates the awkward "please pay me" conversation. Removes cash flow anxiety.
**Proposal:** Per-client payment policy setting: "Require payment before visit" toggle.
When enabled, booking is not confirmed until Stripe payment clears. Sitter only sees
confirmed+paid visits on their today view. Zero ambiguity.

### 3. MILEAGE TRACKING + TAX ESTIMATION (Score: 9/10)
**Demand:** Every independent sitter uses a separate mileage app. "Tax season is a nightmare."
**Retention:** Platform becomes indispensable for business operations, not just scheduling.
**Proposal:** Auto-log mileage between check-out at one address and check-in at the next.
Running total visible on /sitter/earnings. Quarterly tax estimate based on income minus
standard mileage deduction. End-of-year 1099 summary export.

### 4. ONE-TAP CHECK-IN WITH AUTO-REPORT START (Score: 8/10)
**Demand:** Sitters want zero friction at the door. Check in → auto-start timer → auto-attach photos.
**Retention:** Reduces per-visit admin from 10 minutes to 2 minutes.
**Proposal:** Check-in button auto-starts a visit session. Any photos taken during the session
auto-attach to the report draft. Check-out auto-completes the report with timestamps and
prompts for quick-fill template completion.

### 5. ACCESS INFO ON ARRIVAL (Score: 8/10)
**Demand:** "Where's the lockbox code? Let me scroll through 5 screens to find it."
**Retention:** Reduces stress and errors at every single visit.
**Proposal:** When sitter taps "Navigate" on a booking → after arriving → show access
card: door code, alarm sequence, key location, WiFi password, pet feeding instructions.
One screen. All the info. Dismiss to check in.

### 6. EARNINGS DASHBOARD WITH REAL-TIME VISIBILITY (Score: 8/10)
**Demand:** "How much did I actually earn this week?" is asked daily. Especially for 1099 contractors.
**Retention:** Financial transparency builds trust with the platform and the business owner.
**Proposal:** /sitter/earnings shows: today's earnings (live), this week, this month, this year.
Breakdown per booking. Commission percentage visible. Pending payouts vs paid. Running total
for quarterly tax estimate.

### 7. COMMUNICATION BOUNDARIES (QUIET HOURS) (Score: 7/10)
**Demand:** Sitters burned out from 24/7 client texts. "I need to be able to clock out."
**Retention:** Prevents burnout, which is the #1 reason sitters leave the profession.
**Proposal:** Sitter sets "quiet hours" (e.g., 9 PM - 7 AM). During quiet hours:
client messages still arrive but sitter doesn't get push notifications. Auto-reply:
"Your sitter is off duty. For emergencies call [owner number]."

### 8. SCHEDULE OPTIMIZATION / ROUTE PLANNING (Score: 7/10)
**Demand:** Unpaid driving between visits is the hidden cost of the job. Sitters manually plan routes.
**Retention:** Saves 30-60 min/day in driving time. Directly increases hourly earnings.
**Proposal:** /sitter/today shows visits in optimized geographic order, not chronological order.
"Suggested route" with one-tap Maps launch for the full sequence. Estimated driving time
between stops. Owner sees route efficiency metrics.

### 9. PERFORMANCE FEEDBACK BEYOND RATINGS (Score: 7/10)
**Demand:** Sitters want to know they're doing well and how to improve. Currently a black box.
**Retention:** Recognition and growth paths are the #1 driver of long-term sitter engagement.
**Proposal:** Monthly performance summary pushed to /sitter/performance: "You completed 47
visits this month (up 12%). Your on-time rate is 94%. Clients rated you 4.8/5. You're 3 visits
away from advancing to Trusted tier." Specific, actionable, encouraging.

### 10. SMART SCHEDULING WITH BUFFER TIME (Score: 6/10)
**Demand:** Sitters get back-to-back bookings with no travel time. Shows up late, looks unprofessional.
**Retention:** Prevents the cascading lateness that ruins a sitter's entire day.
**Proposal:** When owner assigns bookings, system calculates driving time between consecutive
visits and warns if buffer is too tight. Sitter availability blocks automatically include
travel buffer. "You need 15 min between the Johnson and Smith visits based on driving distance."

---

## STRATEGIC INSIGHTS

### The Sitter Retention Equation

Sitter retention = (Earnings visibility + Professional growth + Work-life boundaries)
                   / (Admin burden + Payment anxiety + Burnout risk)

Every feature that reduces the denominator or increases the numerator directly
improves retention. The top 3 features (#1 report templates, #2 pay enforcement,
#3 mileage tracking) all attack the denominator.

### The Platform Lock-In Insight

Pet care software typically locks in the OWNER (who pays the subscription).
But the sitter is the one who uses the software 8 hours/day. If sitters love
Snout OS, they'll refuse to work for businesses using competing platforms.
**Sitter satisfaction is the moat.**

### The "Stripe for Pet Care" Positioning

Snout OS's stated mission is "become the infrastructure layer that ANY pet care
business cannot operate without." The sitter financial features (#2, #3, #6)
are the path to this. When Snout OS handles a sitter's entire financial life
(earnings, payouts, mileage, tax estimation), switching costs become enormous.

---

## PROPOSALS ONLY — NO IMPLEMENTATION

This document contains sitter community intelligence and proposals only.
Agent 36 (Feature Proposal Agent) should prioritize these against the
competitor gaps from Agent 33.
Agent 37 (Visionary Architect) should design the mileage tracking and
report template systems.

Sources:
- [Pet Sitters International — Industry Stats](https://www.petsit.com/industry-stats-and-facts)
- [Time To Pet — Key Management Guide](https://www.timetopet.com/blog/key-management-for-pet-sitters-and-dog-walking)
- [Avoiding Pet Sitter Burnout — Hands N Paws](https://www.myhandsnpaws.com/avoiding-burnout-as-a-pet-sitter-and-dog-walker-in-columbus-ohio/)
- [How to Schedule Pet Sitting Staff — Pet Sitter Course](https://petsittercourse.com/blog/how-to-schedule-pet-sitters/)
- [Jump Consulting — 7 Common Problems Starting a Pet Sitting Business](https://jumpconsulting.net/starting-a-pet-sitting-business/)
- [Pet Sitter Plus — Client Communication](https://www.petsitterplus.com/client-communication)
- [Pet Sitter Plus — How to Get Paid on Time](https://www.petsitterplus.com/post/how-to-get-paid-on-time)
- [Time To Pet — How Much Do Dog Walkers Make](https://www.timetopet.com/blog/how-much-do-dog-walkers-make)
- [Stride — Dog Walker Tax Write-offs](https://blog.stridehealth.com/post/dog-walker-sitter-tax-write-offs)
- [Rover-Time — An Honest Look at Being a Dog Walker](https://www.rover-time.com/honest-look-dog-walker/)
- [The Pet Lady — Day in the Life](https://www.thepetladyltd.com/blog/a-day-in-the-life-of-a-pet-sitter)
- [Wag Walking — Writing the Pawfect Report Card](https://wagwalking.com/daily/pet-caregiving-101-writing-the-pawfect-report-card)
- [Six Figure Pet Sitting Academy — Is Your Business Killing You?](https://www.sixfigurepetsittingacademy.com/blog/2015/06/is-your-pet-sitting-and-dog-walking-business-killing-you/)
- [Pet Sitting Do's and Don'ts 2024 — Easy Busy Pets](https://easybusypets.com/blog/pet-sitting-dos-and-donts-in-2024)
