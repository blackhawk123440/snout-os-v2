/**
 * Deterministic price calculation with auditable breakdown.
 */

import { prisma } from '@/lib/db';
import { whereOrg } from '@/lib/org-scope';

interface BreakdownItem {
  label: string;
  amount: number;
}

export interface PriceCalculation {
  basePrice: number;
  additionalPetFee: number;
  holidayMultiplier: number;
  afterHoursMultiplier: number;
  rushFee: number;
  discountAmount: number;
  totalPrice: number;
  breakdown: BreakdownItem[];
}

export async function calculateBookingPrice(params: {
  orgId: string;
  service: string;
  startAt: Date;
  endAt: Date;
  petCount: number;
  afterHours: boolean;
  holiday: boolean;
  discountCode?: string;
  hoursNotice?: number;
}): Promise<PriceCalculation> {
  const breakdown: BreakdownItem[] = [];

  // 1. Lookup ServiceConfig
  const config = await (prisma as any).serviceConfig.findFirst({
    where: whereOrg(params.orgId, { serviceName: params.service }),
  });

  let basePrice = config?.basePrice ?? 25;
  const holidayMult = params.holiday ? (config?.holidayMultiplier ?? 1.5) : 1;
  const weekendMult = [0, 6].includes(params.startAt.getDay()) ? (config?.weekendMultiplier ?? 1) : 1;

  // Duration-based for walks/drop-ins
  const durationMin = Math.round((params.endAt.getTime() - params.startAt.getTime()) / 60000);
  if (durationMin > 30 && config?.defaultDuration && config.defaultDuration <= 30) {
    basePrice = basePrice * (durationMin / (config.defaultDuration || 30));
  }

  breakdown.push({ label: params.service, amount: basePrice });

  // 2. Additional pet fee
  let additionalPetFee = 0;
  if (params.petCount > 1) {
    const perPetFee = 5; // Default $5 per additional pet
    additionalPetFee = (params.petCount - 1) * perPetFee;
    breakdown.push({ label: `Additional pet${params.petCount > 2 ? 's' : ''} (+${params.petCount - 1})`, amount: additionalPetFee });
  }

  // 3. Holiday multiplier
  let subtotal = basePrice + additionalPetFee;
  if (holidayMult > 1) {
    const holidayAdd = subtotal * (holidayMult - 1);
    breakdown.push({ label: `Holiday rate (${holidayMult}x)`, amount: Math.round(holidayAdd * 100) / 100 });
    subtotal *= holidayMult;
  }

  // 4. Weekend multiplier
  if (weekendMult > 1) {
    const weekendAdd = subtotal * (weekendMult - 1);
    breakdown.push({ label: `Weekend rate (${weekendMult}x)`, amount: Math.round(weekendAdd * 100) / 100 });
    subtotal *= weekendMult;
  }

  // 5. After-hours
  let afterHoursMultiplier = 1;
  if (params.afterHours) {
    afterHoursMultiplier = 1.25;
    const afterHoursAdd = subtotal * 0.25;
    breakdown.push({ label: 'After-hours surcharge', amount: Math.round(afterHoursAdd * 100) / 100 });
    subtotal *= afterHoursMultiplier;
  }

  // 6. Rush fee
  let rushFee = 0;
  if (params.hoursNotice !== undefined && params.hoursNotice < 24) {
    if (params.hoursNotice < 4) rushFee = 25;
    else if (params.hoursNotice < 12) rushFee = 15;
    else rushFee = 10;
    breakdown.push({ label: 'Same-day rush fee', amount: rushFee });
    subtotal += rushFee;
  }

  // 7. Discount
  let discountAmount = 0;
  if (params.discountCode) {
    const discount = await (prisma as any).discount.findFirst({
      where: whereOrg(params.orgId, {
        code: params.discountCode,
        enabled: true,
      }),
    });
    if (discount) {
      if (discount.valueType === 'percentage') {
        discountAmount = subtotal * (discount.value / 100);
        if (discount.maxDiscount) discountAmount = Math.min(discountAmount, discount.maxDiscount);
      } else {
        discountAmount = discount.value;
      }
      discountAmount = Math.min(discountAmount, subtotal);
      if (discountAmount > 0) {
        breakdown.push({ label: `Discount (${params.discountCode})`, amount: -discountAmount });
        subtotal -= discountAmount;
      }
    }
  }

  const totalPrice = Math.round(Math.max(0, subtotal) * 100) / 100;

  return {
    basePrice,
    additionalPetFee,
    holidayMultiplier: holidayMult,
    afterHoursMultiplier,
    rushFee,
    discountAmount,
    totalPrice,
    breakdown,
  };
}
