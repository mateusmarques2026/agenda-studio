import { sessionView } from "@/lib/session-view";
import { ArrowUpRight, CalendarDays, Scissors, Clock3 } from "lucide-react";
import { getChatGPTUser } from "./chatgpt-auth";
import { isStudioAdmin, requireStudioAdmin } from "@/lib/studio-access";
import StudioHeader from "./components/studio-header";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  const admin = isStudioAdmin(user);
  if (user && admin) await requireStudioAdmin(user);
  return (
    <>
      <StudioHeader admin={admin} identity={sessionView(user)} />
      <main className="portal">
        <div className="portal-intro">
          <div>
            <span className="eyebrow">STUDIO BARBEARIA / AGENDAMENTOS</span>
            <h1>
              Agende seu
              <br />
              horário.
            </h1>
            <p>Escolha o serviço, encontre um horário livre e acompanhe seu atendimento.</p>
            <div className="business-hours">
              <Clock3 size={17} />
              <span>
                Segunda a sábado / 09h às 18h
                <br />
                <small>Intervalo das 12h às 13h · horário de Brasília</small>
              </span>
            </div>
          </div>
          <div className="portal-index" aria-hidden="true">
            <Scissors size={78} strokeWidth={1} />
            <span>
              ST
              <br />
              /DO
            </span>
          </div>
        </div>
        <div className="portal-access">
          <a href="/cliente" className="access-card customer-access">
            <span className="eyebrow">01 / PARA QUEM VEM SE CUIDAR</span>
            <div>
              <CalendarDays size={25} />
              <ArrowUpRight size={26} />
            </div>
            <h2>Área do cliente</h2>
            <p>Agende um atendimento, consulte suas reservas e cancele quando precisar.</p>
            <strong>
              Agendar meu horário
              <ArrowUpRight size={17} />
            </strong>
          </a>
          <a href="/admin" className="access-card admin-access">
            <span className="eyebrow">02 / PARA QUEM ATENDE</span>
            <div>
              <Scissors size={25} />
              <ArrowUpRight size={26} />
            </div>
            <h2>Área do dono</h2>
            <p>Gerencie os serviços, a agenda e os horários disponíveis da barbearia.</p>
            <strong>
              Acessar administração
              <ArrowUpRight size={17} />
            </strong>
          </a>
        </div>
        <footer className="footer">
          <span>STUDIO / Studio Barbearia</span>
          <span>Agendamento com conta conectada</span>
        </footer>
      </main>
    </>
  );
}
