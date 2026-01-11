-- 创建预定表
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    remark TEXT,
    session TEXT NOT NULL CHECK (session IN ('morning', 'afternoon', 'evening')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX idx_bookings_session ON bookings(session);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- 可选：创建统计表（如果需要实时统计）
CREATE TABLE IF NOT EXISTS booking_stats (
    date DATE PRIMARY KEY,
    morning_count INTEGER DEFAULT 0,
    afternoon_count INTEGER DEFAULT 0,
    evening_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0
);