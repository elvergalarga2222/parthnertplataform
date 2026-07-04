"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/modules/auth/actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Partner Manager
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Acceso exclusivo para miembros de la comunidad.
          </p>
        </div>

        <form
          action={action}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Correo de tu cuenta de Skool
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tucorreo@ejemplo.com"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
          />

          {state.error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Verificando…" : "Entrar"}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
            No hay registro manual. Solo miembros activos de Skool pueden entrar.
          </p>
        </form>
      </div>
    </div>
  );
}
