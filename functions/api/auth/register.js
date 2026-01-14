/**
 * POST /api/auth/register - 用户注册
 */

import {
  createUser,
  findUserByUsername,
  ensureDatabase,
} from "../d1-client.js";
import {
  generateSalt,
  hashPassword,
} from "../crypto-utils.js";

// 可用颜色列表
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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    await ensureDatabase(db);
    const data = await request.json();
    const { username, password, color } = data;

    // 验证输入
    if (!username || !password || !color) {
      return new Response(
        JSON.stringify({ error: "用户名、密码和颜色都是必填项" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // 验证用户名长度
    if (username.length < 3 || username.length > 20) {
      return new Response(
        JSON.stringify({ error: "用户名长度必须在3-20个字符之间" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // 验证密码长度
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "密码长度至少6个字符" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // 验证颜色
    const validColor = COLORS.find((c) => c.value === color);
    if (!validColor) {
      return new Response(JSON.stringify({ error: "无效的颜色选择" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 检查用户名是否已存在
    const existingUser = await findUserByUsername(db, username);
    if (existingUser) {
      return new Response(JSON.stringify({ error: "用户名已被占用" }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    // 生成salt和hash
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // 创建用户
    await createUser(db, {
      username,
      passwordHash,
      salt,
      color,
    });

    return new Response(JSON.stringify({ success: true, message: "注册成功" }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("注册API错误:", error);
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
