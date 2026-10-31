import { z, ZodError } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  AppError,
  database,
  validateDate,
  createBooking,
  createBlock,
  transitionBooking,
} from "@/lib/repository";
import { isStudioAdmin, requireStudioAdmin, requireStudioBusiness } from "@/lib/studio-access";
export const dynamic = "force-dynamic";
const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do serviço.").max(70),
    duration: z.number().int().min(15).max(180).multipleOf(15),
    price: z.number().int().min(0).max(1000000),
  })
  .strict();
const bookingSchema = z
  .object({
    date: z.string(),
    start: z.number().int(),
    serviceId: z.string().min(1).max(100),
    customer: z.string().trim().min(2, "Informe o nome do cliente.").max(80),
    phone: z
      .string()
      .trim()
      .regex(/^[\d\s()+-]{10,22}$/, "Informe um telefone válido.")
      .refine(
        (v) => [10, 11].includes(v.replace(/\D/g, "").length),
        "Informe um telefone com DDD.",
      ),
    notes: z.string().trim().max(400).default(""),
  })
  .strict();
const blockSchema = z
  .object({
    date: z.string(),
    start: z.number().int(),
    duration: z.number().int().min(15).max(300).multipleOf(15),
    reason: z.string().trim().min(2, "Informe o motivo do bloqueio.").max(80),
  })
  .strict();
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
async function handle(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) throw new AppError("Entre na sua conta para acessar a agenda.", 401);
    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\/api\/?/, "").split("/");
    if (segments[0] === "admin") segments.shift();
    const [resource, id, action] = segments;
    const db = database();
    let body: unknown;
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        throw new AppError("Origem da solicitação inválida.", 403);
      if (request.method !== "DELETE") {
        if (!request.headers.get("content-type")?.includes("application/json"))
          throw new AppError("Envie um corpo JSON.", 415);
        const raw = await request.text();
        if (raw.length > 16000) throw new AppError("Solicitação muito grande.", 413);
        try {
          body = JSON.parse(raw);
        } catch {
          throw new AppError("JSON inválido.");
        }
      }
    }
    if (resource === "session" && request.method === "GET")
      return json({
        role: isStudioAdmin(user) ? "admin" : "customer",
        displayName: user.displayName,
      });
    if (resource === "customer") {
      const business = await requireStudioBusiness();
      const owner = business.owner;
      if (request.method === "GET" && id === "availability") {
        const date = url.searchParams.get("date") ?? "";
        validateDate(date);
        const results = await db.batch([
          db
            .prepare(
              "SELECT id,name,duration,price,active FROM services WHERE owner=? AND active=1 ORDER BY rowid",
            )
            .bind(owner),
          db
            .prepare("SELECT minute FROM occupied_slots WHERE owner=? AND date=? ORDER BY minute")
            .bind(owner, date),
        ]);
        return json({
          services: results[0].results,
          occupied: (results[1].results as { minute: number }[]).map((r) => r.minute),
          business: { name: business.name },
        });
      }
      if (request.method === "GET" && id === "bookings") {
        const rows = await db
          .prepare(
            "SELECT id,date,start,duration,service_name,price,customer,phone,notes,status,created_at FROM bookings WHERE owner=? AND client_user_id=? ORDER BY date DESC,start DESC LIMIT 200",
          )
          .bind(owner, user.userId)
          .all();
        return json({ bookings: rows.results });
      }
      if (request.method === "POST" && id === "bookings" && !action)
        return json(await createBooking(owner, bookingSchema.parse(body), user.userId), 201);
      if (request.method === "PATCH" && id === "bookings" && action) {
        z.object({ status: z.literal("cancelled") })
          .strict()
          .parse(body);
        return json(await transitionBooking(owner, action, "cancelled", user.userId));
      }
      throw new AppError("Rota não encontrada.", 404);
    }
    const business = await requireStudioAdmin(user);
    const owner = business.owner;
    if (request.method === "GET" && resource === "day") {
      const date = url.searchParams.get("date") ?? "";
      validateDate(date);
      const results = await db.batch([
        db
          .prepare(
            "SELECT id,name,duration,price,active FROM services WHERE owner=? ORDER BY rowid",
          )
          .bind(owner),
        db
          .prepare(
            "SELECT id,date,start,duration,service_id,service_name,price,customer,phone,notes,status,created_at,client_user_id,source FROM bookings WHERE owner=? AND date=? ORDER BY start,created_at",
          )
          .bind(owner, date),
        db
          .prepare(
            "SELECT id,date,start,duration,reason FROM blocks WHERE owner=? AND date=? ORDER BY start",
          )
          .bind(owner, date),
        db
          .prepare("SELECT minute FROM occupied_slots WHERE owner=? AND date=? ORDER BY minute")
          .bind(owner, date),
      ]);
      return json({
        services: results[0].results,
        bookings: results[1].results,
        blocks: results[2].results,
        occupied: (results[3].results as { minute: number }[]).map((r) => r.minute),
      });
    }
    if (request.method === "POST" && resource === "bookings")
      return json(await createBooking(owner, bookingSchema.parse(body)), 201);
    if (request.method === "PATCH" && resource === "bookings" && id) {
      const { status } = z
        .object({ status: z.enum(["cancelled", "completed"]) })
        .strict()
        .parse(body);
      return json(await transitionBooking(owner, id, status));
    }
    if (resource === "services" && (request.method === "POST" || request.method === "PATCH")) {
      const s = serviceSchema.parse(body);
      const serviceId = request.method === "POST" ? crypto.randomUUID() : id;
      if (!serviceId) throw new AppError("Serviço inválido.");
      if (request.method === "POST")
        await db
          .prepare(
            "INSERT INTO services (owner,id,name,duration,price,active) VALUES (?,?,?,?,?,1)",
          )
          .bind(owner, serviceId, s.name, s.duration, s.price)
          .run();
      else {
        const result = await db
          .prepare("UPDATE services SET name=?,duration=?,price=? WHERE owner=? AND id=?")
          .bind(s.name, s.duration, s.price, owner, serviceId)
          .run();
        if (!result.meta.changes) throw new AppError("Serviço não encontrado.", 404);
      }
      return json({ id: serviceId }, request.method === "POST" ? 201 : 200);
    }
    if (request.method === "PATCH" && resource === "service-status" && id) {
      const { active } = z.object({ active: z.boolean() }).strict().parse(body);
      const result = await db
        .prepare("UPDATE services SET active=? WHERE owner=? AND id=?")
        .bind(active ? 1 : 0, owner, id)
        .run();
      if (!result.meta.changes) throw new AppError("Serviço não encontrado.", 404);
      return json({ ok: true });
    }
    if (request.method === "POST" && resource === "blocks")
      return json(await createBlock(owner, blockSchema.parse(body)), 201);
    if (request.method === "DELETE" && resource === "blocks" && id) {
      const results = await db.batch([
        db
          .prepare("DELETE FROM occupied_slots WHERE owner=? AND reference=? AND kind='block'")
          .bind(owner, id),
        db.prepare("DELETE FROM blocks WHERE owner=? AND id=?").bind(owner, id),
      ]);
      if (!results[1].meta.changes) throw new AppError("Bloqueio não encontrado.", 404);
      return json({ ok: true });
    }
    throw new AppError("Rota não encontrada.", 404);
  } catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json({ error: error.issues[0]?.message ?? "Dados inválidos." }, 400);
    console.error("Falha na agenda:", error instanceof Error ? error.message : "erro desconhecido");
    return json({ error: "Não foi possível concluir. Tente novamente." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
