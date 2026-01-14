/**
 * GET /api/auth - 获取当前登录用户信息
 */

import { validateSession, ensureDatabase } from "../d1-client.js";

// 从请求中提取token
function extractToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

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

// CORS配置
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  // 如果有 origin 就使用它，否则不设置该头（同源请求不需要）
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const token = extractToken(request);

    if (!token) {
      return new Response(JSON.stringify({ error: "未登录" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    await ensureDatabase(db);
    const user = await validateSession(db, token);

    if (!user) {
      return new Response(JSON.stringify({ error: "登录已过期" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
        },
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("认证API错误:", error);
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
