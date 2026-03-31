#!/usr/bin/env tsx
/**
 * Phase 1 Staging Verification Script
 * 
 * This script submits 5 test bookings via the /api/form endpoint and verifies
 * they match the acceptance criteria. Run this against your staging environment.
 * 
 * Usage:
 *   BASE_URL=https://your-staging-url.com npx tsx scripts/phase1-staging-verification.ts
 * 
 * Or for local testing:
 *   BASE_URL=http://localhost:3000 npx tsx scripts/phase1-staging-verification.ts
 */

interface BookingPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  service: string;
  startAt: string;
  endAt: string;
  petNames?: string[];
  petSpecies?: string[];
  pets?: Array<{ name: string; species: string }>;
  specialInstructions?: string;
  additionalNotes?: string;
  notes?: string;
  selectedDates?: string[];
  dateTimes?: Record<string, Array<{ time?: string; timeValue?: string; duration?: number; durationValue?: number }>>;
  timezone?: string;
  afterHours?: boolean;
  holiday?: boolean;
}

interface VerificationResult {
  bookingId: string;
  testCase: string;
  passed: boolean;
  failures: string[];
  bookingData?: any;
}

// Test Case 1: Basic booking with notes in specialInstructions
const testCase1: BookingPayload = {
  firstName: "Test",
  lastName: "Client1",
  phone: "3125550101",
  email: "test1@example.com",
  address: "123 Test St, Chicago, IL 60601",
  service: "Dog Walking",
  startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  endAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), // +30 min
  petNames: ["Buddy"],
  petSpecies: ["Dog"],
  specialInstructions: "Please ring doorbell twice. Dog is friendly but cautious.",
  selectedDates: [new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]],
};

// Test Case 2: Booking with notes in additionalNotes
const testCase2: BookingPayload = {
  firstName: "Test",
  lastName: "Client2",
  phone: "3125550202",
  email: "test2@example.com",
  address: "456 Test Ave, Chicago, IL 60602",
  service: "Drop-ins",
  startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  petNames: ["Fluffy"],
  petSpecies: ["Cat"],
  additionalNotes: "Cat prefers wet food only. Leave dry food untouched.",
  selectedDates: [new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]],
};

// Test Case 3: Booking with notes in direct notes field
const testCase3: BookingPayload = {
  firstName: "Test",
  lastName: "Client3",
  phone: "3125550303",
  email: "test3@example.com",
  address: "789 Test Blvd, Chicago, IL 60603",
  service: "Housesitting",
  startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 2 nights
  petNames: ["Max", "Luna"],
  petSpecies: ["Dog", "Dog"],
  notes: "Both dogs need medication at 8am and 8pm. Check backyard gate is locked.",
  selectedDates: [
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  ],
};

// Test Case 4: Pet Taxi with addresses
const testCase4: BookingPayload = {
  firstName: "Test",
  lastName: "Client4",
  phone: "3125550404",
  email: "test4@example.com",
  pickupAddress: "100 Pickup St, Chicago, IL 60604",
  dropoffAddress: "200 Dropoff Ave, Chicago, IL 60605",
  service: "Pet Taxi",
  startAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
  petNames: ["Rex"],
  petSpecies: ["Dog"],
  specialInstructions: "Dog gets car sick. Drive slowly and use back seat.",
};

// Test Case 5: Multiple time slots with pets array format
const testCase5: BookingPayload = {
  firstName: "Test",
  lastName: "Client5",
  phone: "3125550505",
  email: "test5@example.com",
  address: "300 Test Rd, Chicago, IL 60606",
  service: "Dog Walking",
  startAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  pets: [
    { name: "Charlie", species: "Dog" },
    { name: "Bella", species: "Dog" },
  ],
  additionalNotes: "Walk dogs separately. Charlie is aggressive with other dogs.",
  selectedDates: [new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]],
  dateTimes: {
    [new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]: [
      { time: "09:00 AM", duration: 30 },
      { time: "02:00 PM", duration: 30 },
    ],
  },
};

const testCases = [
  { name: "Basic booking with specialInstructions", payload: testCase1 },
  { name: "Booking with additionalNotes", payload: testCase2 },
  { name: "Booking with direct notes field (housesitting)", payload: testCase3 },
  { name: "Pet Taxi with pickup/dropoff addresses", payload: testCase4 },
  { name: "Multiple time slots with pets array", payload: testCase5 },
];

