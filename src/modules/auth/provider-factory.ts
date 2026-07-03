import { DevMembershipProvider } from "./dev-provider";
import type { MembershipProvider } from "./membership-provider";
import { SkoolMembershipProvider } from "./skool-provider";

export function createMembershipProvider(): MembershipProvider {
  const apiKey = process.env.SKOOL_API_KEY;
  const groupId = process.env.SKOOL_GROUP_ID;

  if (apiKey && groupId) {
    return new SkoolMembershipProvider({ apiKey, groupId });
  }

  if (process.env.NODE_ENV !== "production" && process.env.DEV_MEMBER_EMAILS) {
    return new DevMembershipProvider(
      process.env.DEV_MEMBER_EMAILS.split(","),
    );
  }

  throw new Error(
    "No membership provider configured: set SKOOL_API_KEY + SKOOL_GROUP_ID (or DEV_MEMBER_EMAILS in development)",
  );
}
