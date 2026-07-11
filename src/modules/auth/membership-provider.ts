// Riesgo #1 del proyecto: las capacidades reales de la API de Skool aún no
// están validadas (webhooks, lookup por email, fechas de renovación). Todo
// auth/ se programa contra esta interfaz para poder cambiar de estrategia sin
// tocar el resto del módulo. El job de sincronización (PR-10) cubre AMBOS
// caminos: con fecha de fin de periodo (ideal) y sin ella (plan B: gracia de
// MEMBERSHIP_GRACE_DAYS desde la detección del churn).
export interface MembershipProvider {
  /** Busca un miembro del grupo por email. Devuelve null si no existe. */
  findMemberByEmail(email: string): Promise<Member | null>;

  /** Lista todos los miembros activos del grupo (login/gating). */
  listActiveMembers(): Promise<Member[]>;

  /**
   * Lista TODOS los miembros con su estado (para el job de sincronización,
   * que necesita ver churned/removed para congelar).
   */
  listMembers(): Promise<Member[]>;
}

export interface Member {
  externalId: string;
  email: string;
  displayName: string | null;
  status: "active" | "churned" | "removed";
  /** Fin del periodo pagado actual (ISO). null si el provider no lo expone. */
  currentPeriodEndsAt: string | null;
  /** true si canceló la renovación (sigue activo hasta el fin del periodo). */
  cancelAtPeriodEnd: boolean;
}