async function submitBooking(baseUrl: string, payload: BookingPayload): Promise<{ success: boolean; bookingId?: string; error?: any; response?: any }> {
  try {
    const response = await fetch(`${baseUrl}/api/form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data,
      };
    }

    return {
      success: true,
      bookingId: data.booking?.id,
      response: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyBooking(
  baseUrl: string,
  bookingId: string,
  expectedPayload: BookingPayload,
  testCaseName: string
): Promise<VerificationResult> {
  const failures: string[] = [];

  try {
    // Fetch booking from API
    const response = await fetch(`${baseUrl}/api/bookings/${bookingId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      failures.push(`Failed to fetch booking: ${response.status} ${response.statusText}`);
      return {
        bookingId,
        testCase: testCaseName,
        passed: false,
        failures: [...failures],
      } as VerificationResult;
    }

    const data = await response.json();
    const booking = data.booking;

    if (!booking) {
      failures.push(`Booking ${bookingId} not found in API response`);
      return {
        bookingId,
        testCase: testCaseName,
        passed: false,
        failures,
      };
    }

    // Verify notes precedence (specialInstructions > additionalNotes > notes)
    const expectedNotes = expectedPayload.specialInstructions || expectedPayload.additionalNotes || expectedPayload.notes;
    if (expectedNotes) {
      if (!booking.notes || booking.notes.trim() === "") {
        failures.push(`Notes field is empty. Expected: "${expectedNotes.substring(0, 50)}..."`);
      } else if (booking.notes.trim() !== expectedNotes.trim()) {
        failures.push(`Notes mismatch. Expected: "${expectedNotes.substring(0, 50)}...", Got: "${booking.notes.substring(0, 50)}..."`);
      }
    }

    // Verify service
    if (booking.service !== expectedPayload.service) {
      failures.push(`Service mismatch. Expected: ${expectedPayload.service}, Got: ${booking.service}`);
    }

    // Verify pets
    const expectedPetCount = expectedPayload.pets?.length || expectedPayload.petNames?.length || 0;
    if (expectedPetCount > 0 && (!booking.pets || booking.pets.length !== expectedPetCount)) {
      failures.push(`Pet count mismatch. Expected: ${expectedPetCount}, Got: ${booking.pets?.length || 0}`);
    }

    // Verify quantity (for housesitting, should be nights; for others, should be visits)
    if (expectedPayload.service === "Housesitting" || expectedPayload.service === "24/7 Care") {
      const expectedNights = expectedPayload.selectedDates ? expectedPayload.selectedDates.length - 1 : 1;
      if (booking.quantity !== expectedNights) {
        failures.push(`Quantity (nights) mismatch for housesitting. Expected: ${expectedNights}, Got: ${booking.quantity}`);
      }
    }

    // Verify addresses
    if (expectedPayload.service === "Pet Taxi") {
      if (expectedPayload.pickupAddress && booking.pickupAddress !== expectedPayload.pickupAddress.trim()) {
        failures.push(`Pickup address mismatch`);
      }
      if (expectedPayload.dropoffAddress && booking.dropoffAddress !== expectedPayload.dropoffAddress.trim()) {
        failures.push(`Dropoff address mismatch`);
      }
    } else if (expectedPayload.address && expectedPayload.service !== "Housesitting" && expectedPayload.service !== "24/7 Care") {
      if (booking.address !== expectedPayload.address.trim()) {
        failures.push(`Address mismatch`);
      }
    }

    return {
      bookingId,
      testCase: testCaseName,
      passed: failures.length === 0,
      failures,
      bookingData: booking,
    };
  } catch (error) {
    failures.push(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      bookingId,
      testCase: testCaseName,
      passed: false,
      failures,
    };
  }
}

async function main() {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  
  console.log("🧪 Phase 1 Staging Verification");
  console.log("=" .repeat(50));
  console.log(`Target: ${baseUrl}`);
  console.log(`Flag Status: Check ENABLE_FORM_MAPPER_V1 in your environment`);
  console.log("");

  const results: VerificationResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 Test ${i + 1}/5: ${testCase.name}`);
    console.log(`   Submitting booking...`);

    const submitResult = await submitBooking(baseUrl, testCase.payload);

    if (!submitResult.success) {
      console.log(`   ❌ FAILED: Submission error`);
      console.log(`   Error:`, submitResult.error);
      results.push({
        bookingId: "N/A",
        testCase: testCase.name,
        passed: false,
        failures: [`Submission failed: ${JSON.stringify(submitResult.error)}`],
      });
      continue;
    }

    if (!submitResult.bookingId) {
      console.log(`   ❌ FAILED: No booking ID returned`);
      results.push({
        bookingId: "N/A",
        testCase: testCase.name,
        passed: false,
        failures: ["No booking ID in response"],
      });
      continue;
    }

    console.log(`   ✅ Booking created: ${submitResult.bookingId}`);
    console.log(`   Verifying booking data...`);

    // Wait a moment for DB to catch up
    await new Promise(resolve => setTimeout(resolve, 500));

    const verification = await verifyBooking(baseUrl, submitResult.bookingId, testCase.payload, testCase.name);

    if (verification.passed) {
      console.log(`   ✅ PASSED: All checks passed`);
    } else {
      console.log(`   ❌ FAILED:`);
      verification.failures.forEach(failure => {
        console.log(`      - ${failure}`);
      });
    }

    results.push(verification);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  results.forEach((result, index) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} Test ${index + 1}: ${result.testCase}`);
    if (!result.passed && result.failures.length > 0) {
      result.failures.forEach(failure => {
        console.log(`   └─ ${failure}`);
      });
    }
  });

  if (failed > 0) {
    console.log("\n⚠️  VERIFICATION FAILED");
    console.log("If ENABLE_FORM_MAPPER_V1 is true, check mapper logs in server console.");
    console.log("If ENABLE_FORM_MAPPER_V1 is false, this is expected - mapper is not active.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL TESTS PASSED");
    console.log("Phase 1 mapper is working correctly!");
    process.exit(0);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});

