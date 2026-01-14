-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  avatar_id TEXT NOT NULL DEFAULT 'avatar1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户名索引(用于快速查找和唯一性验证)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Token索引(用于快速验证)
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- 过期时间索引(用于清理过期会话)
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 为现有bookings表添加user_id列
-- 注意: SQLite的ALTER TABLE只支持添加列,不支持添加外键约束
ALTER TABLE bookings ADD COLUMN user_id INTEGER;

-- 为新的user_id创建索引
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
