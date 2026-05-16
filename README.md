# Hospital AI Chatbot

## Overview
This project is a simple hospital AI chatbot:
- **Backend**: Node.js + Express API (`/api/chatbot/message`) that calls the **Gemini** API.
- **Frontend**: Static HTML/CSS/JS that collects patient details and sends chat messages to the backend.

## Repo Structure
- `backend/` — Express server
- `frontend/` — Static site assets

## Backend Setup
1. Go to `backend/`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment variables.
   - Copy `backend/.env.example` to `backend/.env` (or set env vars in your platform)
4. Start the server:
   ```bash
   npm start
   ```

### Environment Variables
The backend expects:
- `GEMINI_API_KEY` (required)
- `PORT` (optional; defaults to `5000`)

## Frontend Setup
1. Host `frontend/` as static files (any static host is fine).
2. Update `frontend/script.js` to point to your deployed backend URL.
   - Currently it calls `http://localhost:5000/api/chatbot/message`.

## Deploying
### Recommended (frontend static + backend app)
1. Deploy the **backend** (Render/Railway/Fly/VPS).
   - Set `GEMINI_API_KEY` and `PORT` if required.
2. Deploy the **frontend** (Vercel/Netlify/GitHub Pages/etc.).
3. Update `frontend/script.js` with your backend’s public base URL.

### Single domain (optional)
If you want the frontend and backend on the same domain, configure a reverse proxy (e.g. Nginx) so `/api/...` routes to the backend.

## Notes
- The backend applies a simple rate limiter (20 requests/min per IP).
- If you forget `GEMINI_API_KEY`, the backend will respond with a misconfiguration message.

## GitHub upload notes
- Ensure you have `backend/package-lock.json` committed (it was moved into `backend/`).
- Do **not** commit `backend/.env` (it’s ignored by `.gitignore`).


