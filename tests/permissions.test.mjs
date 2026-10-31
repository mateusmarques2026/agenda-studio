import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAdminEmail, canCancelOwnBooking } from "../lib/permissions.ts";
test("admin precisa de uma conta configurada explicitamente", () => {
  assert.equal(matchesAdminEmail("dono@exemplo.com", undefined), false);
  assert.equal(matchesAdminEmail("cliente@exemplo.com", "dono@exemplo.com"), false);
  assert.equal(matchesAdminEmail(" DONO@EXEMPLO.COM ", "dono@exemplo.com"), true);
});
test("cliente só pode cancelar a própria reserva futura confirmada", () => {
  const booking = { client_user_id: "alice", date: "2026-10-28", start: 600, status: "confirmed" };
  const now = { date: "2026-10-27", minute: 900 };
  assert.equal(canCancelOwnBooking(booking, "alice", now), true);
  assert.equal(canCancelOwnBooking(booking, "bruno", now), false);
  assert.equal(canCancelOwnBooking({ ...booking, client_user_id: null }, "alice", now), false);
  assert.equal(canCancelOwnBooking({ ...booking, status: "completed" }, "alice", now), false);
  assert.equal(canCancelOwnBooking({ ...booking, status: "cancelled" }, "alice", now), false);
  assert.equal(
    canCancelOwnBooking({ ...booking, date: now.date, start: now.minute }, "alice", now),
    false,
  );
});
