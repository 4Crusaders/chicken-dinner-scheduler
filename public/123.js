function $(id) {
  return document.getElementById(id);
}

function setStatus(el, text, kind = "muted") {
  el.classList.remove("muted", "danger");
  el.classList.add(kind);
  el.textContent = text || "";
}

function localInputToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatLocal(iso) {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function renderRows(rows) {
  const body = $("resultsBody");
  body.innerHTML = "";

  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = "暂无结果";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = row.name;

    const start = document.createElement("td");
    start.textContent = formatLocal(row.start);

    const end = document.createElement("td");
    end.textContent = formatLocal(row.end);

    const note = document.createElement("td");
    note.textContent = row.note || "";

    tr.append(name, start, end, note);
    body.appendChild(tr);
  }
}

async function postReservation({ name, startIso, endIso, note }) {
  const res = await fetch("/api/reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, start: startIso, end: endIso, note }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `提交失败（${res.status}）`);
  }
  return json;
}

async function queryReservations({ startIso, endIso }) {
  const url = new URL("/api/reservations", window.location.origin);
  url.searchParams.set("start", startIso);
  url.searchParams.set("end", endIso);
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `查询失败（${res.status}）`);
  }
  return json?.data || [];
}

function initDefaults() {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const toLocalInput = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  };

  $("startLocal").value = toLocalInput(twoHoursLater);
  $("endLocal").value = toLocalInput(sixHoursLater);
  $("queryStartLocal").value = toLocalInput(now);
  $("queryEndLocal").value = toLocalInput(sixHoursLater);
}

async function main() {
  initDefaults();

  const createForm = $("createForm");
  const createStatus = $("createStatus");
  const queryForm = $("queryForm");
  const queryStatus = $("queryStatus");

  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(createStatus, "提交中…");

    const name = $("name").value.trim();
    const startIso = localInputToIso($("startLocal").value);
    const endIso = localInputToIso($("endLocal").value);
    const note = $("note").value.trim() || null;

    if (!name) return setStatus(createStatus, "请填写昵称", "danger");
    if (!startIso || !endIso) return setStatus(createStatus, "开始/结束时间不合法", "danger");
    if (Date.parse(startIso) >= Date.parse(endIso))
      return setStatus(createStatus, "开始时间必须早于结束时间", "danger");

    try {
      await postReservation({ name, startIso, endIso, note });
      setStatus(createStatus, "已提交");
      await runQuery();
    } catch (err) {
      setStatus(createStatus, err?.message || "提交失败", "danger");
    }
  });

  async function runQuery() {
    setStatus(queryStatus, "查询中…");
    const startIso = localInputToIso($("queryStartLocal").value);
    const endIso = localInputToIso($("queryEndLocal").value);
    if (!startIso || !endIso) {
      setStatus(queryStatus, "查询时间不合法", "danger");
      return;
    }
    if (Date.parse(startIso) >= Date.parse(endIso)) {
      setStatus(queryStatus, "查询开始必须早于查询结束", "danger");
      return;
    }

    try {
      const rows = await queryReservations({ startIso, endIso });
      renderRows(rows);
      setStatus(queryStatus, `共 ${rows.length} 条`);
    } catch (err) {
      setStatus(queryStatus, err?.message || "查询失败", "danger");
    }
  }

  queryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await runQuery();
  });

  await runQuery();
}

main().catch(() => {
  // ignore
});

