import { getDb } from "@/db";
import { getRedis } from "@/lib/redis";
import { AuthService } from "./auth-service";
import { DrizzlePartnerRepo } from "./partner-repo";
import { createMembershipProvider } from "./provider-factory";
import { RedisSessionStore } from "./session-store";

let service: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!service) {
    service = new AuthService({
      provider: createMembershipProvider(),
      sessions: new RedisSessionStore(getRedis()),
      repo: new DrizzlePartnerRepo(getDb()),
      groupId: process.env.SKOOL_GROUP_ID ?? "dev",
    });
  }
  return service;
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS } from "./session-store";
export type { LoginResult } from "./auth-service";
