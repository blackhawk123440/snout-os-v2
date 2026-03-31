import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Seeding settings...");

  const defaultSettings = [
    // Contact Information
    {
      key: "owner.phone",
      value: process.env.OWNER_ALERT_NUMBER || "+12562589183",
      category: "contact",
      label: "Owner Phone Number",
    },
    {
      key: "owner.email",
      value: "",
      category: "contact",
      label: "Owner Email",
    },

    // External Links
    {
      key: "links.tip",
      value: process.env.TIP_LINK || "https://tip-coming-soon",
      category: "links",
      label: "Tip/Payment Link",
    },
    {
      key: "links.reviewGoogle",
      value: process.env.REVIEW_GOOGLE || "https://www.snoutservices.com/google-review",
      category: "links",
      label: "Google Review Link",
    },
    {
      key: "links.reviewFacebook",
      value: process.env.REVIEW_FB || "https://www.snoutservice.com/facebook-review",
      category: "links",
      label: "Facebook Review Link",
    },

    // SMS Templates
    {
      key: "smsTemplate.initialBooking",
      value: "Hey [FirstName]! Thanks for booking with Snout Services 🐾 We received your request for [Service] on [Date] at [Time] for [PetNames]. We'll confirm soon!",
      category: "smsTemplates",
      label: "Initial Booking Confirmation (to Client)",
    },
    {
      key: "smsTemplate.ownerAlert",
      value: "NEW BOOKING\n\n[FirstName] [LastName]\n[Phone]\n\n[Service] — [Date] at [Time]\n[PetCount] pets: [PetNames]\nQuote: $[TotalPrice]\n\nCheck dashboard to confirm",
      category: "smsTemplates",
      label: "New Booking Alert (to Owner)",
    },
    {
      key: "smsTemplate.bookingConfirmed",
      value: "Your booking with Snout Services has been confirmed for [DayName] at [Time]! We'll take great care of [PetNames]. ❤️",
      category: "smsTemplates",
      label: "Booking Confirmed (to Client)",
    },
    {
      key: "smsTemplate.sitterAssignment",
      value: "NEW ASSIGNMENT\n\n[ClientFirstName] [ClientLastName]\n[Service] — [Date] at [Time]\n\nPets: [PetNames]\nAddress: [Address]\n\nCheck your Sitter Dashboard for details",
      category: "smsTemplates",
      label: "Sitter Assignment (to Sitter)",
    },
    {
      key: "smsTemplate.nightBeforeClient",
      value: "Hi [FirstName]! Quick reminder — [PetNames]'s [Service] is tomorrow at [Time]! 🐶 Looking forward to it!",
      category: "smsTemplates",
      label: "Night-Before Reminder (to Client)",
    },
    {
      key: "smsTemplate.nightBeforeSitter",
      value: "You have [VisitCount] visit(s) tomorrow. First one: [PetNames] at [Time].",
      category: "smsTemplates",
      label: "Night-Before Reminder (to Sitter)",
    },
    {
      key: "smsTemplate.visitReport",
      value: "Hi [FirstName]!\n\nUpdate from [PetNames]'s visit:\n\n[ReportSummary]\n\nThanks for trusting Snout Services! ❤️",
      category: "smsTemplates",
      label: "Visit Report (to Client)",
    },
    {
      key: "smsTemplate.thankYou",
      value: "Hope [PetNames] had an awesome time! ❤️ Thank you for trusting Snout Services, [FirstName]!",
      category: "smsTemplates",
      label: "Post-Visit Thank You (to Client)",
    },
    {
      key: "smsTemplate.tipReview",
      value: "Hi [FirstName]! If you loved your visit, a tip means the world 💕 [TipLink]\n\nYou can also leave us a review:\n⭐ Google: [GoogleLink]\n⭐ Facebook: [FacebookLink]\n\nNote: [TipLink] is automatically generated with your booking total ($[Amount]) for easy tipping!",
      category: "smsTemplates",
      label: "Tip & Review Request (to Client) - Personalized with booking amount",
    },
    {
      key: "smsTemplate.dailySummary",
      value: "DAILY SCHEDULE — [Date]\n\n[BookingsList]\n\nTotal estimated earnings: $[TotalEarnings]\n\nHave a great day! 🐾",
      category: "smsTemplates",
      label: "Daily Summary (to Owner)",
    },

    // Automation Settings
    {
      key: "automation.nightBeforeTime",
      value: "19:00",
      category: "automation",
      label: "Night-Before Reminder Time (24-hour format)",
    },
    {
      key: "automation.tipReminderDelay",
      value: "30",
      category: "automation",
      label: "Tip/Review Reminder Delay (minutes after visit)",
    },
    {
      key: "automation.dailySummaryTime",
      value: "07:00",
      category: "automation",
      label: "Daily Summary Time (24-hour format)",
    },
    {
      key: "automation.enabledWorkflows",
      value: "bookingConfirmation,ownerAlert,nightBefore,tipReview,dailySummary",
      category: "automation",
      label: "Enabled Automations (comma-separated)",
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
    console.log(`✅ ${setting.label}`);
  }

  console.log("✨ Settings seed completed");
}

main()
  .catch((e) => {
    console.error("❌ Settings seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

