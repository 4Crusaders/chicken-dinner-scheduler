/**
 * 加密工具模块
 * 使用 Web Crypto API 实现密码哈希和 token 生成
 */

// 生成随机 salt (16字节)
export async function generateSalt() {
  const arrayBuffer = new Uint8Array(16);
  crypto.getRandomValues(arrayBuffer);
  return Array.from(arrayBuffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 密码哈希 (使用 PBKDF2)
export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 验证密码
export async function verifyPassword(password, salt, storedHash) {
  const computedHash = await hashPassword(password, salt);
  return computedHash === storedHash;
}

// 生成安全的随机 token (32字节)
export async function generateToken() {
  const arrayBuffer = new Uint8Array(32);
  crypto.getRandomValues(arrayBuffer);
  return Array.from(arrayBuffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 计算 token 过期时间 (1年后)
export function getExpirationYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}
