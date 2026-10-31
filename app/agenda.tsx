"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Scissors,
  Clock3,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Search,
  X,
  Check,
  CircleCheck,
  Ban,
  Pencil,
  CalendarCheck2,
  Users,
  Wallet,
  ArrowRight,
  Coffee,
  RotateCw,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  addDays,
  availableTimes,
  formatDate,
  formatTime,
  money,
  zonedNow,
  isOpenDay,
  type Booking,
  type DayData,
  type Service,
} from "@/lib/scheduling";

import { Modal, Calendar } from "./components/agenda-controls";
import StudioHeader from "./components/studio-header";
import type { SessionView } from "@/lib/session-view";
type View = "agenda" | "services" | "availability";
const EMPTY: DayData = { services: [], bookings: [], blocks: [], occupied: [] };
const statusLabel = { confirmed: "Confirmado", completed: "Atendido", cancelled: "Cancelado" };
async function api<T = { id?: string; ok?: boolean }>(url: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/admin/" + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir.");
  return data;
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export default function Agenda({ identity }: { identity: SessionView }) {
  const today = zonedNow().date;
  const [date, setDate] = useState(today);
  const [view, setView] = useState<View>("agenda");
  const [data, setData] = useState<DayData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<"booking" | "service" | "block" | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [chosenService, setChosenService] = useState("");
  const [chosenTime, setChosenTime] = useState<number | null>(null);
  const [modalError, setModalError] = useState("");
  const [blockDuration, setBlockDuration] = useState(60);
  const serial = useRef(0);
  const load = useCallback(
    async (silent = false) => {
      const request = ++serial.current;
      if (!silent) setLoading(true);
      setError("");
      try {
        const result = await api<DayData>("day?date=" + date);
        if (request === serial.current) setData(result);
      } catch (e) {
        if (request === serial.current) setError((e as Error).message);
      } finally {
        if (request === serial.current) setLoading(false);
      }
    },
    [date],
  );
  useEffect(() => {
    void load();
    return () => {
      serial.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const activeServices = data.services.filter((s) => s.active);
  const selectedService = activeServices.find((s) => s.id === chosenService);
  const times = availableTimes(date, selectedService?.duration ?? 30, data.occupied);
  const blockTimes = availableTimes(date, blockDuration, data.occupied);
  const activeBookings = data.bookings.filter((b) => b.status !== "cancelled");
  const completed = activeBookings.filter((b) => b.status === "completed");
  const bookedMinutes = activeBookings.reduce((n, b) => n + b.duration, 0);
  const occupancy = isOpenDay(date) ? Math.round((bookedMinutes / 480) * 100) : 0;
  const visible = data.bookings.filter(
    (b) =>
      (filter === "all" || b.status === filter) &&
      [b.customer, b.service_name, b.phone]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const freeTimes = availableTimes(date, 30, data.occupied);
  function close() {
    if (pending) return;
    setModal(null);
    setDetail(null);
    setModalError("");
  }
  function openBooking(time?: number) {
    setModalError("");
    setChosenService(activeServices[0]?.id ?? "");
    setChosenTime(time ?? null);
    setModal("booking");
  }
  async function mutate(task: () => Promise<unknown>, message: string) {
    setPending(true);
    setModalError("");
    try {
      await task();
      setModal(null);
      setDetail(null);
      setToast(message);
      await load();
    } catch (e) {
      setModalError((e as Error).message);
      setToast((e as Error).message);
      await load();
    } finally {
      setPending(false);
    }
  }
  function submitBooking(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chosenTime === null || !selectedService) {
      setModalError("Escolha um serviço e um horário.");
      return;
    }
    const f = new FormData(e.currentTarget);
    void mutate(
      () =>
        api("bookings", "POST", {
          date,
          start: chosenTime,
          serviceId: chosenService,
          customer: f.get("customer"),
          phone: f.get("phone"),
          notes: f.get("notes"),
        }),
      "Agendamento confirmado. Tudo certo!",
    );
  }
  function submitService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void mutate(
      () =>
        api("services" + (editing ? "/" + editing.id : ""), editing ? "PATCH" : "POST", {
          name: f.get("name"),
          duration: Number(f.get("duration")),
          price: Math.round(Number(f.get("price")) * 100),
        }),
      editing ? "Serviço atualizado." : "Novo serviço cadastrado.",
    );
  }
  function submitBlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (chosenTime === null) {
      setModalError("Escolha o início do bloqueio.");
      return;
    }
    void mutate(
      () =>
        api("blocks", "POST", {
          date,
          start: chosenTime,
          duration: blockDuration,
          reason: f.get("reason"),
        }),
      "Horário bloqueado na agenda.",
    );
  }
  async function examples() {
    setPending(true);
    try {
      const names = ["Pedro Almeida", "Lucas Martins", "Rafael Costa"];
      let occupied = [...data.occupied];
      let count = 0;
      for (let i = 0; i < names.length; i++) {
        const service = activeServices[i % activeServices.length];
        if (!service) break;
        const time = availableTimes(date, service.duration, occupied)[i === 0 ? 0 : 1];
        if (time === undefined) break;
        await api("bookings", "POST", {
          date,
          start: time,
          serviceId: service.id,
          customer: names[i] + " (demo)",
          phone: "00000000000",
          notes: "Dados fictícios para demonstração do portfólio.",
        });
        for (let m = time; m < time + service.duration; m += 15) occupied.push(m);
        count++;
      }
      setToast(
        count ? "Exemplos adicionados à agenda." : "Escolha um dia com horários disponíveis.",
      );
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      await load();
      setPending(false);
    }
  }
  useEffect(() => {
    const refresh = () => {
      if (!pending && document.visibilityState === "visible") void load(true);
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load, pending]);
  const changeView = (v: View) => setView(v);
  return (
    <div className="app-shell">
      <StudioHeader area="admin" admin identity={identity} />
      <div className="workspace-main">
        <div className="navigation-bar">
          <nav aria-label="Menu principal">
            {(
              [
                ["agenda", "Agenda"],
                ["services", "Serviços"],
                ["availability", "Disponibilidade"],
              ] as const
            ).map(([key, label], i) => (
              <button
                key={key}
                aria-label={label}
                className={view === key ? "active" : ""}
                aria-current={view === key ? "page" : undefined}
                onClick={() => changeView(key)}
              >
                <span className="nav-index">0{i + 1}</span>
                {label}
                {key === "agenda" && (
                  <span className="nav-count">{loading ? "—" : activeBookings.length}</span>
                )}
              </button>
            ))}
          </nav>
          <span className="shop-label">
            <Scissors size={15} />
            Studio Barbearia<span className="shop-divider">/</span>01 profissional
          </span>
        </div>
        <main>
          <div className="page-heading" data-view={view}>
            <div>
              <span className="eyebrow">PAINEL DO DONO / STUDIO BARBEARIA</span>
              <h1>
                {view === "agenda"
                  ? "Agenda."
                  : view === "services"
                    ? "Serviços."
                    : "Disponibilidade."}
              </h1>
              <p>
                {view === "agenda"
                  ? "Atendimentos, horários e clientes do dia."
                  : view === "services"
                    ? "Catálogo de serviços, preços e duração."
                    : "Expediente e bloqueios de atendimento."}
              </p>
            </div>
            <button
              className="primary"
              disabled={
                pending || loading || !!error || (view === "agenda" && activeServices.length === 0)
              }
              onClick={() => {
                setModalError("");
                if (view === "services") {
                  setEditing(null);
                  setModal("service");
                } else if (view === "availability") {
                  setChosenTime(null);
                  setBlockDuration(60);
                  setModal("block");
                } else openBooking();
              }}
            >
              <Plus size={19} />
              {view === "services"
                ? "Novo serviço"
                : view === "availability"
                  ? "Bloquear horário"
                  : "Novo agendamento"}
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => void load()}>
                <RotateCw size={15} />
                Tentar novamente
              </button>
            </div>
          )}
          {view === "agenda" && (
            <div className="stats" aria-label="Resumo da data selecionada">
              <div className="stat">
                <div>
                  <span>Agendamentos</span>
                  <CalendarDays size={18} />
                </div>
                <strong>{loading ? "—" : activeBookings.length.toString().padStart(2, "0")}</strong>
                <small>
                  <span className="stat-dot" />
                  Na data selecionada
                </small>
              </div>
              <div className="stat">
                <div>
                  <span>Atendimentos concluídos</span>
                  <Users size={18} />
                </div>
                <strong>{loading ? "—" : completed.length.toString().padStart(2, "0")}</strong>
                <small>
                  {activeBookings.filter((b) => b.status === "confirmed").length} aguardando
                  atendimento
                </small>
              </div>
              <div className="stat">
                <div>
                  <span>Receita realizada</span>
                  <Wallet size={18} />
                </div>
                <strong className="money-stat">
                  {loading ? "—" : money(completed.reduce((n, b) => n + b.price, 0))}
                </strong>
                <small>
                  {money(activeBookings.reduce((n, b) => n + b.price, 0))} em reservas ativas
                </small>
              </div>
              <div className="stat stat-green">
                <div>
                  <span>Ocupação da agenda</span>
                  <Clock3 size={18} />
                </div>
                <strong>{loading ? "—" : occupancy + "%"}</strong>
                <div className="progress-track">
                  <span style={{ width: occupancy + "%" }} />
                </div>
                <small>{bookedMinutes / 60}h de atendimento · 8h de expediente</small>
              </div>
            </div>
          )}
          <div className={view === "services" ? "services-layout" : "content-grid"}>
            <section className="main-column">
              {view !== "services" && (
                <section className="panel agenda-panel">
                  <div className="panel-heading">
                    <div className="day-heading">
                      <span className="day-number">{date.slice(-2)}</span>
                      <div>
                        <h2>{formatDate(date, { weekday: "long" })}</h2>
                        <p>
                          {formatDate(date, { month: "long", year: "numeric" })}
                          <span className="date-dot">/</span>
                          {date === today
                            ? "Hoje"
                            : view === "agenda"
                              ? "Agenda do dia"
                              : "Bloqueios do dia"}
                        </p>
                      </div>
                    </div>
                    <div className="date-controls">
                      <button
                        className="icon-button"
                        title="Atualizar agenda"
                        aria-label="Atualizar agenda"
                        disabled={loading || pending}
                        onClick={() => void load()}
                      >
                        <RotateCw size={16} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setDate(addDays(date, -1))}
                        aria-label="Dia anterior"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button className="today-button" onClick={() => setDate(today)}>
                        Hoje
                      </button>
                      <button
                        className="icon-button"
                        disabled={date >= addDays(today, 90)}
                        onClick={() => setDate(addDays(date, 1))}
                        aria-label="Próximo dia"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <label className="date-picker">
                        <CalendarDays size={17} />
                        <input
                          aria-label="Selecionar data"
                          type="date"
                          value={date}
                          max={addDays(today, 90)}
                          onChange={(e) => {
                            if (e.target.value) setDate(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="week-strip">
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = addDays(date, i - 3);
                      return (
                        <button
                          key={d}
                          className={d === date ? "chosen" : ""}
                          disabled={d > addDays(today, 90)}
                          onClick={() => setDate(d)}
                        >
                          <span>{formatDate(d, { weekday: "short" }).replace(".", "")}</span>
                          <strong>{Number(d.slice(-2))}</strong>
                          <i className={d === today ? "has-date" : ""} />
                        </button>
                      );
                    })}
                  </div>
                  {view === "agenda" ? (
                    <>
                      <div className="list-toolbar">
                        <div className="filters">
                          {[
                            ["all", "Todos"],
                            ["confirmed", "Confirmados"],
                            ["completed", "Atendidos"],
                            ["cancelled", "Cancelados"],
                          ].map(([key, label]) => (
                            <button
                              key={key}
                              className={filter === key ? "selected" : ""}
                              onClick={() => setFilter(key)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <label className="search">
                          <Search size={16} />
                          <input
                            placeholder="Buscar cliente ou serviço"
                            aria-label="Buscar cliente ou serviço"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="booking-table">
                        <div className="table-head">
                          <span>HORÁRIO</span>
                          <span>CLIENTE / SERVIÇO</span>
                          <span>STATUS</span>
                          <span>VALOR</span>
                          <span />
                        </div>
                        {loading ? (
                          <div className="loading-state">
                            <RotateCw className="spin" size={20} />
                            Carregando sua agenda…
                          </div>
                        ) : error ? (
                          <div className="empty-state">
                            <Ban size={32} />
                            <h3>Não foi possível carregar a agenda</h3>
                            <p>Tente novamente para consultar seus horários.</p>
                          </div>
                        ) : visible.length ? (
                          visible.map((b, i) => (
                            <button
                              className={
                                "booking-row " + (b.status === "cancelled" ? "cancelled-row" : "")
                              }
                              key={b.id}
                              onClick={() => {
                                setModalError("");
                                setDetail(b);
                              }}
                            >
                              <span className="booking-time">
                                <strong>{formatTime(b.start)}</strong>
                                <small>{formatTime(b.start + b.duration)}</small>
                              </span>
                              <span className="client-cell">
                                <span className={"client-avatar avatar-" + (i % 4)}>
                                  {initials(b.customer)}
                                </span>
                                <span>
                                  <strong>{b.customer}</strong>
                                  <small>
                                    {b.service_name}
                                    <span> · </span>
                                    {b.duration} min{b.source === "customer" ? " · Online" : ""}
                                  </small>
                                </span>
                              </span>
                              <span>
                                <span className={"status " + b.status}>
                                  <i />
                                  {statusLabel[b.status]}
                                </span>
                              </span>
                              <span className="booking-price">{money(b.price)}</span>
                              <ArrowUpRight size={17} />
                            </button>
                          ))
                        ) : (
                          <div className="empty-state">
                            <span className="empty-icon">
                              <CalendarCheck2 size={30} />
                            </span>
                            <h3>
                              {search || filter !== "all"
                                ? "Nenhum resultado."
                                : !isOpenDay(date)
                                  ? "Sem expediente aos domingos."
                                  : "Nenhum atendimento agendado."}
                            </h3>
                            <p>
                              {search || filter !== "all"
                                ? "Experimente outro nome ou filtro."
                                : !isOpenDay(date)
                                  ? "A barbearia atende de segunda a sábado."
                                  : "Escolha um horário para registrar o primeiro cliente."}
                            </p>
                            {!search && filter === "all" && freeTimes.length > 0 && (
                              <button
                                className="text-button"
                                disabled={pending || !activeServices.length}
                                onClick={() => openBooking()}
                              >
                                Agendar primeiro cliente
                                <ArrowRight size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="table-footer">
                        <span>
                          {visible.length} {visible.length === 1 ? "agendamento" : "agendamentos"}{" "}
                          nesta visualização
                        </span>
                        <span>
                          <ShieldCheck size={14} />
                          Horários sem sobreposição
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="availability-body">
                      <div className="schedule-banner">
                        <Clock3 size={21} />
                        <div>
                          <strong>Segunda a sábado · 09h às 18h</strong>
                          <p>Intervalo para almoço das 12h às 13h · horários a cada 15 minutos.</p>
                        </div>
                      </div>
                      <div className="section-line">
                        <h3>Bloqueios em {formatDate(date, { day: "numeric", month: "short" })}</h3>
                        <span>{data.blocks.length} bloqueios</span>
                      </div>
                      {loading ? (
                        <p className="muted">Carregando…</p>
                      ) : data.blocks.length ? (
                        data.blocks.map((b) => (
                          <div className="block-row" key={b.id}>
                            <span className="block-icon">
                              <Coffee size={19} />
                            </span>
                            <div>
                              <strong>{b.reason}</strong>
                              <small>
                                {formatTime(b.start)} — {formatTime(b.start + b.duration)}
                              </small>
                            </div>
                            <button
                              className="text-button danger"
                              disabled={pending}
                              onClick={() =>
                                void mutate(
                                  () => api("blocks/" + b.id, "DELETE"),
                                  "Bloqueio removido. Horário liberado.",
                                )
                              }
                            >
                              Liberar horário
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state compact">
                          <Coffee size={30} />
                          <h3>Nenhum horário bloqueado.</h3>
                          <p>Bloqueie um horário para compromissos pessoais ou imprevistos.</p>
                        </div>
                      )}
                      <p className="hint">
                        <ShieldCheck size={16} />
                        Um bloqueio só é criado se todo o intervalo estiver livre.
                      </p>
                    </div>
                  )}
                </section>
              )}
              {view === "services" && (
                <>
                  <div className="section-line services-intro">
                    <span>{activeServices.length} serviços ativos</span>
                    <span>
                      <Clock3 size={15} /> Duração em intervalos de 15 minutos
                    </span>
                  </div>
                  <div className="service-grid">
                    {loading ? (
                      <p>Carregando serviços…</p>
                    ) : (
                      data.services.map((s, i) => (
                        <article
                          className={"service-card " + (!s.active ? "inactive" : "")}
                          key={s.id}
                        >
                          <div className="service-card-top">
                            <span className="service-number">{String(i + 1).padStart(2, "0")}</span>
                            <span className={"status " + (s.active ? "confirmed" : "cancelled")}>
                              <i />
                              {s.active ? "Ativo" : "Pausado"}
                            </span>
                          </div>
                          <h2>{s.name}</h2>
                          <div className="service-price">
                            <strong>{money(s.price)}</strong>
                            <span>
                              <Clock3 size={15} />
                              {s.duration} min
                            </span>
                          </div>
                          <div className="service-actions">
                            <button
                              onClick={() => {
                                setEditing(s);
                                setModalError("");
                                setModal("service");
                              }}
                            >
                              <Pencil size={15} />
                              Editar serviço
                            </button>
                            <button
                              disabled={pending}
                              onClick={() =>
                                void mutate(
                                  () =>
                                    api("service-status/" + s.id, "PATCH", { active: !s.active }),
                                  s.active ? "Serviço pausado." : "Serviço ativado.",
                                )
                              }
                            >
                              {s.active ? "Pausar" : "Ativar"}
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                    <button
                      className="add-service-card"
                      disabled={loading || pending || !!error}
                      onClick={() => {
                        setEditing(null);
                        setModalError("");
                        setModal("service");
                      }}
                    >
                      <span>
                        <Plus size={25} />
                      </span>
                      <strong>Cadastrar outro serviço</strong>
                    </button>
                  </div>
                  <div className="info-strip">
                    <ShieldCheck size={20} />
                    <p>
                      Alterar o preço ou a duração de um serviço vale para novas reservas. Os
                      agendamentos existentes mantêm os valores originais.
                    </p>
                  </div>
                </>
              )}
            </section>
            {view !== "services" && (
              <aside className="right-column">
                <section className="panel calendar-panel">
                  <Calendar date={date} onSelect={setDate} />
                  <div className="calendar-legend">
                    <span>
                      <i />
                      Dia selecionado
                    </span>
                    <span>Horário de Brasília</span>
                  </div>
                </section>
                <section className="panel free-panel">
                  <div className="section-line">
                    <h3>Horários livres</h3>
                    <span className="available-badge">
                      <i />
                      Disponível
                    </span>
                  </div>
                  <p>Sugestões para um atendimento de 30 min.</p>
                  <div className="free-slots">
                    {!loading &&
                      !error &&
                      freeTimes
                        .filter((_, i) => i % 2 === 0)
                        .slice(0, 6)
                        .map((time) => (
                          <button
                            key={time}
                            disabled={!activeServices.length || pending}
                            onClick={() => openBooking(time)}
                          >
                            {formatTime(time)}
                            <Plus size={13} />
                          </button>
                        ))}
                  </div>
                  {!loading && !error && !freeTimes.length && (
                    <p className="muted">
                      {!isOpenDay(date)
                        ? "Sem expediente neste dia."
                        : "Sem horários futuros livres neste dia."}
                    </p>
                  )}
                  <small>Prévia para atendimentos de 30 minutos.</small>
                </section>
                <section className="demo-card">
                  <span className="eyebrow">DADOS DE TESTE</span>
                  <p>Preencha a data selecionada com três clientes fictícios.</p>
                  <button
                    disabled={
                      loading || pending || !!error || !freeTimes.length || !activeServices.length
                    }
                    onClick={() => void examples()}
                  >
                    Carregar exemplos
                    <ArrowUpRight size={16} />
                  </button>
                </section>
              </aside>
            )}
          </div>
          <footer className="footer">
            <span>
              STUDIO <span>/</span> Gestão de agendamentos
            </span>
            <span>Administração · v1.2</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={19} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Dispensar aviso">
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "booking" && (
        <Modal
          title="Novo agendamento"
          subtitle={formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
          onClose={close}
        >
          <form onSubmit={submitBooking}>
            <fieldset disabled={pending}>
              <label>
                Serviço
                <select
                  aria-label="Serviço"
                  value={chosenService}
                  onChange={(e) => {
                    setChosenService(e.target.value);
                    setChosenTime(null);
                  }}
                  required
                >
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration} min · {money(s.price)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Nome do cliente
                  <input
                    name="customer"
                    autoComplete="name"
                    placeholder="Nome completo"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Telefone com DDD
                  <input
                    name="phone"
                    autoComplete="tel"
                    type="tel"
                    placeholder="(85) 99999-9999"
                    minLength={10}
                    maxLength={22}
                    required
                  />
                </label>
              </div>
              <label>
                Horário disponível
                <span className="field-hint">
                  {selectedService?.duration ?? 30} minutos reservados · horário de Brasília
                </span>
              </label>
              <div className="time-grid">
                {times.map((time) => (
                  <button
                    type="button"
                    className={chosenTime === time ? "chosen" : ""}
                    aria-pressed={chosenTime === time}
                    key={time}
                    onClick={() => setChosenTime(time)}
                  >
                    {formatTime(time)}
                  </button>
                ))}
              </div>
              {!times.length && (
                <div className="form-note">
                  Não há horários disponíveis para esse serviço nesta data. Selecione outro dia na
                  agenda.
                </div>
              )}
              <label>
                Observações <span className="optional">opcional</span>
                <textarea
                  name="notes"
                  placeholder="Informações sobre o atendimento"
                  maxLength={400}
                  rows={2}
                />
              </label>
              {modalError && (
                <p className="form-error" role="alert">
                  {modalError}
                </p>
              )}
              <div className="booking-summary">
                <span>Total do atendimento</span>
                <strong>{money(selectedService?.price ?? 0)}</strong>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  Voltar
                </button>
                <button
                  className="primary"
                  disabled={!times.includes(chosenTime ?? -1) || !selectedService || loading}
                >
                  {pending ? (
                    "Salvando…"
                  ) : (
                    <>
                      <Check size={18} />
                      Confirmar agendamento
                    </>
                  )}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {modal === "service" && (
        <Modal
          title={editing ? "Editar serviço" : "Novo serviço"}
          subtitle="Defina o valor e o tempo de atendimento."
          onClose={close}
        >
          <form onSubmit={submitService}>
            <fieldset disabled={pending}>
              <label>
                Nome do serviço
                <input
                  name="name"
                  defaultValue={editing?.name}
                  placeholder="Ex.: Corte e finalização"
                  minLength={2}
                  maxLength={70}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  Duração
                  <select
                    aria-label="Duração"
                    name="duration"
                    defaultValue={editing?.duration ?? 30}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option value={(i + 1) * 15} key={i}>
                        {(i + 1) * 15} minutos
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Preço em reais
                  <input
                    type="number"
                    name="price"
                    min="0"
                    max="10000"
                    step="0.01"
                    defaultValue={editing ? editing.price / 100 : ""}
                    placeholder="40,00"
                    required
                  />
                </label>
              </div>
              {modalError && (
                <p className="form-error" role="alert">
                  {modalError}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  Voltar
                </button>
                <button className="primary">{pending ? "Salvando…" : "Salvar serviço"}</button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {modal === "block" && (
        <Modal
          title="Bloquear horário"
          subtitle={formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
          onClose={close}
        >
          <form onSubmit={submitBlock}>
            <fieldset disabled={pending}>
              <label>
                Motivo do bloqueio
                <input
                  name="reason"
                  placeholder="Ex.: Compromisso pessoal"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Duração
                <select
                  aria-label="Duração"
                  value={blockDuration}
                  onChange={(e) => {
                    setBlockDuration(Number(e.target.value));
                    setChosenTime(null);
                  }}
                >
                  {[15, 30, 45, 60, 90, 120, 180, 240, 300].map((n) => (
                    <option key={n} value={n}>
                      {n} minutos
                    </option>
                  ))}
                </select>
              </label>
              <label>Início do bloqueio</label>
              <div className="time-grid">
                {blockTimes.map((time) => (
                  <button
                    type="button"
                    className={chosenTime === time ? "chosen" : ""}
                    key={time}
                    onClick={() => setChosenTime(time)}
                  >
                    {formatTime(time)}
                  </button>
                ))}
              </div>
              {!blockTimes.length && (
                <p className="form-note">Não há intervalos livres com essa duração nesta data.</p>
              )}
              {modalError && (
                <p className="form-error" role="alert">
                  {modalError}
                </p>
              )}
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={close}>
                  Voltar
                </button>
                <button
                  className="primary"
                  disabled={!blockTimes.includes(chosenTime ?? -1) || loading}
                >
                  {pending ? "Salvando…" : "Bloquear horário"}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title={detail.customer}
          subtitle={
            detail.service_name + " · " + formatDate(detail.date, { day: "numeric", month: "long" })
          }
          onClose={close}
        >
          <div className="detail-card">
            <span className={"status " + detail.status}>
              <i />
              {statusLabel[detail.status]}
            </span>
            <strong>
              {formatTime(detail.start)} — {formatTime(detail.start + detail.duration)}
            </strong>
            <p>
              {detail.duration} minutos · {money(detail.price)}
              <br />
              <span>
                {detail.source === "customer"
                  ? "Agendado pela área do cliente"
                  : "Registrado pelo profissional"}
              </span>
            </p>
            <div className="detail-line">
              <span>Telefone</span>
              <strong>{detail.phone}</strong>
            </div>
            {detail.notes && (
              <div className="detail-notes">
                <span>Observações</span>
                <p>{detail.notes}</p>
              </div>
            )}
          </div>
          {modalError && (
            <p className="form-error" role="alert">
              {modalError}
            </p>
          )}
          {detail.status === "confirmed" ? (
            <div className="modal-actions">
              <button
                disabled={pending}
                className="secondary danger"
                onClick={() =>
                  void mutate(
                    () => api("bookings/" + detail.id, "PATCH", { status: "cancelled" }),
                    "Agendamento cancelado. O horário está livre novamente.",
                  )
                }
              >
                <Ban size={16} />
                Cancelar reserva
              </button>
              <button
                disabled={pending}
                className="primary"
                onClick={() =>
                  void mutate(
                    () => api("bookings/" + detail.id, "PATCH", { status: "completed" }),
                    "Atendimento concluído.",
                  )
                }
              >
                <Check size={17} />
                {pending ? "Salvando…" : "Marcar como atendido"}
              </button>
            </div>
          ) : (
            <button className="secondary full-width" onClick={close}>
              Fechar detalhes
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
