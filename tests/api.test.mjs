import { test } from "node:test";
import assert from "node:assert/strict";
import { availableTimes, addDays, zonedNow, isOpenDay } from "../lib/scheduling.ts";
const base = process.env.AGENDA_TEST_URL ?? "http://127.0.0.1:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Execute os testes de integração apenas no ambiente local.");
let cookie = "";
async function call(route, method = "GET", body) {
  const r = await fetch(base + "/api/" + route, {
    method,
    headers: { cookie, origin: base, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
test("API real: autenticação, corrida, rollback, cancelamento, bloqueio e valores históricos", async () => {
  const noAuth = await call("day?date=" + zonedNow().date);
  assert.equal(noAuth.status, 401);
  const login = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" });
  cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie, "Cookie de desenvolvimento ausente");
  let date = addDays(zonedNow().date, 82);
  while (!isOpenDay(date)) date = addDays(date, 1);
  let day = await call("day?date=" + date);
  assert.equal(day.status, 200);
  const serviceResult = await call("services", "POST", {
    name: "Serviço de teste " + Date.now(),
    duration: 60,
    price: 5500,
  });
  assert.equal(serviceResult.status, 201);
  const serviceId = serviceResult.data.id;
  const occupied = day.data.occupied;
  const start = availableTimes(date, 60, occupied)[0];
  assert.notEqual(start, undefined, "Sem intervalo livre para teste");
  const input = {
    date,
    start,
    serviceId,
    customer: "Teste automatizado",
    phone: "00000000000",
    notes: "Registro de teste local",
  };
  let winner;
  try {
    const race = await Promise.all([
      call("bookings", "POST", input),
      call("bookings", "POST", input),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    winner = race.find((r) => r.status === 201).data.id;
    day = await call("day?date=" + date);
    assert.equal(
      day.data.bookings.filter((b) => b.service_id === serviceId).length,
      1,
      "A transação perdedora não pode deixar reserva órfã",
    );
    assert.equal(day.data.occupied.filter((m) => m >= start && m < start + 60).length, 4);
    const overlap = await call("blocks", "POST", {
      date,
      start: start + 15,
      duration: 30,
      reason: "Bloqueio concorrente",
    });
    assert.equal(overlap.status, 409);
    day = await call("day?date=" + date);
    assert.ok(!day.data.blocks.some((b) => b.reason === "Bloqueio concorrente"));
    assert.equal(
      (
        await call("services/" + serviceId, "PATCH", {
          name: "Serviço atualizado",
          duration: 30,
          price: 9000,
        })
      ).status,
      200,
    );
    day = await call("day?date=" + date);
    assert.equal(day.data.bookings.find((b) => b.id === winner).price, 5500);
    assert.equal(day.data.bookings.find((b) => b.id === winner).duration, 60);
    assert.equal((await call("bookings/" + winner, "PATCH", { status: "cancelled" })).status, 200);
    assert.equal((await call("bookings/" + winner, "PATCH", { status: "completed" })).status, 409);
    day = await call("day?date=" + date);
    assert.ok(!day.data.occupied.some((m) => m >= start && m < start + 60));
    const block = await call("blocks", "POST", {
      date,
      start,
      duration: 60,
      reason: "Pausa de teste",
    });
    assert.equal(block.status, 201);
    assert.equal((await call("bookings", "POST", input)).status, 409);
    assert.equal((await call("blocks/" + block.data.id, "DELETE")).status, 200);
    const rebook = await call("bookings", "POST", input);
    assert.equal(rebook.status, 201);
    assert.equal(
      (await call("bookings/" + rebook.data.id, "PATCH", { status: "completed" })).status,
      200,
    );
    assert.equal(
      (await call("bookings/" + rebook.data.id, "PATCH", { status: "cancelled" })).status,
      409,
    );
    const invalid = await call("bookings", "POST", { ...input, customer: "A" });
    assert.equal(invalid.status, 400);
    const csrf = await fetch(base + "/api/bookings", {
      method: "POST",
      headers: { cookie, origin: "https://exemplo.invalid", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(csrf.status, 403);
  } finally {
    await call("service-status/" + serviceId, "PATCH", { active: false });
  }
});

async function profileCall(profile, route, method = "GET", body) {
  const r = await fetch(base + "/api/" + route, {
    method,
    headers: {
      cookie,
      origin: base,
      "x-studio-test-user": profile,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
test("cliente e dono: isolamento entre contas e disputa na mesma agenda", async () => {
  const session = await profileCall("alice", "session");
  assert.equal(
    session.data.role,
    "customer",
    "Inicie a prévia com npm run dev:roles para habilitar as identidades locais de teste.",
  );
  assert.equal((await profileCall("alice", "admin/day?date=" + zonedNow().date)).status, 403);
  assert.equal(
    (
      await profileCall("alice", "admin/services", "POST", {
        name: "Tentativa de acesso",
        duration: 30,
        price: 1,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await profileCall("alice", "admin/blocks", "POST", {
        date: zonedNow().date,
        start: 540,
        duration: 30,
        reason: "Não permitido",
      })
    ).status,
    403,
  );
  let date = addDays(zonedNow().date, 72);
  while (!isOpenDay(date)) date = addDays(date, 1);
  const availability = await profileCall("alice", "customer/availability?date=" + date);
  assert.equal(availability.status, 200);
  assert.deepEqual(Object.keys(availability.data).sort(), ["business", "occupied", "services"]);
  assert.ok(!JSON.stringify(availability.data).includes("phone"));
  const s = availability.data.services[0];
  const start = availableTimes(date, s.duration, availability.data.occupied)[0];
  assert.notEqual(start, undefined);
  const input = {
    date,
    start,
    serviceId: s.id,
    customer: "Cliente de teste",
    phone: "00000000000",
    notes: "Reserva de cliente",
  };
  const race = await Promise.all([
    profileCall("alice", "customer/bookings", "POST", input),
    profileCall("bruno", "customer/bookings", "POST", input),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  const winnerIndex = race.findIndex((r) => r.status === 201);
  const own = winnerIndex === 0 ? "alice" : "bruno";
  const other = winnerIndex === 0 ? "bruno" : "alice";
  const id = race[winnerIndex].data.id;
  const ownList = await profileCall(own, "customer/bookings");
  const otherList = await profileCall(other, "customer/bookings");
  assert.ok(ownList.data.bookings.some((b) => b.id === id));
  assert.ok(!otherList.data.bookings.some((b) => b.id === id));
  assert.ok(!("client_user_id" in ownList.data.bookings.find((b) => b.id === id)));
  assert.equal(
    (await profileCall(other, "customer/bookings/" + id, "PATCH", { status: "cancelled" })).status,
    404,
  );
  assert.equal(
    (await profileCall(own, "customer/bookings/" + id, "PATCH", { status: "completed" })).status,
    400,
  );
  assert.equal(
    (await profileCall(own, "customer/bookings", "POST", { ...input, clientUserId: "local_seedy" }))
      .status,
    400,
  );
  const adminDay = await call("admin/day?date=" + date);
  assert.ok(adminDay.data.bookings.some((b) => b.id === id && b.source === "customer"));
  assert.equal(
    (await profileCall(own, "customer/bookings/" + id, "PATCH", { status: "cancelled" })).status,
    200,
  );
  const freed = await profileCall(own, "customer/availability?date=" + date);
  assert.ok(availableTimes(date, s.duration, freed.data.occupied).includes(start));
  const block = await call("admin/blocks", "POST", {
    date,
    start,
    duration: s.duration,
    reason: "Pausa particular do dono",
  });
  assert.equal(block.status, 201);
  const blocked = await profileCall("alice", "customer/availability?date=" + date);
  assert.ok(!JSON.stringify(blocked.data).includes("Pausa particular"));
  assert.ok(!availableTimes(date, s.duration, blocked.data.occupied).includes(start));
  assert.equal((await profileCall(own, "customer/bookings", "POST", input)).status, 409);
  await call("admin/blocks/" + block.data.id, "DELETE");
  const complete = await profileCall(own, "customer/bookings", "POST", input);
  assert.equal(complete.status, 201);
  assert.equal(
    (await call("admin/bookings/" + complete.data.id, "PATCH", { status: "completed" })).status,
    200,
  );
  assert.equal(
    (
      await profileCall(own, "customer/bookings/" + complete.data.id, "PATCH", {
        status: "cancelled",
      })
    ).status,
    409,
  );
});
