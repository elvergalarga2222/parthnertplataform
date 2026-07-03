import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthService, SESSION_COOKIE } from "@/modules/auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await getAuthService().logout(sessionId);
    cookieStore.delete(SESSION_COOKIE);
  }
  return NextResponse.json({ ok: true });
}
