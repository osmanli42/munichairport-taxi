import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

function getDbConfig(): mysql.ConnectionOptions {
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) {
    throw new Error('Missing required DB env vars: DB_HOST, DB_USER, DB_PASS, DB_NAME must all be set.');
  }
  return {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectTimeout: 10000,
    ssl: { rejectUnauthorized: false },
  };
}

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...getDbConfig(),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

export async function run(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, params);
  return result as mysql.ResultSetHeader;
}

export async function initializeDatabase(): Promise<void> {
  const conn = await mysql.createConnection(getDbConfig());
  try {
    await conn.execute(`
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

    await conn.execute(`
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
        min_price DOUBLE NOT NULL DEFAULT 0,
        min_price_km DOUBLE NOT NULL DEFAULT 15,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    // Migration: add min_price columns if not exist
    try {
      await conn.execute(`ALTER TABLE prices ADD COLUMN min_price DOUBLE NOT NULL DEFAULT 0`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE prices ADD COLUMN min_price_km DOUBLE NOT NULL DEFAULT 15`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Settings table for global configuration
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Seed default settings if not exist
    const defaultSettings = [
      ['stadtfahrt_enabled', '0'],
      ['anfahrt_price_per_km', '1.70'],
      ['zwischenstopp_enabled', '0'],
      ['plz_surcharge_enabled', '0'],
      ['bank_name', ''],
      ['bank_iban', ''],
      ['bank_bic', ''],
      ['bank_kontoinhaber', ''],
      ['company_name', 'Taxi N&N GbR'],
      ['company_address', 'Eisvogelweg 2, 85356 Freising'],
      ['company_phone', '+49 151 4162 0000'],
      ['company_email', 'info@flughafen-muenchen.taxi'],
      ['company_steuernr', ''],
      ['company_ustidnr', ''],
      ['reminder_enabled', 'true'],
      ['reminder_time', '18:00'],
      ['flight_validation_enabled', '1'],
      ['phone_validation_enabled', '1'],
      ['portal_tracking_enabled', '1'],
      ['b2b_applications_enabled', '1'],
      // A/B rollout percentage for the /buchen checkout redesign — 'off' until Adım 3 ships.
      ['experiment_checkout_v2', 'off'],
    ];
    for (const [key, value] of defaultSettings) {
      await conn.execute(
        `INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`,
        [key, value]
      );
    }

    // Migration: add anfahrt_cost to bookings
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN anfahrt_cost DOUBLE DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add zwischenstopp_address to bookings
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN zwischenstopp_address TEXT DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add steuersatz to bookings (7 or 19 percent, NULL = not set)
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN steuersatz INT DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add stripe payment columns
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN stripe_charge_id VARCHAR(100) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN stripe_payment_date DATETIME DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN stripe_payout_id VARCHAR(100) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add promo code columns to bookings
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN promo_code VARCHAR(50) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN discount_amount DOUBLE DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add flight validation columns to bookings
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN flight_validated VARCHAR(2) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN flight_info TEXT DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add phone validation columns to bookings.
    // `phone` keeps whatever the customer typed; these hold the derived values, so
    // existing rows stay untouched and simply carry NULL.
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN phone_e164 VARCHAR(20) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN phone_line_type VARCHAR(24) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add kombinierbar to promotions
    try {
      await conn.execute(`ALTER TABLE promotions ADD COLUMN kombinierbar TINYINT(1) NOT NULL DEFAULT 0`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: add show_banner to promotions
    try {
      await conn.execute(`ALTER TABLE promotions ADD COLUMN show_banner TINYINT(1) NOT NULL DEFAULT 1`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Promotions table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS promotions (
        id INT NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        type ENUM('fixed','percent') NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        max_uses INT DEFAULT NULL,
        used_count INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        description VARCHAR(255) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS plz_surcharges (
        id INT NOT NULL AUTO_INCREMENT,
        plz VARCHAR(10) NOT NULL,
        stadt VARCHAR(100) NOT NULL DEFAULT '',
        surcharge DOUBLE NOT NULL DEFAULT 10,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY (plz)
      )
    `);

    // Pflichtfahrgebiet: global config (single row, id=1)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pflichtgebiet_config (
        id INT NOT NULL DEFAULT 1,
        enabled TINYINT NOT NULL DEFAULT 0,
        mode VARCHAR(10) NOT NULL DEFAULT 'floor',
        radius_km DOUBLE NOT NULL DEFAULT 50,
        roundtrip_discount_enabled TINYINT NOT NULL DEFAULT 1,
        airport_enabled TINYINT NOT NULL DEFAULT 1,
        airport_lat DOUBLE NOT NULL DEFAULT 48.3538,
        airport_lng DOUBLE NOT NULL DEFAULT 11.7861,
        betriebssitz_enabled TINYINT NOT NULL DEFAULT 1,
        betriebssitz_lat DOUBLE NOT NULL DEFAULT 48.4028,
        betriebssitz_lng DOUBLE NOT NULL DEFAULT 11.7489,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    await conn.execute(`INSERT IGNORE INTO pflichtgebiet_config (id) VALUES (1)`);
    try {
      await conn.execute(`ALTER TABLE pflichtgebiet_config ADD COLUMN ip_bypass_enabled TINYINT NOT NULL DEFAULT 0`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE pflichtgebiet_config ADD COLUMN ip_bypass_distance_km DOUBLE NOT NULL DEFAULT 100`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Pflichtfahrgebiet: mandatory tariff per vehicle type
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pflichtgebiet_tarife (
        vehicle_type VARCHAR(20) NOT NULL,
        grundgebuehr DOUBLE NOT NULL DEFAULT 4.20,
        min_per_km DOUBLE NOT NULL DEFAULT 2.50,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (vehicle_type)
      )
    `);
    for (const vt of ['kombi', 'van', 'grossraumtaxi']) {
      await conn.execute(
        `INSERT IGNORE INTO pflichtgebiet_tarife (vehicle_type) VALUES (?)`,
        [vt]
      );
    }

    // Fixed-price routes (Festpreisrouten) — legally mandated prices for specific routes
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS fixed_routes (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        pickup_keywords TEXT NOT NULL,
        dropoff_keywords TEXT NOT NULL,
        price_kombi DOUBLE NOT NULL DEFAULT 0,
        price_van DOUBLE NOT NULL DEFAULT 0,
        price_grossraumtaxi DOUBLE NOT NULL DEFAULT 0,
        bidirectional TINYINT NOT NULL DEFAULT 1,
        enabled TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    await conn.execute(`
      INSERT IGNORE INTO fixed_routes (id, name, pickup_keywords, dropoff_keywords, price_kombi, price_van, price_grossraumtaxi, bidirectional)
      VALUES (1, 'Flughafen München ↔ Neue Messe München', 'flughafen münchen,munich airport,flughafen munchen,muc terminal,muc t1,muc t2', 'neue messe,messesee,81829,messe münchen,messe munchen,messe riem,messestadt', 94, 94, 94, 1)
    `);

    // Pflichtgebiet PLZ exclusions (places within radius but legally outside the zone)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pflichtgebiet_exclusions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plz VARCHAR(5) NOT NULL,
        ort VARCHAR(120) NOT NULL DEFAULT '',
        enabled TINYINT NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (plz)
      )
    `);
    const exclusionSeeds: [string, string][] = [
      // Stadt Landshut
      ['84028','Landshut'],['84030','Landshut/Ergolding'],['84032','Landshut/Altdorf'],['84034','Landshut'],['84036','Landshut/Kumhausen'],
      // Landkreis Landshut (innerhalb ~50km)
      ['84051','Essenbach'],['84056','Rottenburg a.d.Laaber'],['84061','Ergoldsbach'],['84079','Bruckberg'],
      ['84088','Neufahrn i.NB'],['84092','Bayerbach'],['84095','Furth'],['84098','Hohenthann'],
      ['84100','Niederaichbach'],['84101','Obersüßbach'],['84103','Postau'],['84107','Weihmichl'],['84109','Wörth a.d.Isar'],
      // Landkreis Dachau
      ['85221','Dachau'],['85229','Markt Indersdorf'],['85232','Bergkirchen'],['85235','Odelzhausen'],
      ['85238','Petershausen'],['85241','Hebertshausen'],['85244','Röhrmoos'],['85247','Schwabhausen'],
      ['85250','Altomünster'],['85253','Erdweg'],['85254','Sulzemoos'],['85256','Vierkirchen'],
      ['85258','Weichs'],['85757','Karlsfeld'],['85778','Haimhausen'],['86567','Hilgertshausen-Tandern'],
      // Landkreis Pfaffenhofen a.d.Ilm
      ['85077','Manching'],['85084','Reichertshofen'],['85088','Vohburg a.d.Donau'],['85107','Baar-Ebenhausen'],
      ['85119','Ernsgaden'],['85126','Münchsmünster'],['85276','Pfaffenhofen a.d.Ilm'],['85283','Wolnzach'],
      ['85290','Geisenfeld'],['85293','Reichertshausen'],['85296','Rohrbach'],['85298','Scheyern'],
      ['85301','Schweitenkirchen'],['85302','Gerolsbach'],['85304','Ilmmünster'],['85305','Jetzendorf'],
      ['85309','Pörnbach'],['86558','Hohenwart'],
      // Landkreis Ebersberg
      ['83550','Emmering (Ebersberg)'],['83553','Frauenneuharting'],['85560','Ebersberg'],['85567','Grafing/Bruck'],
      ['85570','Markt Schwaben'],['85586','Poing'],['85591','Vaterstetten'],['85604','Zorneding'],
      ['85614','Kirchseeon'],['85617','Aßling'],['85625','Glonn/Baiern'],['85643','Steinhöring'],
      ['85646','Anzing'],['85652','Pliening'],['85658','Egmating'],['85661','Forstinning'],
      ['85664','Hohenlinden'],['85665','Moosach'],
      // Landkreis Fürstenfeldbruck
      ['82110','Germering'],['82140','Olching'],['82178','Puchheim'],['82194','Gröbenzell'],
      ['82216','Maisach'],['82223','Eichenau'],['82239','Alling'],['82256','Fürstenfeldbruck'],
      ['82272','Moorenweis'],['82275','Emmering (FFB)'],['82276','Adelshofen'],['82278','Althegnenberg'],
      ['82281','Egenhofen'],['82284','Grafrath'],['82285','Hattenhofen'],['82287','Jesenwang'],
      ['82288','Kottgeisering'],['82290','Landsberied'],['82291','Mammendorf'],['82293','Mittelstetten'],
      // Landkreis Starnberg
      ['82131','Gauting'],['82205','Gilching'],['82211','Herrsching a.Ammersee'],
      ['82229','Seefeld'],['82234','Weßling'],['82237','Wörthsee'],['82266','Inning a.Ammersee'],
      ['82319','Starnberg'],['82327','Tutzing'],['82335','Berg'],['82340','Feldafing'],
      ['82343','Pöcking'],['82346','Andechs'],
    ];
    for (const [plz, ort] of exclusionSeeds) {
      await conn.execute(`INSERT IGNORE INTO pflichtgebiet_exclusions (plz, ort) VALUES (?, ?)`, [plz, ort]);
    }
    // 82152 Krailling/Planegg = LK München (Pflichtfahrgebiet), yanlışlıkla eklenmişti
    await conn.execute(`DELETE FROM pflichtgebiet_exclusions WHERE plz = '82152'`);

    // Drivers (Fahrer) table for live tracking
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(40) NOT NULL DEFAULT '',
        vehicle_plate VARCHAR(40) NOT NULL DEFAULT '',
        vehicle_model VARCHAR(80) NOT NULL DEFAULT '',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    // Migration: driver tracking columns on bookings
    const bookingDriverCols = [
      `ALTER TABLE bookings ADD COLUMN assigned_driver_id INT DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN driver_status VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN driver_lat DOUBLE DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN driver_lng DOUBLE DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN driver_location_updated_at DATETIME DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN pickup_lat DOUBLE DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN pickup_lng DOUBLE DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN customer_lat DOUBLE DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN customer_lng DOUBLE DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN customer_location_updated_at DATETIME DEFAULT NULL`,
    ];
    for (const stmt of bookingDriverCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    // ── B2B Firmenkundenportal ──────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT NOT NULL AUTO_INCREMENT,
        company_name VARCHAR(200) NOT NULL,
        contact_name VARCHAR(200) NOT NULL,
        email VARCHAR(200) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        ust_idnr VARCHAR(50) DEFAULT NULL,
        message TEXT,
        discount_percent DOUBLE NOT NULL DEFAULT 0,
        allowed_payment_methods VARCHAR(50) NOT NULL DEFAULT 'cash,card',
        pg_discount_override TINYINT(1) NOT NULL DEFAULT 0,
        discount_kombinierbar TINYINT(1) NOT NULL DEFAULT 0,
        payment_term_days INT NOT NULL DEFAULT 7,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS company_users (
        id INT NOT NULL AUTO_INCREMENT,
        company_id INT NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        name VARCHAR(200) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        must_change_password TINYINT(1) NOT NULL DEFAULT 1,
        last_login_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_cu_company (company_id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS company_invoices (
        id INT NOT NULL AUTO_INCREMENT,
        company_id INT NOT NULL,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        period_month VARCHAR(7) NOT NULL,
        mwst_satz INT NOT NULL DEFAULT 7,
        booking_ids TEXT NOT NULL,
        total DOUBLE NOT NULL,
        due_date DATE DEFAULT NULL,
        reminder_level TINYINT NOT NULL DEFAULT 0,
        reminder_sent_at DATETIME DEFAULT NULL,
        mahngebuehr DOUBLE NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'sent',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ci_period (company_id, period_month)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS company_favorites (
        id INT NOT NULL AUTO_INCREMENT,
        company_id INT NOT NULL,
        label VARCHAR(200) NOT NULL,
        pickup_address TEXT NOT NULL,
        dropoff_address TEXT NOT NULL,
        vehicle_type VARCHAR(20) NOT NULL DEFAULT 'kombi',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_cf_company (company_id)
      )
    `);

    // Migration: B2B columns on bookings
    const bookingB2bCols = [
      `ALTER TABLE bookings ADD COLUMN company_id INT DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN company_user_id INT DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN rechnung_number VARCHAR(50) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN cost_center VARCHAR(100) DEFAULT NULL`,
    ];
    for (const stmt of bookingB2bCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }
    // ────────────────────────────────────────────────────────────────────

    // Migration: customer-requested invoice (Rechnung). The customer opts in on
    // /buchen and supplies their own billing address; autoRechnungJob mails the
    // invoice once the ride is over. The rechnung_* render params are stored so the
    // exact same PDF can be reproduced later (Datum/Zahlungsziel would otherwise be
    // recomputed from "now" — see generateRechnungPdf's invoice_date).
    const bookingRechnungCols = [
      `ALTER TABLE bookings ADD COLUMN rechnung_required TINYINT(1) NOT NULL DEFAULT 0`,
      `ALTER TABLE bookings ADD COLUMN rechnung_adresse TEXT DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN rechnung_sent_at DATETIME DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN rechnung_mwst INT DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN rechnung_sprache VARCHAR(5) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN rechnung_zahlungsart VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN rechnung_attempts INT NOT NULL DEFAULT 0`,
      `ALTER TABLE bookings ADD COLUMN rechnung_error TEXT DEFAULT NULL`,
    ];
    for (const stmt of bookingRechnungCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }
    // Index for the auto-invoice cron's candidate scan (runs every minute).
    try {
      await conn.execute(`ALTER TABLE bookings ADD INDEX idx_rechnung_pending (rechnung_required, rechnung_number)`);
    } catch (e: any) { if (!e.message?.includes('Duplicate key name')) throw e; }
    // ────────────────────────────────────────────────────────────────────

    // Migration: company card-on-file (Stripe) columns
    const companyCardCols = [
      `ALTER TABLE companies ADD COLUMN stripe_customer_id VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE companies ADD COLUMN stripe_payment_method_id VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE companies ADD COLUMN card_brand VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE companies ADD COLUMN card_last4 VARCHAR(4) DEFAULT NULL`,
      `ALTER TABLE companies ADD COLUMN card_exp_month INT DEFAULT NULL`,
      `ALTER TABLE companies ADD COLUMN card_exp_year INT DEFAULT NULL`,
      `ALTER TABLE companies ADD COLUMN charge_mode VARCHAR(20) NOT NULL DEFAULT 'manual'`,
    ];
    for (const stmt of companyCardCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }

    // Migration: booking charge status (for company card-on-file charges)
    const bookingChargeCols = [
      `ALTER TABLE bookings ADD COLUMN charge_status VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN charge_error TEXT DEFAULT NULL`,
    ];
    for (const stmt of bookingChargeCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }

    // Migration: regular-customer card-on-file (Stripe) columns on bookings — mirrors
    // the companies Stripe columns above, but scoped per-booking since anonymous/walk-up
    // customers have no persistent account to attach a reusable card to.
    const bookingStripeCardCols = [
      `ALTER TABLE bookings ADD COLUMN stripe_customer_id VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN stripe_payment_method_id VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN card_brand VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN card_last4 VARCHAR(4) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN card_exp_month INT DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN card_exp_year INT DEFAULT NULL`,
    ];
    for (const stmt of bookingStripeCardCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }
    // ────────────────────────────────────────────────────────────────────

    // Migration: Google-Kalender-Import columns (Sammelrechnung für Telefon/E-Mail-Fahrten)
    const bookingCalendarCols = [
      `ALTER TABLE bookings ADD COLUMN source VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN calendar_event_uid VARCHAR(191) DEFAULT NULL`,
      `ALTER TABLE bookings ADD COLUMN imported_at DATETIME DEFAULT NULL`,
    ];
    for (const stmt of bookingCalendarCols) {
      try { await conn.execute(stmt); }
      catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    }
    try {
      await conn.execute(`CREATE UNIQUE INDEX idx_bookings_cal_uid ON bookings (calendar_event_uid)`);
    } catch (e: any) { if (!e.message?.includes('Duplicate key name')) throw e; }

    // Live-visitors dashboard now runs several correlated subqueries against
    // bookings.visitor_id per request (tracking.ts) — this column had no index.
    try {
      await conn.execute(`ALTER TABLE bookings ADD INDEX idx_visitor_id (visitor_id)`);
    } catch (e: any) { if (!e.message?.includes('Duplicate key name')) throw e; }

    // Migration: session_id ties a booking back to the exact visitor_sessions row
    // it was created from (tracking.ts). Together with the pre-existing `source`
    // column (currently only written by the calendar importer — 'calendar'), this
    // lets the admin funnel count real web conversions instead of every booking
    // regardless of where it came from (admin panel, B2B portal, calendar import).
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN session_id VARCHAR(64) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD INDEX idx_session_id (session_id)`);
    } catch (e: any) { if (!e.message?.includes('Duplicate key name')) throw e; }
    try {
      await conn.execute(`ALTER TABLE bookings ADD INDEX idx_source_created (source, created_at)`);
    } catch (e: any) { if (!e.message?.includes('Duplicate key name')) throw e; }

    // Migration: A/B attribution. Recomputed server-side from visitor_id at booking time
    // (backend/src/utils/experiments.ts) — never trusted from the client. Lets uplift be
    // measured per variant by joining bookings to this column instead of visitor_sessions,
    // which can be pruned independently.
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN experiment_variant VARCHAR(80) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Alias-Zuordnung: Kalender-Eventtext → Firma (z.B. "BMW" → company 3)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS company_aliases (
        id INT NOT NULL AUTO_INCREMENT,
        company_id INT NOT NULL,
        alias VARCHAR(191) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ca_alias (alias),
        KEY idx_ca_company (company_id)
      )
    `);
    // ────────────────────────────────────────────────────────────────────

    // Migration: manueller Rechnungsversand (E-Mail-Icon → grün nach erfolgreichem Senden)
    try {
      await conn.execute(`ALTER TABLE company_invoices ADD COLUMN manual_sent_at DATETIME DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }

    // Migration: Standard-Zahlungsziel für NEU angelegte Firmen auf 7 Tage (statt 14).
    // Bestehende Firmen behalten ihr aktuelles payment_term_days — wird hier NICHT rückwirkend geändert.
    try {
      await conn.execute(`ALTER TABLE companies MODIFY COLUMN payment_term_days INT NOT NULL DEFAULT 7`);
    } catch (e: any) { console.error('payment_term_days default migration failed:', e.message); }

    // ─── Automatische Rabatte (Rabatte-Tab) ─────────────────────────────
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS auto_discounts (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
          discount_value DECIMAL(10,2) NOT NULL,
          zone_scope ENUM('inside','outside','any') NOT NULL DEFAULT 'outside',
          min_km DECIMAL(6,1) DEFAULT NULL,
          max_km DECIMAL(6,1) DEFAULT NULL,
          hour_from TINYINT DEFAULT NULL,
          hour_to TINYINT DEFAULT NULL,
          weekday_mask VARCHAR(20) DEFAULT NULL,
          booking_index_max INT DEFAULT NULL,
          max_uses INT DEFAULT NULL,
          used_count INT NOT NULL DEFAULT 0,
          max_discount_amount DECIMAL(10,2) DEFAULT NULL,
          vehicle_types VARCHAR(50) DEFAULT NULL,
          trip_types VARCHAR(20) DEFAULT NULL,
          start_date DATE DEFAULT NULL,
          end_date DATE DEFAULT NULL,
          active TINYINT(1) NOT NULL DEFAULT 1,
          priority INT NOT NULL DEFAULT 0,
          stackable_with_promo TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )
      `);
    } catch (e: any) { console.error('auto_discounts table migration failed:', e.message); }
    // Migration: tables created before discount_type/discount_value existed (CREATE TABLE
    // IF NOT EXISTS above is a no-op on an already-deployed table) still have discount_percent.
    try {
      await conn.execute(`ALTER TABLE auto_discounts ADD COLUMN discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'percent'`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) console.error('auto_discounts.discount_type migration failed:', e.message); }
    try {
      await conn.execute(`ALTER TABLE auto_discounts ADD COLUMN discount_value DECIMAL(10,2) DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) console.error('auto_discounts.discount_value migration failed:', e.message); }
    try {
      await conn.execute(`UPDATE auto_discounts SET discount_value = discount_percent WHERE discount_value IS NULL AND discount_percent IS NOT NULL`);
    } catch (e: any) { if (!e.message?.includes("Unknown column")) console.error('auto_discounts discount_value backfill failed:', e.message); }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN auto_discount_id INT DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) console.error('auto_discount_id migration failed:', e.message); }
    try {
      await conn.execute(`ALTER TABLE bookings ADD COLUMN auto_discount_amount DOUBLE DEFAULT NULL`);
    } catch (e: any) { if (!e.message?.includes('Duplicate column')) console.error('auto_discount_amount migration failed:', e.message); }
    try {
      await conn.execute(`ALTER TABLE bookings ADD INDEX idx_phone_e164 (phone_e164)`);
    } catch (e: any) { if (!e.message?.includes('Duplicate key name')) console.error('idx_phone_e164 migration failed:', e.message); }
    try {
      await conn.execute(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('auto_discounts_enabled', '1')`);
    } catch (e: any) { console.error('auto_discounts_enabled seed failed:', e.message); }
    // ────────────────────────────────────────────────────────────────────

    // Seed default prices if not exists
    const [priceRows] = await conn.execute('SELECT COUNT(*) as count FROM prices') as any;
    if (priceRows[0].count === 0) {
      await conn.execute(`INSERT INTO prices (vehicle_type, base_price, price_per_km) VALUES ('kombi', 8.00, 2.10)`);
      await conn.execute(`INSERT INTO prices (vehicle_type, base_price, price_per_km) VALUES ('van', 10.00, 2.20)`);
      await conn.execute(`INSERT INTO prices (vehicle_type, base_price, price_per_km) VALUES ('grossraumtaxi', 15.00, 2.40)`);
      console.log('Default prices seeded.');
    }

    // Seed default admin user if not exists
    const [adminRows] = await conn.execute('SELECT COUNT(*) as count FROM admin_users') as any;
    if (adminRows[0].count === 0) {
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
      if (!defaultPassword) {
        console.warn('admin_users is empty and ADMIN_DEFAULT_PASSWORD is not set — skipping admin seed. Set ADMIN_DEFAULT_PASSWORD and restart to create the initial admin account.');
      } else {
        const passwordHash = bcrypt.hashSync(defaultPassword, 10);
        await conn.execute('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', passwordHash]);
        console.log('Default admin user created (password not logged).');
      }
    }

    console.log('Database initialized successfully.');
  } finally {
    await conn.end().catch(() => {});
  }
}

// Diagnostic: test MySQL connectivity
export async function testConnection(): Promise<{ ok: boolean; error?: string; code?: string; host?: string }> {
  try {
    const conn = await mysql.createConnection(getDbConfig());
    const [rows] = await conn.execute('SELECT 1 as test') as any;
    await conn.end().catch(() => {});
    return { ok: true, host: getDbConfig().host || 'not set' };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || String(err),
      code: err.code || err.errno || 'unknown',
      host: getDbConfig().host || 'not set',
    };
  }
}

export default { query, run };
