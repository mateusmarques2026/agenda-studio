import {
  DEFAULT_SERVICES,
  addDays,
  availableTimes,
  isDate,
  isOpenDay,
  slotMinutes,
  zonedNow,
  type Booking,
  type Block,
  type Service,
} from "@/lib/scheduling";
import { createStore, DemoError, input, json, text } from "./runtime";
type State = { services: Service[]; bookings: Booking[]; blocks: Block[] };
const clientId = "cliente-demo";
export const role = () => (location.hash === "#admin" ? "admin" : "cliente");
export const store = createStore<State>("studio-pages-v1", () => {
  const today = zonedNow().date;
  let next = addDays(today, 1);
  while (!isOpenDay(next)) next = addDays(next, 1);
  const services = DEFAULT_SERVICES.map((s) => ({ ...s, active: 1 }));
  const booking = (
    id: string,
    date: string,
    start: number,
    customer: string,
    own = false,
  ): Booking => ({
    id,
    date,
    start,
    duration: 30,
    service_id: "corte",
    service_name: "Corte de cabelo",
    price: 4000,
    customer,
    phone: "00000000000",
    notes: "Exemplo fictício da demonstração.",
    status: "confirmed",
    client_user_id: own ? clientId : null,
    source: own ? "customer" : "admin",
    created_at: new Date().toISOString(),
  });
  return {
    services,
    blocks: [],
    bookings: [
      ...(isOpenDay(today)
        ? [
            booking("exemplo-1", today, 540, "Pedro Almeida (exemplo)"),
            booking("exemplo-2", today, 615, "Lucas Martins (exemplo)"),
          ]
        : []),
      booking("reserva-cliente", next, 600, "Marina (demonstração)", true),
    ],
  };
});
const occupied = (s: State, date: string) => [
  ...s.bookings
    .filter((b) => b.date === date && b.status !== "cancelled")
    .flatMap((b) => slotMinutes(b.start, b.duration)),
  ...s.blocks.filter((b) => b.date === date).flatMap((b) => slotMinutes(b.start, b.duration)),
];
function number(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    throw new DemoError("Confira " + label + ".");
  return value;
}
export async function handle(request: Request) {
  const url = new URL(request.url),
    [, , scope, resource, id] = url.pathname.split("/");
  if (scope === "admin" && role() !== "admin")
    throw new DemoError("Troque para a visão do dono nos controles da demonstração.", 403);
  if (!["admin", "customer"].includes(scope)) throw new DemoError("Rota não encontrada.", 404);
  const state = store.get(),
    date = url.searchParams.get("date") ?? zonedNow().date,
    admin = scope === "admin";
  if (request.method === "GET" && resource === "day" && admin)
    return json({
      ...state,
      bookings: state.bookings.filter((b) => b.date === date).sort((a, b) => a.start - b.start),
      blocks: state.blocks.filter((b) => b.date === date),
      occupied: occupied(state, date),
    });
  if (request.method === "GET" && resource === "availability")
    return json({
      services: state.services.filter((s) => s.active),
      occupied: occupied(state, date),
      business: { name: "Studio Barbearia" },
    });
  if (request.method === "GET" && resource === "bookings")
    return json({
      bookings: state.bookings
        .filter((b) => b.client_user_id === clientId)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    });
  const body = request.method === "DELETE" ? {} : await input(request);
  if (request.method === "POST" && resource === "bookings") {
    const day = text(body.date, 10, 10, "data"),
      start = number(body.start, 0, 1440, "o horário"),
      service = state.services.find((s) => s.id === body.serviceId && s.active);
    if (!service) throw new DemoError("Escolha um serviço ativo.");
    if (
      !isDate(day) ||
      !availableTimes(day, service.duration, occupied(state, day)).includes(start)
    )
      throw new DemoError("Esse horário não está disponível. Escolha outro.", 409);
    const customer = text(body.customer, 2, 100, "nome"),
      phone = text(body.phone, 10, 20, "telefone");
    if (!/^[\d\s()+-]+$/.test(phone)) throw new DemoError("Confira o telefone com DDD.");
    const booking: Booking = {
      id: crypto.randomUUID(),
      date: day,
      start,
      duration: service.duration,
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      customer,
      phone,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : "",
      status: "confirmed",
      created_at: new Date().toISOString(),
      client_user_id: admin ? null : clientId,
      source: admin ? "admin" : "customer",
    };
    state.bookings.push(booking);
    store.save(state);
    return json({ id: booking.id }, 201);
  }
  if (request.method === "PATCH" && resource === "bookings" && id) {
    const booking = state.bookings.find(
      (b) => b.id === id && (admin || b.client_user_id === clientId),
    );
    if (!booking) throw new DemoError("Reserva não encontrada.", 404);
    if (body.status !== "cancelled" && !(admin && body.status === "completed"))
      throw new DemoError("Alteração não permitida.", 403);
    const now = zonedNow();
    if (
      booking.status !== "confirmed" ||
      (!admin &&
        (booking.date < now.date || (booking.date === now.date && booking.start <= now.minute)))
    )
      throw new DemoError("Esta reserva não pode ser alterada.", 409);
    booking.status = body.status;
    store.save(state);
    return json({ ok: true });
  }
  if (admin && resource === "services" && ["POST", "PATCH"].includes(request.method)) {
    const name = text(body.name, 2, 80, "serviço"),
      duration = number(body.duration, 15, 240, "a duração"),
      price = number(body.price, 0, 1000000, "o preço");
    if (duration % 15) throw new DemoError("Use duração em intervalos de 15 minutos.");
    if (id) {
      const service = state.services.find((s) => s.id === id);
      if (!service) throw new DemoError("Serviço não encontrado.", 404);
      Object.assign(service, { name, duration, price });
    } else state.services.push({ id: crypto.randomUUID(), name, duration, price, active: 1 });
    store.save(state);
    return json({ ok: true });
  }
  if (admin && resource === "service-status" && request.method === "PATCH") {
    const service = state.services.find((s) => s.id === id);
    if (!service) throw new DemoError("Serviço não encontrado.", 404);
    service.active = body.active ? 1 : 0;
    store.save(state);
    return json({ ok: true });
  }
  if (admin && resource === "blocks" && request.method === "POST") {
    const day = text(body.date, 10, 10, "data"),
      start = number(body.start, 0, 1440, "o horário"),
      duration = number(body.duration, 15, 240, "a duração");
    if (!availableTimes(day, duration, occupied(state, day)).includes(start))
      throw new DemoError("Esse intervalo não está disponível.", 409);
    const block = {
      id: crypto.randomUUID(),
      date: day,
      start,
      duration,
      reason: text(body.reason, 2, 200, "motivo"),
    };
    state.blocks.push(block);
    store.save(state);
    return json({ id: block.id }, 201);
  }
  if (admin && resource === "blocks" && request.method === "DELETE") {
    state.blocks = state.blocks.filter((b) => b.id !== id);
    store.save(state);
    return json({ ok: true });
  }
  throw new DemoError("Rota não encontrada.", 404);
}
