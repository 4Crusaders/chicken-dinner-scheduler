/**
 * POST /api/auth/logout - 用户登出
 */

import { deleteSession, ensureDatabase } from "../d1-client.js";

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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    await ensureDatabase(db);
    const token = extractToken(request);

    if (token) {
      await deleteSession(db, token);
    }

    // 清除Cookie
    const responseHeaders = {
      ...corsHeaders,
      "Set-Cookie": `auth_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`,
    };

    return new Response(JSON.stringify({ success: true, message: "已登出" }), {
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("登出API错误:", error);
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
