"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LoginError, loginWithEmail } from "./service";
import { destroySession } from "./session";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido."),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Correo inválido." };
  }

  try {
    await loginWithEmail(parsed.data.email);
  } catch (err) {
    if (err instanceof LoginError) {
      return { error: err.message };
    }
    console.error("loginAction error:", err);
    return {
      error: "No se pudo iniciar sesión. Intenta de nuevo en unos momentos.",
    };
  }

  // redirect() lanza una excepción de control de flujo: debe ir fuera del try.
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
