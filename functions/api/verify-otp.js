// POST /api/verify-otp   body: { "to": "+14155551234", "code": "123456" }
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { to, code } = body;
  if (!to || !code) {
    return json({ error: "Missing 'to' or 'code'" }, 400);
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) {
    return json({ error: "Server is missing Twilio secrets. See README for setup." }, 500);
  }

  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const resp = await fetch(
    `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, Code: code }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    return json({ error: data.message || "Verification failed" }, resp.status);
  }
  return json({ approved: data.status === "approved", status: data.status });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
