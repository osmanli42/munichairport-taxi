import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

function getDbConfig(): mysql.ConnectionOptions {
  return {
    host: process.env.DB_HOST || 'srv1699.hstgr.io',
    user: process.env.DB_USER || 'u609144885_FMT',
    password: process.env.DB_PASS || 'Osman-1977',
    database: process.env.DB_NAME || 'u609144885_FMT',
    connectTimeout: 10000,
    ssl: { rejectUnauthorized: false },
  };
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const conn = await mysql.createConnection(getDbConfig());
  try {
    const [rows] = await conn.execute(sql, params);
    return rows as T[];
  } finally {
    await conn.end().catch(() => {});
  }
}

export async function run(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const conn = await mysql.createConnection(getDbConfig());
  try {
    const [result] = await conn.execute(sql, params);
    return result as mysql.ResultSetHeader;
  } finally {
    await conn.end().catch(() => {});
  }
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
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      await conn.execute('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', passwordHash]);
      console.log(`Default admin user created. Username: admin, Password: ${defaultPassword}`);
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
