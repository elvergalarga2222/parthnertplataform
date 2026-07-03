// Riesgo #1 del proyecto: las capacidades reales de la API de Skool aún no
// están validadas (webhooks, lookup por email). Todo auth/ se programa contra
// esta interfaz para poder cambiar de estrategia sin tocar el resto del módulo.
export interface MembershipProvider {
  /** Busca un miembro del grupo por email. Devuelve null si no existe. */
  findMemberByEmail(email: string): Promise<Member | null>;

  /** Lista todos los miembros activos del grupo (para el job de polling). */
  listActiveMembers(): Promise<Member[]>;
}

export interface Member {
  externalId: string;
  email: string;
  displayName: string | null;
  status: "active" | "churned" | "removed";
}
