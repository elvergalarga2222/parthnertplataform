// View models serialized for client components.

export const WORKSPACE_STATUSES = ["activo", "pausado", "finalizado"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export interface WorkspaceListItem {
  id: string;
  clientName: string;
  status: WorkspaceStatus;
  dealId: string | null;
  dealValue: number | null;
  createdAt: string;
  cardCount: number;
  doneCount: number;
}

export interface WorkspaceColumnView {
  id: string;
  name: string;
  position: number;
  sopContent: string | null;
}

export interface WorkspaceCardView {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  assignee: string | null;
  dueDate: string | null;
  position: number;
}

export interface WorkspaceProfileView {
  businessName: string | null;
  industry: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  extra: Record<string, string>;
}

export interface WorkspaceSnapshot {
  id: string;
  clientName: string;
  status: WorkspaceStatus;
  dealId: string | null;
  columns: WorkspaceColumnView[];
  cards: WorkspaceCardView[];
  profile: WorkspaceProfileView;
}
