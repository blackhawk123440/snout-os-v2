/**
 * BookingForm Component
 *
 * EXACT MATCH to booking-form.html structure:
 * - Service cards (visual selection matching HTML)
 * - Pet counters (dogs, cats, farm, reptiles, birds, other)
 * - Booking type (one-time, recurring)
 * - 24/7 Care option for house sitting
 * - Calendar date picker
 * - Time slot selection
 * - Pet Taxi addresses (conditional)
 * - Contact information (exact field order and labels)
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, FormRow, SectionHeader } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { BookingFormValues } from '@/lib/bookings/booking-form-mapper';

export interface BookingFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<BookingFormValues>;
  bookingId?: string;
  onSubmit: (values: BookingFormValues) => Promise<void>;
  onCancel: () => void;
}

// Service cards matching booking-form.html exactly
const SERVICE_CARDS = [
  {
    dataService: 'dog-walking',
    name: 'Dog Walking',
    description: '30 or 60 minute walk',
    icon: '🐕',
    apiName: 'Dog Walking'
  },
  {
    dataService: 'pet-sitting',
    name: 'House Sitting',
    description: 'Daytime and overnight care',
    icon: '🏠',
    apiName: 'Housesitting'
  },
  {
    dataService: 'drop-in',
    name: 'Drop-in Visits',
    description: '30 or 60 minute visit',
    icon: '🦴',
    apiName: 'Drop-ins'
  },
  {
    dataService: 'pet-taxi',
    name: 'Pet Taxi',
    description: 'Pet transport',
    icon: '🚗',
    apiName: 'Pet Taxi'
  },
] as const;

const PET_TYPES = [
  { key: 'dogs', label: 'Dogs', species: 'Dog' },
  { key: 'cats', label: 'Cats', species: 'Cat' },
  { key: 'farm', label: 'Farm Animals', species: 'Farm Animal' },
  { key: 'reptiles', label: 'Reptiles', species: 'Reptile' },
  { key: 'birds', label: 'Birds', species: 'Bird' },
  { key: 'other', label: 'Other', species: 'Other' },
] as const;

// Time slots matching HTML form (9:00 AM to 10:30 PM, 30-minute intervals)
const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let hour = 9; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m} ${period}`);
    }
  }
  return slots;
})();

export const BookingForm: React.FC<BookingFormProps> = ({
  mode,
  initialValues,
  onSubmit,
  onCancel,
}) => {
  const isMobile = useMobile();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Service selection (matching HTML form data-service values)
  const [selectedService, setSelectedService] = useState<string | null>(null);

  // Pet counters matching booking-form.html
  const [petCounts, setPetCounts] = useState({
    dogs: 0,
    cats: 0,
    farm: 0,
    reptiles: 0,
    birds: 0,
    other: 0,
  });
  const [otherPetType, setOtherPetType] = useState('');
  const [bookingType, setBookingType] = useState<'one-time' | 'recurring'>('one-time');
  const [is247Care, setIs247Care] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  // Client saved pets (fetched when phone matches existing client)
  const [savedPets, setSavedPets] = useState<Array<{ id: string; name: string; species: string; selected: boolean }>>([]);
  const [savedPetsLoaded, setSavedPetsLoaded] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dateTimes, setDateTimes] = useState<Record<string, Array<{ time: string; duration: number }>>>({});
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeModalDate, setTimeModalDate] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<BookingFormValues>({
    firstName: initialValues?.firstName || '',
    lastName: initialValues?.lastName || '',
    phone: initialValues?.phone || '',
    email: initialValues?.email || '',
    address: initialValues?.address || '',
    pickupAddress: initialValues?.pickupAddress || '',
    dropoffAddress: initialValues?.dropoffAddress || '',
    service: initialValues?.service || 'Dog Walking',
    startAt: initialValues?.startAt || new Date().toISOString(),
    endAt: initialValues?.endAt || new Date(Date.now() + 3600000).toISOString(),
    pets: initialValues?.pets || [],
    notes: initialValues?.notes || '',
    selectedDates: initialValues?.selectedDates || [],
    dateTimes: initialValues?.dateTimes || {},
    afterHours: initialValues?.afterHours || false,
    holiday: initialValues?.holiday || false,
  });

  // Fetch client's saved pets when phone is entered (owner booking flow)
  useEffect(() => {
    if (savedPetsLoaded || !formValues.phone || formValues.phone.length < 7) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?page=1&pageSize=1&search=${encodeURIComponent(formValues.phone)}`);
        if (!res.ok) return;
        const json = await res.json();
        const client = json.items?.[0];
        if (!client?.id) return;
        const petsRes = await fetch(`/api/clients/${client.id}/pets`);
        if (!petsRes.ok) return;
        const petsJson = await petsRes.json();
        if (Array.isArray(petsJson.pets) && petsJson.pets.length > 0) {
          setSavedPets(petsJson.pets.map((p: any) => ({ id: p.id, name: p.name || 'Pet', species: p.species || 'Dog', selected: true })));
        }
        setSavedPetsLoaded(true);
      } catch { /* silent */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [formValues.phone, savedPetsLoaded]);

  // Initialize from initialValues
  useEffect(() => {
    if (initialValues) {
      // Set service from initial values
      const serviceCard = SERVICE_CARDS.find(c => c.apiName === initialValues.service);
      if (serviceCard) {
        setSelectedService(serviceCard.dataService);
      }

      // Set selected dates and dateTimes
      if (initialValues.selectedDates) {
        setSelectedDates(initialValues.selectedDates);
      }
      if (initialValues.dateTimes) {
        setDateTimes(initialValues.dateTimes);
      }

      // Convert pets to pet counts
      if (initialValues.pets) {
        const counts = { dogs: 0, cats: 0, farm: 0, reptiles: 0, birds: 0, other: 0 };
        initialValues.pets.forEach(pet => {
          const species = pet.species.toLowerCase();
          if (species.includes('dog')) counts.dogs++;
          else if (species.includes('cat')) counts.cats++;
          else if (species.includes('farm')) counts.farm++;
          else if (species.includes('reptile')) counts.reptiles++;
          else if (species.includes('bird')) counts.birds++;
          else counts.other++;
        });
        setPetCounts(counts);
      }

      // Set 24/7 Care
      if (initialValues.service === '24/7 Care') {
        setIs247Care(true);
        setSelectedService('pet-sitting');
      }
    }
  }, [initialValues]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> = [];

    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: date.toISOString().split('T')[0],
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        dateStr: date.toISOString().split('T')[0],
      });
    }

    // Next month days to fill grid
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: date.toISOString().split('T')[0],
      });
    }

    return days;
  }, [currentMonth]);

  const handleDateClick = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
      const newDateTimes = { ...dateTimes };
      delete newDateTimes[dateStr];
      setDateTimes(newDateTimes);
    } else {
      setSelectedDates([...selectedDates, dateStr].sort());
      if (!dateTimes[dateStr]) {
        setDateTimes({ ...dateTimes, [dateStr]: [] });
      }
    }
  };

  const openTimeModal = (dateStr: string) => {
    setTimeModalDate(dateStr);
    setTimeModalOpen(true);
  };

  const selectTimeSlot = (time: string, duration: 30 | 60) => {
    if (!timeModalDate) return;

    const existing = dateTimes[timeModalDate] || [];
    const existingIndex = existing.findIndex(e => e.time === time);

    if (existingIndex > -1) {
      // Toggle off if same duration, or replace if different
      if (existing[existingIndex].duration === duration) {
        const updated = existing.filter((_, i) => i !== existingIndex);
        setDateTimes({ ...dateTimes, [timeModalDate]: updated });
      } else {
        const updated = [...existing];
        updated[existingIndex] = { time, duration };
        setDateTimes({ ...dateTimes, [timeModalDate]: updated });
      }
    } else {
      // Add new time slot
      setDateTimes({ ...dateTimes, [timeModalDate]: [...existing, { time, duration }] });
    }
  };

  // Convert pet counts to pets array - matching booking-form.html exactly
  const buildPetsArray = (): Array<{ name: string; species: string }> => {
    const pets: Array<{ name: string; species: string }> = [];

    PET_TYPES.forEach(({ key, species }) => {
      const count = petCounts[key];
      for (let i = 0; i < count; i++) {
        if (key === 'other') {
          pets.push({
            name: otherPetType || 'Pet',
            species: otherPetType || 'Other',
          });
        } else {
          pets.push({
            name: `${species} ${i + 1}`,
            species: species,
          });
        }
      }
    });

    // Include selected saved pets
    const selectedSaved = savedPets.filter((p) => p.selected);
    if (selectedSaved.length > 0) {
      for (const sp of selectedSaved) {
        if (!pets.some((p) => p.name === sp.name && p.species === sp.species)) {
          pets.push({ name: sp.name, species: sp.species });
        }
      }
    }

    if (pets.length === 0 && formValues.pets.length > 0) {
      return formValues.pets;
    }

    if (pets.length === 0) {
      return [{ name: 'Pet', species: 'Dog' }];
    }

    return pets;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation matching HTML form
    const newErrors: Record<string, string> = {};
    if (!formValues.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formValues.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formValues.email.trim()) newErrors.email = 'Email is required';
    if (!formValues.phone.trim()) newErrors.phone = 'Phone is required';
    if (!selectedService) newErrors.service = 'Service is required';

    const pets = buildPetsArray();
    if (pets.length === 0) {
      newErrors.pets = 'At least one pet is required';
    }

    const isPetTaxi = selectedService === 'pet-taxi';
    const isHouseSitting = selectedService === 'pet-sitting';

    if (isPetTaxi) {
      if (!formValues.pickupAddress?.trim()) newErrors.pickupAddress = 'Pickup address is required for Pet Taxi';
      if (!formValues.dropoffAddress?.trim()) newErrors.dropoffAddress = 'Dropoff address is required for Pet Taxi';
    } else if (!isHouseSitting) {
      if (!formValues.address?.trim()) newErrors.address = 'Service address is required';
    }

    if (selectedDates.length === 0) {
      newErrors.dates = 'At least one date is required';
    }

    if (!smsConsent) {
      newErrors.consent = 'You must agree to the Terms of Service and Privacy Policy';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Map service name matching HTML form (lines 4037-4050)
      let serviceName: string;
      if (selectedService === 'pet-sitting' && is247Care) {
        serviceName = '24/7 Care';
      } else {
        const serviceMap: Record<string, string> = {
          'dog-walking': 'Dog Walking',
          'pet-sitting': 'Housesitting',
          'drop-in': 'Drop-ins',
          'pet-taxi': 'Pet Taxi'
        };
        serviceName = serviceMap[selectedService!] || 'Drop-ins';
      }

      // Calculate startAt and endAt from selectedDates and dateTimes
      const sortedDates = [...selectedDates].sort();
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];

      // Get first time from first date
      const firstDateTimes = dateTimes[firstDate] || [];
      const firstTime = firstDateTimes.length > 0 ? firstDateTimes[0].time : '9:00 AM';

      // Convert 12-hour to 24-hour
      const convertTo24Hour = (time12h: string): string => {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12).padStart(2, '0');
        return `${String(hours).padStart(2, '0')}:${minutes}:00`;
      };

      const createDateInTimezone = (dateStr: string, time24h: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, mins] = time24h.split(':').map(Number);
        const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00.000Z`;
        return new Date(isoString);
      };

      const firstTime24h = convertTo24Hour(firstTime);
      const startAt = createDateInTimezone(firstDate, firstTime24h);

      // Get last time from last date
      const lastDateTimes = dateTimes[lastDate] || [];
      const lastTime = lastDateTimes.length > 0
        ? lastDateTimes[lastDateTimes.length - 1].time
        : '11:30 PM';
      const lastTime24h = convertTo24Hour(lastTime);
      const endAt = createDateInTimezone(lastDate, lastTime24h);

      const finalValues: BookingFormValues = {
        ...formValues,
        service: serviceName,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        pets: buildPetsArray(),
        selectedDates: sortedDates,
        dateTimes: dateTimes,
        smsConsent,
      };

      await onSubmit(finalValues);
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to save booking' });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof BookingFormValues, value: any) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updatePetCount = (type: keyof typeof petCounts, delta: number) => {
    setPetCounts(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta),
    }));
    if (errors.pets) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.pets;
        return next;
      });
    }
  };

  const isPetTaxi = selectedService === 'pet-taxi';
  const isHouseSitting = selectedService === 'pet-sitting';
  const totalPets = Object.values(petCounts).reduce((sum, count) => sum + count, 0);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Step 1: Service Selection - Matching booking-form.html exactly */}
      <Card>
        <SectionHeader title="Choose Your Service" />
        <div className="p-4">
          <p className="mb-4 text-text-secondary">
            Select the type of care your pet needs
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_CARDS.map((service) => (
              <div
                key={service.dataService}
                onClick={() => {
                  setSelectedService(service.dataService);
                  if (service.dataService === 'pet-sitting' && !is247Care) {
                    updateField('service', 'Housesitting');
                  } else if (service.dataService !== 'pet-sitting') {
                    updateField('service', service.apiName);
                  }
                  if (errors.service) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.service;
                      return next;
                    });
                  }
                }}
                style={{
                  border: `2px solid ${selectedService === service.dataService ? tokens.colors.primary.DEFAULT : tokens.colors.border.default}`,
                  backgroundColor: selectedService === service.dataService ? tokens.colors.primary[50] : 'transparent',
                }}
                className="p-4 rounded-lg cursor-pointer text-center transition-all duration-fast"
              >
                <div className="text-[32px] mb-2">
                  {service.icon}
                </div>
                <div className="font-semibold mb-1">
                  {service.name}
                </div>
                <div className="text-sm text-text-secondary">
                  {service.description}
                </div>
              </div>
            ))}
          </div>
          {errors.service && (
            <div className="text-status-danger-text mt-2">
              {errors.service}
            </div>
          )}
        </div>
      </Card>

      {/* Saved pets from client profile */}
      {savedPets.length > 0 && (
        <Card>
          <SectionHeader title="Your Pets" />
          <div className="p-4">
            <p className="text-text-secondary mb-3 text-sm">
              Select which pets are included in this booking:
            </p>
            <div className="flex flex-col gap-2">
              {savedPets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => setSavedPets((prev) => prev.map((p) => p.id === pet.id ? { ...p, selected: !p.selected } : p))}
                  style={{
                    border: `1px solid ${pet.selected ? tokens.colors.accent?.primary || '#432f21' : tokens.colors.border.default}`,
                    backgroundColor: pet.selected ? (tokens.colors.accent?.tertiary || '#fef7fb') : tokens.colors.background?.primary || '#fff',
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer text-left min-h-[44px]"
                >
                  <span className="text-[1.2rem]">{pet.selected ? '\u2611' : '\u2610'}</span>
                  <span className="font-medium text-sm">
                    {pet.name} ({pet.species})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Pet Selection - Matching booking-form.html exactly */}
      <Card>
        <SectionHeader title="Tell Us About Your Pet" />
        <div className="p-4 flex flex-col gap-4">
          <p className="text-text-secondary mb-2">
            Help us provide the best care
          </p>
          {PET_TYPES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3 justify-between">
              <label className="flex-1 text-base">{label}</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => updatePetCount(key, -1)}
                  disabled={petCounts[key] === 0}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={petCounts[key]}
                  readOnly
                  style={{ width: '60px', textAlign: 'center' }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => updatePetCount(key, 1)}
                >
                  +
                </Button>
              </div>
            </div>
          ))}

          {petCounts.other > 0 && (
            <FormRow label="Specify other pet type">
              <Input
                value={otherPetType}
                onChange={(e) => setOtherPetType(e.target.value)}
                placeholder="Specify other pet type..."
              />
            </FormRow>
          )}

          {errors.pets && (
            <div className="text-status-danger-text text-sm">
              {errors.pets}
            </div>
          )}

          {totalPets > 0 && (
            <div className="p-3 bg-accent-tertiary rounded-md text-sm">
              Total pets: {totalPets}
            </div>
          )}
        </div>
      </Card>

      {/* Booking Type - Matching booking-form.html */}
      <Card>
        <SectionHeader title="Booking Type" />
        <div className="p-4 flex gap-3">
          <Button
            type="button"
            variant={bookingType === 'one-time' ? 'primary' : 'secondary'}
            onClick={() => setBookingType('one-time')}
            style={{ flex: 1 }}
          >
            One-time
          </Button>
          <Button
            type="button"
            variant={bookingType === 'recurring' ? 'primary' : 'secondary'}
            onClick={() => setBookingType('recurring')}
            style={{ flex: 1 }}
          >
            Recurring
          </Button>
        </div>
      </Card>

      {/* 24/7 Care Option - Matching booking-form.html */}
      {isHouseSitting && (
        <Card>
          <SectionHeader title="Care Option" />
          <div className="p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={is247Care}
                onChange={(e) => {
                  setIs247Care(e.target.checked);
                  if (e.target.checked) {
                    updateField('service', '24/7 Care');
                  } else {
                    updateField('service', 'Housesitting');
                  }
                }}
                style={{ width: '18px', height: '18px' }}
              />
              <span>24/7 Care</span>
            </label>
          </div>
        </Card>
      )}

      {/* Step 3: Date Selection - Calendar matching booking-form.html */}
      <Card>
        <SectionHeader title="Choose Your Dates" />
        <div className="p-4">
          <p className="text-text-secondary mb-4">
            Select the dates you need care
          </p>

          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              ←
            </Button>
            <div className="font-semibold">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            >
              →
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold p-2 text-sm">
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                onClick={() => day.isCurrentMonth && handleDateClick(day.dateStr)}
                style={{
                  aspectRatio: '1',
                  backgroundColor: selectedDates.includes(day.dateStr)
                    ? tokens.colors.primary.DEFAULT
                    : day.isCurrentMonth
                      ? 'transparent'
                      : tokens.colors.neutral[50],
                  color: selectedDates.includes(day.dateStr)
                    ? 'white'
                    : day.isCurrentMonth
                      ? tokens.colors.text.primary
                      : tokens.colors.text.secondary,
                }}
                className={`flex items-center justify-center rounded-md ${
                  day.isCurrentMonth ? 'cursor-pointer' : 'cursor-default'
                } ${
                  selectedDates.includes(day.dateStr) ? 'font-semibold' : 'font-normal'
                }`}
              >
                {day.date.getDate()}
              </div>
            ))}
          </div>

          {errors.dates && (
            <div className="text-status-danger-text mt-2">
              {errors.dates}
            </div>
          )}
        </div>
      </Card>

      {/* Step 4: Time Selection - Matching booking-form.html */}
      {selectedDates.length > 0 && (
        <Card>
          <SectionHeader title="Select Times" />
          <div className="p-4">
            <p className="text-text-secondary mb-4">
              Choose the best times for your pet's care
            </p>

            <div className="flex flex-col gap-3">
              {selectedDates.map(dateStr => {
                const times = dateTimes[dateStr] || [];
                const date = new Date(dateStr + 'T00:00:00');
                return (
                  <div key={dateStr} className="p-3 border border-border-default rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-semibold">
                          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        {times.length > 0 && (
                          <div className="text-sm text-text-secondary">
                            {times.map(t => `${t.time} (${t.duration} min)`).join(', ')}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openTimeModal(dateStr)}
                      >
                        {times.length > 0 ? 'Edit Times' : 'Select Times'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Time Selection Modal */}
      {timeModalOpen && timeModalDate && (
        <div className="fixed inset-0 flex items-center justify-center z-layer-modal" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <Card style={{
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div className="flex justify-between items-center mb-4">
              <h3>Select Times</h3>
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={() => {
                  setTimeModalOpen(false);
                  setTimeModalDate(null);
                }}
              >
                ×
              </Button>
            </div>

            <div className="mb-4">
              {timeModalDate && new Date(timeModalDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {TIME_SLOTS.map(time => {
                const existing = dateTimes[timeModalDate]?.find(t => t.time === time);
                return (
                  <div key={time}>
                    <div
                      onClick={() => selectTimeSlot(time, 30)}
                      style={{
                        border: `1px solid ${existing?.duration === 30 ? tokens.colors.primary.DEFAULT : tokens.colors.border.default}`,
                        backgroundColor: existing?.duration === 30 ? tokens.colors.primary[50] : 'transparent',
                      }}
                      className="p-2 rounded-md cursor-pointer text-center mb-1"
                    >
                      {time} (30 min)
                    </div>
                    <div
                      onClick={() => selectTimeSlot(time, 60)}
                      style={{
                        border: `1px solid ${existing?.duration === 60 ? tokens.colors.primary.DEFAULT : tokens.colors.border.default}`,
                        backgroundColor: existing?.duration === 60 ? tokens.colors.primary[50] : 'transparent',
                      }}
                      className="p-2 rounded-md cursor-pointer text-center"
                    >
                      {time} (60 min)
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setTimeModalOpen(false);
                setTimeModalDate(null);
              }}
            >
              Done
            </Button>
          </Card>
        </div>
      )}

      {/* Step 5: Pet Taxi Transportation - Matching booking-form.html */}
      {isPetTaxi && (
        <Card>
          <SectionHeader title="Transportation Details" />
          <div className="p-4">
            <p className="text-text-secondary mb-4">
              Tell us where to pick up and drop off your pet
            </p>
            <div className="flex flex-col gap-4">
              <FormRow label="Pickup Address" error={errors.pickupAddress}>
                <Input
                  value={formValues.pickupAddress || ''}
                  onChange={(e) => updateField('pickupAddress', e.target.value)}
                  placeholder="Enter pickup location"
                  required
                />
              </FormRow>
              <FormRow label="Dropoff Address" error={errors.dropoffAddress}>
                <Input
                  value={formValues.dropoffAddress || ''}
                  onChange={(e) => updateField('dropoffAddress', e.target.value)}
                  placeholder="Enter dropoff location"
                  required
                />
              </FormRow>
            </div>
          </div>
        </Card>
      )}

      {/* Step 6: Contact Information - Matching booking-form.html exactly */}
      <Card>
        <SectionHeader title="Contact Information" />
        <div className="p-4">
          <p className="text-text-secondary mb-4">
            We'll use this to confirm your booking
          </p>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormRow label="First Name" error={errors.firstName}>
                <Input
                  value={formValues.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="Enter your first name"
                  required
                />
              </FormRow>
              <FormRow label="Last Name" error={errors.lastName}>
                <Input
                  value={formValues.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Enter your last name"
                  required
                />
              </FormRow>
            </div>

            <FormRow label="Email Address" error={errors.email}>
              <Input
                type="email"
                value={formValues.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="Enter your email address"
                required
              />
            </FormRow>

            <FormRow label="Phone Number" error={errors.phone}>
              <Input
                type="tel"
                value={formValues.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="Enter your phone number"
                required
              />
            </FormRow>

            {!isPetTaxi && (
              <FormRow label="Service Address" error={errors.address}>
                <Input
                  value={formValues.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Enter your address"
                  required={!isHouseSitting}
                />
              </FormRow>
            )}

            <FormRow label="Additional Notes (Optional)" error={errors.notes}>
              <textarea
                value={formValues.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes, questions or preferred sitter"
                className="w-full min-h-[100px] p-3 border border-border-default rounded-md text-base font-sans"
                style={{ resize: 'vertical' }}
              />
            </FormRow>
          </div>
        </div>
      </Card>

      {/* Policy Agreement & SMS Consent */}
      <Card>
        <div className="p-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              required
              className="shrink-0"
              style={{ width: '18px', height: '18px', marginTop: '2px' }}
            />
            <span className="text-sm">
              I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline">Privacy Policy</a>, and I consent to receive SMS text messages from Snout Pet Care regarding my booking, including confirmations, reminders, and updates. Message and data rates may apply. Reply STOP to opt out at any time.
            </span>
          </label>
          {errors.consent && (
            <div className="text-status-danger-text text-xs mt-1">
              {errors.consent}
            </div>
          )}
        </div>
      </Card>

      {/* Submit Errors */}
      {errors.submit && (
        <Card className="bg-status-danger-bg p-4">
          <div className="text-status-danger-text">{errors.submit}</div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : mode === 'create' ? 'Complete Booking' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};
