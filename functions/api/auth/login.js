/**
 * POST /api/auth/login - 用户登录
 */

import {
  findUserByUsername,
  createSession,
  ensureDatabase,
} from "../d1-client.js";
import {
  verifyPassword,
  generateToken,
  getExpirationYear,
} from "../crypto-utils.js";

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
    const { username, password } = data;

    // 验证输入
    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "用户名和密码是必填项" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // 查找用户
    const user = await findUserByUsername(db, username);
    if (!user) {
      return new Response(JSON.stringify({ error: "用户名或密码错误" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.salt, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "用户名或密码错误" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 生成token
    const token = await generateToken();
    const expiresAt = getExpirationYear();

    // 创建会话
    await createSession(db, {
      userId: user.id,
      token,
      expiresAt,
    });

    // 设置Cookie
    const responseHeaders = {
      ...corsHeaders,
      "Set-Cookie": `auth_token=${token}; HttpOnly; SameSite=Lax; Max-Age=${
        365 * 24 * 60 * 60
      }; Path=/`,
    };

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
        },
      }),
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error("登录API错误:", error);
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
