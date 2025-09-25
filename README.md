## Car-care Online - Backend

Node.js/Express backend for Car-care Online. Provides authentication, user management, reservations, payments, notifications, and reporting APIs.

### Prerequisites
- Node.js 18+
- MySQL 8+

### Setup
1. Install dependencies:
```bash
npm install
```
2. Create `.env` in `backend/` (copy from `env.example`) and fill values:
```bash
cp env.example .env
```
Required keys (see `env.example` for full list):
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- PORT, API_FRONT_URL
- ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
- FRONTEND_URL

3. Ensure MySQL database exists and credentials match `.env`.

### Run
```bash
node server.js
```
The server listens on `PORT` (default 3000).

### CORS & Sessions
- CORS origin: `API_FRONT_URL`
- Session secret: `ACCESS_TOKEN_SECRET`

### OAuth
- Google: `/auth/google` → callback `/auth/google/callback`
- Facebook: `/auth/facebook` → callback `/auth/facebook/callback`
On success, user is redirected to `${API_FRONT_URL}/dashboard?user=<encoded JSON>`.

### Static Files
- `GET /uploads/...` serves files from `backend/uploads/`

### Base URL
- REST base path: `/api`

### Routes (mounted prefixes)
- `GET /success`, `GET /fail` (OAuth fallbacks)
- `/api/auth` and `/api/register` → `routes/auth`
- `/api/users` → `routes/user`
- `/api/employee` → `routes/employee`
- `/api/infomation` → `routes/infomation`
- `/api/package` → `routes/package`
- `/api/promotion` → `routes/promotion`
- `/api/reservation` → `routes/reservation`
- `/api/service` → `routes/service`
- `/api/tools` → `routes/tools`
- `/api/dashboard` → `routes/dashboard`
- `/api/payment` → `routes/payment`
- `/api/income` → `routes/income`
- `/api/expense` → `routes/expense`
- `/api/useser` → `routes/useser` (note: spelling as in code)
- `/api/score` → `routes/score`
- `/api/notification` → `routes/notification`
- `/api/work-table` → `routes/work-table`
- `/review` → `routes/review`

Endpoints inside each router depend on the corresponding files under `backend/routes/`.

### Environment Variables
See `env.example` for a complete, documented list. Example important fields:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=carcaredb
PORT=3000
API_FRONT_URL=http://localhost:4200
ACCESS_TOKEN_SECRET=change-me
REFRESH_TOKEN_SECRET=change-me
```

### Notes
- In development, session cookies are `secure: false` and `httpOnly: false`.
- Ensure secrets are strong in production and `cookie.secure` is true behind HTTPS.

### Scripts
Add these to `package.json` if desired:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  }
}
```


