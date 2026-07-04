import { redirect } from "next/navigation";

// La raíz manda al dashboard; el gating de (app) redirige a /login si no hay
// sesión activa.
export default function Home() {
  redirect("/dashboard");
}
