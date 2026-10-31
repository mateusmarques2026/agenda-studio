"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Scissors,
  X,
  RotateCw,
} from "lucide-react";
import StudioHeader from "@/app/components/studio-header";
import {
  addDays,
  availableTimes,
  formatDate,
  formatTime,
  isOpenDay,
  money,
  zonedNow,
  type Booking,
  type Service,
} from "@/lib/scheduling";
import type { SessionView } from "@/lib/session-view";
type Availability = { services: Service[]; occupied: number[]; business: { name: string } };
async function api<T>(route: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/customer/" + route, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir.");
  return data;
}
const statusNames = { confirmed: "Confirmado", completed: "Atendido", cancelled: "Cancelado" };
function isFuture(b: Booking) {
  const now = zonedNow();
  return b.date > now.date || (b.date === now.date && b.start > now.minute);
}
function CancelDialog({
  booking,
  pending,
  error,
  onCancel,
  onClose,
}: {
  booking: Booking;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current!.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="cancel-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-head">
          <div>
            <span className="eyebrow">MINHA RESERVA</span>
            <h2 id="cancel-title">Cancelar atendimento?</h2>
            <p>O horário ficará disponível para outros clientes.</p>
          </div>
          <button className="icon-button" disabled={pending} onClick={onClose} aria-label="Fechar">
            <X size={19} />
          </button>
        </div>
        <div className="cancel-summary">
          <strong>{booking.service_name}</strong>
          <p>
            {formatDate(booking.date, { day: "numeric", month: "long" })} às{" "}
            {formatTime(booking.start)}
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" disabled={pending} onClick={onClose}>
            Manter reserva
          </button>
          <button className="primary" disabled={pending} onClick={onCancel}>
            {pending ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
export default function Customer({
  displayName,
  admin,
  restricted,
  identity,
}: {
  displayName: string;
  admin: boolean;
  restricted: boolean;
  identity: SessionView;
}) {
  const today = zonedNow().date;
  const [view, setView] = useState<"book" | "bookings">("book");
  const [date, setDate] = useState(isOpenDay(today) ? today : addDays(today, 1));
  const [catalog, setCatalog] = useState<Availability>({
    services: [],
    occupied: [],
    business: { name: "Studio Barbearia" },
  });
  const [serviceId, setServiceId] = useState("");
  const [time, setTime] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [bookingsError, setBookingsError] = useState("");
  const [formError, setFormError] = useState("");
  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [cancel, setCancel] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState("");
  const serial = useRef(0);
  const loadAvailability = useCallback(async () => {
    const token = ++serial.current;
    setLoading(true);
    setAvailabilityError("");
    try {
      const result = await api<Availability>("availability?date=" + date);
      if (token === serial.current) setCatalog(result);
    } catch (e) {
      if (token === serial.current) setAvailabilityError((e as Error).message);
    } finally {
      if (token === serial.current) setLoading(false);
    }
  }, [date]);
  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const result = await api<{ bookings: Booking[] }>("bookings");
      setBookings(result.bookings);
    } catch (e) {
      setBookingsError((e as Error).message);
    } finally {
      setBookingsLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadAvailability();
    return () => {
      serial.current++;
    };
  }, [loadAvailability]);
  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);
  const dateWindow = date < addDays(today, 7) ? today : date;
  const service = catalog.services.find((s) => s.id === serviceId) ?? catalog.services[0];
  const times = availableTimes(date, service?.duration ?? 30, catalog.occupied);
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && isFuture(b))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const history = bookings.filter((b) => b.status !== "confirmed" || !isFuture(b));
  const shown = showHistory ? history : upcoming;
  function selectDate(d: string) {
    setDate(d);
    setTime(null);
    setFormError("");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!service || time === null || !times.includes(time)) {
      setFormError("Escolha um serviço e um horário disponível.");
      return;
    }
    setPending(true);
    setFormError("");
    try {
      await api("bookings", "POST", {
        date,
        start: time,
        serviceId: service.id,
        customer: name,
        phone,
        notes,
      });
      setSuccess(
        service.name +
          " confirmado para " +
          formatDate(date, { day: "numeric", month: "long" }) +
          " às " +
          formatTime(time) +
          ".",
      );
      setView("bookings");
      setShowHistory(false);
      setTime(null);
      setNotes("");
      await Promise.all([loadBookings(), loadAvailability()]);
    } catch (e) {
      setFormError((e as Error).message);
      setTime(null);
      await loadAvailability();
    } finally {
      setPending(false);
    }
  }
  async function confirmCancel() {
    if (!cancel) return;
    setPending(true);
    setCancelError("");
    try {
      await api("bookings/" + cancel.id, "PATCH", { status: "cancelled" });
      setCancel(null);
      setSuccess("Reserva cancelada. O horário foi liberado.");
      await Promise.all([loadBookings(), loadAvailability()]);
    } catch (e) {
      setCancelError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <StudioHeader area="customer" admin={admin} identity={identity} />
      <div className="customer-shell">
        <nav className="customer-nav" aria-label="Área do cliente">
          <a href="/">Início</a>
          <ChevronRight size={13} />
          <span>Área do cliente</span>
          <div>
            <button className={view === "book" ? "active" : ""} onClick={() => setView("book")}>
              Agendar atendimento
            </button>
            <button
              className={view === "bookings" ? "active" : ""}
              onClick={() => {
                setView("bookings");
                void loadBookings();
              }}
            >
              Meus horários<span>{upcoming.length}</span>
            </button>
          </div>
        </nav>
        <main className="customer-main">
          <div className="page-heading customer-heading">
            <div>
              <span className="eyebrow">
                {catalog.business.name.toUpperCase()} / ÁREA DO CLIENTE
              </span>
              <h1>{view === "book" ? "Agendar." : "Meus horários."}</h1>
              <p>
                {view === "book"
                  ? "Escolha o serviço, o dia e o melhor horário para você."
                  : "Acompanhe os próximos atendimentos e seu histórico."}
              </p>
            </div>
            {view === "bookings" && (
              <button
                className="primary"
                onClick={() => {
                  setView("book");
                  setSuccess("");
                }}
              >
                Novo agendamento
                <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          {restricted && (
            <div className="access-notice">
              Sua conta acessa a área do cliente. A administração é exclusiva do responsável pela
              barbearia.
            </div>
          )}
          {success && (
            <div className="customer-success" role="status">
              <Check size={20} />
              <span>{success}</span>
              <button aria-label="Dispensar confirmação" onClick={() => setSuccess("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {view === "book" ? (
            <form id="customer-booking-form" onSubmit={submit}>
              <div className="customer-grid">
                <div className="booking-steps">
                  <section className="booking-step">
                    <div className="step-heading">
                      <span>01</span>
                      <h2>Escolha o serviço</h2>
                      <small>{catalog.services.length} opções</small>
                    </div>
                    {availabilityError ? (
                      <div className="form-error" role="alert">
                        {availabilityError}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void loadAvailability()}
                        >
                          Tentar novamente
                        </button>
                      </div>
                    ) : (
                      <div className="customer-services">
                        {catalog.services.map((s, i) => (
                          <button
                            key={s.id}
                            type="button"
                            className={service?.id === s.id ? "selected" : ""}
                            aria-pressed={service?.id === s.id}
                            disabled={pending}
                            onClick={() => {
                              setServiceId(s.id);
                              setTime(null);
                              setFormError("");
                            }}
                          >
                            <span className="service-choice-number">
                              0{i + 1}
                              <Scissors size={17} />
                            </span>
                            <strong>{s.name}</strong>
                            <span className="service-choice-bottom">
                              <span>{money(s.price)}</span>
                              <small>{s.duration} min</small>
                            </span>
                          </button>
                        ))}
                        {loading && !catalog.services.length && (
                          <p className="muted">Carregando serviços…</p>
                        )}
                        {!loading && !catalog.services.length && (
                          <p className="muted">Nenhum serviço disponível no momento.</p>
                        )}
                      </div>
                    )}
                  </section>
                  <section className="booking-step">
                    <div className="step-heading">
                      <span>02</span>
                      <h2>Dia e horário</h2>
                    </div>
                    <div className="customer-date-head">
                      <strong>
                        {formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
                      </strong>
                      <label>
                        Outra data
                        <input
                          aria-label="Escolher outra data"
                          type="date"
                          value={date}
                          min={today}
                          max={addDays(today, 90)}
                          disabled={pending}
                          onChange={(e) => {
                            if (e.target.value) selectDate(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                    <div className="customer-days">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = addDays(dateWindow, i);
                        return (
                          <button
                            type="button"
                            key={d}
                            className={date === d ? "selected" : ""}
                            aria-pressed={date === d}
                            disabled={!isOpenDay(d) || d > addDays(today, 90) || pending}
                            onClick={() => selectDate(d)}
                          >
                            <span>
                              {d === today
                                ? "Hoje"
                                : formatDate(d, { weekday: "short" }).replace(".", "")}
                            </span>
                            <strong>{d.slice(-2)}</strong>
                            <small>
                              {isOpenDay(d)
                                ? formatDate(d, { month: "short" }).replace(".", "")
                                : "Fechado"}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                    {loading ? (
                      <div className="customer-times-loading">
                        <RotateCw size={18} className="spin" />
                        Consultando horários…
                      </div>
                    ) : availabilityError ? (
                      <p className="muted">Não foi possível consultar os horários.</p>
                    ) : !times.length ? (
                      <div className="no-times">
                        <Clock3 size={22} />
                        <p>
                          Não há horários livres para este serviço nesta data.
                          <br />
                          <strong>Escolha outro dia para continuar.</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="customer-time-groups">
                        {[
                          ["Manhã", times.filter((t) => t < 720)],
                          ["Tarde", times.filter((t) => t >= 780)],
                        ].map(([period, slots]) => (
                          <div key={period as string}>
                            <h3>{period as string}</h3>
                            <div className="customer-times">
                              {(slots as number[]).map((t) => (
                                <button
                                  type="button"
                                  key={t}
                                  className={time === t ? "selected" : ""}
                                  aria-pressed={time === t}
                                  disabled={pending}
                                  onClick={() => {
                                    setTime(t);
                                    setFormError("");
                                  }}
                                >
                                  {formatTime(t)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="time-zone-note">Horário de Brasília · Intervalo das 12h às 13h</p>
                  </section>
                  <section className="booking-step">
                    <div className="step-heading">
                      <span>03</span>
                      <h2>Seus dados</h2>
                    </div>
                    <fieldset disabled={pending} className="customer-fields">
                      <div className="form-row">
                        <label>
                          Nome completo
                          <input
                            name="customer"
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            minLength={2}
                            maxLength={80}
                            placeholder="Como devemos chamar você?"
                            required
                          />
                        </label>
                        <label>
                          Telefone com DDD
                          <input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            minLength={10}
                            maxLength={22}
                            placeholder="(85) 99999-9999"
                            required
                          />
                        </label>
                      </div>
                      <label>
                        Observações <span className="optional">opcional</span>
                        <textarea
                          name="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          maxLength={400}
                          rows={2}
                          placeholder="Alguma informação sobre o atendimento?"
                        />
                      </label>
                    </fieldset>
                  </section>
                </div>
                <aside className="checkout-panel">
                  <span className="eyebrow">SUA RESERVA</span>
                  <h2>
                    Resumo do
                    <br />
                    atendimento.
                  </h2>
                  <div className="checkout-service">
                    <Scissors size={22} />
                    <div>
                      <strong>{service?.name ?? "Escolha um serviço"}</strong>
                      <span>{service?.duration ?? "—"} minutos de atendimento</span>
                    </div>
                  </div>
                  <div className="checkout-date">
                    <CalendarDays size={20} />
                    <div>
                      <strong>{formatDate(date, { day: "numeric", month: "long" })}</strong>
                      <span>
                        {time !== null
                          ? formatTime(time) + " — " + formatTime(time + (service?.duration ?? 30))
                          : "Escolha um horário"}
                      </span>
                    </div>
                  </div>
                  <div className="checkout-price">
                    <span>Total</span>
                    <strong>{money(service?.price ?? 0)}</strong>
                  </div>
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                  <button
                    className="primary"
                    type="submit"
                    disabled={
                      pending ||
                      loading ||
                      !!availabilityError ||
                      !service ||
                      time === null ||
                      !times.includes(time)
                    }
                  >
                    {pending ? "Confirmando…" : "Confirmar agendamento"}
                    <ArrowRight size={17} />
                  </button>
                  <p className="checkout-note">
                    Você pode consultar e cancelar suas reservas futuras em{" "}
                    <strong>Meus horários</strong>.
                  </p>
                  <div className="checkout-business">
                    <strong>{catalog.business.name}</strong>
                    <span>Segunda a sábado · 09h às 18h</span>
                  </div>
                </aside>
              </div>
            </form>
          ) : (
            <section className="my-bookings">
              <div className="my-bookings-toolbar">
                <div>
                  <button
                    className={!showHistory ? "selected" : ""}
                    onClick={() => setShowHistory(false)}
                  >
                    Próximos<span>{upcoming.length}</span>
                  </button>
                  <button
                    className={showHistory ? "selected" : ""}
                    onClick={() => setShowHistory(true)}
                  >
                    Histórico<span>{history.length}</span>
                  </button>
                </div>
                <button
                  className="text-button"
                  disabled={bookingsLoading}
                  onClick={() => void loadBookings()}
                >
                  <RotateCw size={14} />
                  Atualizar
                </button>
              </div>
              {bookingsLoading ? (
                <div className="loading-state">
                  <RotateCw size={19} className="spin" />
                  Carregando suas reservas…
                </div>
              ) : bookingsError ? (
                <p className="form-error" role="alert">
                  {bookingsError}
                </p>
              ) : !shown.length ? (
                <div className="empty-state">
                  <CalendarDays size={31} />
                  <h3>
                    {showHistory
                      ? "Nenhum atendimento no histórico."
                      : "Nenhum atendimento marcado."}
                  </h3>
                  <p>
                    {showHistory
                      ? "Seus atendimentos anteriores e cancelamentos aparecem aqui."
                      : "Escolha um serviço e reserve seu próximo horário."}
                  </p>
                  {!showHistory && (
                    <button className="text-button" onClick={() => setView("book")}>
                      Agendar atendimento
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="customer-booking-list">
                  {shown.map((b) => (
                    <article key={b.id} className={"customer-booking " + b.status}>
                      <div className="customer-booking-date">
                        <strong>{b.date.slice(-2)}</strong>
                        <span>{formatDate(b.date, { month: "short" }).replace(".", "")}</span>
                      </div>
                      <div className="customer-booking-info">
                        <span className={"status " + b.status}>
                          <i />
                          {statusNames[b.status]}
                        </span>
                        <h2>{b.service_name}</h2>
                        <p>
                          {formatTime(b.start)} — {formatTime(b.start + b.duration)}
                          <span> / </span>
                          {b.duration} min<span> / </span>
                          {money(b.price)}
                        </p>
                        <small>{formatDate(b.date, { weekday: "long", year: "numeric" })}</small>
                      </div>
                      {b.status === "confirmed" && isFuture(b) ? (
                        <button
                          className="secondary cancel-booking-button"
                          disabled={pending}
                          onClick={() => {
                            setCancel(b);
                            setCancelError("");
                          }}
                        >
                          Cancelar reserva
                        </button>
                      ) : (
                        <span className="booking-final-label">
                          {b.status === "completed"
                            ? "Atendimento concluído"
                            : b.status === "cancelled"
                              ? "Reserva cancelada"
                              : "Horário encerrado"}
                        </span>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          <footer className="footer">
            <span>STUDIO / Studio Barbearia</span>
            <span>Área do cliente</span>
          </footer>
        </main>
      </div>
      {cancel && (
        <CancelDialog
          booking={cancel}
          pending={pending}
          error={cancelError}
          onClose={() => {
            if (!pending) setCancel(null);
          }}
          onCancel={() => void confirmCancel()}
        />
      )}
    </>
  );
}
