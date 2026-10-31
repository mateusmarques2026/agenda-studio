import { ArrowRight, UserRound, ShieldCheck } from "lucide-react";
import { getChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
import { isStudioAdmin } from "@/lib/studio-access";
import { sessionView, isLocalPreview } from "@/lib/session-view";
import StudioHeader from "@/app/components/studio-header";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const query = await searchParams;
  const user = await getChatGPTUser();
  const admin = isStudioAdmin(user);
  const destination =
    query.destino === "/admin"
      ? "/admin"
      : query.destino === "/cliente"
        ? "/cliente"
        : admin
          ? "/admin"
          : "/cliente";
  const local = isLocalPreview();
  return (
    <>
      <StudioHeader admin={admin} identity={sessionView(user)} />
      <main className="login-page">
        <div className="login-explainer">
          <span className="eyebrow">STUDIO / ACESSO À CONTA</span>
          <h1>{user ? "Conta conectada." : "Entre para\nagendar."}</h1>
          <p>
            Suas reservas ficam ligadas à sua conta. O acesso administrativo é reservado ao dono do
            negócio.
          </p>
          <div className="login-rules">
            <div>
              <UserRound size={22} />
              <span>
                <strong>Cliente</strong>
                <small>Agende e acompanhe apenas suas próprias reservas.</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={22} />
              <span>
                <strong>Dono do negócio</strong>
                <small>Gerencie serviços, horários e todos os atendimentos.</small>
              </span>
            </div>
          </div>
        </div>
        <section className="login-card">
          {user ? (
            <>
              <span className="eyebrow">SEU ACESSO</span>
              <h2>{user.fullName ?? "Minha conta"}</h2>
              <p className="login-email">{user.email}</p>
              <div className="login-role">
                <span>Perfil autorizado</span>
                <strong>{admin ? "Dono do negócio" : "Cliente"}</strong>
              </div>
              {local && (
                <div className="local-login-note">
                  <strong>Ambiente de desenvolvimento</strong>
                  <p>
                    Esta é uma conta de teste. O login local não solicita senha. Na versão
                    publicada, sua identidade é confirmada pelo provedor de acesso.
                  </p>
                </div>
              )}
              <a className="primary" href={destination}>
                Abrir {destination === "/admin" ? "administração" : "área do cliente"}
                <ArrowRight size={17} />
              </a>
              {admin && (
                <a className="secondary" href={destination === "/admin" ? "/cliente" : "/admin"}>
                  {destination === "/admin" ? "Ver área do cliente" : "Abrir administração"}
                </a>
              )}
              <a className="text-button" href="/signout-with-chatgpt?return_to=/entrar">
                Sair desta conta
              </a>
            </>
          ) : (
            <>
              <span className="eyebrow">IDENTIFICAÇÃO</span>
              <h2>Acesse o Studio</h2>
              <p>Continue com sua conta para confirmar horários e consultar seus atendimentos.</p>
              {local && (
                <div className="local-login-note">
                  <strong>Você está no ambiente local</strong>
                  <p>
                    Uma conta fictícia de dono será usada para desenvolvimento. Nenhuma senha será
                    solicitada.
                  </p>
                </div>
              )}
              <a className="primary" href={chatGPTSignInPath(destination)} target="_top">
                {local ? "Entrar com conta de teste" : "Entrar com ChatGPT"}
                <ArrowRight size={17} />
              </a>
              <p className="login-provider-note">
                O perfil de acesso é verificado pelo servidor. Abrir a tela do dono não concede
                permissão administrativa.
              </p>
            </>
          )}
        </section>
      </main>
    </>
  );
}
