import { query } from './src/db';

async function main() {
  const sessions = await query<any>(
    `SELECT
       s.session_id, s.visitor_id,
       (SELECT COUNT(*) FROM bookings b WHERE b.visitor_id = s.visitor_id) AS past_bookings_count,
       (SELECT MAX(b.created_at) FROM bookings b WHERE b.visitor_id = s.visitor_id) AS last_booking_date,
       (SELECT b.pickup_address FROM bookings b WHERE b.visitor_id = s.visitor_id ORDER BY b.created_at DESC LIMIT 1) AS last_booking_pickup_address,
       (SELECT b.dropoff_address FROM bookings b WHERE b.visitor_id = s.visitor_id ORDER BY b.created_at DESC LIMIT 1) AS last_booking_dropoff_address,
       (SELECT b.pickup_datetime FROM bookings b WHERE b.visitor_id = s.visitor_id ORDER BY b.created_at DESC LIMIT 1) AS last_booking_datetime,
       (SELECT b.trip_type FROM bookings b WHERE b.visitor_id = s.visitor_id ORDER BY b.created_at DESC LIMIT 1) AS last_booking_trip_type,
       (SELECT b.return_datetime FROM bookings b WHERE b.visitor_id = s.visitor_id ORDER BY b.created_at DESC LIMIT 1) AS last_booking_return_datetime
     FROM visitor_sessions s
     WHERE s.visitor_id IN (SELECT visitor_id FROM bookings WHERE visitor_id IS NOT NULL AND visitor_id != '')
     ORDER BY s.last_seen DESC
     LIMIT 3`
  );
  console.log(JSON.stringify(sessions, null, 2));
  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
