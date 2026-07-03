import type { Member, MembershipProvider } from "./membership-provider";

// Implementación contra la API de Skool (https://docs.skoolapi.com/).
// RIESGO #1 DEL PROYECTO: los endpoints y formas de respuesta exactos deben
// validarse con una API key real del grupo. Cualquier ajuste queda contenido
// en este archivo — el resto del módulo solo conoce MembershipProvider.
interface SkoolConfig {
  apiKey: string;
  groupId: string;
  baseUrl?: string;
}

interface SkoolMemberPayload {
  id: string;
  email: string;
  name?: string | null;
  status?: string;
}

export class SkoolMembershipProvider implements MembershipProvider {
  private baseUrl: string;

  constructor(private config: SkoolConfig) {
    this.baseUrl = config.baseUrl ?? "https://api.skool.com/v1";
  }

  async findMemberByEmail(email: string): Promise<Member | null> {
    const res = await this.request(
      `/groups/${this.config.groupId}/members?email=${encodeURIComponent(email)}`,
    );
    if (res === null) {
      return null;
    }
    const members: SkoolMemberPayload[] = Array.isArray(res)
      ? res
      : (res.members ?? []);
    const match = members.find(
      (m) => m.email?.toLowerCase() === email.toLowerCase(),
    );
    return match ? toMember(match) : null;
  }

  async listActiveMembers(): Promise<Member[]> {
    const members: Member[] = [];
    let page = 1;
    // Paginación defensiva: cortar a las 100 páginas por si la API no pagina
    // como esperamos.
    while (page <= 100) {
      const res = await this.request(
        `/groups/${this.config.groupId}/members?status=active&page=${page}`,
      );
      const batch: SkoolMemberPayload[] = Array.isArray(res)
        ? res
        : (res?.members ?? []);
      if (batch.length === 0) {
        break;
      }
      members.push(...batch.map(toMember));
      if (!Array.isArray(res) && res?.has_more === false) {
        break;
      }
      page++;
    }
    return members.filter((m) => m.status === "active");
  }

  private async request(path: string) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: "application/json",
      },
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Skool API error ${res.status} on ${path}`);
    }
    return res.json();
  }
}

function toMember(payload: SkoolMemberPayload): Member {
  const status = payload.status ?? "active";
  return {
    externalId: payload.id,
    email: payload.email,
    displayName: payload.name ?? null,
    status:
      status === "active" || status === "churned" || status === "removed"
        ? status
        : "removed",
  };
}
