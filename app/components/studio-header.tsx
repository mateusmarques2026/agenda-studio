import { ArrowUpRight, LogOut, UserRound } from "lucide-react";
import type { SessionView } from "@/lib/session-view";
export default function StudioHeader({
  area = "portal",
  admin = false,
  identity,
}: {
  area?: "portal" | "customer" | "admin";
  admin?: boolean;
  identity?: SessionView;
}) {
  return (
    <header className="studio-header">
      <div className="header-inner">
        <a href="/" className="brand" aria-label="Studio, início">
          <span className="brand-slash">/</span>
          <strong>STUDIO</strong>
          <span className="brand-caption">
            CORTE, BARBA
            <br />E HORÁRIO MARCADO
          </span>
        </a>
        <div className="header-account">
          <a href={area === "customer" ? "/" : "/cliente"}>
            <span className="desktop-label">
              {area === "customer" ? "Início" : "Área do cliente"}
            </span>
            <span className="mobile-label">{area === "customer" ? "Início" : "Cliente"}</span>
            <ArrowUpRight size={14} />
          </a>
          {area !== "admin" && (
            <a href="/admin" className="owner-entry">
              <span className="desktop-label">
                {admin ? "Administração" : "Acesso do profissional"}
              </span>
              <span className="mobile-label">{admin ? "Admin" : "Dono"}</span>
            </a>
          )}
          {identity ? (
            <details className="account-menu">
              <summary aria-label="Minha conta">
                <UserRound size={17} />
                <span>
                  <strong>{identity.name}</strong>
                  <small>
                    {admin ? "Dono do negócio" : "Cliente"}
                    {identity.local ? " · teste local" : ""}
                  </small>
                </span>
              </summary>
              <div className="account-dropdown">
                <strong>{identity.name}</strong>
                <p>{identity.email}</p>
                <span className="account-role">{admin ? "Administrador / dono" : "Cliente"}</span>
                {identity.local && (
                  <p className="local-login-note">
                    Você está usando uma conta fictícia no ambiente local.
                  </p>
                )}
                <a href="/entrar">
                  Detalhes do acesso
                  <ArrowUpRight size={13} />
                </a>
                <a href="/signout-with-chatgpt?return_to=/entrar">
                  <LogOut size={15} />
                  Sair da conta
                </a>
              </div>
            </details>
          ) : (
            <a className="owner-entry" href="/entrar">
              Entrar
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
