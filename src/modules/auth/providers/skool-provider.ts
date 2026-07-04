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
}
