/**
 * GET /api/auth/colors - 获取颜色列表
 */

import { ensureDatabase } from "../d1-client.js";

const COLORS = [
  { id: "color1", name: "红色", value: "#e74c3c" },
  { id: "color2", name: "橙色", value: "#f39c12" },
  { id: "color3", name: "蓝色", value: "#3498db" },
  { id: "color4", name: "紫色", value: "#9b59b6" },
  { id: "color5", name: "青色", value: "#1abc9c" },
  { id: "color6", name: "粉色", value: "#e91e63" },
  { id: "color7", name: "灰色", value: "#95a5a6" },
  { id: "color8", name: "深蓝", value: "#34495e" },
];

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

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  await ensureDatabase(db);

  return new Response(JSON.stringify({ colors: COLORS }), {
    headers: corsHeaders,
  });
}
