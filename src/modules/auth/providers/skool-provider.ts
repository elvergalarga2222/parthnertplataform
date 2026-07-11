import type { Member, MembershipProvider } from "../membership-provider";

// Riesgo #1 del proyecto: las capacidades reales de la API de Skool no están
// validadas. Esta implementación asume una API REST con auth Bearer y un shape
// razonable; si Skool difiere, solo se ajusta este archivo (el resto del módulo
// depende de la interfaz MembershipProvider, no de Skool directamente).
interface SkoolMemberDto {
  id: string;
  email: string;
  name?: string | null;
  // Skool suele exponer el estado de la membresía; normalizamos abajo.
  status?: string;
  active?: boolean;
  // Campos de ciclo de vida ASUMIDOS (riesgo #1: validar contra la API real
  // antes del deploy — si Skool no los expone, quedan null/false y el job de
  // sincronización usa el plan B de gracia).
  current_period_ends_at?: string | null;
  renews_at?: string | null;
  expires_at?: string | null;
  cancel_at_period_end?: boolean;
  cancelled?: boolean;
}

/** Primera fecha de fin de periodo presente y parseable, como ISO. */
function normalizePeriodEnd(dto: SkoolMemberDto): string | null {
  for (const raw of [dto.current_period_ends_at, dto.renews_at, dto.expires_at]) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function normalizeStatus(dto: SkoolMemberDto): Member["status"] {
  if (dto.active === false) return "removed";
  switch ((dto.status ?? "").toLowerCase()) {
    case "active":
    case "member":
      return "active";
    case "churned":
    case "expired":
    case "past_due":
      return "churned";
    case "removed":
    case "banned":
      return "removed";
    default:
      return dto.active ? "active" : "removed";
  }
}

function toMember(dto: SkoolMemberDto): Member {
  return {
    externalId: dto.id,
    email: dto.email.toLowerCase(),
    displayName: dto.name ?? null,
    status: normalizeStatus(dto),
    currentPeriodEndsAt: normalizePeriodEnd(dto),
    cancelAtPeriodEnd: Boolean(dto.cancel_at_period_end ?? dto.cancelled),
  };
}

export class SkoolMembershipProvider implements MembershipProvider {
  constructor(
    private readonly apiKey: string,
    private readonly groupId: string,
    private readonly baseUrl: string = "https://api.skool.com",
  ) {}

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      // Nunca cacheamos datos de membresía: el gating debe ser fresco.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Skool API error ${res.status} en ${path}`);
    }
    return (await res.json()) as T;
  }

  async findMemberByEmail(email: string): Promise<Member | null> {
    const query = new URLSearchParams({
      group_id: this.groupId,
      email: email.toLowerCase(),
    });
    const data = await this.request<{ members: SkoolMemberDto[] }>(
      `/v1/members?${query.toString()}`,
    );
    const dto = data.members?.[0];
    return dto ? toMember(dto) : null;
  }

  async listActiveMembers(): Promise<Member[]> {
    const query = new URLSearchParams({
      group_id: this.groupId,
      status: "active",
    });
    const data = await this.request<{ members: SkoolMemberDto[] }>(
      `/v1/members?${query.toString()}`,
    );
    return (data.members ?? [])
      .map(toMember)
      .filter((m) => m.status === "active");
  }

  async listMembers(): Promise<Member[]> {
    // Todos los estados: el job de sincronización necesita ver churned/removed.
    const query = new URLSearchParams({ group_id: this.groupId });
    const data = await this.request<{ members: SkoolMemberDto[] }>(
      `/v1/members?${query.toString()}`,
    );
    return (data.members ?? []).map(toMember);
  }
}
