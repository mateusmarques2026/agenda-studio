import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
export type SessionView = { name: string; email: string; local: boolean };
export function sessionView(user: ChatGPTUser | null): SessionView | undefined {
  return user
    ? {
        name: user.fullName ?? user.email,
        email: user.email,
        local: env.STUDIO_LOCAL_PREVIEW === "1",
      }
    : undefined;
}
export function isLocalPreview() {
  return env.STUDIO_LOCAL_PREVIEW === "1";
}
