# Agent 37 --- Vision Roadmap
# Technical Implementation Plan for 15 Approved Proposals

**Generated:** 2026-03-29
**Status:** Approved for execution
**Timeline:** 12 weeks (3 months)
**Repo:** /Users/leahhudson/Desktop/final form/snout-os/

---

## PHASE 1: QUICK WINS (Weeks 1-2)

These five proposals require zero new Prisma models, minimal API surface, and can ship independently. They build user trust and visible momentum before the heavier phases.

---

### Proposal #1: Dark Mode Toggle

**Summary:** Expose the already-functional theme system to users through a visible toggle in the command bar and a settings page control.

#### 1. DATA MODEL CHANGES

None. Theme preference is stored in `localStorage` under key `snout-theme`. No server-side persistence required in Phase 1.

Future consideration: add `themePreference` field to `UserSettings` model if cross-device sync is requested.

#### 2. API ROUTES

None required. This is entirely client-side.

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| All | `src/lib/theme-context.tsx` | Verify `ThemeProvider` reads/writes `localStorage('snout-theme')` and applies CSS class `.theme-{value}` to `document.documentElement` |
| All | `src/commands/commands.tsx` (line ~474) | Replace stub with functional `toggleTheme()` that cycles: `snout` -> `dark` -> `light` -> `snout-dark` -> `snout` |
| All | `src/components/ui/ThemeToggle.tsx` (NEW) | Dropdown or segmented control: 4 options with preview swatches. Imports `useTheme()` from theme-context |
| All | `src/components/layout/TopBar.tsx` or equivalent shell | Mount `<ThemeToggle />` in the top-right actions area, next to user avatar |
| Settings | `/settings/appearance` section | Full theme picker with live preview panel showing sample cards in each theme |

#### 4. QUEUE JOBS

None.

#### 5. DEPENDENCIES

- None. Fully self-contained.

#### 6. BUILD SEQUENCE

1. Confirm `ThemeProvider` in `src/lib/theme-context.tsx` exposes `{ theme, setTheme }` and persists to localStorage.
2. Create `src/components/ui/ThemeToggle.tsx` with dropdown rendering 4 theme options.
3. Wire `ThemeToggle` into the app shell top bar.
4. Remove stub code at `src/commands/commands.tsx:474` and replace with call to `setTheme()`.
5. Add theme picker section to settings appearance page.
6. Test: toggle each theme, refresh page (persistence), open new tab (persistence).

---

### Proposal #2: Personalized Notifications (Pet Names)

**Summary:** Add `{{petNames}}` template variable to all notification templates so clients receive messages like "Walkies for Luna and Max confirmed!" instead of generic text.

#### 1. DATA MODEL CHANGES

None. Pet names are already available on `booking.pets` relation. The change is in the template rendering pipeline.

#### 2. API ROUTES

None. Notification rendering is internal.

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Admin | Notification template editor (if exists) | Document `{{petNames}}` as available variable |

#### 4. QUEUE JOBS

No new jobs. Modify existing notification rendering in the automation executor.

#### 5. DEPENDENCIES

- None.

#### 6. BUILD SEQUENCE

1. In `src/lib/notifications/triggers.ts`, locate every trigger function that builds a template context object (the object containing `firstName`, `service`, `datesTimes`, etc.).
2. For each trigger, resolve the booking's pets relation: `booking.pets.map(p => p.name)`.
3. Build the `petNames` variable:
   - 1 pet: `"Luna"`
   - 2 pets: `"Luna and Max"`
   - 3+ pets: `"Luna, Max, and Bella"`
4. Add `petNames` to the template context object passed to the renderer.
5. In `src/lib/automation-executor.ts`, ensure the template interpolation handles `{{petNames}}`.
6. Update all default notification templates to include `{{petNames}}` where contextually appropriate (booking confirmations, reminders, visit reports).
7. Test: create booking with 1 pet, 2 pets, 3 pets --- verify notification text renders correctly.

Helper function to add (in `src/lib/notifications/utils.ts` or similar):

```typescript
export function formatPetNames(pets: { name: string }[]): string {
  if (pets.length === 0) return '';
  if (pets.length === 1) return pets[0].name;
  if (pets.length === 2) return `${pets[0].name} and ${pets[1].name}`;
  const last = pets[pets.length - 1].name;
  const rest = pets.slice(0, -1).map(p => p.name).join(', ');
  return `${rest}, and ${last}`;
}
```

---

### Proposal #3: Access Info Card at Sitter Check-In

**Summary:** When a sitter taps "Start Visit," display a card with the client's lockbox code, door alarm code, WiFi credentials, entry instructions, parking notes, and key location.

#### 1. DATA MODEL CHANGES

None. All fields already exist on the `Client` model:
- `lockboxCode: String?`
- `doorAlarmCode: String?`
- `wifiNetwork: String?`
- `wifiPassword: String?`
- `entryInstructions: String?`
- `parkingNotes: String?`
- `keyLocation: String?`

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sitter/bookings/[id]/access-info` | Sitter (must be assigned to booking) | Returns access info fields for the booking's client |

**Response shape:**

```json
{
  "lockboxCode": "1234",
  "doorAlarmCode": "5678#",
  "wifiNetwork": "SmithHome",
  "wifiPassword": "password123",
  "entryInstructions": "Use the side gate, key under the blue pot",
  "parkingNotes": "Driveway is fine, don't block the mailbox",
  "keyLocation": "Under the blue pot by the side gate",
  "emergencyVetAuth": null
}
```

**Auth check:** Verify `sitterId` on the booking matches the authenticated user. Return 403 otherwise.

**Privacy:** Only serve this data when the booking is within 30 minutes of its start time or currently in progress. Return 403 with `{ error: "Access info available 30 minutes before visit start" }` otherwise.

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/components/sitter/AccessInfoCard.tsx` (NEW) | Card component displaying all access fields with copy-to-clipboard on codes/passwords |
| Sitter | `src/app/sitter/today/page.tsx` | After "Start Visit" tap, show `<AccessInfoCard />` in a modal or expanded section |
| Sitter | `src/app/sitter/bookings/[id]/page.tsx` | Show `<AccessInfoCard />` when booking is active (checked in but not checked out) |

#### 4. QUEUE JOBS

None.

#### 5. DEPENDENCIES

- None for base implementation.
- Proposal #15 (Emergency Vet Authorization) will add an `emergencyVetAuth` section to this card later.

#### 6. BUILD SEQUENCE

1. Create API route `src/app/api/sitter/bookings/[id]/access-info/route.ts` with GET handler.
2. Implement auth check: booking must belong to sitter, booking must be within 30-min window or active.
3. Query client access fields from the booking's client relation.
4. Create `src/components/sitter/AccessInfoCard.tsx` --- renders each non-null field in a labeled row, with clipboard copy buttons for codes and passwords.
5. Integrate into sitter today page: after check-in action, display AccessInfoCard.
6. Integrate into sitter booking detail: show AccessInfoCard when booking status is `IN_PROGRESS`.
7. Test: verify 403 when >30 min before visit, verify fields render, verify copy-to-clipboard.

---

### Proposal #4: "On My Way" Notification

**Summary:** Add an "On My Way" button to sitter booking cards that appears 30 minutes before visit start time. Tapping it sends the client a push/SMS: "[Sitter name] is on their way to [Pet name]!"

#### 1. DATA MODEL CHANGES

Add field to `Booking` model:

```prisma
model Booking {
  // ... existing fields ...
  onMyWaySentAt  DateTime?  // null = not sent, timestamp = sent at
}
```

**Migration:** `ALTER TABLE "Booking" ADD COLUMN "onMyWaySentAt" TIMESTAMP;`

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sitter/bookings/[id]/on-my-way` | Sitter (assigned to booking) | Marks sitter as en route, triggers notification |

**Request:** Empty body.

**Response:**

```json
{
  "success": true,
  "sentAt": "2026-03-29T14:30:00Z"
}
```

**Validation:**
- Booking must belong to authenticated sitter.
- Booking start time must be within 30 minutes from now (not earlier than 30 min before, not after start).
- `onMyWaySentAt` must be null (prevent duplicate sends).

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/app/sitter/today/page.tsx` | Add "On My Way" button to each booking card. Visible when: `now >= booking.startTime - 30min AND now <= booking.startTime AND !booking.onMyWaySentAt`. After tap: button changes to "Notified at {time}" (disabled). |
| Client | Push notification / SMS | Receives: "[Sitter name] is on their way to [Pet name]!" |

#### 4. QUEUE JOBS

No new queue job needed. The POST handler calls `notifyClientSitterOnMyWay()` synchronously (fast, single notification).

If latency becomes a concern, wrap in a BullMQ job: `sitter.onMyWay` queue.

#### 5. DEPENDENCIES

- Proposal #2 (pet name formatting) --- uses `formatPetNames()` helper for the notification message.
- Existing notification infrastructure in `src/lib/notifications/triggers.ts`.

#### 6. BUILD SEQUENCE

