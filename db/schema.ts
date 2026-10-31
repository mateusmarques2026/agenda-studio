import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
export const services = sqliteTable(
  "services",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    duration: integer("duration").notNull(),
    price: integer("price").notNull(),
    active: integer("active").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    date: text("date").notNull(),
    start: integer("start").notNull(),
    duration: integer("duration").notNull(),
    serviceId: text("service_id").notNull(),
    serviceName: text("service_name").notNull(),
    price: integer("price").notNull(),
    customer: text("customer").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("confirmed"),
    createdAt: text("created_at").notNull(),
    clientUserId: text("client_user_id"),
    source: text("source").notNull().default("admin"),
  },
  (t) => [
    index("bookings_owner_client_date_idx").on(t.owner, t.clientUserId, t.date),
    index("bookings_owner_date_idx").on(t.owner, t.date),
  ],
);
export const blocks = sqliteTable("blocks", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  date: text("date").notNull(),
  start: integer("start").notNull(),
  duration: integer("duration").notNull(),
  reason: text("reason").notNull(),
});
// The primary key arbitrates competing reservations inside an atomic batch.
export const occupiedSlots = sqliteTable(
  "occupied_slots",
  {
    owner: text("owner").notNull(),
    date: text("date").notNull(),
    minute: integer("minute").notNull(),
    reference: text("reference").notNull(),
    kind: text("kind").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.date, t.minute] })],
);

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});
