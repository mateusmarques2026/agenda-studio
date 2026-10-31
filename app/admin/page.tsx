import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isStudioAdmin, requireStudioAdmin } from "@/lib/studio-access";
import Agenda from "@/app/agenda";
import { sessionView } from "@/lib/session-view";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/entrar?destino=/admin");
  if (!isStudioAdmin(user)) redirect("/cliente?acesso=restrito");
  await requireStudioAdmin(user);
  return <Agenda identity={sessionView(user)!} />;
}
