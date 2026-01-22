import {
  addBooking,
  getBookingStats,
  ensureDatabase,
  validateSession,
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
  const { request, env } = context;
  const db = env.DB;

  // 初始化数据库（只在需要时）
  if (
    request.method === "POST" &&
    new URL(request.url).pathname.endsWith("/init")
  ) {
    await ensureDatabase(db);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 设置CORS头
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };

  // 处理OPTIONS预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(request.url);
    await ensureDatabase(db);

    switch (request.method) {
      case "GET":
        // 获取预定列表（无需认证）
        if (url.pathname.endsWith("/bookings")) {
          const filter = url.searchParams.get("filter") || "all";
          const bookings = await getBookingsWithUserInfo(db, filter);
          return new Response(JSON.stringify(bookings), {
            headers: corsHeaders,
          });
        }
        break;

      case "POST":
        // 添加预定（需要认证）
        if (url.pathname.endsWith("/bookings")) {
          // 验证登录状态
          const token = extractToken(request);
          if (!token) {
            return new Response(
              JSON.stringify({ error: "请先登录" }),
              {
                status: 401,
                headers: corsHeaders,
              }
            );
          }

          const session = await validateSession(db, token);
          if (!session) {
            return new Response(
              JSON.stringify({ error: "登录已过期，请重新登录" }),
              {
                status: 401,
                headers: corsHeaders,
              }
            );
          }

          const data = await request.json();

          // 验证数据（不再需要name字段，使用登录用户的用户名）
          if (!data.session) {
            return new Response(
              JSON.stringify({
                error: "场次是必填项",
              }),
              {
                status: 400,
                headers: corsHeaders,
              }
            );
          }

          const result = await addBooking(db, {
            name: session.username, // 使用登录用户的用户名
            remark: data.remark,
            session: data.session,
            userId: session.id, // 关联用户ID
          });

          // 获取更新后的预定列表
          const bookings = await getBookingsWithUserInfo(db, "all");
          const stats = await getBookingStats(db);

          return new Response(
            JSON.stringify({
              success: true,
              id: result.meta.last_row_id,
              bookings,
              stats,
            }),
            {
              headers: corsHeaders,
            }
          );
        }
        break;

      case "DELETE":
        break;
    }

    // 如果未匹配任何路由
    return new Response(JSON.stringify({ error: "未找到路由" }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("API错误:", error);

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
