import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthService, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/modules/auth";

const loginSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const result = await getAuthService().login(parsed.data.email);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "not_member"
            ? "No encontramos una membresía con ese email. El acceso es exclusivo para miembros del grupo de Skool."
            : "Tu membresía no está activa. Reactívala en Skool para volver a entrar.",
      },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
