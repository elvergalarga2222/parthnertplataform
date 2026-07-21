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
  /** Regla #7: si la tarjeta aparece en la vista pública de cliente. */
  isClientVisible: boolean;
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

// --- Vista de Cliente (regla #7) ---------------------------------------------
// Modelos deliberadamente distintos a los del Partner: lo que no está en estas
// interfaces no puede filtrarse por el enlace público, aunque el servicio
// cambie. Sin `assignee` (operación interna), sin SOPs, sin perfil, sin IA.

export interface ClientViewCard {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
}

export interface ClientViewColumn {
  id: string;
  name: string;
  cards: ClientViewCard[];
}

export interface ClientView {
  clientName: string;
  columns: ClientViewColumn[];
}

/** Estado del enlace compartido, para la UI del Partner. */
export interface ClientViewShareState {
  enabled: boolean;
  /** true si ya se generó un token (el valor en claro no es recuperable). */
  hasToken: boolean;
  visibleCardCount: number;
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
