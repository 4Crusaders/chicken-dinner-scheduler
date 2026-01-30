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

  const normalizeTzOffset = (value) => {
    if (!value) return "+00:00";
    const match = value.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) return "+00:00";
    const hours = Number.parseInt(match[2], 10);
    const minutes = Number.parseInt(match[3], 10);
    if (hours > 14 || minutes > 59) return "+00:00";
    return `${match[1]}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const getLocalDateString = (offsetMinutes) => {
    const now = new Date();
    const localMs = now.getTime() + offsetMinutes * 60 * 1000;
    return new Date(localMs).toISOString().split("T")[0];
  };

  const parseOffsetMinutes = (offset) => {
    const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) return 0;
    const sign = match[1] === "+" ? 1 : -1;
    const hours = Number.parseInt(match[2], 10);
    const minutes = Number.parseInt(match[3], 10);
    return sign * (hours * 60 + minutes);
  };

  // 确保数据库已初始化
  await ensureDatabase(db);

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
    const tzOffset = normalizeTzOffset(url.searchParams.get("tzOffset"));
    const offsetMinutes = parseOffsetMinutes(tzOffset);
    const date = url.searchParams.get("date") || getLocalDateString(offsetMinutes);

    await cleanupExpiredTimeSlotBookings(db, tzOffset);

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
