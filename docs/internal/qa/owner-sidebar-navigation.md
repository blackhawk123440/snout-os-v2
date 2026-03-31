# Owner Sidebar Navigation — Final Structure

Clean, executive owner sidebar with sections, single-expand collapsible, and diagnostics muted. **No routes changed.**

---

## Files changed

- **`src/components/layout/OwnerAppShell.tsx`**
  - **Structure:** Operations (6 items), Communication (Messaging with 5 children), Workforce (2), Business (3), Platform (Integrations, Settings), Diagnostics (collapsible with 6 links). Removed Automations from nav; removed Sitter Profile.
  - **Labels:** "Owner Inbox" → "Inbox"; "Assignments (Routing)" → "Routing" (route remains `/messaging/assignments`).
  - **Collapsible:** Single `expandedKey` — only one of Messaging or Diagnostics can be open at a time. Toggle opens that section and closes the other.
  - **Defaults:** Messaging opens only when current path is under `/messaging`; otherwise collapsed. Diagnostics always starts collapsed.
  - **Visual:** Tighter spacing (h-9, h-8 for children, mb-3 sections). Diagnostics section has `muted: true` (opacity-80, lighter text). Active state: `bg-slate-100` + font-medium.
  - **Mobile:** Drawer uses same section grouping (Operations, Communication, …) with section headers and same links; no collapsible on mobile.

- **`src/lib/navigation.ts`**
  - **ownerNavigation:** Inbox, Routing labels; removed Automations and Sitter Profile; Platform = Integrations, Settings only.

---

## Exact final nav structure

**Operations**  
Dashboard · Command Center · Bookings · Calendar · Clients · Sitters  

**Communication**  
Messaging (collapsible)  
├── Inbox  
├── Sitters  
├── Numbers  
├── Routing  
└── Twilio Setup  

**Workforce**  
Growth / Tiers · Payroll  

**Business**  
Reports · Payments · Finance  

**Platform**  
Integrations · Settings  

**Diagnostics** (section muted; collapsible, default collapsed)  
Diagnostics (collapsible)  
├── Automation Failures  
├── Message Failures  
├── Calendar Repair  
├── Payout Operations  
├── Reconciliation  
└── AI Ops  

---

## Collapsible behavior

1. **Only one submenu open at a time.** Expanding Messaging closes Diagnostics; expanding Diagnostics closes Messaging.
2. **Messaging:** Opens by default only when the current route is under `/messaging`; otherwise starts collapsed.
3. **Diagnostics:** Always starts collapsed. Section is visually muted (opacity and lighter text).
4. **Platform** (Integrations, Settings) appears above Diagnostics; Diagnostics is last.

---

## Confirmation: no routes changed

- All hrefs are unchanged (e.g. `/messaging/assignments` for Routing).
- Only nav labels and grouping were updated. `/automations` and `/sitters/profile` are still valid; they are simply not in the owner sidebar list.
