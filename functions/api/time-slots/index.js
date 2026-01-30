import { ensureDatabase } from "../d1-client.js";
import {
  addTimeSlotBooking,
  getTimeSlotBookings,
  deleteTimeSlotBooking,
  getTimeSlotStats,
  cleanupExpiredTimeSlotBookings,
  getSessionUser,
} from "../d1-client.js";

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 确保数据库已初始化
  await ensureDatabase(db);
  await cleanupExpiredTimeSlotBookings(db);

  // CORS 处理
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || new Date().toISOString().split('T')[0];

    // GET - 获取时间段预定列表
    if (request.method === "GET") {
      const [bookings, stats] = await Promise.all([
        getTimeSlotBookings(db, date),
        getTimeSlotStats(db, date),
      ]);

      return new Response(JSON.stringify({ success: true, bookings, stats }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST - 添加时间段预定（需要认证）
    if (request.method === "POST") {
      const sessionUser = await getSessionUser(db, request);
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
      }

      const data = await request.json();
      const { startTime, endTime, remark } = data;

      // 验证
      if (!startTime || !endTime) {
        return new Response(JSON.stringify({ error: "请选择完整的时间范围" }), { status: 400 });
      }

      if (endTime <= startTime) {
        return new Response(JSON.stringify({ error: "结束时间必须大于开始时间" }), { status: 400 });
      }

      // 验证时间格式
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return new Response(JSON.stringify({ error: "时间格式无效（应为 HH:MM）" }), { status: 400 });
      }

      await addTimeSlotBooking(db, {
        userId: sessionUser.id,
        remark: remark || null,
        startTime,
        endTime,
        bookingDate: date,
      });

      const [bookings, stats] = await Promise.all([
        getTimeSlotBookings(db, date),
        getTimeSlotStats(db, date),
      ]);

      return new Response(JSON.stringify({ success: true, bookings, stats }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
