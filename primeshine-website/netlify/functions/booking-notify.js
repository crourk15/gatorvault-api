/**
 * PrimeShine booking notifier — email + SMS.
 * Env (optional but recommended for reliable SMS):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   PRIMESHINE_NOTIFY_EMAIL (default crourk15@gmail.com)
 *   PRIMESHINE_SMS_TO (default 8638609238)
 */

const DEFAULT_EMAIL = "crourk15@gmail.com";
const DEFAULT_SMS_TO = "8638609238";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
    body: JSON.stringify(body),
  };
}

function clean(value) {
  return String(value || "").trim();
}

function buildSms(p) {
  return (
    "PrimeShine booking: " +
    p.name +
    ", " +
    p.service +
    ", " +
    p.datetime +
    ", " +
    p.phone +
    ", " +
    p.address
  ).slice(0, 320);
}

async function sendEmail(p, toEmail) {
  const res = await fetch("https://formsubmit.co/ajax/" + toEmail, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: p.name,
      phone: p.phone,
      address: p.address,
      vehicle: p.vehicle,
      service: p.service,
      datetime: p.datetime,
      notes: p.notes,
      sms_summary: buildSms(p),
      _subject: "PrimeShine Booking — " + p.name + " — " + p.service,
      _template: "table",
      _captcha: "false",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Email failed: " + text.slice(0, 200));
  }
  return true;
}

async function sendSmsTwilio(message, toPhone) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { sent: false, reason: "twilio_not_configured" };

  const to = toPhone.startsWith("+") ? toPhone : "+1" + toPhone.replace(/\D/g, "");
  const auth = Buffer.from(sid + ":" + token).toString("base64");
  const body = new URLSearchParams({ To: to, From: from, Body: message });

  const res = await fetch(
    "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json",
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Twilio failed: " + text.slice(0, 200));
  }
  return { sent: true, reason: "twilio" };
}

async function sendSmsCarrierEmail(message, phone) {
  const digits = phone.replace(/\D/g, "");
  const gateways = [
    digits + "@vtext.com",
    digits + "@tmomail.net",
    digits + "@txt.att.net",
  ];
  // Best-effort: FormSubmit to first gateway (others as cc).
  const res = await fetch("https://formsubmit.co/ajax/" + gateways[0], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      message,
      _subject: "PrimeShine Booking",
      _captcha: "false",
      _cc: gateways.slice(1).join(","),
    }),
  });
  return { sent: res.ok, reason: res.ok ? "carrier_email" : "carrier_email_failed" };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let raw;
  try {
    raw = JSON.parse(event.body || "{}");
  } catch (_) {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const p = {
    name: clean(raw.name),
    phone: clean(raw.phone),
    address: clean(raw.address),
    vehicle: clean(raw.vehicle),
    service: clean(raw.service),
    datetime: clean(raw.datetime),
    notes: clean(raw.notes) || "(none)",
  };

  if (!p.name || !p.phone || !p.service) {
    return json(400, { ok: false, error: "Missing required fields" });
  }

  const toEmail = process.env.PRIMESHINE_NOTIFY_EMAIL || DEFAULT_EMAIL;
  const toSms = (process.env.PRIMESHINE_SMS_TO || DEFAULT_SMS_TO).replace(/\D/g, "");
  const message = buildSms(p);

  const result = { ok: true, email: false, sms: false, smsVia: null };

  try {
    await sendEmail(p, toEmail);
    result.email = true;
  } catch (err) {
    return json(502, { ok: false, error: String(err.message || err) });
  }

  try {
    let sms = await sendSmsTwilio(message, toSms);
    if (!sms.sent) sms = await sendSmsCarrierEmail(message, toSms);
    result.sms = !!sms.sent;
    result.smsVia = sms.reason;
  } catch (err) {
    // Email already delivered — still return success, note SMS issue.
    result.sms = false;
    result.smsVia = String(err.message || err);
  }

  return json(200, result);
};
