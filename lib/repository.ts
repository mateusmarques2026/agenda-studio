import { env } from "cloudflare:workers";
import { canCancelOwnBooking } from "./permissions";
import {
  DEFAULT_SERVICES,
  availableTimes,
  slotMinutes,
  fitsHours,
  isDate,
  isOpenDay,
  zonedNow,
  addDays,
  type Service,
} from "./scheduling";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function database() {
  if (!env.DB) throw new AppError("Banco de dados indisponível.", 503);
  return env.DB;
}
export async function initializeServices(owner: string) {
  const db = database();
  await db.batch(
    DEFAULT_SERVICES.map((s) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO services (owner,id,name,duration,price,active) VALUES (?,?,?,?,?,1)",
        )
        .bind(owner, s.id, s.name, s.duration, s.price),
    ),
  );
}
export function validateDate(date: string, writing = false) {
  if (!isDate(date)) throw new AppError("Data inválida.");
  const today = zonedNow().date;
  if (date > addDays(today, 90)) throw new AppError("Escolha uma data nos próximos 90 dias.");
  if (writing && (date < today || !isOpenDay(date)))
    throw new AppError("Escolha um dia de funcionamento a partir de hoje.");
}
export async function createBooking(
  owner: string,
  input: {
    date: string;
    start: number;
    serviceId: string;
    customer: string;
    phone: string;
    notes: string;
  },
  clientUserId: string | null = null,
) {
  validateDate(input.date, true);
  const db = database();
  const service = await db
    .prepare("SELECT * FROM services WHERE owner=? AND id=? AND active=1")
    .bind(owner, input.serviceId)
    .first<Service>();
  if (!service) throw new AppError("Serviço não encontrado.", 404);
  if (!availableTimes(input.date, service.duration, []).includes(input.start))
    throw new AppError("Esse horário está fora do expediente ou já passou.");
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO bookings (id,owner,date,start,duration,service_id,service_name,price,customer,phone,notes,status,created_at,client_user_id,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,?)",
        )
        .bind(
          id,
          owner,
          input.date,
          input.start,
          service.duration,
          service.id,
          service.name,
          service.price,
          input.customer,
          input.phone,
          input.notes,
          new Date().toISOString(),
          clientUserId,
          clientUserId ? "customer" : "admin",
        ),
      ...slotMinutes(input.start, service.duration).map((minute) =>
        db
          .prepare(
            "INSERT INTO occupied_slots (owner,date,minute,reference,kind) VALUES (?,?,?,?,'booking')",
          )
          .bind(owner, input.date, minute, id),
      ),
    ]);
  } catch (error) {
    if (/UNIQUE constraint|PRIMARY KEY/i.test(String(error)))
      throw new AppError("Esse horário acabou de ser ocupado. Escolha outro horário.", 409);
    throw error;
  }
  return { id };
}
export async function createBlock(
  owner: string,
  input: { date: string; start: number; duration: number; reason: string },
) {
  validateDate(input.date, true);
  if (
    !fitsHours(input.start, input.duration) ||
    !availableTimes(input.date, input.duration, []).includes(input.start)
  )
    throw new AppError("O bloqueio deve estar dentro do expediente e não pode estar no passado.");
  const db = database();
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db
        .prepare("INSERT INTO blocks (id,owner,date,start,duration,reason) VALUES (?,?,?,?,?,?)")
        .bind(id, owner, input.date, input.start, input.duration, input.reason),
      ...slotMinutes(input.start, input.duration).map((minute) =>
        db
          .prepare(
            "INSERT INTO occupied_slots (owner,date,minute,reference,kind) VALUES (?,?,?,?,'block')",
          )
          .bind(owner, input.date, minute, id),
      ),
    ]);
  } catch (error) {
    if (/UNIQUE constraint|PRIMARY KEY/i.test(String(error)))
      throw new AppError("Há uma reserva ou bloqueio nesse intervalo.", 409);
    throw error;
  }
  return { id };
}

export async function transitionBooking(
  owner: string,
  id: string,
  status: "cancelled" | "completed",
  clientUserId: string | null = null,
) {
  const db = database();
  const current = zonedNow();
  const own = clientUserId !== null;
  if (own) {
    const booking = await db
      .prepare(
        "SELECT client_user_id,date,start,status FROM bookings WHERE id=? AND owner=? AND client_user_id=?",
      )
      .bind(id, owner, clientUserId)
      .first<{ client_user_id: string; date: string; start: number; status: string }>();
    if (!booking) throw new AppError("Reserva não encontrada.", 404);
    if (status !== "cancelled")
      throw new AppError("Somente o profissional pode concluir o atendimento.", 403);
    if (!canCancelOwnBooking(booking, clientUserId!, current))
      throw new AppError(
        "Somente reservas futuras e confirmadas podem ser canceladas pelo cliente.",
        409,
      );
  }
  const guard = own ? " AND client_user_id=? AND (date>? OR (date=? AND start>?))" : "";
  const params: (string | number)[] = [
    id,
    owner,
    ...(own ? [clientUserId!, current.date, current.date, current.minute] : []),
  ];
  if (status === "cancelled") {
    const result = await db.batch([
      db
        .prepare(
          "DELETE FROM occupied_slots WHERE owner=? AND reference=? AND kind='booking' AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND owner=? AND status='confirmed'" +
            guard +
            ")",
        )
        .bind(owner, id, ...params),
      db
        .prepare(
          "UPDATE bookings SET status='cancelled' WHERE id=? AND owner=? AND status='confirmed'" +
            guard,
        )
        .bind(...params),
    ]);
    if (!result[1].meta.changes)
      throw new AppError("A reserva já foi alterada ou não existe.", 409);
  } else {
    const result = await db
      .prepare(
        "UPDATE bookings SET status='completed' WHERE id=? AND owner=? AND status='confirmed'",
      )
      .bind(id, owner)
      .run();
    if (!result.meta.changes) throw new AppError("A reserva já foi alterada ou não existe.", 409);
  }
  return { ok: true };
}
