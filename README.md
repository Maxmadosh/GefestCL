# Gefest Cl

Mobile web MVP for field acceptance checklists.

## Run

This first prototype is dependency-free because the current environment has Node but no `npm`.

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173
```

## Current Scope

- local-first static prototype
- sample data from `Osk-Shkola65COW (54469)`
- document upload metadata
- checklist review
- photo category attachments
- mileage entry
- send-channel selection
- report preview
- optional Netlify submit endpoint at `/.netlify/functions/submit-report`

## Netlify Backend

The app works on GitHub Pages without a backend. On Netlify it will try to POST the full checklist, printable PDF HTML, Excel HTML, and share text to `/.netlify/functions/submit-report`.

Set these Netlify environment variables for automatic delivery:

- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to send reports directly to Telegram.
- `REPORT_WEBHOOK_URL` to forward the full report JSON to an automation service, email service, CRM, or custom backend.

If no delivery variable is configured, the app falls back to client-side Email/WhatsApp/Telegram sharing.

## Next

- add real DOCX/XLSX parsing
- deploy the Netlify backend and configure Telegram variables
- add OCR for PDF/JPEG and equipment photos
