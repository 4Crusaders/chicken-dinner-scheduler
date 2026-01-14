// D1数据库操作封装

// 添加预定
export async function addBooking(db, booking) {
  const { name, remark, session } = booking;

  const result = await db
    .prepare(
      `INSERT INTO bookings (name, remark, session) 
     VALUES (?, ?, ?)`
    )
    .bind(name, remark, session)
    .run();

  return result;
}

// 获取所有预定（支持筛选）
export async function getBookings(db, filter = "all") {
  let query = `SELECT id, name, remark, session, 
               datetime(created_at, 'localtime') as created_at 
               FROM bookings`;

  let params = [];

  if (filter !== "all") {
    query += ` WHERE session = ?`;
    params.push(filter);
  }

  query += ` ORDER BY created_at DESC`;

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();
  return results || [];
}

// 获取预定统计
export async function getBookingStats(db) {
  const stats = await db
    .prepare(
      `
    SELECT 
      session,
      COUNT(*) as count
    FROM bookings 
    GROUP BY session
  `
    )
    .all();

  const result = {
    total: 0,
    morning: 0,
    afternoon: 0,
    evening: 0,
  };

  if (stats.results) {
    stats.results.forEach((row) => {
      result[row.session] = row.count;
      result.total += row.count;
    });
  }

  return result;
}

// 清空所有预定
export async function clearAllBookings(db) {
  const result = await db.prepare(`DELETE FROM bookings`).run();
  return result;
}

// 初始化数据库
export async function initDatabase(db) {
  // Avoid db.exec multi-statement quirks in local dev by running statements individually.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        remark TEXT,
        session TEXT NOT NULL CHECK (session IN ('morning', 'afternoon', 'evening')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session)`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC)`
    )
    .run();

  return { success: true };
}

let initPromise;

// Ensure DB schema exists; runs once per Worker instance.
export async function ensureDatabase(db) {
  if (!initPromise) {
    initPromise = initDatabase(db).catch((error) => {
      initPromise = undefined;
      throw error;
    });
  }

  return initPromise;
}
