import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: { rejectUnauthorized: false },
});

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function run(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

export async function initializeDatabase(): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT NOT NULL AUTO_INCREMENT,
      booking_number VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'new',
      pickup_address TEXT NOT NULL,
      dropoff_address TEXT NOT NULL,
      pickup_datetime VARCHAR(50) NOT NULL,
      vehicle_type VARCHAR(20) NOT NULL,
      passengers INT NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      flight_number TEXT,
      pickup_sign TEXT,
      child_seat TINYINT NOT NULL DEFAULT 0,
      child_seat_details TEXT,
      luggage_count INT NOT NULL DEFAULT 0,
      notes TEXT,
      distance_km DOUBLE,
      duration_minutes INT,
      price DOUBLE NOT NULL,
      payment_method VARCHAR(10) NOT NULL DEFAULT 'cash',
      card_holder TEXT,
      card_number_enc TEXT,
      card_expiry TEXT,
      card_cvv_enc TEXT,
      language VARCHAR(5) NOT NULL DEFAULT 'de',
      trip_type VARCHAR(10) NOT NULL DEFAULT 'oneway',
      return_datetime TEXT,
      fahrrad_count INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS prices (
      id INT NOT NULL AUTO_INCREMENT,
      vehicle_type VARCHAR(20) UNIQUE NOT NULL,
      base_price DOUBLE NOT NULL,
      price_per_km DOUBLE NOT NULL,
      roundtrip_discount DOUBLE NOT NULL DEFAULT 5,
      fahrrad_price DOUBLE NOT NULL DEFAULT 10,
      fahrrad_enabled TINYINT NOT NULL DEFAULT 0,
      max_passengers INT NOT NULL DEFAULT 8,
      max_luggage INT NOT NULL DEFAULT 10,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT NOT NULL AUTO_INCREMENT,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  // Seed default prices if not exists
  const [priceRows] = await pool.execute('SELECT COUNT(*) as count FROM prices') as any;
  if (priceRows[0].count === 0) {
    await pool.execute(`INSERT INTO prices (vehicle_type, base_price, price_per_km) VALUES ('kombi', 8.00, 2.10)`);
    await pool.execute(`INSERT INTO prices (vehicle_type, base_price, price_per_km) VALUES ('van', 10.00, 2.20)`);
    await pool.execute(`INSERT INTO prices (vehicle_type, base_price, price_per_km) VALUES ('grossraumtaxi', 15.00, 2.40)`);
    console.log('Default prices seeded.');
  }

  // Seed default admin user if not exists
  const [adminRows] = await pool.execute('SELECT COUNT(*) as count FROM admin_users') as any;
  if (adminRows[0].count === 0) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    await pool.execute('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', passwordHash]);
    console.log(`Default admin user created. Username: admin, Password: ${defaultPassword}`);
  }

  console.log('Database initialized successfully.');
}

export default pool;
