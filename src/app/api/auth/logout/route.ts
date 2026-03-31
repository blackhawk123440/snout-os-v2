/**
 * Logout API Route (Gate B Phase 2.2)
 * 
 * Handles user logout
 */

import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST() {
  await signOut({ redirect: false });
  return NextResponse.json({ success: true });
}

