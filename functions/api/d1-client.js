// D1数据库操作封装

// ============= 用户相关操作 =============

// 创建用户
export async function createUser(db, { username, passwordHash, salt, color }) {
  const result = await db
    .prepare(`INSERT INTO users (username, password_hash, salt, color) VALUES (?, ?, ?, ?)`)
    .bind(username, passwordHash, salt, color)
    .run();

  return result;
}

// 根据用户名查找用户
export async function findUserByUsername(db, username) {
  const user = await db
    .prepare(`SELECT id, username, password_hash, salt, color FROM users WHERE username = ?`)
    .bind(username)
    .first();

  return user;
}

// 根据ID查找用户
export async function findUserById(db, userId) {
  const user = await db
    .prepare(`SELECT id, username, color FROM users WHERE id = ?`)
    .bind(userId)
    .first();

  return user;
}

// 创建会话
export async function createSession(db, { userId, token, expiresAt }) {
  const result = await db
    .prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`)
    .bind(userId, token, expiresAt)
    .run();

  return result;
}

// 删除会话（登出）
export async function deleteSession(db, token) {
  const result = await db
    .prepare(`DELETE FROM sessions WHERE token = ?`)
    .bind(token)
    .run();

  return result;
}

// 验证token并返回用户信息
export async function validateSession(db, token) {
  const session = await db
    .prepare(`
      SELECT s.user_id, s.expires_at, u.id, u.username, u.color
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `)
    .bind(token)
    .first();

  return session;
}

// 获取预定列表并包含用户信息
export async function getBookingsWithUserInfo(db, filter = "all") {
  let query = `
    SELECT b.id, b.name, b.remark, b.session, b.user_id,
           strftime('%Y-%m-%dT%H:%M:%SZ', b.created_at) as created_at,
           u.color, u.username
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
  `;

  let params = [];

  if (filter !== "all") {
    query += ` WHERE b.session = ?`;
    params.push(filter);
  }

  query += ` ORDER BY b.created_at DESC`;

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();

  return results || [];
}

// 删除指定预定（只能删除自己的）
export async function deleteBooking(db, bookingId, userId) {
  const result = await db
    .prepare(`DELETE FROM bookings WHERE id = ? AND user_id = ?`)
    .bind(bookingId, userId)
    .run();

  return result;
}

// ============= 原有的预定相关操作 =============

// 添加预定（已更新支持user_id）
export async function addBooking(db, booking) {
  const { name, remark, session, userId } = booking;

  const result = await db
    .prepare(`INSERT INTO bookings (name, remark, session, user_id) VALUES (?, ?, ?, ?)`)
    .bind(name, remark, session, userId)
    .run();

  return result;
}

// 获取所有预定（支持筛选）
export async function getBookings(db, filter = "all") {
  let query = `SELECT id, name, remark, session,
               strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at
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
  // Users表
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`)
    .run();

  // Sessions表
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    )
    .run();

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`)
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`
    )
    .run();

  // Bookings表
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        remark TEXT,
        session TEXT NOT NULL CHECK (session IN ('morning', 'afternoon', 'evening')),
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  // 尝试为现有的bookings表添加user_id列（如果列不存在的话）
  // 使用try-catch因为列可能已经存在
  try {
    await db.prepare(`ALTER TABLE bookings ADD COLUMN user_id INTEGER`).run();
  } catch (e) {
    // 列已存在，忽略错误
  }

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

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)`)
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
