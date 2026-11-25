// GET    /api/cases            -> list all cases
// POST   /api/cases             body: case object (no id)   -> creates, returns id
// PATCH  /api/cases?id=GOV-1001 body: { status?, audit_append? } -> updates one case
//
// Storage: Cloudflare KV namespace bound as CASES_KV (see README for setup).
// All three persona views (citizen / caseworker / executive) read and write
// through this one endpoint so everyone sees the same live data.

const INDEX_KEY = "__case_index__";

async function loadIndex(kv) {
  const raw = await kv.get(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveIndex(kv, ids) {
  await kv.put(INDEX_KEY, JSON.stringify(ids));
}

export async function onRequestGet(context) {
  const kv = context.env.CASES_KV;
  const ids = await loadIndex(kv);
  const cases = [];
  for (const id of ids) {
    const raw = await kv.get(`case:${id}`);
    if (raw) cases.push(JSON.parse(raw));
  }
  return json({ cases });
}

export async function onRequestPost(context) {
  const kv = context.env.CASES_KV;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.department || !body.issue || !body.citizen) {
    return json({ error: "Missing required fields: citizen, issue, department" }, 400);
  }
  const id = "GOV-" + Math.floor(1000 + Math.random() * 9000);
  const record = {
    id,
    citizen: body.citizen,
    department: body.department,
    issue: body.issue,
    status: "SUBMITTED",
    priority: body.priority || "MEDIUM",
    reasoning: body.reasoning || "",
    slaHours: body.slaHours ?? 24,
    audit: body.audit || [],
  };
  await kv.put(`case:${id}`, JSON.stringify(record));
  const ids = await loadIndex(kv);
  ids.unshift(id);
  await saveIndex(kv, ids);
  return json({ case: record });
}

export async function onRequestPatch(context) {
  const kv = context.env.CASES_KV;
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing ?id=" }, 400);

  const raw = await kv.get(`case:${id}`);
  if (!raw) return json({ error: "Case not found" }, 404);
  const record = JSON.parse(raw);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (body.status) record.status = body.status;
  if (body.audit_append) record.audit.push(body.audit_append);

  await kv.put(`case:${id}`, JSON.stringify(record));
  return json({ case: record });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
