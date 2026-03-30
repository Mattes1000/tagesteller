import { Database } from "bun:sqlite";

const DB_PATH = process.env.DATABASE_PATH ?? "tagesteller.db";
export const db = new Database(DB_PATH, { create: true });

// db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = OFF;`);

// Migration: add user_id to orders if missing
try {
  const cols = db.query("PRAGMA table_info(orders)").all() as { name: string }[];
  if (cols.length > 0 && !cols.find((c) => c.name === "user_id")) {
    db.exec("ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id);");
  }
} catch { /* table doesn't exist yet, will be created below */ }

// Migration: add username + password_hash to users if missing
try {
  const ucols = db.query("PRAGMA table_info(users)").all() as { name: string }[];
  if (ucols.length > 0) {
    if (!ucols.find((c) => c.name === "username"))
      db.exec("ALTER TABLE users ADD COLUMN username TEXT;");
    if (!ucols.find((c) => c.name === "password_hash"))
      db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
  }
} catch { /* table doesn't exist yet, will be created below */ }

// Migration: add max_quantity to menu_days if missing
try {
  const mdcols = db.query("PRAGMA table_info(menu_days)").all() as { name: string }[];
  if (mdcols.length > 0 && !mdcols.find((c) => c.name === "max_quantity")) {
    db.exec("ALTER TABLE menu_days ADD COLUMN max_quantity INTEGER;");
  }
} catch { /* table doesn't exist yet, will be created below */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menu_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    available_date TEXT NOT NULL,
    max_quantity INTEGER,
    UNIQUE(menu_id, available_date)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'manager', 'user')),
    qr_token TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    customer_name TEXT NOT NULL,
    order_date TEXT NOT NULL DEFAULT (date('now')),
    total REAL NOT NULL DEFAULT 0,
    remarks TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_id INTEGER NOT NULL REFERENCES menus(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_order REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locked_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locked_date TEXT NOT NULL UNIQUE,
    locked_at TEXT NOT NULL DEFAULT (datetime('now')),
    locked_by INTEGER REFERENCES users(id)
  );
`);
