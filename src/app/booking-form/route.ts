import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  try {
    // Read the booking form HTML file from public directory
    const filePath = join(process.cwd(), "public", "booking-form.html");
    const fileContents = await readFile(filePath, "utf-8");
    
    // Return the HTML with proper content type
    return new NextResponse(fileContents, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error serving booking form:", error);
    return new NextResponse("Booking form not found", { status: 404 });
  }
}

