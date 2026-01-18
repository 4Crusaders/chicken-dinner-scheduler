-- Migration: 0004_time_slots.sql
-- Description: 创建时间段预定表，支持自定义时间段预定功能
-- Date: 2025-01-18

-- 创建时间段预定表
CREATE TABLE IF NOT EXISTS time_slot_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  remark TEXT,
  start_time TEXT NOT NULL,  -- 格式: "HH:MM" (24小时制)
  end_time TEXT NOT NULL,    -- 格式: "HH:MM" (24小时制)
  booking_date TEXT NOT NULL DEFAULT (date('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (end_time > start_time)
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_time_slot_user_date ON time_slot_bookings(user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_time_slot_date_time ON time_slot_bookings(booking_date, start_time);