1. Add `onMyWaySentAt DateTime?` to Booking model in `schema.prisma`.
2. Run `npx prisma migrate dev --name add-booking-on-my-way-sent-at`.
3. Create trigger function `notifyClientSitterOnMyWay(booking)` in `src/lib/notifications/triggers.ts`:
   - Template: `"{{sitterFirstName}} is on their way to {{petNames}}!"`
   - Deliver via existing push + SMS channels.
4. Create API route `src/app/api/sitter/bookings/[id]/on-my-way/route.ts`.
5. In sitter today page, add "On My Way" button with visibility logic based on time window and `onMyWaySentAt` state.
6. After tap: call POST, update local state to show "Notified" confirmation.
7. Test: verify button visibility timing, verify notification delivery, verify idempotency (second tap blocked).

---

### Proposal #9: Client-Facing Sitter Reliability Score

**Summary:** Show clients a human-readable trust indicator for their assigned sitter, derived from the existing SRS engine. Display tier name and 2-3 plain-language statements --- never raw numeric scores.

#### 1. DATA MODEL CHANGES

None. The `SitterTierSnapshot` model already stores `rolling30dScore` and tier classification. The SRS engine at `src/lib/tiers/srs-engine.ts` already computes 6 dimensions.

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client/sitters/[id]/reliability` | Client (must have a booking with this sitter) | Returns tier name + human-readable statements |

**Response shape:**

```json
{
  "tierName": "Trusted",
  "statements": [
    "Consistently arrives on time",
    "Sends detailed visit reports",
    "Highly rated by other pet parents"
  ],
  "memberSince": "2025-06-15"
}
```

**Privacy rules:**
- Never expose raw numeric scores (0-100).
- Never expose individual dimension breakdowns.
- Client must have at least one booking (any status) with this sitter. Return 403 otherwise.

**Statement generation logic** (map from SRS dimensions to human language):

| Dimension | Score >= 80 Statement | Score >= 60 Statement | Score < 60 Statement |
|-----------|-----------------------|-----------------------|----------------------|
| punctuality | "Consistently arrives on time" | "Generally punctual" | (omit) |
| reportQuality | "Sends detailed visit reports" | "Provides visit updates" | (omit) |
| clientRating | "Highly rated by other pet parents" | "Well reviewed by clients" | (omit) |
| consistency | "Very reliable with scheduling" | "Dependable availability" | (omit) |
| responsiveness | "Quick to respond to messages" | "Responsive communicator" | (omit) |
| retention | "Trusted by long-term clients" | "Building strong relationships" | (omit) |

Select the top 3 statements where score >= 60. If fewer than 3 qualify, show what qualifies (minimum 1 for any tiered sitter).

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Client | `src/components/client/SitterReliabilityBadge.tsx` (NEW) | Compact badge: tier icon + tier name (e.g., shield icon + "Trusted") |
| Client | `src/components/client/SitterReliabilityCard.tsx` (NEW) | Expandable card: tier badge + 2-3 statement pills + "Member since" date |
| Client | `src/app/client/bookings/[id]/page.tsx` | Mount `<SitterReliabilityCard />` in the sitter info section |

#### 4. QUEUE JOBS

None. Reads existing snapshot data.

#### 5. DEPENDENCIES

- Existing SRS engine at `src/lib/tiers/srs-engine.ts`.
- Existing `SitterTierSnapshot` model.

#### 6. BUILD SEQUENCE

1. Create utility `src/lib/tiers/srs-statements.ts` --- maps SRS dimension scores to human-readable statements using the table above.
2. Create API route `src/app/api/client/sitters/[id]/reliability/route.ts`.
3. Implement auth: verify client has a booking with this sitter.
4. Query latest `SitterTierSnapshot` for the sitter, run through statement mapper, return top 3.
5. Create `SitterReliabilityBadge.tsx` (compact) and `SitterReliabilityCard.tsx` (expanded).
6. Mount card on client booking detail page.
7. Test: verify different tiers produce correct statements, verify raw scores never leak, verify 403 for unrelated client.

---

## PHASE 2: DIFFERENTIATION LAYER (Weeks 3-6)

These proposals add substantial new functionality that differentiates Snout OS from competitors. They involve new Prisma models, new pages, and cross-cutting integrations.

---

### Proposal #5: Gingr/PetExec Migration Import Tool

**Summary:** Allow new customers to import their existing client, pet, sitter, and booking data from competitor platforms (PetExec, Gingr, Time To Pet) via CSV upload.

#### 1. DATA MODEL CHANGES

```prisma
model ImportJob {
  id            String         @id @default(cuid())
  orgId         String
  org           Organization   @relation(fields: [orgId], references: [id])
  sourceSystem  String         // 'petexec' | 'gingr' | 'timetopet' | 'generic'
  status        String         @default("pending") // 'pending' | 'mapping' | 'previewing' | 'importing' | 'completed' | 'failed'
  fileName      String
  fileUrl       String         // S3 path to uploaded CSV
  totalRows     Int            @default(0)
  processedRows Int            @default(0)
  createdRows   Int            @default(0)
  skippedRows   Int            @default(0)
  errorRows     Int            @default(0)
  columnMapping Json?          // user-confirmed column-to-field mapping
  errors        Json?          // array of { row, field, message }
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  completedAt   DateTime?
  createdBy     String
}

