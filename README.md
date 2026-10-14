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
- `FRONTEND_ORIGINS` (optional; comma-separated exact HTTP(S) frontend origins; defaults to local development origins on port `5500`)

For local development, serve the `frontend/` directory over HTTP at `http://localhost:5500` or `http://127.0.0.1:5500`; opening `index.html` directly as a `file://` URL is not allowed by the API's browser-origin policy. Set `FRONTEND_ORIGINS` to the exact origin(s) of your deployed frontend. Do not use `*` or include URL paths.

### Emergency safety safeguard
The backend screens the current message and up to five recent user messages for selected emergency warning signs before contacting Gemini. A possible match returns urgent-care guidance without calling the model. This is an initial safeguard, not a clinically validated triage system; a message with no match does not mean that a user is safe.

### Conversation memory
The frontend sends up to five completed exchanges from the active browser chat with each message. The backend validates the turns and includes them in the Gemini request for follow-up context; history is not stored by the backend. A new chat or a request without history is handled as a fresh conversation. The included history is sent to the configured Gemini provider, so avoid entering identifying or sensitive information.

### Structured chat responses
Successful chat responses keep the existing `reply` text field for the current frontend and add a `structured` object with `message`, `urgency`, `selfCare`, `warningSigns`, `followUpQuestions`, `sources`, and `status`. The backend requests JSON output from Gemini and validates it before returning it. Malformed or incomplete model output and provider failures produce a cautious fallback with `urgency: "unknown"`. `sources` remains empty because this project does not retrieve or verify evidence. A valid structure does not establish medical accuracy.

Run the backend tests from `backend/` with:
```bash
npm test
```

The automated suite covers emergency warning-sign examples and negations, routine and ambiguous symptom requests, medication safety prompt instructions, follow-up context, history validation, structured-output validation, and provider failures. Provider responses are mocked; passing tests do not establish clinical accuracy or replace review by qualified clinicians. Before production use, have the warning-sign coverage, emergency wording, and model responses reviewed by appropriate clinical and legal/privacy stakeholders.

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
- The chatbot endpoint is limited to 20 requests per minute per client IP, and JSON request bodies are capped at 64 KB. Patient details are limited to 2,000 bytes.
- CORS is restricted to configured frontend origins. Requests without an `Origin` header (for example, server-to-server requests) are still accepted; CORS is not authentication.
- If you forget `GEMINI_API_KEY`, the backend will respond with a misconfiguration message.

## GitHub upload notes
- Ensure you have `backend/package-lock.json` committed (it was moved into `backend/`).
- Do **not** commit `backend/.env` (it’s ignored by `.gitignore`).
