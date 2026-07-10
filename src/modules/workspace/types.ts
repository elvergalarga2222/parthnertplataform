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
  /** Documento vivo de estrategia (texto/markdown ligero). */
  strategyDoc: string | null;
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
  /** Última generación IA de tipo 'estrategia' del workspace (para sembrar el doc). */
  latestStrategyGeneration: { outputText: string; createdAt: string } | null;
}

// --- Export (PR-13) ----------------------------------------------------------

export interface WorkspaceExportGeneration {
  type: string;
  outputText: string;
  createdAt: string;
}

export interface WorkspaceExportColumn {
  name: string;
  sopContent: string | null;
  cards: {
    title: string;
    description: string | null;
    assignee: string | null;
    dueDate: string | null;
  }[];
}

export interface WorkspaceExport {
  id: string;
  clientName: string;
  status: WorkspaceStatus;
  exportedAt: string;
  deal: { title: string; value: number; currency: string } | null;
  profile: WorkspaceProfileView;
  columns: WorkspaceExportColumn[];
  /** Última generación por tipo (guion/estrategia/diagnostico). */
  latestGenerations: WorkspaceExportGeneration[];
}
