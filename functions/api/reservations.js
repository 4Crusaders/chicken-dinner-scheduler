function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function badRequest(message) {
  return json({ ok: false, error: message }, { status: 400 });
}

function parseIsoDate(value) {
  if (typeof value !== "string" || value.length < 10) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp);
}

let schemaReadyPromise = null;

async function ensureSchema(db) {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    await db
      .prepare(
        `
          CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_ts TEXT NOT NULL,
            end_ts TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `,
      )
      .run();

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_reservations_start_ts ON reservations(start_ts)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_reservations_end_ts ON reservations(end_ts)").run();
  })();
  return schemaReadyPromise;
}

export async function onRequestGet({ request, env }) {
  await ensureSchema(env.DB);

  const url = new URL(request.url);
  const start = parseIsoDate(url.searchParams.get("start"));
  const end = parseIsoDate(url.searchParams.get("end"));

  if (!start || !end) {
    return badRequest("缺少或非法参数：start/end（ISO 时间）");
  }
  if (start.getTime() >= end.getTime()) {
    return badRequest("start 必须早于 end");
  }

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const results = await env.DB.prepare(
    `
      SELECT id, name, start_ts as start, end_ts as end, note, created_at
      FROM reservations
      WHERE start_ts < ?1 AND end_ts > ?2
      ORDER BY start_ts ASC, id ASC
    `,
  )
    .bind(endIso, startIso)
    .all();

  return json({ ok: true, data: results.results });
}

export async function onRequestPost({ request, env }) {
  await ensureSchema(env.DB);

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("请求体必须是 JSON");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  const start = parseIsoDate(body?.start);
  const end = parseIsoDate(body?.end);

  if (!name) return badRequest("name 不能为空");
  if (name.length > 40) return badRequest("name 过长（最多 40 字符）");
  if (note && note.length > 200) return badRequest("note 过长（最多 200 字符）");
  if (!start || !end) return badRequest("start/end 必须是合法 ISO 时间");
  if (start.getTime() >= end.getTime()) return badRequest("start 必须早于 end");

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const result = await env.DB.prepare(
    `
      INSERT INTO reservations (name, start_ts, end_ts, note)
      VALUES (?1, ?2, ?3, ?4)
    `,
  )
    .bind(name, startIso, endIso, note)
    .run();

  return json(
    { ok: true, id: result.meta.last_row_id, name, start: startIso, end: endIso, note },
    { status: 201 },
  );
}
