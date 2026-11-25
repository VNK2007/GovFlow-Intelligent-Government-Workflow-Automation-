// POST /api/send-otp   body: { "to": "+14155551234" }
// Sends a one-time code via Twilio Verify. Twilio generates, stores and
// expires the code for you — this function never sees or stores it.
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const to = body.to;
  if (!to || typeof to !== "string") {
    return json({ error: "Missing 'to' — phone number in E.164 format, e.g. +14155551234" }, 400);
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) {
    return json({ error: "Server is missing Twilio secrets. See README for setup." }, 500);
  }

  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const resp = await fetch(
    `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, Channel: "sms" }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    return json({ error: data.message || "Failed to send code" }, resp.status);
  }
  return json({ status: data.status }); // "pending"
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
