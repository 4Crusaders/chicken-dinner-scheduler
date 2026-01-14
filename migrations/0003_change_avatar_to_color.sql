-- 将 avatar_id 列改为 color 列
-- SQLite 不支持直接修改列，需要重新创建表

-- 1. 创建新的 users 表（使用 color 列）
CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3498db',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 复制数据到新表（将 avatar_id 映射到对应的颜色）
-- 默认使用蓝色 #3498db
INSERT INTO users_new (id, username, password_hash, salt, color, created_at)
SELECT id, username, password_hash, salt,
  CASE avatar_id
    WHEN 'avatar1' THEN '#e74c3c'
    WHEN 'avatar2' THEN '#f39c12'
    WHEN 'avatar3' THEN '#3498db'
    WHEN 'avatar4' THEN '#9b59b6'
    WHEN 'avatar5' THEN '#1abc9c'
    WHEN 'avatar6' THEN '#e91e63'
    ELSE '#3498db'
  END as color,
  created_at
FROM users;

-- 3. 删除旧表
DROP TABLE users;

-- 4. 重命名新表
ALTER TABLE users_new RENAME TO users;

-- 5. 重新创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
