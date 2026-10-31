import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { matchesAdminEmail } from "./permissions";
import { AppError, database, initializeServices } from "./repository";
export type StudioBusiness = { id: string; owner: string; name: string };
export function isStudioAdmin(user: ChatGPTUser | null) {
  return matchesAdminEmail(user?.email, env.STUDIO_ADMIN_EMAIL);
}
export async function getStudioBusiness() {
  return database()
    .prepare("SELECT id,owner,name FROM businesses WHERE id='studio'")
    .first<StudioBusiness>();
}
export async function requireStudioBusiness() {
  const business = await getStudioBusiness();
  if (!business) throw new AppError("A agenda ainda não foi aberta pelo responsável.", 503);
  return business;
}
export async function requireStudioAdmin(user: ChatGPTUser) {
  if (!isStudioAdmin(user)) throw new AppError("Esta área é exclusiva do dono do negócio.", 403);
  const db = database();
  await db
    .prepare(
      "INSERT OR IGNORE INTO businesses (id,owner,name,created_at) VALUES ('studio',?,'Studio Barbearia',?)",
    )
    .bind(user.userId, new Date().toISOString())
    .run();
  const business = await requireStudioBusiness();
  if (business.owner !== user.userId)
    throw new AppError("A conta conectada não é a responsável por este negócio.", 403);
  await initializeServices(business.owner);
  return business;
}
