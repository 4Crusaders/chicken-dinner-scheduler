import {
  addBooking,
  getBookings,
  getBookingStats,
  clearAllBookings,
  initDatabase,
} from "./d1-client.js";

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 初始化数据库（只在需要时）
  if (
    request.method === "POST" &&
    new URL(request.url).pathname.endsWith("/init")
  ) {
    await initDatabase(db);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 设置CORS头
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

    switch (request.method) {
      case "GET":
        // 获取预定列表
        if (url.pathname.endsWith("/bookings")) {
          const filter = url.searchParams.get("filter") || "all";
          const bookings = await getBookings(db, filter);
          return new Response(JSON.stringify(bookings), {
            headers: corsHeaders,
          });
        }

        // 获取统计信息
        if (url.pathname.endsWith("/stats")) {
          const stats = await getBookingStats(db);
          return new Response(JSON.stringify(stats), {
            headers: corsHeaders,
          });
        }

        break;

      case "POST":
        // 添加预定
        if (url.pathname.endsWith("/bookings")) {
          const data = await request.json();

          // 验证数据
          if (!data.name || !data.session) {
            return new Response(
              JSON.stringify({
                error: "姓名和场次是必填项",
              }),
              {
                status: 400,
                headers: corsHeaders,
              }
            );
          }

          const result = await addBooking(db, data);

          // 获取更新后的预定列表
          const bookings = await getBookings(db, "all");
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
        // 清空所有预定
        if (url.pathname.endsWith("/bookings")) {
          await clearAllBookings(db);
          const stats = await getBookingStats(db);

          return new Response(
            JSON.stringify({
              success: true,
              stats,
              message: "所有预定已清空",
            }),
            {
              headers: corsHeaders,
            }
          );
        }
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
