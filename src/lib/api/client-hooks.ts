/**
 * React Query hooks for Client Portal API calls.
 *
 * Uses cookie auth (NextAuth session) — plain fetch(), not apiGet/apiPost.
 * Every query hook returns the standard useQuery result.
 * Every mutation hook invalidates the relevant queries on success.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Shared fetch helper ────────────────────────────────────────────

async function clientFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Response interfaces ────────────────────────────────────────────

export interface ClientHomeData {
  clientName: string;
  upcomingCount: number;
  upcomingBookings: Array<{
    id: string;
    service: string;
    startAt: string;
    status: string;
    sitterName?: string | null;
  }>;
  recentBookings: Array<{
    id: string;
    service: string;
    startAt: string;
    status: string;
    sitterName?: string | null;
  }>;
  latestReport?: {
    id: string;
    content: string;
    createdAt: string;
    service?: string;
    mediaUrls?: string | null;
  } | null;
  pets: Array<{
    id: string;
    name: string | null;
    species: string | null;
    photoUrl: string | null;
  }>;
}

export interface ClientOnboardingStatus {
  hasAccount: boolean;
  hasPets: boolean;
  hasEmergencyContact: boolean;
  hasAddress: boolean;
  hasHomeAccess: boolean;
  completionPercent: number;
}

export interface ClientBooking {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
  sitter: { id: string; name: string } | null;
  threadId: string | null;
}

export interface ClientBookingDetail {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
  paymentStatus?: string;
  totalPrice?: number;
  address: string | null;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
  sitter?: { name: string; tier: string | null; profile?: { tierLabel: string | null; statements: string[] } | null } | null;
  pricingSnapshot?: string | null;
  checkedInAt?: string | null;
  reportId?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  paymentProof?: {
    status: string;
    amount: number;
    paidAt: string;
    bookingReference: string;
    invoiceReference: string;
    paymentIntentId: string | null;
    currency: string;
    receiptLink: string | null;
  } | null;
}

export interface ClientThread {
  id: string;
  status: string;
  lastActivityAt: string | null;
  sitter: { id: string; name: string } | null;
  booking: { id: string; service: string; startAt: string | null } | null;
  preview: string | null;
}

export interface ClientMessage {
  id: string;
  body: string;
  direction: string;
  actorType: string;
  createdAt: string;
  isFromClient: boolean;
}

export interface ClientThreadDetail {
  id: string;
  status: string;
  sitter: { id: string; name: string } | null;
  booking: { id: string; service: string; startAt: string } | null;
  messages: ClientMessage[];
}

export interface ClientPet {
  id: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  weight: number | null;
  photoUrl: string | null;
}

export interface ClientPetHealthLog {
  id: string;
  type: string;
  note: string;
  createdAt: string;
}

export interface ClientPetEmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

export interface ClientPetDetail {
  id: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  birthday: string | null;
  color: string | null;
  microchipId: string | null;
  isFixed: boolean;
  photoUrl: string | null;
  feedingInstructions: string | null;
  medicationNotes: string | null;
  behaviorNotes: string | null;
  houseRules: string | null;
  walkInstructions: string | null;
  vetName: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
  vetClinicName: string | null;
  notes: string | null;
  healthLogs: ClientPetHealthLog[];
  emergencyContacts: ClientPetEmergencyContact[];
}

export interface ClientBillingData {
  invoices: Array<{
    id: string;
    service: string;
    startAt: string;
    totalPrice: number;
    paymentLink: string | null;
    paymentStatus: string;
    sitterName: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    bookingId: string | null;
  }>;
  paidCompletions: Array<{
    status: string;
    amount: number;
    paidAt: string;
    bookingService: string | null;
    bookingStartAt: string | null;
    invoiceReference: string;
    receiptLink: string | null;
  }>;
  loyalty: { points: number; tier: string };
  loyaltySummary: {
    availablePoints: number;
    redeemablePoints: number;
    redeemableDiscount: number;
  };
  referrals: {
    referralCode: string | null;
    referralCount: number;
    qualifiedReferralCount: number;
  };
}

export interface ClientReport {
  id: string;
  content: string;
  mediaUrls: string | null;
  personalNote: string | null;
  visitStarted: string | null;
  visitCompleted: string | null;
  createdAt: string | null;
  clientRating: number | null;
  sentAt: string | null;
  bookingId: string | null;
  sitterName: string | null;
  booking: { id: string; service: string; startAt: string | null } | null;
}

export interface ClientReportDetail {
  id: string;
  content: string;
  mediaUrls: string | null;
  walkDuration: number | null;
  pottyNotes: string | null;
  foodNotes: string | null;
  waterNotes: string | null;
  medicationNotes: string | null;
  behaviorNotes: string | null;
  personalNote: string | null;
  visitStarted: string | null;
  visitCompleted: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  clientRating: number | null;
  clientFeedback: string | null;
  ratedAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
  sitterName: string | null;
  booking: {
    id: string;
    service: string;
    startAt: string | null;
    endAt: string | null;
    pets: Array<{ name: string; species: string }>;
  } | null;
}

export interface ClientProfileData {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  keyLocation: string | null;
  lockboxCode: string | null;
  doorAlarmCode: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  entryInstructions: string | null;
  parkingNotes: string | null;
}

export interface ClientEmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

export interface ClientReferralData {
  referralCode: string;
  referralCount: number;
  qualifiedReferralCount: number;
  bonusPoints: number;
}

// ─── Query hooks ────────────────────────────────────────────────────

export function useClientHome() {
  return useQuery({
    queryKey: ['client', 'home'],
    queryFn: () => clientFetch<ClientHomeData>('/api/client/home'),
    refetchInterval: 45000,
  });
}

export function useClientOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: ['client', 'onboarding-status'],
    queryFn: () => clientFetch<ClientOnboardingStatus>('/api/client/onboarding-status'),
    enabled,
  });
}

export function useClientBookings(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['client', 'bookings', page, pageSize],
    queryFn: () =>
      clientFetch<{ items: ClientBooking[]; total: number }>(
        `/api/client/bookings?page=${page}&pageSize=${pageSize}`
      ),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useClientBookingDetail(id: string | null) {
  return useQuery({
    queryKey: ['client', 'bookings', id],
    queryFn: () => clientFetch<ClientBookingDetail>(`/api/client/bookings/${id}`),
    enabled: !!id && id !== 'new',
  });
}

export function useClientMessages() {
  return useQuery({
    queryKey: ['client', 'messages'],
    queryFn: () => clientFetch<{ threads: ClientThread[] }>('/api/client/messages'),
  });
}

export function useClientMessageThread(id: string | null) {
  return useQuery({
    queryKey: ['client', 'messages', id],
    queryFn: () => clientFetch<ClientThreadDetail>(`/api/client/messages/${id}`),
    refetchInterval: 8000,
    enabled: !!id,
  });
}

export function useClientPets() {
  return useQuery({
    queryKey: ['client', 'pets'],
    queryFn: () => clientFetch<{ pets: ClientPet[] }>('/api/client/pets'),
  });
}

export function useClientPetDetail(id: string | null) {
  return useQuery({
    queryKey: ['client', 'pets', id],
    queryFn: () => clientFetch<ClientPetDetail>(`/api/client/pets/${id}`),
    enabled: !!id,
  });
}

export function useClientBilling() {
  return useQuery({
    queryKey: ['client', 'billing'],
    queryFn: () => clientFetch<ClientBillingData>('/api/client/billing'),
  });
}

export function useClientMe(enabled = true) {
  return useQuery({
    queryKey: ['client', 'me'],
    queryFn: () => clientFetch<ClientProfileData>('/api/client/me'),
    enabled,
  });
}

export function useClientProfile() {
  return useQuery({
    queryKey: ['client', 'profile'],
    queryFn: async () => {
      const [profile, contactsRes] = await Promise.all([
        clientFetch<ClientProfileData>('/api/client/me'),
        clientFetch<{ contacts: ClientEmergencyContact[] }>('/api/client/emergency-contacts'),
      ]);
      return { profile, contacts: contactsRes.contacts ?? [] };
    },
  });
}

export function useClientReferral() {
  return useQuery({
    queryKey: ['client', 'referral'],
    queryFn: () => clientFetch<ClientReferralData>('/api/client/referral'),
  });
}

export function useClientReports() {
  return useQuery({
    queryKey: ['client', 'reports'],
    queryFn: () => clientFetch<{ reports: ClientReport[] }>('/api/client/reports'),
    refetchInterval: 30000,
  });
}

export function useClientReportDetail(id: string | null) {
  return useQuery({
    queryKey: ['client', 'reports', id],
    queryFn: () => clientFetch<ClientReportDetail>(`/api/client/reports/${id}`),
    enabled: !!id,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────

export function useSendClientMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      clientFetch<{ messageId: string }>(`/api/client/messages/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'messages', threadId] });
    },
  });
}

export function useCancelBooking(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientFetch<{ success: boolean }>(`/api/client/bookings/${bookingId}/cancel`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'bookings', bookingId] });
      qc.invalidateQueries({ queryKey: ['client', 'bookings'] });
    },
  });
}

export function useSubmitBookingComplaint(bookingId: string) {
  return useMutation({
    mutationFn: (data: { issueType: string; description: string }) =>
      clientFetch<{ success: boolean }>(`/api/client/bookings/${bookingId}/complaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateClientBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      clientFetch<{ id: string }>('/api/client/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'bookings'] });
    },
  });
}

export function useCreateClientPet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      clientFetch<{ id: string }>('/api/client/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'pets'] });
    },
  });
}

export function useUpdateClientPet(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      clientFetch<{ success: boolean }>(`/api/client/pets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'pets', id] });
      qc.invalidateQueries({ queryKey: ['client', 'pets'] });
    },
  });
}

export function useAddPetHealthLog(petId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string; note: string }) =>
      clientFetch<{ id: string }>(`/api/client/pets/${petId}/health-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'pets', petId] });
    },
  });
}

export function useUpdateClientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ClientProfileData>) =>
      clientFetch<{ success: boolean }>('/api/client/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'profile'] });
    },
  });
}

export function useAddEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone: string; relationship?: string }) =>
      clientFetch<{ id: string }>('/api/client/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'profile'] });
    },
  });
}

export function useDeleteEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      clientFetch<{ success: boolean }>(`/api/client/emergency-contacts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'profile'] });
    },
  });
}

export function useRateReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { rating: number; feedback?: string }) =>
      clientFetch<{ success: boolean }>(`/api/client/reports/${reportId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'reports', reportId] });
      qc.invalidateQueries({ queryKey: ['client', 'reports'] });
    },
  });
}

export function useClientPaymentMethods() {
  return useQuery({
    queryKey: ['client', 'payment-methods'],
    queryFn: () => clientFetch<{ methods: any[]; hasCustomer: boolean }>('/api/client/payment-methods'),
  });
}

export function useAddPaymentMethod() {
  return useMutation({
    mutationFn: () =>
      clientFetch<{ clientSecret: string; customerId: string }>('/api/client/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
  });
}

export function useRemovePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      clientFetch<{ success: boolean }>(`/api/client/payment-methods?id=${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'payment-methods'] });
    },
  });
}

export function useRedeemLoyaltyPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (maxPoints?: number) =>
      clientFetch<{
        success: boolean;
        discountDollars: number;
        pointsUsed: number;
        remainingPoints: number;
        appliedToBookingId?: string | null;
        message?: string;
        error?: string;
      }>('/api/client/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify(maxPoints != null ? { maxPoints } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'billing'] });
    },
  });
}

export function useSubmitMeetGreet() {
  return useMutation({
    mutationFn: (data: { preferredDateTime: string; notes?: string }) =>
      clientFetch<{ success: boolean }>('/api/client/meet-greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
  });
}

// ─── Recurring schedule hooks ───────────────────────────────────────

export function useClientRecurringSchedules() {
  return useQuery({
    queryKey: ['client', 'recurring-schedules'],
    queryFn: () => clientFetch<{ schedules: any[] }>('/api/client/recurring-schedules'),
  });
}

export function useCreateRecurringSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      clientFetch<{ schedule: { id: string }; bookingsCreated: number }>('/api/client/recurring-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'recurring-schedules'] });
      qc.invalidateQueries({ queryKey: ['client', 'bookings'] });
    },
  });
}

export function useUpdateRecurringSchedule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      clientFetch(`/api/client/recurring-schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'recurring-schedules'] });
      qc.invalidateQueries({ queryKey: ['client', 'bookings'] });
    },
  });
}

export function useCancelRecurringSchedule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientFetch(`/api/client/recurring-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', 'recurring-schedules'] });
      qc.invalidateQueries({ queryKey: ['client', 'bookings'] });
    },
  });
}

// ─── Branding ──────────────────────────────────────────────────────

export interface OrgBranding {
  businessName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export function useBranding() {
  return useQuery<OrgBranding | null>({
    queryKey: ['branding'],
    queryFn: async () => {
      const res = await fetch('/api/settings/branding');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