model ImportRow {
  id          String    @id @default(cuid())
  importJobId String
  importJob   ImportJob @relation(fields: [importJobId], references: [id], onDelete: Cascade)
  rowNumber   Int
  rawData     Json      // original CSV row as key-value
  mappedData  Json?     // after column mapping applied
  entityType  String    // 'client' | 'pet' | 'sitter' | 'booking'
  status      String    @default("pending") // 'pending' | 'created' | 'skipped' | 'error'
  errorMessage String?
  createdEntityId String? // ID of the created record
  createdAt   DateTime  @default(now())

  @@index([importJobId, status])
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/import/upload` | Admin | Upload CSV file, create ImportJob |
| GET | `/api/admin/import/[jobId]` | Admin | Get import job status and summary |
| POST | `/api/admin/import/[jobId]/map-columns` | Admin | Save column mapping |
| GET | `/api/admin/import/[jobId]/preview` | Admin | Preview first 20 rows with mapped data |
| POST | `/api/admin/import/[jobId]/execute` | Admin | Start import execution |
| GET | `/api/admin/import/[jobId]/errors` | Admin | Get error rows with details |
| DELETE | `/api/admin/import/[jobId]/rollback` | Admin | Delete all created entities from this import |

**POST /upload request:** `multipart/form-data` with `file` (CSV) and `sourceSystem` field.

**POST /map-columns request:**
```json
{
  "mapping": {
    "First Name": "firstName",
    "Last Name": "lastName",
    "Email Address": "email",
    "Phone": "phone",
    "Pet Name": "petName",
    "Pet Breed": "petBreed"
  }
}
```

**GET /preview response:**
```json
{
  "rows": [
    {
      "rowNumber": 1,
      "raw": { "First Name": "Jane", "Email Address": "jane@example.com" },
      "mapped": { "firstName": "Jane", "email": "jane@example.com" },
      "entityType": "client",
      "issues": []
    }
  ],
  "totalRows": 342,
  "entityBreakdown": { "client": 120, "pet": 180, "sitter": 12, "booking": 30 }
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Admin | `src/app/admin/settings/import/page.tsx` (NEW) | Main import page |
| Admin | `src/components/admin/import/ImportUploader.tsx` (NEW) | Drag-drop CSV upload with source system selector |
| Admin | `src/components/admin/import/ColumnMapper.tsx` (NEW) | Two-column UI: CSV headers on left, Snout OS fields on right, drag to map |
| Admin | `src/components/admin/import/ImportPreview.tsx` (NEW) | Table showing first 20 mapped rows with validation highlights |
| Admin | `src/components/admin/import/ImportProgress.tsx` (NEW) | Progress bar with live counts: created/skipped/errors |
| Admin | `src/components/admin/import/ImportErrors.tsx` (NEW) | Error table with row number, field, message, raw data |

#### 4. QUEUE JOBS

| Queue | Job Name | Description |
|-------|----------|-------------|
| `import` | `import.execute` | Process ImportJob row by row. Batch size: 50 rows per tick. |

**Job logic:**
1. Read batch of 50 `ImportRow` records where `status = 'pending'`.
2. For each row, apply column mapping, validate required fields, check for duplicates (match on `email` or `phone`).
3. If duplicate found: skip row, set status `skipped`, store reason.
4. If valid: create entity (Client, Pet, Sitter, or Booking), set status `created`, store `createdEntityId`.
5. If error: set status `error`, store `errorMessage`.
6. Update `ImportJob.processedRows`, `createdRows`, `skippedRows`, `errorRows`.
7. If all rows processed: set `ImportJob.status = 'completed'`, set `completedAt`.

#### 5. DEPENDENCIES

- S3 storage for CSV uploads (existing).
- BullMQ for job processing (existing).
- No dependency on other proposals.

#### 6. BUILD SEQUENCE

1. Add `ImportJob` and `ImportRow` models to `schema.prisma`. Run migration.
2. Create known column mappings for each source system in `src/lib/import/column-maps.ts`:
   - PetExec standard export columns.
   - Gingr standard export columns.
   - Time To Pet standard export columns.
3. Create `src/lib/import/validators.ts` --- validate mapped rows against required fields per entity type.
4. Create `src/lib/import/deduplicator.ts` --- check for existing records by email or phone.
5. Create upload API route with S3 storage and CSV parsing (use `csv-parse` library).
6. Create column mapping API route.
7. Create preview API route (parse first 20 rows, apply mapping, run validation).
8. Create BullMQ job `import.execute` in `src/jobs/import-execute.ts`.
9. Create execute API route (enqueues job).
10. Create error and rollback API routes.
11. Build UI components: ImportUploader, ColumnMapper, ImportPreview, ImportProgress, ImportErrors.
12. Build settings/import page assembling all components in a stepper flow.
13. Test: upload PetExec sample CSV, map columns, preview, execute, verify entities created, verify deduplication, test rollback.

---

### Proposal #6: Visit Report Quick-Fill Templates

**Summary:** Replace free-text visit reports with structured quick-select categories, then optionally AI-expand selections into a polished narrative paragraph.

#### 1. DATA MODEL CHANGES

```prisma
model ReportTemplate {
  id         String   @id @default(cuid())
  orgId      String
  org        Organization @relation(fields: [orgId], references: [id])
  category   String   // 'eating' | 'bathroom' | 'energy' | 'mood' | 'medication' | 'highlights'
  label      String   // display text, e.g. "Ate everything"
  sortOrder  Int      @default(0)
  isDefault  Boolean  @default(false) // seeded by system
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([orgId, category, label])
  @@index([orgId, category, isActive])
}

model VisitReportEntry {
  id          String   @id @default(cuid())
  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])
  category    String
  selectedLabel String  // the quick-select option chosen
  freeText    String?  // optional additional note for this category
  createdAt   DateTime @default(now())

  @@index([bookingId])
}
```

Also add to `Booking` model (or existing report model):

```prisma
model Booking {
  // ... existing fields ...
  aiExpandedReport  String?  // AI-generated polished paragraph from selections
  reportEntries     VisitReportEntry[]
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/org/report-templates` | Admin, Sitter | List templates by category for the org |
| POST | `/api/org/report-templates` | Admin | Create custom template option |
| PUT | `/api/org/report-templates/[id]` | Admin | Update template option |
| DELETE | `/api/org/report-templates/[id]` | Admin | Soft-delete (set isActive=false) |
| POST | `/api/sitter/bookings/[id]/report` | Sitter | Submit structured report (replaces existing free-text endpoint) |
| POST | `/api/sitter/bookings/[id]/report/expand` | Sitter | AI-expand selections into narrative |

**POST /report request:**
```json
{
  "entries": [
    { "category": "eating", "selectedLabel": "Ate everything", "freeText": null },
    { "category": "bathroom", "selectedLabel": "Normal (#1 and #2)", "freeText": null },
    { "category": "energy", "selectedLabel": "High energy", "freeText": "Zoomies in the backyard" },
    { "category": "mood", "selectedLabel": "Happy and playful", "freeText": null },
    { "category": "medication", "selectedLabel": "Medication given on time", "freeText": null },
    { "category": "highlights", "selectedLabel": "Great walk", "freeText": "We went to the dog park and she played fetch for 20 minutes" }
  ],
  "aiExpand": true
}
```

**POST /report/expand request:**
```json
{
  "entries": [
    { "category": "eating", "selectedLabel": "Ate everything" },
    { "category": "energy", "selectedLabel": "High energy", "freeText": "Zoomies in the backyard" }
  ],
  "petNames": ["Luna"],
  "sitterFirstName": "Sarah"
}
```

**POST /report/expand response:**
```json
{
  "expandedText": "Luna had a wonderful visit today! She ate all of her food with enthusiasm and was full of energy -- we even got some great zoomies in the backyard. She's a happy girl!"
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/components/sitter/ReportQuickFill.tsx` (NEW) | Category accordion with pill-select options per category. Tap a pill to select. Optional free-text input under each category. |
| Sitter | `src/components/sitter/ReportPreview.tsx` (NEW) | Shows AI-expanded narrative with "Regenerate" button. Sitter can edit before submitting. |
| Sitter | Sitter check-out flow | Replace free-text report textarea with `<ReportQuickFill />` component |
| Admin | `/admin/settings/report-templates` (NEW section) | Manage quick-fill options per category. Add/edit/disable options. |
| Client | Booking detail page | Display structured report with AI-expanded narrative |

**Default template options to seed:**

| Category | Options |
|----------|---------|
| eating | "Ate everything", "Ate most of it", "Ate about half", "Picked at food", "Didn't eat" |
| bathroom | "Normal (#1 and #2)", "#1 only", "#2 only", "No bathroom", "Accident inside" |
| energy | "High energy", "Normal energy", "Low energy", "Sleepy/resting" |
| mood | "Happy and playful", "Calm and relaxed", "Anxious or nervous", "Shy/timid" |
| medication | "Medication given on time", "Medication refused", "No medication needed" |
| highlights | "Great walk", "Played fetch", "Good socialization", "Training practice", "Cuddle time" |

#### 4. QUEUE JOBS

None. AI expansion is synchronous via `governed-call` (existing AI invocation wrapper). If latency becomes an issue, move to a BullMQ job with polling.

#### 5. DEPENDENCIES

- Existing AI governed-call infrastructure for report expansion.
- No dependency on other proposals, but #7 (Visit Card) and #8 (Health Checklist) will consume report data.

#### 6. BUILD SEQUENCE

1. Add `ReportTemplate` and `VisitReportEntry` models to `schema.prisma`. Add `aiExpandedReport` and `reportEntries` relation to Booking. Run migration.
2. Create seed script `src/lib/import/seed-report-templates.ts` to populate default options per org.
3. Create CRUD API routes for report templates.
4. Create `src/lib/reports/ai-expand.ts` --- takes structured entries + pet/sitter context, calls governed-call with prompt to generate polished paragraph.
5. Update POST `/api/sitter/bookings/[id]/report` to accept structured entries, create `VisitReportEntry` records, optionally call AI expand.
6. Create `/report/expand` API route for standalone expansion.
7. Build `ReportQuickFill.tsx` --- accordion per category, pill selection, free-text inputs.
8. Build `ReportPreview.tsx` --- shows expanded text, allows edit and regenerate.
9. Replace sitter check-out report flow with new components.
10. Update client booking detail to display structured report with narrative.
11. Build admin template management UI.
12. Test: complete report flow end-to-end, test AI expansion with various combinations, test custom template management.

---

### Proposal #7: Real-Time Visit Proof (Visit Card)

**Summary:** After a sitter checks out, automatically assemble a "Visit Card" containing a map thumbnail, photos, timestamps, duration, health checklist, and sitter note. Push the card link to the client.

#### 1. DATA MODEL CHANGES

```prisma
model VisitCard {
  id              String    @id @default(cuid())
  bookingId       String    @unique
  booking         Booking   @relation(fields: [bookingId], references: [id])
  orgId           String
  org             Organization @relation(fields: [orgId], references: [id])
  checkInAt       DateTime
  checkOutAt      DateTime
  durationMinutes Int
  checkInLat      Float?
  checkInLng      Float?
  checkOutLat     Float?
  checkOutLng     Float?
  mapThumbnailUrl String?   // S3 path to static map image
  photoUrls       Json      // string array of S3 photo URLs
  healthCheckData Json?     // snapshot of VisitHealthCheck data (from #8)
  reportSummary   String?   // AI-expanded report text or raw text
  sitterNote      String?
  isPublished     Boolean   @default(false) // true after assembly complete
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([orgId, bookingId])
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client/visits/[bookingId]` | Client (booking must belong to client) | Get visit card data |
| GET | `/api/sitter/bookings/[id]/visit-card` | Sitter (assigned to booking) | Get visit card for review before publishing |
| POST | `/api/internal/visit-cards/assemble` | Internal (called by queue job) | Assemble visit card after check-out |

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Client | `src/app/client/visits/[bookingId]/page.tsx` (NEW) | Full visit card page |
| Client | `src/components/client/VisitCard.tsx` (NEW) | Card layout: map at top, photo grid, timestamps row, health checklist section, report narrative, sitter note |
| Client | `src/components/client/VisitCardMap.tsx` (NEW) | Static map thumbnail with check-in/check-out pins |
| Client | `src/components/client/VisitCardPhotos.tsx` (NEW) | Photo gallery with lightbox |
| Client | Push notification | "Your visit report for [Pet name] is ready! Tap to view." with deep link to `/client/visits/[bookingId]` |
| Sitter | `src/app/sitter/bookings/[id]/page.tsx` | Link to view assembled visit card after check-out |

#### 4. QUEUE JOBS

| Queue | Job Name | Description |
|-------|----------|-------------|
| `visit-card` | `visit-card.assemble` | Triggered on check-out. Assembles the VisitCard record. |

**Job logic:**
1. Receive `{ bookingId }`.
2. Load booking with relations: client, sitter, pets, photos, GPS data, report entries, health checks.
3. Calculate duration from check-in/check-out timestamps.
4. Generate static map thumbnail using Google Static Maps API (check-in pin + check-out pin + route if available). Upload to S3.
5. Collect photo URLs from booking.
6. Snapshot health checklist data from `VisitHealthCheck` (if Proposal #8 is shipped).
7. Get report summary (AI-expanded text from Proposal #6, or raw text).
8. Create `VisitCard` record with `isPublished = true`.
9. Trigger push notification to client with visit card link.

#### 5. DEPENDENCIES

- **Proposal #6** (Visit Report Quick-Fill): report summary data. If #6 not shipped, fall back to raw report text.
- **Proposal #8** (Pet Health Checklist): health check data. If #8 not shipped, omit health section from card.
- Existing: GPS capture, S3 photo storage, RouteMap component, BullMQ.
- Optional: Google Static Maps API for map thumbnail (new env var `GOOGLE_MAPS_API_KEY`, shared with #11/#13).

#### 6. BUILD SEQUENCE

1. Add `VisitCard` model to `schema.prisma`. Run migration.
2. Create `src/lib/visit-card/assembler.ts` --- logic to gather all data and build the VisitCard record.
3. Create `src/lib/visit-card/map-thumbnail.ts` --- generates static map image URL or uploads rendered map to S3.
4. Create BullMQ job `visit-card.assemble` in `src/jobs/visit-card-assemble.ts`.
5. Hook job trigger into the existing check-out flow (after check-out succeeds, enqueue `visit-card.assemble`).
6. Create GET API route for client visit card.
7. Create GET API route for sitter visit card review.
8. Build `VisitCard.tsx`, `VisitCardMap.tsx`, `VisitCardPhotos.tsx` components.
9. Build client visit card page at `/client/visits/[bookingId]`.
10. Add notification trigger `notifyClientVisitCardReady(booking)` to `src/lib/notifications/triggers.ts`.
11. Test: complete a full visit (check-in, photos, report, check-out), verify card assembles, verify notification, verify client can view card.

---

### Proposal #8: Pet Health Checklist Per Visit

**Summary:** Add a structured health checklist to the sitter check-out flow, capturing eating, drinking, bathroom, medication, energy, and concerns for each pet on the booking.

#### 1. DATA MODEL CHANGES

```prisma
model VisitHealthCheck {
  id              String    @id @default(cuid())
  bookingId       String
  booking         Booking   @relation(fields: [bookingId], references: [id])
  petId           String
  pet             Pet       @relation(fields: [petId], references: [id])
  ate             String    // 'all' | 'most' | 'half' | 'little' | 'none' | 'not_offered'
  drank           Boolean   // true = drank water, false = didn't
  bathroom        String    // 'normal' | 'pee_only' | 'poop_only' | 'none' | 'accident' | 'diarrhea'
  medicationGiven Json?     // array of { medicationName: string, given: boolean, notes?: string }
  energyLevel     String    // 'high' | 'normal' | 'low' | 'lethargic'
  concerns        String?   // free-text for anything unusual
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([bookingId, petId])
  @@index([petId])
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sitter/bookings/[id]/health-check` | Sitter (assigned) | Submit health checks for all pets on booking |
| GET | `/api/sitter/bookings/[id]/health-check` | Sitter (assigned) | Get existing health checks (for edit/review) |
| GET | `/api/client/bookings/[id]/health-check` | Client (owns booking) | View health checks for a booking |

**POST request:**
```json
{
  "checks": [
    {
      "petId": "clx...",
      "ate": "all",
      "drank": true,
      "bathroom": "normal",
      "medicationGiven": [
        { "medicationName": "Apoquel", "given": true, "notes": null },
        { "medicationName": "Fish oil", "given": true, "notes": null }
      ],
      "energyLevel": "high",
      "concerns": null
    }
  ]
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/components/sitter/HealthChecklist.tsx` (NEW) | Per-pet checklist form: segmented controls for ate/bathroom/energy, toggle for drank, medication rows (pre-populated from pet's medication list), free-text concerns |
| Sitter | Sitter check-out flow | Insert `<HealthChecklist />` before report step. Required to complete before check-out. |
| Client | `src/components/client/HealthCheckSummary.tsx` (NEW) | Read-only display of health check data with icons per category |
| Client | `src/app/client/bookings/[id]/page.tsx` | Mount `<HealthCheckSummary />` in booking detail |
| Client | Visit Card (Proposal #7) | Health check data included in visit card assembly |

#### 4. QUEUE JOBS

None.

#### 5. DEPENDENCIES

- No hard dependencies on other proposals.
- Proposal #7 (Visit Card) will consume health check data when assembling the card.
- Pet medication list should come from the Pet model (if medications are stored there) for pre-populating the medication checklist.

#### 6. BUILD SEQUENCE

1. Add `VisitHealthCheck` model to `schema.prisma`. Run migration.
2. Create POST API route `src/app/api/sitter/bookings/[id]/health-check/route.ts`.
3. Create GET API routes for sitter and client.
4. Build `HealthChecklist.tsx` --- one section per pet on the booking, with segmented controls for enums, toggle for boolean, medication rows, and free-text concerns.
5. Integrate into sitter check-out flow: health checklist step appears after check-out GPS capture but before report submission.
6. Build `HealthCheckSummary.tsx` for client-side read-only display.
7. Mount on client booking detail page.
8. If Proposal #7 is built: update visit card assembler to include health check data in `healthCheckData` JSON field.
9. Test: multi-pet booking health check submission, medication pre-population, client view, edge case (no medications on pet).

---

### Proposal #14: Unified Pet Care Timeline

**Summary:** Create a chronological feed of all events for a given pet --- bookings, reports, health checks, messages, status changes --- displayed as a timeline on the client's pet profile page.

#### 1. DATA MODEL CHANGES

No new models. The timeline is assembled dynamically from existing tables:
- `Booking` (with `BookingStatusHistory`)
- `VisitReportEntry` / visit report text
- `VisitHealthCheck` (from Proposal #8)
- `VisitCard` (from Proposal #7)
- `MessageEvent` (if exists, or messages table)
- Any pet-related log entries

Optional: if performance requires it, create a materialized timeline cache:

```prisma
model PetTimelineEvent {
  id          String   @id @default(cuid())
  petId       String
  pet         Pet      @relation(fields: [petId], references: [id])
  orgId       String
  eventType   String   // 'booking_created' | 'booking_completed' | 'visit_report' | 'health_check' | 'message' | 'status_change' | 'visit_card'
  eventDate   DateTime
  title       String   // "Walk with Sarah" | "Visit report received" | "Vaccination due"
  summary     String?  // short description
  referenceId String?  // ID of the source record
  referenceType String? // 'Booking' | 'VisitCard' | 'VisitHealthCheck' etc.
  metadata    Json?    // type-specific extra data
  createdAt   DateTime @default(now())

  @@index([petId, eventDate(sort: Desc)])
  @@index([orgId, petId])
}
```

**Recommendation:** Start with dynamic assembly (no new model). Add `PetTimelineEvent` cache only if query performance degrades with >500 events per pet.

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client/pets/[id]/timeline` | Client (owns pet) | Get paginated timeline events |

**Query params:**
- `cursor` (optional): ISO date string for cursor-based pagination
- `limit` (optional, default 20, max 50): events per page
- `types` (optional): comma-separated filter, e.g., `booking_completed,visit_report`

**Response:**
```json
{
  "events": [
    {
      "id": "evt_...",
      "eventType": "visit_card",
      "eventDate": "2026-03-28T16:00:00Z",
      "title": "Walk completed with Sarah",
      "summary": "Luna had a great 30-minute walk!",
      "referenceId": "clx...",
      "referenceType": "VisitCard",
      "metadata": {
        "durationMinutes": 30,
        "sitterName": "Sarah",
        "photoCount": 3
      }
    },
    {
      "id": "evt_...",
      "eventType": "health_check",
      "eventDate": "2026-03-28T16:00:00Z",
      "title": "Health check recorded",
      "summary": "Ate all food, normal energy, no concerns",
      "referenceId": "clx...",
      "referenceType": "VisitHealthCheck",
      "metadata": {
        "ate": "all",
        "energyLevel": "normal"
      }
    }
  ],
  "nextCursor": "2026-03-27T10:00:00Z",
  "hasMore": true
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Client | `src/app/client/pets/[id]/page.tsx` | Add "Timeline" tab alongside existing pet info |
| Client | `src/components/client/PetTimeline.tsx` (NEW) | Vertical timeline component with infinite scroll |
| Client | `src/components/client/timeline/TimelineBookingCard.tsx` (NEW) | Card for booking events |
| Client | `src/components/client/timeline/TimelineReportCard.tsx` (NEW) | Card for visit reports |
| Client | `src/components/client/timeline/TimelineHealthCard.tsx` (NEW) | Card for health checks |
| Client | `src/components/client/timeline/TimelineMessageCard.tsx` (NEW) | Card for message events |
| Client | `src/components/client/timeline/TimelineStatusCard.tsx` (NEW) | Card for booking status changes |

#### 4. QUEUE JOBS

None for dynamic assembly approach.

If using `PetTimelineEvent` cache model: add a `timeline.index` job triggered on each relevant event (booking create, report submit, health check submit, etc.) that inserts a `PetTimelineEvent` record.

#### 5. DEPENDENCIES

- **Proposal #7** (Visit Card): visit card events in timeline. Graceful fallback if not shipped.
- **Proposal #8** (Health Checklist): health check events. Graceful fallback if not shipped.
- **Proposal #6** (Visit Report): structured report data. Falls back to raw report text.

#### 6. BUILD SEQUENCE

1. Create `src/lib/timeline/assembler.ts` --- queries all relevant tables for a given petId, merges into unified event list, sorts by date descending, applies pagination.
2. Define event type mappers in `src/lib/timeline/mappers/`:
   - `booking-mapper.ts` --- maps Booking records to timeline events.
   - `report-mapper.ts` --- maps report data to timeline events.
   - `health-check-mapper.ts` --- maps VisitHealthCheck to timeline events.
   - `message-mapper.ts` --- maps message events.
   - `status-mapper.ts` --- maps BookingStatusHistory to timeline events.
   - `visit-card-mapper.ts` --- maps VisitCard to timeline events.
3. Create GET API route `/api/client/pets/[id]/timeline`.
4. Build timeline card components (one per event type).
5. Build `PetTimeline.tsx` --- renders cards based on eventType, handles infinite scroll with cursor pagination.
6. Add "Timeline" tab to client pet profile page.
7. Test: pet with diverse event history, verify chronological ordering, verify pagination, verify type filtering.

---

## PHASE 3: OPERATIONAL INTELLIGENCE (Weeks 7-10)

These proposals add operational intelligence for sitters and businesses --- mileage, scheduling, and communication management.

---

### Proposal #11: Mileage Tracking + Tax Estimation

**Summary:** Calculate and log driving distance for each sitter visit, provide monthly/yearly mileage reports, and estimate quarterly tax obligations using IRS standard mileage rate.

#### 1. DATA MODEL CHANGES

```prisma
model SitterMileageLog {
  id              String   @id @default(cuid())
  sitterId        String
  sitter          Sitter   @relation(fields: [sitterId], references: [id])
  bookingId       String
  booking         Booking  @relation(fields: [bookingId], references: [id])
  orgId           String
  org             Organization @relation(fields: [orgId], references: [id])
  fromAddress     String   // sitter home or previous booking address
  toAddress       String   // client address
  distanceMiles   Float
  durationMinutes Float?
  calculatedAt    DateTime @default(now())
  source          String   @default("google_maps") // 'google_maps' | 'manual'

  @@index([sitterId, calculatedAt])
  @@index([orgId, sitterId])
}

model SitterTaxEstimate {
  id                String   @id @default(cuid())
  sitterId          String
  sitter            Sitter   @relation(fields: [sitterId], references: [id])
  orgId             String
  year              Int
  quarter           Int      // 1-4
  totalEarningsCents Int
  totalMiles        Float
  mileageDeductionCents Int  // miles * IRS rate
  estimatedTaxCents Int      // (earnings - deduction) * estimated tax rate
  irsRatePerMile    Float    // e.g., 0.67 for 2026
  calculatedAt      DateTime @default(now())

  @@unique([sitterId, year, quarter])
  @@index([sitterId])
}
```

Also add to `Sitter` model:

```prisma
model Sitter {
  // ... existing fields ...
  homeAddress     String?  // for mileage calculation origin
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sitter/mileage` | Sitter | List mileage logs with date range filter |
| GET | `/api/sitter/mileage/summary` | Sitter | Monthly/yearly mileage summary |
| POST | `/api/sitter/mileage/[bookingId]/calculate` | Sitter | Manually trigger mileage calculation for a booking |
| POST | `/api/sitter/mileage/manual` | Sitter | Manually enter mileage for a booking |
| GET | `/api/sitter/tax-estimate` | Sitter | Get quarterly tax estimates for current year |
| GET | `/api/sitter/tax-estimate/[year]` | Sitter | Get quarterly tax estimates for specified year |

**GET /mileage/summary response:**
```json
{
  "currentMonth": {
    "totalMiles": 234.5,
    "totalTrips": 18,
    "deductionCents": 15712
  },
  "currentYear": {
    "totalMiles": 1845.2,
    "totalTrips": 156,
    "deductionCents": 123628
  },
  "monthlyBreakdown": [
    { "month": "2026-01", "totalMiles": 210.3, "trips": 16, "deductionCents": 14090 },
    { "month": "2026-02", "totalMiles": 198.7, "trips": 15, "deductionCents": 13313 }
  ]
}
```

**GET /tax-estimate response:**
```json
{
  "year": 2026,
  "irsRatePerMile": 0.67,
  "quarters": [
    {
      "quarter": 1,
      "totalEarningsCents": 450000,
      "totalMiles": 612.3,
      "mileageDeductionCents": 41024,
      "taxableIncomeCents": 408976,
      "estimatedTaxCents": 61346,
      "estimatedTaxRate": 0.15
    }
  ]
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/app/sitter/mileage/page.tsx` (NEW) | Mileage dashboard: monthly chart, YTD totals, trip log table |
| Sitter | `src/components/sitter/MileageSummaryCard.tsx` (NEW) | Compact card showing month/year totals, mountable on sitter dashboard |
| Sitter | `src/components/sitter/MileageLogTable.tsx` (NEW) | Paginated table of individual trips with from/to, distance, date |
| Sitter | `src/app/sitter/mileage/tax/page.tsx` (NEW) | Tax estimation page: quarterly breakdown, IRS rate display, deduction calculator |
| Sitter | `src/components/sitter/TaxEstimateCard.tsx` (NEW) | Per-quarter card: earnings, mileage deduction, estimated tax |
| Sitter | `src/app/sitter/profile/page.tsx` | Add home address field for mileage origin |

#### 4. QUEUE JOBS

| Queue | Job Name | Description |
|-------|----------|-------------|
| `mileage` | `mileage.calculate` | Triggered on booking check-out. Calls Google Distance Matrix API. |
| `mileage` | `mileage.quarterly-estimate` | Cron: runs on 1st of each quarter month (Jan/Apr/Jul/Oct). Calculates tax estimates. |

**mileage.calculate job logic:**
1. Receive `{ bookingId, sitterId }`.
2. Determine origin: sitter's home address OR the check-out address of their previous booking that day (whichever is later).
3. Destination: client address from booking.
4. Call Google Distance Matrix API: `origins={origin}&destinations={destination}&mode=driving`.
5. Extract `distance.value` (meters) -> convert to miles.
6. Create `SitterMileageLog` record.

#### 5. DEPENDENCIES

- **New env var:** `GOOGLE_MAPS_API_KEY` (shared with #13 Route Optimization).
- Google Distance Matrix API billing enabled on the key.
- Sitter home address field on profile.

#### 6. BUILD SEQUENCE

1. Add `SitterMileageLog` and `SitterTaxEstimate` models to `schema.prisma`. Add `homeAddress` to Sitter. Run migration.
2. Add `GOOGLE_MAPS_API_KEY` to `.env.example` and environment config.
3. Create `src/lib/mileage/distance-calculator.ts` --- wraps Google Distance Matrix API call.
4. Create `src/lib/mileage/tax-estimator.ts` --- calculates quarterly estimates with configurable IRS rate and estimated tax rate.
5. Create BullMQ job `mileage.calculate` in `src/jobs/mileage-calculate.ts`.
6. Hook job trigger into check-out flow (after check-out, enqueue mileage calculation).
7. Create BullMQ cron job `mileage.quarterly-estimate`.
8. Create API routes for mileage listing, summary, manual entry, and tax estimates.
9. Add home address field to sitter profile page.
10. Build mileage dashboard page and components.
11. Build tax estimation page and components.
12. Test: complete a booking, verify mileage calculated, verify monthly/yearly rollups, verify tax estimate math.

---

### Proposal #12: Travel Buffer in Smart Scheduling

**Summary:** Add a configurable travel buffer (default 20 minutes) before and after each booking to prevent back-to-back scheduling collisions.

#### 1. DATA MODEL CHANGES

Add to `BusinessSettings` model:

```prisma
model BusinessSettings {
  // ... existing fields ...
  defaultTravelBufferMinutes  Int  @default(20)
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/admin/settings/scheduling` | Admin | Update travel buffer setting |
| GET | `/api/admin/settings/scheduling` | Admin | Get scheduling settings |

**PUT request:**
```json
{
  "defaultTravelBufferMinutes": 25
}
```

**Validation:** Min 0, max 120. Integer only.

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Admin | Settings -> Scheduling section | Add "Travel buffer between visits" input (minutes) with helper text: "Minimum gap between the end of one visit and the start of the next, to allow for travel time." |
| Sitter / Client | Booking calendar view | Visual indicator of buffer zones (grayed-out blocks before/after bookings) |

#### 4. QUEUE JOBS

None.

#### 5. DEPENDENCIES

- Must modify the existing availability/conflict-checking engine.
- Locate `checkConflict()` function (likely in scheduling or availability utilities).

#### 6. BUILD SEQUENCE

1. Add `defaultTravelBufferMinutes` field to `BusinessSettings` in `schema.prisma`. Run migration.
2. Create/update scheduling settings API routes.
3. Locate the `checkConflict()` function in the scheduling engine.
4. Modify `checkConflict()` logic:
   - Currently checks: `newBookingStart < existingBookingEnd AND newBookingEnd > existingBookingStart`.
   - New check: `newBookingStart < (existingBookingEnd + bufferMinutes) AND (newBookingEnd + bufferMinutes) > existingBookingStart`.
   - Fetch `defaultTravelBufferMinutes` from BusinessSettings for the org.
5. Update any availability display logic to account for buffer zones.
6. Add UI control to admin settings scheduling section.
7. Optionally: show buffer zones as grayed blocks on calendar views.
8. Test: create two bookings with <buffer gap, verify conflict detected. Create with >=buffer gap, verify allowed. Change buffer setting, verify new behavior.

---

### Proposal #13: Route Optimization

**Summary:** Given a sitter's bookings for a day, calculate the optimal visit order using Google Maps Directions API with waypoint optimization, and display an optimized route with estimated drive times.

#### 1. DATA MODEL CHANGES

```prisma
model OptimizedRoute {
  id              String   @id @default(cuid())
  sitterId        String
  sitter          Sitter   @relation(fields: [sitterId], references: [id])
  orgId           String
  date            DateTime @db.Date
  waypointOrder   Json     // ordered array of booking IDs in optimized sequence
  totalDistanceMiles Float
  totalDurationMinutes Float
  legs            Json     // array of { fromBookingId, toBookingId, distanceMiles, durationMinutes }
  optimizedAt     DateTime @default(now())

  @@unique([sitterId, date])
  @@index([sitterId, date])
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sitter/routes/optimize` | Sitter | Calculate optimized route for a given date |
| GET | `/api/sitter/routes/[date]` | Sitter | Get previously calculated optimized route |

**POST /optimize request:**
```json
{
  "date": "2026-03-29",
  "startAddress": "123 Sitter Home St, City, ST 12345"
}
```

If `startAddress` is omitted, use the sitter's `homeAddress` from their profile.

**POST /optimize response:**
```json
{
  "optimizedOrder": [
    {
      "position": 1,
      "bookingId": "clx...",
      "clientName": "Smith",
      "petNames": "Luna",
      "address": "456 Client Ave",
      "scheduledTime": "09:00",
      "estimatedArrival": "09:12",
      "driveFromPrevious": { "distanceMiles": 3.2, "durationMinutes": 12 }
    },
    {
      "position": 2,
      "bookingId": "clx...",
      "clientName": "Johnson",
      "petNames": "Max and Bella",
      "address": "789 Another St",
      "scheduledTime": "10:00",
      "estimatedArrival": "09:55",
      "driveFromPrevious": { "distanceMiles": 2.1, "durationMinutes": 8 }
    }
  ],
  "totalDistanceMiles": 15.4,
  "totalDurationMinutes": 42,
  "savings": {
    "distanceMilesSaved": 4.2,
    "timeSavedMinutes": 14
  }
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/app/sitter/today/page.tsx` | Add "Optimize route" button at top of daily schedule |
| Sitter | `src/components/sitter/RouteOptimizer.tsx` (NEW) | Full optimization UI: shows current order vs. optimized order, map with route, drive time estimates per leg |
| Sitter | `src/components/sitter/RouteMap.tsx` (NEW or extend existing) | Map with numbered pins for each stop, polyline route between them |
| Sitter | `src/components/sitter/RouteLegCard.tsx` (NEW) | Card per leg: from -> to, distance, estimated drive time |

#### 4. QUEUE JOBS

None. API call to Google Maps is synchronous (typically <2s for <10 waypoints). If sitters have >10 bookings/day, consider async.

#### 5. DEPENDENCIES

- **New env var:** `GOOGLE_MAPS_API_KEY` (shared with #11 Mileage Tracking).
- Google Directions API with waypoint optimization enabled on the key.
- Sitter `homeAddress` field (added in #11).

#### 6. BUILD SEQUENCE

1. Add `OptimizedRoute` model to `schema.prisma`. Run migration.
2. Create `src/lib/routes/optimizer.ts`:
   - Input: array of bookings with addresses + start address.
   - Call Google Directions API with `optimize:true` on waypoints.
   - Parse response: extract optimized waypoint order, per-leg distances and durations.
   - Calculate savings vs. original order.
3. Create POST `/api/sitter/routes/optimize` route.
4. Create GET `/api/sitter/routes/[date]` route.
5. Build `RouteOptimizer.tsx` --- shows before/after comparison, savings callout.
6. Build `RouteMap.tsx` --- Google Maps embed with numbered markers and route polyline.
7. Build `RouteLegCard.tsx` --- per-leg details.
8. Add "Optimize route" button to sitter today page.
9. Test: 3-booking day, 5-booking day, verify optimization reduces total distance, verify map renders correctly.

---

### Proposal #10: Communication Quiet Hours

**Summary:** Allow sitters to set notification quiet hours so push notifications are suppressed during off-hours, with queued delivery when quiet hours end and optional auto-reply to clients.

#### 1. DATA MODEL CHANGES

```prisma
model SitterQuietHours {
  id          String   @id @default(cuid())
  sitterId    String   @unique
  sitter      Sitter   @relation(fields: [sitterId], references: [id])
  startTime   String   // HH:mm format, e.g. "22:00"
  endTime     String   // HH:mm format, e.g. "07:00"
  timezone    String   // IANA timezone, e.g. "America/New_York"
  enabled     Boolean  @default(true)
  autoReplyEnabled  Boolean  @default(false)
  autoReplyMessage  String?  // e.g. "I'm currently off-duty. I'll respond when I'm back online!"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model DelayedNotification {
  id              String   @id @default(cuid())
  recipientId     String   // sitter user ID
  recipientType   String   @default("sitter")
  notificationType String  // 'push' | 'sms' | 'email'
  payload         Json     // full notification payload to deliver
  scheduledFor    DateTime // when quiet hours end
  deliveredAt     DateTime?
  status          String   @default("pending") // 'pending' | 'delivered' | 'expired'
  createdAt       DateTime @default(now())

  @@index([status, scheduledFor])
  @@index([recipientId])
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sitter/quiet-hours` | Sitter | Get quiet hours config |
| PUT | `/api/sitter/quiet-hours` | Sitter | Create or update quiet hours config |
| DELETE | `/api/sitter/quiet-hours` | Sitter | Disable and remove quiet hours |

**PUT request:**
```json
{
  "startTime": "22:00",
  "endTime": "07:00",
  "timezone": "America/New_York",
  "enabled": true,
  "autoReplyEnabled": true,
  "autoReplyMessage": "I'm currently off-duty and will respond in the morning!"
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Sitter | `src/app/sitter/profile/page.tsx` | Add "Notification Quiet Hours" section |
| Sitter | `src/components/sitter/QuietHoursConfig.tsx` (NEW) | Time picker for start/end, timezone selector, enable toggle, auto-reply toggle + message editor |
| Client | Message thread | If auto-reply enabled and message sent during quiet hours, client sees auto-reply message |

#### 4. QUEUE JOBS

| Queue | Job Name | Description |
|-------|----------|-------------|
| `notifications` | `notifications.deliver-delayed` | Cron: runs every 5 minutes. Finds `DelayedNotification` records where `scheduledFor <= now()` and `status = 'pending'`, delivers them. |

#### 5. DEPENDENCIES

- Must modify the existing notification delivery pipeline to check quiet hours before sending.
- Modify the function that sends push/SMS to sitters.

#### 6. BUILD SEQUENCE

1. Add `SitterQuietHours` and `DelayedNotification` models to `schema.prisma`. Run migration.
2. Create `src/lib/notifications/quiet-hours.ts`:
   - `isInQuietHours(sitterId: string): Promise<{ inQuietHours: boolean; endsAt?: Date }>` --- checks current time against sitter's quiet hours in their timezone.
   - `queueDelayedNotification(recipientId, type, payload, deliverAt): Promise<void>` --- creates DelayedNotification record.
3. Modify the existing notification delivery function (in triggers.ts or wherever push/SMS is sent to sitters):
   - Before sending to a sitter: call `isInQuietHours(sitterId)`.
   - If in quiet hours: call `queueDelayedNotification()` instead of sending immediately.
   - If auto-reply enabled: send auto-reply to the message sender.
4. Create BullMQ cron job `notifications.deliver-delayed` --- runs every 5 minutes, queries pending delayed notifications where `scheduledFor <= now()`, delivers them, updates status.
5. Create API routes for quiet hours CRUD.
6. Build `QuietHoursConfig.tsx` component.
7. Add to sitter profile page.
8. Implement auto-reply logic in messaging pipeline.
9. Test: set quiet hours, send notification during quiet hours (verify suppressed), wait for quiet hours end (verify delivered), test auto-reply, test timezone edge cases (crossing midnight).

---

## PHASE 4: TRUST AND PROTECTION (Weeks 11-12)

The final phase adds legal and safety infrastructure that builds deep trust with pet owners.

---

### Proposal #15: Emergency Vet Authorization

**Summary:** Allow clients to pre-authorize emergency vet visits with a spending limit, digital signature, and designated vet information. The authorization is stored as a signed PDF and shown to sitters at check-in.

#### 1. DATA MODEL CHANGES

```prisma
model EmergencyVetAuthorization {
  id                  String    @id @default(cuid())
  petId               String
  pet                 Pet       @relation(fields: [petId], references: [id])
  clientId            String
  client              Client    @relation(fields: [clientId], references: [id])
  orgId               String
  org                 Organization @relation(fields: [orgId], references: [id])
  authorizedUpToCents Int       // max dollar amount authorized for emergency care
  vetName             String
  vetPhone            String
  vetAddress          String
  vetEmergencyPhone   String?   // after-hours emergency number
  additionalNotes     String?   // allergies, conditions, special instructions
  signedAt            DateTime?
  signatureData       String?   // base64 encoded signature image or signature pad data
  signaturePdfUrl     String?   // S3 path to generated PDF
  expiresAt           DateTime  // client sets expiration (e.g., 1 year from signing)
  isActive            Boolean   @default(true)
  revokedAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([petId, isActive])
  @@index([clientId])
  @@index([orgId])
}
```

#### 2. API ROUTES

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client/pets/[petId]/vet-auth` | Client | Get active vet authorization for a pet |
| POST | `/api/client/pets/[petId]/vet-auth` | Client | Create and sign a new vet authorization |
| PUT | `/api/client/pets/[petId]/vet-auth/[id]` | Client | Update authorization (revokes previous, creates new) |
| DELETE | `/api/client/pets/[petId]/vet-auth/[id]` | Client | Revoke authorization |
| GET | `/api/client/pets/[petId]/vet-auth/[id]/pdf` | Client | Download signed PDF |
| GET | `/api/sitter/bookings/[bookingId]/vet-auth` | Sitter (assigned) | Get vet authorizations for all pets on booking |

**POST request:**
```json
{
  "authorizedUpToCents": 200000,
  "vetName": "Downtown Pet Hospital",
  "vetPhone": "(555) 123-4567",
  "vetAddress": "100 Vet Way, City, ST 12345",
  "vetEmergencyPhone": "(555) 123-9999",
  "additionalNotes": "Luna is allergic to penicillin. She takes Apoquel daily.",
  "signatureData": "data:image/png;base64,iVBOR...",
  "expiresAt": "2027-03-29T00:00:00Z"
}
```

**POST response:**
```json
{
  "id": "clx...",
  "signedAt": "2026-03-29T15:00:00Z",
  "signaturePdfUrl": "/api/client/pets/clx.../vet-auth/clx.../pdf",
  "expiresAt": "2027-03-29T00:00:00Z"
}
```

**GET /sitter/bookings/[bookingId]/vet-auth response:**
```json
{
  "authorizations": [
    {
      "petName": "Luna",
      "petId": "clx...",
      "authorizedUpTo": "$2,000.00",
      "vetName": "Downtown Pet Hospital",
      "vetPhone": "(555) 123-4567",
      "vetAddress": "100 Vet Way, City, ST 12345",
      "vetEmergencyPhone": "(555) 123-9999",
      "additionalNotes": "Luna is allergic to penicillin.",
      "signedAt": "2026-03-29T15:00:00Z",
      "expiresAt": "2027-03-29T00:00:00Z"
    }
  ]
}
```

#### 3. UI SURFACES

| Portal | Page / Component | Change |
|--------|-----------------|--------|
| Client | `src/app/client/pets/[petId]/vet-auth/page.tsx` (NEW) | Vet authorization form and signing page |
| Client | `src/components/client/VetAuthForm.tsx` (NEW) | Form: vet details, spending limit slider/input, notes, expiration date picker |
| Client | `src/components/client/SignaturePad.tsx` (NEW) | HTML5 canvas signature pad for digital signature capture |
| Client | `src/components/client/VetAuthCard.tsx` (NEW) | Display active authorization on pet profile: vet name, limit, expiry, "Edit" and "Revoke" buttons |
| Client | `src/app/client/pets/[petId]/page.tsx` | Mount `<VetAuthCard />` in pet profile page, with "Set up emergency vet authorization" CTA if none exists |
| Sitter | `src/components/sitter/AccessInfoCard.tsx` (from #3) | Add "Emergency Vet Authorization" section showing vet details, authorized amount, and quick-dial button for vet phone |
| Sitter | `src/components/sitter/VetAuthBanner.tsx` (NEW) | Alert banner on booking detail: "Emergency vet authorization on file for Luna (up to $2,000)" with tap to expand details |

#### 4. QUEUE JOBS

| Queue | Job Name | Description |
|-------|----------|-------------|
| `vet-auth` | `vet-auth.generate-pdf` | After signing, generate PDF document and upload to S3. |
| `vet-auth` | `vet-auth.expiry-check` | Daily cron: find authorizations expiring in 30 days, notify client to renew. |

**vet-auth.generate-pdf job logic:**
1. Receive `{ authorizationId }`.
2. Load authorization with pet and client relations.
3. Generate PDF using a template (use `@react-pdf/renderer` or `puppeteer` for HTML-to-PDF):
   - Header: Organization name, "Emergency Veterinary Authorization"
   - Pet info: name, breed, weight, known conditions
   - Vet info: name, phone, address, emergency phone
   - Authorization: "I authorize emergency veterinary care up to $X,XXX.XX"
   - Additional notes
   - Signature image
   - Signed date, expiration date
   - Client name and contact info
4. Upload PDF to S3.
5. Update `signaturePdfUrl` on the authorization record.

#### 5. DEPENDENCIES

- **Proposal #3** (Access Info Card): vet auth section is added to the AccessInfoCard.
- S3 for PDF storage (existing).
- PDF generation library (new dependency: `@react-pdf/renderer` or `puppeteer`).

#### 6. BUILD SEQUENCE

1. Add `EmergencyVetAuthorization` model to `schema.prisma`. Run migration.
2. Create `src/lib/vet-auth/pdf-generator.ts` --- generates PDF from authorization data.
3. Create BullMQ job `vet-auth.generate-pdf` in `src/jobs/vet-auth-generate-pdf.ts`.
4. Create BullMQ cron job `vet-auth.expiry-check` in `src/jobs/vet-auth-expiry-check.ts`.
5. Create notification trigger `notifyClientVetAuthExpiring(authorization)` in triggers.ts.
6. Create client API routes: GET, POST, PUT, DELETE for vet authorization.
7. Create sitter API route: GET vet auth for booking.
8. Build `SignaturePad.tsx` --- HTML5 canvas with touch support, outputs base64 PNG.
9. Build `VetAuthForm.tsx` --- form fields + signature pad + submit.
10. Build `VetAuthCard.tsx` --- compact display for pet profile.
11. Build signing page at `/client/pets/[petId]/vet-auth`.
12. Mount `VetAuthCard` on client pet profile page.
13. Update `AccessInfoCard.tsx` (from Proposal #3) to include vet auth section with quick-dial button.
14. Build `VetAuthBanner.tsx` for sitter booking detail.
15. Test: full signing flow, PDF generation, sitter view at check-in, expiration notification, revocation.

---

## DEPENDENCY MAP

```
#1  Dark Mode Toggle          -> (none)
#2  Pet Name Notifications    -> (none)
#3  Access Info Card           -> (none)            <- #15 adds vet auth section
#4  "On My Way" Notification  -> #2 (formatPetNames helper)
#9  Sitter Reliability Score  -> (none)

#5  Import Tool               -> (none)
#6  Report Quick-Fill         -> (none)             <- #7 consumes report data
#7  Visit Card                -> #6 (report data), #8 (health data) [graceful fallback]
#8  Health Checklist           -> (none)             <- #7 consumes health data
#14 Pet Timeline              -> #6, #7, #8 (all graceful fallback)

#11 Mileage Tracking          -> GOOGLE_MAPS_API_KEY (new)
#12 Travel Buffer             -> (none, modifies scheduling engine)
#13 Route Optimization        -> GOOGLE_MAPS_API_KEY (shared with #11), #11 (homeAddress field)
#10 Quiet Hours               -> (none, modifies notification pipeline)

#15 Emergency Vet Auth        -> #3 (AccessInfoCard integration)
```

**Critical path within each phase:**

- **Phase 1:** #2 before #4 (pet names helper). Everything else parallel.
- **Phase 2:** #6 and #8 before #7 (Visit Card needs report + health data). #5 is independent. #14 should come last (consumes #6, #7, #8).
- **Phase 3:** #11 before #13 (shared API key setup + homeAddress field). #12 and #10 are independent.
- **Phase 4:** #3 should be complete before #15 starts (AccessInfoCard exists to extend).

**Recommended build order within phases:**

```
Phase 1:  #1 -> #2 -> #3 -> #4 -> #9    (sequential due to small scope)
Phase 2:  #5 || (#6 -> #8 -> #7 -> #14)  (#5 independent, others sequential)
Phase 3:  #10 || #12 || (#11 -> #13)     (#10 and #12 independent, #11 before #13)
Phase 4:  #15                             (single proposal)
```

---

## NEW PRISMA MODELS SUMMARY

| Model | Proposal | Fields (key) | Relations |
|-------|----------|-------------|-----------|
| `ImportJob` | #5 | orgId, sourceSystem, status, fileName, fileUrl, totalRows, processedRows, createdRows, skippedRows, errorRows, columnMapping, errors | Organization, ImportRow[] |
| `ImportRow` | #5 | importJobId, rowNumber, rawData, mappedData, entityType, status, errorMessage, createdEntityId | ImportJob |
| `ReportTemplate` | #6 | orgId, category, label, sortOrder, isDefault, isActive | Organization |
| `VisitReportEntry` | #6 | bookingId, category, selectedLabel, freeText | Booking |
| `VisitCard` | #7 | bookingId, orgId, checkInAt, checkOutAt, durationMinutes, GPS fields, mapThumbnailUrl, photoUrls, healthCheckData, reportSummary, sitterNote, isPublished | Booking, Organization |
| `VisitHealthCheck` | #8 | bookingId, petId, ate, drank, bathroom, medicationGiven, energyLevel, concerns | Booking, Pet |
| `PetTimelineEvent` | #14 | petId, orgId, eventType, eventDate, title, summary, referenceId, referenceType, metadata | Pet (optional, only if perf requires) |
| `SitterMileageLog` | #11 | sitterId, bookingId, orgId, fromAddress, toAddress, distanceMiles, durationMinutes, source | Sitter, Booking, Organization |
| `SitterTaxEstimate` | #11 | sitterId, orgId, year, quarter, totalEarningsCents, totalMiles, mileageDeductionCents, estimatedTaxCents, irsRatePerMile | Sitter |
| `OptimizedRoute` | #13 | sitterId, orgId, date, waypointOrder, totalDistanceMiles, totalDurationMinutes, legs | Sitter |
| `SitterQuietHours` | #10 | sitterId, startTime, endTime, timezone, enabled, autoReplyEnabled, autoReplyMessage | Sitter |
| `DelayedNotification` | #10 | recipientId, recipientType, notificationType, payload, scheduledFor, deliveredAt, status | (none) |
| `EmergencyVetAuthorization` | #15 | petId, clientId, orgId, authorizedUpToCents, vetName, vetPhone, vetAddress, signedAt, signatureData, signaturePdfUrl, expiresAt, isActive | Pet, Client, Organization |

**Existing model modifications:**

| Model | Proposal | Change |
|-------|----------|--------|
| `Booking` | #4 | Add `onMyWaySentAt: DateTime?` |
| `Booking` | #6 | Add `aiExpandedReport: String?`, `reportEntries: VisitReportEntry[]` relation |
| `Sitter` | #11 | Add `homeAddress: String?` |
| `BusinessSettings` | #12 | Add `defaultTravelBufferMinutes: Int @default(20)` |

**Total new models:** 13
**Total modified models:** 3
**Total new migrations:** Approximately 8 (batch related models into single migrations)

---

## NEW ENV VARS SUMMARY

| Variable | Proposals | Description | Required By |
|----------|-----------|-------------|-------------|
| `GOOGLE_MAPS_API_KEY` | #7, #11, #13 | Google Maps Platform API key with Distance Matrix, Directions, and Static Maps APIs enabled | Phase 2 (optional for #7), Phase 3 (required for #11, #13) |

**Note:** All other proposals use existing infrastructure (BullMQ, S3, Stripe, Twilio, AI governed-call). No additional env vars required beyond `GOOGLE_MAPS_API_KEY`.

**Google Maps API billing estimate:**
- Distance Matrix API: $5 per 1,000 elements
- Directions API: $5 per 1,000 requests (with waypoint optimization: $10 per 1,000)
- Static Maps API: $2 per 1,000 requests
- Estimated monthly cost for a 50-sitter org: $20-50/month

---

## NEW NPM DEPENDENCIES

| Package | Proposals | Purpose |
|---------|-----------|---------|
| `csv-parse` | #5 | CSV parsing for import tool |
| `@react-pdf/renderer` OR `puppeteer` | #15 | PDF generation for vet authorization documents |
| `signature_pad` | #15 | HTML5 canvas signature capture (or build custom) |

All other functionality uses existing dependencies in the project.

---

## NEW BULLMQ JOBS SUMMARY

| Queue | Job Name | Trigger | Cron | Proposal |
|-------|----------|---------|------|----------|
| `import` | `import.execute` | Manual (admin clicks "Execute") | No | #5 |
| `visit-card` | `visit-card.assemble` | Automatic (on sitter check-out) | No | #7 |
| `mileage` | `mileage.calculate` | Automatic (on sitter check-out) | No | #11 |
| `mileage` | `mileage.quarterly-estimate` | N/A | Quarterly (1st of Jan/Apr/Jul/Oct) | #11 |
| `notifications` | `notifications.deliver-delayed` | N/A | Every 5 minutes | #10 |
| `vet-auth` | `vet-auth.generate-pdf` | Automatic (on authorization signing) | No | #15 |
| `vet-auth` | `vet-auth.expiry-check` | N/A | Daily | #15 |

---

## THE 12-MONTH VISION

With all 15 proposals shipped, Snout OS transforms from a booking and scheduling tool into a comprehensive, trust-driven pet care platform. Here is what the product looks like after 12 weeks of execution:

### For Pet Parents (Clients)

A pet parent opens Snout OS and sees their pet's **unified timeline** --- a living history of every walk, every health check, every visit report, stretching back months. When they book a visit, they see their sitter's **reliability badge** ("Trusted --- consistently arrives on time, sends detailed visit reports"), giving them quiet confidence. They have signed an **emergency vet authorization** once, and it stays on file, automatically shown to every sitter at every visit.

Thirty minutes before the visit, they receive: **"Sarah is on her way to Luna!"** --- not a generic alert, but a personal message with their pet's name. After the visit, they receive a push notification linking to a **Visit Card**: a map showing where Sarah walked Luna, 3 photos from the park, a health checklist confirming Luna ate all her food, took her medication, and had normal energy, plus a polished narrative summary: "Luna had a wonderful 30-minute walk today! She was full of energy and played fetch at Riverside Park. Medication given on time --- she's a happy girl!"

The client never wonders what happened during the visit. They know.

### For Sitters

A sitter opens their day in Snout OS and taps **"Optimize route"** --- the system reorders their 5 visits to minimize driving, saving them 20 minutes and 8 miles. Each booking card shows a drive time estimate to the next stop. Before leaving for the first visit, they tap **"On My Way"** and the client is notified instantly.

At check-in, the **Access Info Card** appears: lockbox code, WiFi password, parking notes, and Luna's emergency vet authorization (Downtown Pet Hospital, authorized up to $2,000, allergic to penicillin). Everything they need, right when they need it.

At check-out, they fill the **health checklist** in 15 seconds (tap tap tap --- ate everything, drank water, normal bathroom, medication given, high energy, no concerns) and the **report quick-fill** in another 15 seconds (pill selections expanded by AI into a warm paragraph). Total reporting time: 30 seconds instead of 3 minutes of typing.

Their **mileage dashboard** tracks every mile automatically. At tax time, they have a clean quarterly breakdown: $18,000 earned, 2,400 miles driven, $1,608 mileage deduction, estimated quarterly tax: $2,459. Their accountant is impressed.

At 10 PM, their **quiet hours** kick in. No pings until 7 AM. Clients who message get a friendly auto-reply. When the sitter wakes up, all delayed notifications arrive at once.

### For Business Owners (Admins)

A new pet care business signs up for Snout OS and **imports their entire client database** from PetExec in under 10 minutes --- 200 clients, 340 pets, 15 sitters, all deduplicated and mapped. They are operational on day one, not day thirty.

The **travel buffer** in scheduling prevents the constant complaint of back-to-back bookings with no drive time. The 20-minute default catches 90% of cases. The **report templates** standardize visit reporting across all sitters --- no more "walked the dog, everything was fine" vs. 5-paragraph essays. Every report hits the same quality bar.

The **dark mode toggle** is a small thing, but it is the kind of polish that signals "this product is built by people who care." Clients notice. They stay.

### The Competitive Position

After these 15 proposals ship, Snout OS has:
- **Visit transparency** that no competitor matches (Visit Cards with GPS proof, photos, health data, and AI-generated narratives)
- **Sitter operational tools** that Gingr and PetExec do not offer (route optimization, mileage tracking, tax estimation, quiet hours)
- **Trust infrastructure** unique in the market (emergency vet authorization with digital signature and PDF generation)
- **Migration tooling** that removes the switching cost barrier (import from PetExec, Gingr, Time To Pet)
- **Personalization** that makes automated messages feel human (pet names in every notification)

The platform is no longer just "where bookings happen." It is where pet parents feel safe, sitters feel supported, and business owners feel in control.

---

*End of Vision Roadmap. This document serves as the authoritative technical specification for all 15 approved proposals. Execution agents should reference the BUILD SEQUENCE sections for implementation order and the DEPENDENCY MAP for cross-proposal coordination.*
