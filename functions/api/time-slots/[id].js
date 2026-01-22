import { ensureDatabase, deleteTimeSlotBooking, getSessionUser } from "../d1-client.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const bookingId = params.id;

  // 确保数据库已初始化
  await ensureDatabase(db);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (request.method === "DELETE") {
    try {
      const sessionUser = await getSessionUser(db, request);
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
      }

      const result = await deleteTimeSlotBooking(db, bookingId, sessionUser.id);

      if (result.meta?.changes === 0) {
        return new Response(JSON.stringify({ error: "预定不存在或无权删除" }), { status: 404 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}
