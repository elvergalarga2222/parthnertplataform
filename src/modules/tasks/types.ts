// View models serializados para componentes cliente (fechas como ISO strings).

export const TASK_STATUSES = ["pendiente", "en_progreso", "hecha"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["baja", "media", "alta"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  /** "YYYY-MM-DD" o null. */
  dueDate: string | null;
  completedAt: string | null;
  /** null = "Yo" (el partner o quien crea, sin asignar a un colaborador). */
  assignee: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
  workspace: { id: string; clientName: string } | null;
  /** Derivado: status != 'hecha' && dueDate < hoy. */
  overdue: boolean;
  createdAt: string;
}

export type TaskStatusFilter = TaskStatus | "abiertas" | "todas";
export type TaskDueFilter = "vencidas" | "hoy" | "semana" | "all";

export interface TaskFilter {
  /** Default: "abiertas" (pendiente + en_progreso). */
  status?: TaskStatusFilter;
  /**
   * undefined = sin filtro; null = solo tareas sin asignar (asignadas al
   * partner); string = ese colaborador. La resolución de "Yo" (¿quién es el
   * actor actual?) ocurre en la capa de actions/page — el servicio no conoce
   * la sesión.
   */
  assigneeId?: string | null;
  dealId?: string;
  workspaceId?: string;
  due?: TaskDueFilter;
  /** true ⇒ solo tareas con dealId O workspaceId (dashboard: tareas de clientes). */
  linked?: boolean;
}

export interface TaskAlert {
  id: string;
  title: string;
  dueDate: string;
  daysOverdue: number;
  assigneeName: string | null;
}

export interface TaskAlerts {
  overdue: TaskAlert[];
  dueToday: TaskAlert[];
  total: number;
}
