/**
 * BookingForm — Step-by-step booking wizard
 *
 * Faithfully replicates the flow from public/booking-form.html.
 *
 * Steps:
 *   1  Service Selection (4 cards)
 *   2  Pet Info + Booking Type + 24/7 toggle
 *   3  Date Selection (calendar)
 *   4  Time Selection (per-date inline time grid)
 *   5  Pet Taxi addresses (only for pet-taxi)
 *   6  Contact info (owner: client search + manual; client: skipped)
 *
 * Supports owner and client variants, create and edit modes.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Dog,
  Home,
  Bone,
  Car,
  Heart,
  CalendarDays,
  Clock,
  User,
  Plus,
  Minus,
  ChevronDown,
  X,
  Search,
} from 'lucide-react';
import { BookingFormValues } from '@/lib/bookings/booking-form-mapper';

/* ─────────────────────────── Props ─────────────────────────── */

export interface BookingFormProps {
  mode: 'create' | 'edit';
  variant: 'owner' | 'client';
  initialValues?: Partial<BookingFormValues>;
  bookingId?: string;
  onSubmit: (values: BookingFormValues) => Promise<void>;
  onCancel: () => void;
}

/* ─────────────────────────── Constants ─────────────────────── */

const SERVICES = [
  { id: 'dog-walking', apiName: 'Dog Walking', icon: Dog, label: 'Dog Walking', desc: '30 or 60 minute walk' },
  { id: 'pet-sitting', apiName: 'Housesitting', icon: Home, label: 'House Sitting', desc: 'Daytime and overnight care' },
  { id: 'drop-in', apiName: 'Drop-ins', icon: Bone, label: 'Drop-in Visits', desc: '30 or 60 minute visit' },
  { id: 'pet-taxi', apiName: 'Pet Taxi', icon: Car, label: 'Pet Taxi', desc: 'Pet transport' },
] as const;

type ServiceId = (typeof SERVICES)[number]['id'];

const PET_TYPES = [
  { key: 'dogs', label: 'Dogs', species: 'Dog' },
  { key: 'cats', label: 'Cats', species: 'Cat' },
  { key: 'farm', label: 'Farm Animals', species: 'Farm Animal' },
  { key: 'reptiles', label: 'Reptiles', species: 'Reptile' },
  { key: 'birds', label: 'Birds', species: 'Bird' },
  { key: 'other', label: 'Other', species: 'Other' },
] as const;

type PetCounts = Record<string, number>;

interface TimeEntry {
  time: string;
  duration: number;
}

/* ─────────────────────────── Helpers ──────────────────────── */

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<{ date: string; day: number; disabled: boolean; today: boolean } | null> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dt.getTime() === today.getTime();
    days.push({ date: iso, day: d, disabled: dt < today, today: isToday });
  }
  return days;
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 22 && minute > 30) break;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const displayMinute = minute.toString().padStart(2, '0');
      slots.push(`${displayHour}:${displayMinute} ${period}`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

function convertTo24Hour(time12h: string): string {
  if (!time12h) return '09:00:00';
  const match = time12h.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '09:00:00';
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = match[3].toUpperCase();
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
}

function apiServiceName(serviceId: string, is247: boolean): string {
  if (serviceId === 'pet-sitting' && is247) return '24/7 Care';
  const svc = SERVICES.find((s) => s.id === serviceId);
  return svc?.apiName ?? 'Drop-ins';
}

function serviceIdFromApiName(name: string): ServiceId {
  if (name === '24/7 Care' || name === 'Housesitting') return 'pet-sitting';
  const found = SERVICES.find((s) => s.apiName === name);
  return (found?.id ?? 'drop-in') as ServiceId;
}

function isConsecutiveDate(existing: string[], newDate: string): boolean {
  if (existing.length === 0) return true;
  const nd = new Date(newDate).getTime();
  const sorted = [...existing].sort().map((d) => new Date(d).getTime());
  return sorted.some((d) => Math.abs(nd - d) === 86400000);
}

/* ─────────────────────── Client type ──────────────────────── */

interface ClientResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
}

interface ClientPet {
  id: string;
  name: string;
  species: string;
}

/* ──────────────────── Progress Indicator ──────────────────── */

