import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'taxi.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'confirmed', 'completed', 'cancelled')),
      pickup_address TEXT NOT NULL,
      dropoff_address TEXT NOT NULL,
      pickup_datetime TEXT NOT NULL,
      vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('kombi', 'van', 'grossraumtaxi')),
      passengers INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      flight_number TEXT,
      child_seat INTEGER NOT NULL DEFAULT 0,
      luggage_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      distance_km REAL,
      duration_minutes INTEGER,
      price REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash', 'card')),
      card_holder TEXT,
      card_number_enc TEXT,
      card_expiry TEXT,
      card_cvv_enc TEXT,
      language TEXT NOT NULL DEFAULT 'de',
      trip_type TEXT NOT NULL DEFAULT 'oneway',
      return_datetime TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_type TEXT UNIQUE NOT NULL CHECK(vehicle_type IN ('kombi', 'van', 'grossraumtaxi')),
      base_price REAL NOT NULL,
      price_per_km REAL NOT NULL,
      roundtrip_discount REAL NOT NULL DEFAULT 5,
      fahrrad_price REAL NOT NULL DEFAULT 10,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations: add missing columns
  try { db.exec(`ALTER TABLE bookings ADD COLUMN trip_type TEXT NOT NULL DEFAULT 'oneway'`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE bookings ADD COLUMN return_datetime TEXT`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE bookings ADD COLUMN fahrrad_count INTEGER NOT NULL DEFAULT 0`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE bookings ADD COLUMN child_seat_details TEXT`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE prices ADD COLUMN roundtrip_discount REAL NOT NULL DEFAULT 5`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE prices ADD COLUMN fahrrad_price REAL NOT NULL DEFAULT 10`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE prices ADD COLUMN fahrrad_enabled INTEGER NOT NULL DEFAULT 0`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE prices ADD COLUMN max_passengers INTEGER NOT NULL DEFAULT 8`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE prices ADD COLUMN max_luggage INTEGER NOT NULL DEFAULT 10`); } catch { /* column exists */ }
  try { db.exec(`ALTER TABLE bookings ADD COLUMN pickup_sign TEXT`); } catch { /* column exists */ }

  // Seed default prices if not exists
  const priceCount = db.prepare('SELECT COUNT(*) as count FROM prices').get() as { count: number };
  if (priceCount.count === 0) {
    const insertPrice = db.prepare(`
      INSERT INTO prices (vehicle_type, base_price, price_per_km)
      VALUES (?, ?, ?)
    `);
    insertPrice.run('kombi', 8.00, 2.10);
    insertPrice.run('van', 10.00, 2.20);
    insertPrice.run('grossraumtaxi', 15.00, 2.40);
    console.log('Default prices seeded.');
  }

  // Seed default admin user if not exists
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
  if (adminCount.count === 0) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', passwordHash);
    console.log(`Default admin user created. Username: admin, Password: ${defaultPassword}`);
  }

  console.log('Database initialized successfully.');
}

export default db;
