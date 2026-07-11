// View models serialized para componentes cliente (fechas como ISO strings).

export type CollaboratorPermission = "editor" | "lector";
export type CollaboratorStatus = "invitado" | "activo" | "desactivado";

export interface CollaboratorView {
  id: string;
  email: string;
  displayName: string | null;
  roleTitle: string | null;
  permission: CollaboratorPermission;
  status: CollaboratorStatus;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface MeetingAttendeeView {
  /** null = el propio partner ("Yo"). */
  collaboratorId: string | null;
  name: string;
}

export interface MeetingView {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  note: string | null;
  attendees: MeetingAttendeeView[];
  createdAt: string;
}

export interface TeamSnapshot {
  collaborators: CollaboratorView[];
  meetings: MeetingView[];
  /** true = quien mira es el partner dueño de la cuenta (gestiona el equipo). */
  isPartner: boolean;
  /** Colaborador actual (si aplica) — preselecciona "Yo" en asistentes. */
  selfCollaboratorId: string | null;
}
