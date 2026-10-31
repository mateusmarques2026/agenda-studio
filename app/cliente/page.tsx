import { redirect } from "next/navigation";
import { sessionView } from "@/lib/session-view";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isStudioAdmin, requireStudioAdmin } from "@/lib/studio-access";
import Customer from "./customer";
export const dynamic = "force-dynamic";
export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ acesso?: string }>;
}) {
  const user = await getChatGPTUser();
  if (!user) redirect("/entrar?destino=/cliente");
  const admin = isStudioAdmin(user);
  if (admin) await requireStudioAdmin(user);
  const query = await searchParams;
  return (
    <Customer
      displayName={user.fullName ?? ""}
      admin={admin}
      identity={sessionView(user)!}
      restricted={query.acesso === "restrito"}
    />
  );
}
