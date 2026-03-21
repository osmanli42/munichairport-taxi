# Munich Airport Taxi

Professional airport transfer website for Munich Airport (MUC).

**Owner:** Osman Nar & Muhammed Ali Nar
**Website:** www.munichairport.taxi
**Phone:** +49 151 41620000
**Email:** info@munichairport.taxi

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS, next-intl (DE/EN/TR)
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **APIs:** Google Maps JS API, Google Places Autocomplete, Google Distance Matrix API, Nodemailer, Twilio

---

## Project Structure

```
munichairport-taxi/
├── frontend/          # Next.js 14 app
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/      # Localized pages (de/en/tr)
│   │   │   │   ├── page.tsx           # Homepage + Booking Form
│   │   │   │   ├── vehicles/page.tsx  # Vehicles & Prices
│   │   │   │   ├── about/page.tsx     # About Us
│   │   │   │   ├── contact/page.tsx   # Contact
│   │   │   │   ├── impressum/page.tsx # Legal Notice
│   │   │   │   ├── datenschutz/page.tsx # Privacy Policy
│   │   │   │   └── agb/page.tsx       # Terms & Conditions
│   │   │   └── admin/page.tsx         # Admin Panel
│   │   ├── components/
│   │   │   ├── BookingForm.tsx        # Main booking form
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── VehicleCard.tsx
│   │   │   ├── WhatsAppButton.tsx
│   │   │   └── CookieBanner.tsx
│   │   └── lib/
│   │       ├── api.ts          # API client
│   │       └── utils.ts        # Helpers
│   └── messages/
│       ├── de.json             # German translations
│       ├── en.json             # English translations
│       └── tr.json             # Turkish translations
└── backend/           # Express API
    └── src/
        ├── index.ts           # Server entry point
        ├── db.ts              # SQLite setup
        ├── routes/
        │   ├── bookings.ts    # Booking CRUD
        │   ├── admin.ts       # Admin endpoints
        │   └── prices.ts      # Price management
        ├── services/
        │   └── notifications.ts  # Email + SMS
        └── middleware/
            └── auth.ts        # JWT authentication
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Maps API Key (with Places API + Distance Matrix API enabled)

### 1. Clone / Setup

```bash
cd /Users/osman/munichairport-taxi
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

The API runs on **http://localhost:4000**

### 3. Frontend Setup

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with your Google Maps API key
npm install
npm run dev
```

The frontend runs on **http://localhost:3000**

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 4000) |
| `JWT_SECRET` | Secret for JWT tokens |
| `ADMIN_DEFAULT_PASSWORD` | Initial admin password |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | SMTP username/email |
| `SMTP_PASS` | SMTP password/app password |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |

---

## Admin Panel

Visit **http://localhost:3000/admin**

Default credentials: `admin` / `admin123`

**Change the password immediately in production!**

Features:
- Dashboard with revenue statistics (today/week/month/total)
- Booking management with status updates
- Filter by status, vehicle type, date range, search
- Price management (update prices without code changes)
- Booking detail view with quick actions

---

## Vehicle Prices

| Vehicle | Base Price | Per km |
|---|---|---|
| Kombi (1-3 persons) | €8.00 | €2.10 |
| Van/Minibus (4-7 persons) | €10.00 | €2.20 |
| Großraumtaxi (8+ persons) | €15.00 | €2.40 |

**Formula:** Total = base_price + (distance_km × price_per_km)

---

## API Endpoints

### Public

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/bookings` | Create booking |
| POST | `/api/bookings/calculate-price` | Calculate price |
| GET | `/api/bookings/:booking_number` | Get booking |
| GET | `/api/prices` | Get all prices |

### Admin (requires JWT token)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/login` | Login |
| GET | `/api/admin/bookings` | List bookings |
| PATCH | `/api/admin/bookings/:id/status` | Update status |
| DELETE | `/api/admin/bookings/:id` | Delete booking |
| GET | `/api/admin/stats` | Get statistics |
| PUT | `/api/prices/:vehicle_type` | Update price |
| POST | `/api/admin/change-password` | Change password |

---

## Notifications

On each new booking:
1. **Admin email** to info@munichairport.taxi with full booking details
2. **Customer confirmation email** in their language (DE/EN/TR)
3. **Admin SMS** to +4915141620000 with brief summary

---

## Deployment

### Backend (e.g., VPS/DigitalOcean)

```bash
cd backend
npm run build
NODE_ENV=production node dist/index.js
```

Use PM2 for process management:
```bash
npm install -g pm2
pm2 start dist/index.js --name "taxi-backend"
```

### Frontend (e.g., Vercel/Netlify)

```bash
cd frontend
npm run build
npm start
```

Or deploy to Vercel:
```bash
npx vercel --prod
```

---

## Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Distance Matrix API
4. Create an API key
5. Restrict the key to your domain in production

---

## License

Private project. All rights reserved.

Munich Airport Taxi - Osman Nar & Muhammed Ali Nar