function ProgressBar({
  currentStep,
  totalSteps,
  stepLabels,
}: {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}) {
  const pct = ((currentStep + 1) / totalSteps) * 100;
  return (
    <div className="mb-6">
      {/* Fill bar */}
      <div className="h-1 rounded-full bg-surface-tertiary mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Step circles */}
      <div className="flex items-center justify-between">
        {stepLabels.map((label, i) => {
          const completed = i < currentStep;
          const current = i === currentStep;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  completed
                    ? 'bg-green-500 text-white'
                    : current
                      ? 'bg-accent-primary text-text-inverse'
                      : 'bg-surface-tertiary text-text-tertiary'
                }`}
              >
                {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-[10px] font-medium text-text-secondary text-center leading-tight">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════ MAIN COMPONENT ═════════════════════════ */

export const BookingForm: React.FC<BookingFormProps> = ({
  mode,
  variant,
  initialValues,
  bookingId,
  onSubmit,
  onCancel,
}) => {
  /* ── Determine steps ─────────────────────────────────────────── */
  // We'll resolve step indices dynamically based on selected service
  // Steps conceptually: Service, PetInfo, Dates, Times, [PetTaxi], [Contact]

  /* ── State ───────────────────────────────────────────────────── */
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Service
  const [selectedService, setSelectedService] = useState<ServiceId | null>(
    initialValues?.service ? serviceIdFromApiName(initialValues.service) : null,
  );

  // Step 2: Pet info + booking type
  const [petCounts, setPetCounts] = useState<PetCounts>(() => {
    const defaults: PetCounts = { dogs: 0, cats: 0, farm: 0, reptiles: 0, birds: 0, other: 0 };
    if (initialValues?.pets) {
      initialValues.pets.forEach((p) => {
        const key = PET_TYPES.find((t) => t.species === p.species)?.key ?? 'other';
        defaults[key] = (defaults[key] || 0) + 1;
      });
    }
    return defaults;
  });
  const [petDropdownOpen, setPetDropdownOpen] = useState(false);
  const [bookingType, setBookingType] = useState<'one-time' | 'recurring' | null>(null);
  const [is247Care, setIs247Care] = useState(initialValues?.service === '24/7 Care');

  // Client variant: named pets
  const [clientPets, setClientPets] = useState<ClientPet[]>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(new Set());
  const [clientPetsLoaded, setClientPetsLoaded] = useState(false);

  // Step 3: Calendar
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDates, setSelectedDates] = useState<string[]>(initialValues?.selectedDates ?? []);

  // Step 4: Times
  const [dateTimes, setDateTimes] = useState<Record<string, TimeEntry[]>>(initialValues?.dateTimes ?? {});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [activeDuration, setActiveDuration] = useState<30 | 60>(30);

  // Step 5: Pet Taxi
  const [pickupAddress, setPickupAddress] = useState(initialValues?.pickupAddress ?? '');
  const [dropoffAddress, setDropoffAddress] = useState(initialValues?.dropoffAddress ?? '');

  // Step 6: Contact
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '');
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [phone, setPhone] = useState(initialValues?.phone ?? '');
  const [address, setAddress] = useState(initialValues?.address ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [policyAgreed, setPolicyAgreed] = useState(false);

  // Owner variant: client search
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);

  // Client variant: profile
  const [clientProfileLoaded, setClientProfileLoaded] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── Derived values ──────────────────────────────────────────── */

  const isPetTaxi = selectedService === 'pet-taxi';
  const isHouseSitting = selectedService === 'pet-sitting';
  const showDuration = !isHouseSitting && !isPetTaxi;

  const totalPets = useMemo(() => {
    if (variant === 'client' && clientPetsLoaded) return selectedPetIds.size;
    return Object.values(petCounts).reduce((a, b) => a + b, 0);
  }, [petCounts, variant, clientPetsLoaded, selectedPetIds]);

  // Build ordered step list
  const stepList = useMemo(() => {
    const steps: Array<{ key: string; label: string }> = [
      { key: 'service', label: 'Service' },
      { key: 'pets', label: 'Pets' },
      { key: 'dates', label: 'Dates' },
      { key: 'times', label: 'Times' },
    ];
    if (isPetTaxi) steps.push({ key: 'taxi', label: 'Addresses' });
    if (variant === 'owner') steps.push({ key: 'contact', label: 'Contact' });
    return steps;
  }, [isPetTaxi, variant]);

  const totalSteps = stepList.length;
  const currentStepKey = stepList[step]?.key ?? 'service';

  /* ── Client variant: fetch profile + pets ────────────────────── */

  useEffect(() => {
    if (variant !== 'client') return;
    if (clientProfileLoaded) return;
    fetch('/api/client/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          if (data.firstName) setFirstName(data.firstName);
          if (data.lastName) setLastName(data.lastName);
          if (data.phone) setPhone(data.phone);
          if (data.email) setEmail(data.email);
          if (data.address) setAddress(data.address);
        }
        setClientProfileLoaded(true);
      })
      .catch(() => setClientProfileLoaded(true));
  }, [variant, clientProfileLoaded]);

  useEffect(() => {
    if (variant !== 'client') return;
    if (clientPetsLoaded) return;
    fetch('/api/client/pets')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.pets?.length) {
          const pets: ClientPet[] = data.pets.map((p: { id: string; name: string; species?: string }) => ({
            id: p.id,
            name: p.name,
            species: p.species || 'Dog',
          }));
          setClientPets(pets);
          setSelectedPetIds(new Set(pets.map((p) => p.id)));
        }
        setClientPetsLoaded(true);
      })
      .catch(() => setClientPetsLoaded(true));
  }, [variant, clientPetsLoaded]);

  /* ── Owner variant: client search ────────────────────────────── */

  useEffect(() => {
    if (variant !== 'owner') return;
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setClientSearching(true);
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}`)
        .then((r) => (r.ok ? r.json() : { clients: [] }))
        .then((data) => {
          setClientResults(data.clients ?? data ?? []);
          setClientSearching(false);
        })
        .catch(() => {
          setClientResults([]);
          setClientSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, variant]);

  /* ── Close pet dropdown on outside click ─────────────────────── */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPetDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── Validation ──────────────────────────────────────────────── */

  const validateStep = useCallback(
    (s: number): boolean => {
      const key = stepList[s]?.key;
      switch (key) {
        case 'service':
          return selectedService !== null;
        case 'pets':
          return bookingType !== null && totalPets > 0;
        case 'dates':
          return selectedDates.length > 0;
        case 'times': {
          if (isHouseSitting) {
            const first = selectedDates[0];
            return !!first && !!dateTimes[first] && dateTimes[first].length > 0;
          }
          return selectedDates.every((d) => dateTimes[d] && dateTimes[d].length > 0);
        }
        case 'taxi':
          return pickupAddress.trim().length > 0 && dropoffAddress.trim().length > 0;
        case 'contact': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const phoneRegex = /^[\d\s\-()+ ]+$/;
          const hasBasic =
            firstName.trim().length > 0 &&
            lastName.trim().length > 0 &&
            emailRegex.test(email.trim()) &&
            phone.trim().length >= 10 &&
            phoneRegex.test(phone.trim()) &&
            policyAgreed;
          if (!hasBasic) return false;
          // Address required for non-taxi, non-housesitting
          if (!isPetTaxi && !isHouseSitting) return address.trim().length > 0;
          return true;
        }
        default:
          return false;
      }
    },
    [
      stepList,
      selectedService,
      bookingType,
      totalPets,
      selectedDates,
      dateTimes,
      isHouseSitting,
      pickupAddress,
      dropoffAddress,
      firstName,
      lastName,
      email,
      phone,
      address,
      policyAgreed,
      isPetTaxi,
    ],
  );

  const canProceed = validateStep(step);

  /* ── Navigation ──────────────────────────────────────────────── */

  const next = () => {
    if (canProceed && step < totalSteps - 1) setStep(step + 1);
  };
  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  /* ── Pet counter helpers ─────────────────────────────────────── */

  const updatePetCount = (key: string, delta: number) => {
    setPetCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(10, (prev[key] ?? 0) + delta)),
    }));
  };

  /* ── Date toggle ─────────────────────────────────────────────── */

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const idx = prev.indexOf(dateStr);
      if (idx > -1) {
        // Remove
        const next = prev.filter((d) => d !== dateStr);
        setDateTimes((dt) => {
          const copy = { ...dt };
          delete copy[dateStr];
          return copy;
        });
        return next;
      }
      // For house sitting, enforce consecutive
      if (isHouseSitting && !isConsecutiveDate(prev, dateStr)) {
        return prev; // silently refuse
      }
      return [...prev, dateStr].sort();
    });
  };

  /* ── Time slot toggle ────────────────────────────────────────── */

  const toggleTimeSlot = (dateStr: string, time: string) => {
    setDateTimes((prev) => {
      const existing = prev[dateStr] ?? [];
      const idx = existing.findIndex((e) => e.time === time);
      if (idx > -1) {
        return { ...prev, [dateStr]: existing.filter((_, i) => i !== idx) };
      }
      // House sitting: limit 1 time per date
      if (isHouseSitting && existing.length >= 1) return prev;
      const defaultDur = isHouseSitting || isPetTaxi ? 60 : activeDuration;
      return { ...prev, [dateStr]: [...existing, { time, duration: defaultDur }] };
    });
  };

  const setTimeSlotDuration = (dateStr: string, time: string, duration: number) => {
    setDateTimes((prev) => {
      const existing = prev[dateStr] ?? [];
      const idx = existing.findIndex((e) => e.time === time);
      if (idx > -1) {
        const updated = [...existing];
        updated[idx] = { ...updated[idx], duration };
        return { ...prev, [dateStr]: updated };
      }
      // If not yet selected, add it with this duration
      return { ...prev, [dateStr]: [...existing, { time, duration }] };
    });
  };

  const applyFirstDateTimesToAll = () => {
    if (selectedDates.length < 2) return;
    const firstTimes = dateTimes[selectedDates[0]] ?? [];
    if (firstTimes.length === 0) return;
    setDateTimes((prev) => {
      const updated = { ...prev };
      selectedDates.slice(1).forEach((d) => {
        updated[d] = [...firstTimes];
      });
      return updated;
    });
  };

  /* ── Select client (owner variant) ───────────────────────────── */

  const selectClient = (client: ClientResult) => {
    setSelectedClient(client);
    setFirstName(client.firstName);
    setLastName(client.lastName);
    setEmail(client.email);
    setPhone(client.phone);
    setAddress(client.address ?? '');
    setClientSearch('');
    setClientResults([]);
    setShowManualEntry(false);
  };

  /* ── Build payload and submit ────────────────────────────────── */

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setLoading(true);
    setError(null);

    try {
      const svcName = apiServiceName(selectedService!, is247Care);
      const sortedDates = [...selectedDates].sort();
      const firstDate = sortedDates[0];
      const firstTimes = dateTimes[firstDate] ?? [];
      const firstTime = firstTimes[0];

      const time24h = convertTo24Hour(firstTime?.time || '9:00 AM');
      const startDateTime = `${firstDate}T${time24h}`;
      const duration = firstTime?.duration || 30;

      const isHS = svcName === 'Housesitting' || svcName === '24/7 Care';

      let endDateTime: string;
      let _quantity: number;

      if (isHS && sortedDates.length > 1) {
        const lastDate = sortedDates[sortedDates.length - 1];
        const lastDateTimes = dateTimes[lastDate] ?? [];
        const lastTime = lastDateTimes[lastDateTimes.length - 1];
        if (lastTime?.time) {
          endDateTime = new Date(`${lastDate}T${convertTo24Hour(lastTime.time)}`).toISOString();
        } else {
          endDateTime = new Date(`${lastDate}T23:59:59`).toISOString();
        }
        _quantity = sortedDates.length - 1;
      } else {
        endDateTime = new Date(new Date(startDateTime).getTime() + duration * 60000).toISOString();
        _quantity = sortedDates.reduce((total, d) => total + (dateTimes[d]?.length || 0), 0) || 1;
      }

      // Build pets array
      let pets: Array<{ name: string; species: string }> = [];
      if (variant === 'client' && clientPetsLoaded && clientPets.length > 0) {
        pets = clientPets.filter((p) => selectedPetIds.has(p.id)).map((p) => ({ name: p.name, species: p.species }));
      } else {
        PET_TYPES.forEach(({ key, species }) => {
          const count = petCounts[key] || 0;
          for (let i = 0; i < count; i++) {
            pets.push({ name: `${species} ${i + 1}`, species });
          }
        });
      }
      if (pets.length === 0) pets = [{ name: 'Pet', species: 'Dog' }];

      const payload: BookingFormValues = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        ...(isPetTaxi ? { pickupAddress: pickupAddress.trim(), dropoffAddress: dropoffAddress.trim() } : {}),
        service: svcName,
        startAt: new Date(startDateTime).toISOString(),
        endAt: endDateTime,
        pets,
        selectedDates: sortedDates,
        dateTimes,
        notes: notes.trim() || undefined,
        afterHours: false,
        holiday: false,
        smsConsent: policyAgreed,
      };

      await onSubmit(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit booking';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Calendar data ───────────────────────────────────────────── */

  const days = getMonthDays(calYear, calMonth);
  const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /* ── Time formatting for display ─────────────────────────────── */

  const formatTimesForDate = (dateStr: string): string => {
    const times = dateTimes[dateStr] ?? [];
    if (times.length === 0) return '';
    if (isHouseSitting) return times.map((t) => t.time).join(', ');
    if (isPetTaxi) return times.map((t) => t.time).join(', ');
    return times.map((t) => `${t.time} (${t.duration}min)`).join(', ');
  };

  /* ── Step labels for progress ────────────────────────────────── */

  const stepLabels = stepList.map((s) => s.label);

  /* ─────────────────── RENDER ─────────────────────────────────── */

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <ProgressBar currentStep={step} totalSteps={totalSteps} stepLabels={stepLabels} />

      {/* ═══════════ STEP 1: SERVICE SELECTION ═══════════ */}
      {currentStepKey === 'service' && (
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border-default">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-tertiary text-accent-primary">
              <Dog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Choose Your Service</h2>
              <p className="text-sm text-text-secondary">Select the type of care your pet needs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              const isSelected = selectedService === svc.id;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => {
                    if (selectedService !== svc.id) {
                      // Reset downstream state on service change
                      setSelectedDates([]);
                      setDateTimes({});
                      setPetCounts({ dogs: 0, cats: 0, farm: 0, reptiles: 0, birds: 0, other: 0 });
                      setBookingType(null);
                      setIs247Care(false);
                      setPickupAddress('');
                      setDropoffAddress('');
                    }
                    setSelectedService(svc.id as ServiceId);
                  }}
                  className={`flex flex-col items-center text-center rounded-2xl p-3 min-h-[70px] transition-all ${
                    isSelected
                      ? 'bg-accent-tertiary border-2 border-accent-primary shadow-md'
                      : 'bg-surface-primary border-2 border-border-default hover:border-border-strong hover:shadow-sm'
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-1 ${isSelected ? 'text-accent-primary' : 'text-text-primary'}`} />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-accent-primary' : 'text-text-primary'}`}>
                    {svc.label}
                  </span>
                  <span className="text-xs text-text-secondary mt-0.5">{svc.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ STEP 2: PET INFO + BOOKING TYPE ═══════════ */}
      {currentStepKey === 'pets' && (
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border-default">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-tertiary text-accent-primary">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Tell Us About Your Pet</h2>
              <p className="text-sm text-text-secondary">Help us provide the best care</p>
            </div>
          </div>

          {/* Pet selection — client variant: named checkboxes */}
          {variant === 'client' && clientPetsLoaded && clientPets.length > 0 ? (
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Your Pets</label>
              <div className="flex flex-wrap gap-2">
                {clientPets.map((pet) => {
                  const checked = selectedPetIds.has(pet.id);
                  return (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() =>
                        setSelectedPetIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(pet.id)) next.delete(pet.id);
                          else next.add(pet.id);
                          return next;
                        })
                      }
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition min-h-[44px] ${
                        checked
                          ? 'bg-accent-tertiary border-2 border-accent-primary text-accent-primary'
                          : 'bg-surface-secondary border-2 border-transparent text-text-secondary'
                      }`}
                    >
                      <Dog className="h-4 w-4" />
                      {pet.name}
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Owner variant or no client pets: counters */
            <div className="rounded-xl bg-surface-secondary border border-border-default" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setPetDropdownOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl transition ${
                  petDropdownOpen ? 'bg-accent-tertiary border border-accent-primary' : ''
                }`}
              >
                <span className="text-base text-text-primary">
                  {totalPets > 0
                    ? PET_TYPES.filter((t) => (petCounts[t.key] ?? 0) > 0)
                        .map((t) => `${petCounts[t.key]} ${t.label}`)
                        .join(', ')
                    : 'Tap to add your pets'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-text-secondary transition-transform ${petDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {petDropdownOpen && (
                <div className="border-t border-border-default max-h-[200px] overflow-y-auto">
                  {PET_TYPES.map((pt) => (
                    <div
                      key={pt.key}
                      className="flex items-center justify-between px-4 py-3 border-b border-border-default last:border-b-0 min-h-[44px]"
                    >
                      <span className="text-base font-medium text-text-primary">{pt.label}</span>
                      <div className="flex items-center gap-2 rounded-md bg-surface-secondary border border-border-default px-1 py-0.5">
                        <button
                          type="button"
                          disabled={(petCounts[pt.key] ?? 0) <= 0}
                          onClick={() => updatePetCount(pt.key, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-primary text-sm font-semibold text-text-primary transition hover:bg-accent-primary hover:text-text-inverse disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-text-primary">
                          {petCounts[pt.key] ?? 0}
                        </span>
                        <button
                          type="button"
                          disabled={(petCounts[pt.key] ?? 0) >= 10}
                          onClick={() => updatePetCount(pt.key, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-primary text-sm font-semibold text-text-primary transition hover:bg-accent-primary hover:text-text-inverse disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Pet chips summary */}
              {totalPets > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-3 pt-2">
                  {PET_TYPES.filter((t) => (petCounts[t.key] ?? 0) > 0).map((t) => (
                    <span
                      key={t.key}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-tertiary text-accent-primary border border-accent-primary px-3 py-1 text-xs font-medium"
                    >
                      <Dog className="h-3 w-3" />
                      {petCounts[t.key]} {t.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Booking type toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'one-time' as const, icon: CalendarDays, label: 'One-time', desc: 'Single service booking' },
              { id: 'recurring' as const, icon: CalendarDays, label: 'Recurring', desc: 'Regular weekly service' },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = bookingType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBookingType(t.id)}
                  className={`flex flex-col items-center text-center rounded-2xl p-4 transition-all ${
                    isSelected
                      ? 'bg-accent-tertiary border-2 border-accent-primary shadow-md'
                      : 'bg-surface-primary border-2 border-border-default hover:border-border-strong'
                  }`}
                >
                  <Icon className={`h-6 w-6 mb-1 ${isSelected ? 'text-accent-primary' : 'text-text-primary'}`} />
                  <span className={`text-base font-semibold ${isSelected ? 'text-accent-primary' : 'text-text-primary'}`}>
                    {t.label}
                  </span>
                  <span className="text-sm text-text-secondary mt-0.5">{t.desc}</span>
                </button>
              );
            })}
          </div>

          {/* 24/7 care option for house sitting */}
          {isHouseSitting && (
            <button
              type="button"
              onClick={() => setIs247Care((v) => !v)}
              className={`flex items-center gap-3 w-full rounded-lg px-4 py-3 text-sm font-medium transition min-h-[44px] ${
                is247Care
                  ? 'bg-accent-primary text-text-inverse border-2 border-accent-primary'
                  : 'bg-surface-primary text-text-primary border-2 border-border-default hover:border-accent-primary'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>24/7 Care</span>
            </button>
          )}
        </div>
      )}

      {/* ═══════════ STEP 3: DATE SELECTION ═══════════ */}
      {currentStepKey === 'dates' && (
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border-default">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-tertiary text-accent-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Choose Your Dates</h2>
              <p className="text-sm text-text-secondary">Select the dates you need care</p>
            </div>
          </div>

          <div className="mx-auto max-w-[420px] rounded-xl bg-surface-secondary border border-border-default p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-tertiary transition"
              >
                <ChevronLeft className="h-5 w-5 text-text-primary" />
              </button>
              <span className="text-lg font-semibold text-text-primary">{formatMonthYear(calYear, calMonth)}</span>
              <button
                type="button"
                onClick={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else {
                    setCalMonth((m) => m + 1);
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-tertiary transition"
              >
                <ChevronRight className="h-5 w-5 text-text-primary" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-text-primary py-2">
                  {d}
                </div>
              ))}
              {/* Calendar days */}
              {days.map((d, i) =>
                d ? (
                  <button
                    key={d.date}
                    type="button"
                    disabled={d.disabled}
                    onClick={() => toggleDate(d.date)}
                    className={`aspect-square flex items-center justify-center rounded-md text-sm font-medium transition min-h-[44px] border ${
                      d.disabled
                        ? 'opacity-30 cursor-not-allowed bg-surface-tertiary border-border-default'
                        : selectedDates.includes(d.date)
                          ? 'bg-accent-primary text-text-inverse border-accent-primary shadow-md'
                          : d.today
                            ? 'bg-accent-tertiary border-accent-primary font-semibold text-text-primary'
                            : 'bg-surface-primary border-border-default text-text-primary hover:border-accent-primary hover:bg-accent-tertiary'
                    }`}
                  >
                    {d.day}
                  </button>
                ) : (
                  <div key={`empty-${i}`} className="aspect-square" />
                ),
              )}
            </div>
          </div>

          {/* Selected dates summary */}
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {[...selectedDates].sort().map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-tertiary text-accent-primary border border-accent-primary px-3 py-1 text-xs font-medium"
                >
                  {formatDateShort(d)}
                  <button type="button" onClick={() => toggleDate(d)} className="ml-0.5 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ STEP 4: TIME SELECTION ═══════════ */}
      {currentStepKey === 'times' && (
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border-default">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-tertiary text-accent-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Select Times</h2>
              <p className="text-sm text-text-secondary">Choose the best times for your pet&apos;s care</p>
            </div>
          </div>

          {/* Apply all button */}
          {!isHouseSitting && selectedDates.length > 1 && (dateTimes[selectedDates[0]]?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={applyFirstDateTimesToAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-surface-primary border border-border-default text-text-primary hover:bg-surface-secondary transition min-h-[28px]"
            >
              Apply {formatDateShort(selectedDates[0])} Times to All
            </button>
          )}

          {/* Dates list */}
          <div className="mx-auto max-w-[420px] rounded-xl bg-surface-secondary border border-border-default p-4 space-y-2 max-h-[500px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base font-semibold text-text-primary">Your Selected Dates</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-text-inverse text-xs font-bold">
                {selectedDates.length}
              </span>
            </div>

            {(() => {
              const sorted = [...selectedDates].sort();
              const datesToShow =
                isHouseSitting && sorted.length > 1 ? [sorted[0], sorted[sorted.length - 1]] : sorted;
              return datesToShow.map((dateStr) => {
                const times = dateTimes[dateStr] ?? [];
                const isExpanded = expandedDate === dateStr;
                return (
                  <div key={dateStr} className="rounded-lg border border-border-default bg-surface-primary">
                    {/* Date row */}
                    <div className="flex items-center justify-between px-3 py-2 min-h-[44px]">
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium text-text-primary">{formatDateLong(dateStr)}</div>
                        <div className="text-xs text-text-secondary">
                          {times.length > 0 ? formatTimesForDate(dateStr) : <em>No times selected</em>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedDate(isExpanded ? null : dateStr)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-tertiary text-accent-primary hover:bg-accent-primary hover:text-text-inverse transition"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDate(dateStr)}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-red-100 hover:text-red-600 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline time grid */}
                    {isExpanded && (
                      <div className="border-t border-border-default p-3 space-y-3">
                        {/* Title */}
                        <div className="text-center">
                          <span className="text-sm font-semibold text-text-primary">
                            {isHouseSitting
                              ? dateStr === selectedDates[0]
                                ? 'Select Start Time'
                                : 'Select End Time'
                              : 'Select Times'}
                          </span>
                        </div>

                        {/* Duration toggle (only for non-housesitting, non-taxi) */}
                        {showDuration && (
                          <div className="flex rounded-xl bg-surface-secondary p-1 gap-1">
                            {([30, 60] as const).map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setActiveDuration(d)}
                                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                                  activeDuration === d
                                    ? 'bg-accent-primary text-text-inverse'
                                    : 'text-text-tertiary hover:text-text-secondary bg-transparent'
                                }`}
                              >
                                {d} min
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Time slots */}
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                          {TIME_SLOTS.map((time) => {
                            const entry = (dateTimes[dateStr] ?? []).find((e) => e.time === time);
                            const isSelected = !!entry;
                            return (
                              <div
                                key={time}
                                onClick={() => toggleTimeSlot(dateStr, time)}
                                className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 cursor-pointer transition min-h-[56px] ${
                                  isSelected
                                    ? 'border-accent-primary bg-accent-tertiary'
                                    : 'border-border-default bg-surface-primary hover:border-accent-primary hover:bg-accent-tertiary'
                                }`}
                              >
                                <span className="text-sm font-medium text-text-primary">{time}</span>
                                {showDuration && (
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    {([30, 60] as const).map((d) => (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTimeSlotDuration(dateStr, time, d);
                                        }}
                                        className={`px-2 py-0.5 rounded text-xs font-semibold transition min-w-[28px] ${
                                          isSelected && entry?.duration === d
                                            ? 'bg-accent-primary text-text-inverse'
                                            : !isSelected && activeDuration === d
                                              ? 'bg-accent-primary text-text-inverse'
                                              : 'bg-surface-tertiary text-text-primary hover:bg-accent-tertiary'
                                        }`}
                                      >
                                        {d}m
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedDate(null)}
                          className="w-full mt-2 rounded-lg border border-border-default bg-surface-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary transition min-h-[44px]"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ═══════════ STEP 5: PET TAXI ADDRESSES ═══════════ */}
      {currentStepKey === 'taxi' && (
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border-default">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-tertiary text-accent-primary">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Transportation Details</h2>
              <p className="text-sm text-text-secondary">Tell us where to pick up and drop off your pet</p>
            </div>
          </div>

          <div className="mx-auto max-w-[540px] rounded-xl bg-surface-secondary border border-border-default p-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Pickup Address</label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Enter pickup location"
                className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Dropoff Address</label>
              <input
                type="text"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                placeholder="Enter dropoff location"
                className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 6: CONTACT INFO (owner only) ═══════════ */}
      {currentStepKey === 'contact' && (
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border-default">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-tertiary text-accent-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Contact Information</h2>
              <p className="text-sm text-text-secondary">We&apos;ll use this to confirm the booking</p>
            </div>
          </div>

          {/* Owner variant: client search */}
          {variant === 'owner' && !showManualEntry && !selectedClient && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients by name, email, or phone..."
                  className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary pl-10 pr-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition"
                />
              </div>
              {clientSearching && (
                <p className="text-sm text-text-tertiary">Searching...</p>
              )}
              {clientResults.length > 0 && (
                <div className="rounded-lg border border-border-default divide-y divide-border-default max-h-[200px] overflow-y-auto">
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-secondary transition min-h-[44px]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tertiary text-accent-primary text-xs font-bold">
                        {c.firstName?.[0]}
                        {c.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-xs text-text-tertiary">{c.email} {c.phone ? `/ ${c.phone}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className="text-sm font-medium text-accent-primary hover:underline"
              >
                + Add new client
              </button>
            </div>
          )}

          {/* Selected client badge (owner) */}
          {variant === 'owner' && selectedClient && (
            <div className="flex items-center justify-between rounded-lg bg-accent-tertiary border border-accent-primary px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {selectedClient.firstName} {selectedClient.lastName}
                </p>
                <p className="text-xs text-text-secondary">{selectedClient.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedClient(null);
                  setFirstName('');
                  setLastName('');
                  setEmail('');
                  setPhone('');
                  setAddress('');
                }}
                className="text-xs text-accent-primary hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* Manual entry form */}
          {(variant === 'owner' && (showManualEntry || selectedClient)) && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none transition"
                />
              </div>

              {/* Address (not shown for pet-taxi or house-sitting) */}
              {!isPetTaxi && !isHouseSitting && (
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Service Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter service address"
                    className="w-full min-h-[44px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Additional Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional notes, questions or preferred sitter"
                  className="w-full min-h-[100px] rounded-lg border-2 border-border-default bg-surface-primary px-4 py-3 text-base text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none resize-y transition"
                />
              </div>

              {/* Terms of Service */}
              <div className="flex items-start gap-3 rounded-lg bg-surface-secondary border border-border-default p-4">
                <input
                  type="checkbox"
                  checked={policyAgreed}
                  onChange={(e) => setPolicyAgreed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-border-default text-accent-primary focus:ring-accent-primary flex-shrink-0"
                />
                <label className="text-sm font-medium text-text-primary leading-relaxed">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline">
                    Privacy Policy
                  </a>
                  , and I consent to receive SMS text messages from Snout Pet Care regarding this booking, including
                  confirmations, reminders, and updates. Message and data rates may apply. Reply STOP to opt out at any time.
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-status-danger-bg border border-status-danger-border px-4 py-3">
              <p className="text-sm text-status-danger-text">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ NAVIGATION BUTTONS ═══════════ */}
      <div className="flex items-center justify-between mt-4">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-1 rounded-lg border-2 border-border-default bg-surface-primary px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary hover:border-border-strong transition min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-lg border-2 border-border-default bg-surface-primary px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary hover:border-border-strong transition min-h-[44px]"
          >
            Cancel
          </button>
        )}

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canProceed}
            className="flex items-center gap-1 rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-semibold text-text-inverse shadow-sm hover:brightness-90 transition min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStepKey === 'service' && 'Continue to Pet Info'}
            {currentStepKey === 'pets' && 'Continue to Dates'}
            {currentStepKey === 'dates' && 'Continue to Times'}
            {currentStepKey === 'times' && (isPetTaxi ? 'Continue to Addresses' : variant === 'owner' ? 'Continue to Contact' : 'Continue')}
            {currentStepKey === 'taxi' && 'Continue to Contact'}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !canProceed}
            className="flex items-center gap-1 rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-semibold text-text-inverse shadow-sm hover:brightness-90 transition min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Complete Booking'}
            {!loading && <Check className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
};
