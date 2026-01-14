import {
  ensureDatabase,
  validateSession,
  deleteBooking,
  getBookingStats,
  getBookingsWithUserInfo,
} from "../d1-client.js";

// 从请求中提取token
function extractToken(request) {
  // 优先从Authorization header获取
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // 其次从Cookie获取
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const authCookie = cookies.find((c) => c.startsWith("auth_token="));
    if (authCookie) {
      return authCookie.substring("auth_token=".length);
    }
  }

  return null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  if (request.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    await ensureDatabase(db);

    const token = extractToken(request);
    if (!token) {
      return new Response(JSON.stringify({ error: "请先登录" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const session = await validateSession(db, token);
    if (!session) {
      return new Response(JSON.stringify({ error: "登录已过期，请重新登录" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const bookingId = Number.parseInt(params.id, 10);
    if (Number.isNaN(bookingId)) {
      return new Response(JSON.stringify({ error: "无效的预定ID" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const result = await deleteBooking(db, bookingId, session.id);
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: "预定不存在或无权删除" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const bookings = await getBookingsWithUserInfo(db, "all");
    const stats = await getBookingStats(db);

    return new Response(
      JSON.stringify({
        success: true,
        bookings,
        stats,
        message: "预定已删除",
      }),
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("删除预定API错误:", error);
    return new Response(
      JSON.stringify({
        error: "服务器内部错误",
        message: error.message,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
