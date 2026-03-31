import { redactPhoneNumber, redactPhoneNumbersInString } from "@/lib/messaging/logging-helpers";

const PHONE_KEY_PATTERN = /(phone|e164|from|to|mobile|sms|contact)/i;

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7;
}

function redactPrimitiveString(value: string, key?: string): string {
  if (PHONE_KEY_PATTERN.test(key ?? "") && looksLikePhone(value)) {
    return redactPhoneNumber(value);
  }
  return redactPhoneNumbersInString(value);
}

function redactUnknown(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return redactPrimitiveString(value, key);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, key));
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(input)) {
      output[entryKey] = redactUnknown(entryValue, entryKey);
    }
    return output;
  }

  return value;
}

export function redactPhoneLikeString(value: string | null | undefined): string {
  if (!value) return "[REDACTED]";
  return redactPhoneNumber(value);
}

export function redactSensitiveMetadata<T>(value: T): T {
  return redactUnknown(value) as T;
}
