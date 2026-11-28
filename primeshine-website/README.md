# PrimeShine Mobile Detailing — Website

Standalone static marketing site for **PrimeShine Mobile Detailing** (Bartow / Lakeland / Winter Haven).

## Pages
- `index.html` — Home
- `services.html` — Services
- `pricing.html` — Pricing + launch offer
- `about.html` — About / van equipment
- `booking.html` — Booking form
- `contact.html` — Contact

## Open locally
Open `index.html` in a browser, or from this folder:

```bash
python3 -m http.server 5173
```

Then visit `http://localhost:5173`

## Deploy
Upload the entire `primeshine-website` folder to Netlify, Vercel, GitHub Pages, or any static host.
Point the domain root at this folder.

## Brand
- Navy `#0A1A2F` · Silver `#C8C8C8` · White · Teal `#00C2C7`
- Headings: Montserrat · Body: Open Sans
- Slogan: “Prime Results. Mobile Convenience.”
- Phone: 863-860-9238

## Booking notifications
The booking form sends:
- **Email** to `crourk15@gmail.com` (FormSubmit — confirm the first activation email)
- **Text** to `863-860-9238` (Twilio if configured on Netlify; otherwise best-effort carrier email-to-SMS)
- A backup copy into **Netlify Forms** (Project → Forms)

Optional Netlify env vars for reliable SMS:
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `PRIMESHINE_NOTIFY_EMAIL`, `PRIMESHINE_SMS_TO`

