// API配置
const API_BASE_URL = "/api"; // Cloudflare Pages Functions路径

// 预设颜色配置
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

// 应用状态
const appState = {
  bookings: [],
  selectedSession: "morning",
  filter: "all",
  sessions: [
    {
      id: "morning",
      name: "早场",
      time: "08:00 - 12:00",
      icon: "fas fa-sun",
    },
    {
      id: "afternoon",
      name: "下午场",
      time: "13:00 - 17:00",
      icon: "fas fa-cloud-sun",
    },
    {
      id: "evening",
      name: "夜场",
      time: "18:00 - 22:00",
      icon: "fas fa-moon",
    },
  ],
  filters: [
    { id: "all", name: "全部" },
    { id: "morning", name: "早场" },
    { id: "afternoon", name: "下午场" },
    { id: "evening", name: "夜场" },
  ],
  stats: {
    total: 0,
    morning: 0,
    afternoon: 0,
    evening: 0,
  },
  // 认证相关状态
  currentUser: null,
  isAuthenticated: false,
  showAuthModal: false,
  authMode: "login", // 'login' 或 'register'
  availableColors: COLORS,
};

// DOM元素
const elements = {
  bookingForm: document.getElementById("bookingForm"),
  sessionOptions: document.getElementById("sessionOptions"),
  stats: document.getElementById("stats"),
  filterButtons: document.getElementById("filterButtons"),
  bookingsList: document.getElementById("bookingsList"),
  emptyBoard: document.getElementById("emptyBoard"),
  notification: document.getElementById("notification"),
  submitBtn: document.getElementById("submitBtn"),
  loginHint: document.getElementById("loginHint"),
  loginLink: document.getElementById("loginLink"),
  registerLink: document.getElementById("registerLink"),
};

const TOKEN_STORAGE_KEY = "auth_token";
const tokenStorage = {
  getToken() {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn("无法读取本地token:", error);
      return null;
    }
  },
  setToken(token) {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (error) {
      console.warn("无法写入本地token:", error);
    }
  },
  clearToken() {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn("无法清理本地token:", error);
    }
  },
};

// API服务
const api = {
  // 通用请求方法
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
    };
    const token = tokenStorage.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const defaultOptions = {
      credentials: "include", // 发送Cookie
      headers,
    };

    try {
      const response = await fetch(url, {
        ...defaultOptions,
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API请求失败:", error);
      throw error;
    }
  },

  // 获取预定列表
  async getBookings(filter = "all") {
    const endpoint =
      filter === "all" ? "/bookings" : `/bookings?filter=${filter}`;
    return await this.request(endpoint);
  },

  // 获取统计信息
  async getStats() {
    return await this.request("/stats");
  },

  // 添加预定
  async addBooking(booking) {
    return await this.request("/bookings", {
      method: "POST",
      body: JSON.stringify(booking),
    });
  },

  // 删除预定
  async deleteBooking(bookingId) {
    return await this.request(`/bookings/${bookingId}`, {
      method: "DELETE",
    });
  },

  // ============= 认证相关API =============

  // 获取当前登录用户信息
  async getCurrentUser() {
    return await this.request("/auth");
  },

  // 获取颜色列表
  async getColors() {
    return await this.request("/auth/colors");
  },

  // 用户注册
  async register({ username, password, color }) {
    return await this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, color }),
    });
  },

  // 用户登录
  async login({ username, password }) {
    return await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  // 用户登出
  async logout() {
    return await this.request("/auth/logout", {
      method: "POST",
    });
  },
};

// 认证工具函数
const authUtils = {
  // 检查登录状态
  // 注意：HttpOnly Cookie 无法通过 JS 访问，浏览器会自动在请求中携带
  async checkAuthStatus() {
    try {
      const response = await api.getCurrentUser();
      if (response.user) {
        appState.currentUser = response.user;
        appState.isAuthenticated = true;
        return true;
      }
    } catch (error) {
      // Token可能已过期或不存在
      console.log("未登录或登录已过期");
      tokenStorage.clearToken();
    }

    appState.currentUser = null;
    appState.isAuthenticated = false;
    return false;
  },

  // 获取用户名首字符
  getUserInitial(username) {
    if (!username) return "?";
    return username.charAt(0).toUpperCase();
  },
};

// 工具函数
const utils = {
  // 显示通知
  showNotification(message, type = "success", duration = 3000) {
    const notification = elements.notification;
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = "block";

    setTimeout(() => {
      notification.style.display = "none";
    }, duration);
  },

  // 格式化日期
  formatDate(dateString) {
    if (!dateString) {
      return "";
    }

    let normalized = dateString;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
      normalized = dateString.replace(" ", "T") + "Z";
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  },

  // 设置按钮加载状态
  setButtonLoading(button, isLoading, originalText = "") {
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = '<span class="loading"></span> 处理中...';
    } else {
      button.disabled = false;
      button.innerHTML = originalText || button.dataset.originalText || '<i class="fas fa-paper-plane"></i> 提交预定';
    }
  },

  // 获取场次信息
  getSessionInfo(sessionId) {
    return (
      appState.sessions.find((s) => s.id === sessionId) || {
        name: "未知场次",
        icon: "fas fa-question",
      }
    );
  },

  // 获取场次CSS类
  getSessionClass(sessionId) {
    return `${sessionId}-session`;
  },
};

// 渲染函数
const render = {
  // 渲染认证按钮（在header中）
  renderAuthButton() {
    let authButton = document.getElementById("authButton");
    if (!authButton) {
      // 在header中创建认证按钮容器
      const header = document.querySelector("header");
      authButton = document.createElement("div");
      authButton.id = "authButton";
      authButton.style.cssText = `
        margin-top: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      `;
      header.appendChild(authButton);
    }

    if (appState.isAuthenticated && appState.currentUser) {
      // 已登录状态
      const userColor = appState.currentUser.color || "#3498db";
      const userInitial = authUtils.getUserInitial(appState.currentUser.username);
      authButton.innerHTML = `
        <div class="user-info" style="display: flex; align-items: center; gap: 8px;">
          <div class="user-avatar" style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${userColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 14px;
          ">
            ${userInitial}
          </div>
          <span style="font-weight: 600; color: #2c3e50;">${appState.currentUser.username}</span>
        </div>
        <button class="logout-btn" style="
          padding: 6px 12px;
          border-radius: 16px;
          border: 2px solid #e74c3c;
          background: white;
          color: #e74c3c;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.3s;
        ">
          <i class="fas fa-sign-out-alt"></i> 登出
        </button>
      `;

      // 添加登出事件
      authButton.querySelector(".logout-btn").addEventListener("click", () => {
        handlers.handleLogout();
      });
    } else {
      // 未登录状态
      authButton.innerHTML = `
        <button class="login-btn" style="
          padding: 8px 20px;
          border-radius: 20px;
          border: 2px solid #3498db;
          background: white;
          color: #3498db;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.3s;
        ">
          <i class="fas fa-user"></i> 登录 / 注册
        </button>
      `;

      // 添加登录按钮事件
      authButton.querySelector(".login-btn").addEventListener("click", () => {
        handlers.showAuthModal("login");
      });
    }
  },

  // 渲染认证模态框
  renderAuthModal() {
    let modal = document.getElementById("authModal");

    if (!appState.showAuthModal) {
      if (modal) {
        modal.remove();
      }
      return;
    }

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "authModal";
      document.body.appendChild(modal);
    }

    const isLogin = appState.authMode === "login";

    modal.innerHTML = `
      <div class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
      ">
        <div class="modal-content" style="
          background: white;
          border-radius: 12px;
          padding: 30px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        ">
          <div class="modal-header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          ">
            <h2 style="margin: 0; color: #2c3e50;">
              ${isLogin ? '<i class="fas fa-sign-in-alt"></i> 登录' : '<i class="fas fa-user-plus"></i> 注册'}
            </h2>
            <button class="close-btn" style="
              background: none;
              border: none;
              font-size: 1.5rem;
              cursor: pointer;
              color: #7f8c8d;
            ">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <form id="authForm" class="auth-form">
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #2c3e50;">
                <i class="fas fa-user"></i> 用户名
              </label>
              <input type="text" name="username" placeholder="${isLogin ? '请输入用户名' : '3-20个字符'}" required
                style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px;" />
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #2c3e50;">
                <i class="fas fa-lock"></i> 密码
              </label>
              <input type="password" name="password" placeholder="${isLogin ? '请输入密码' : '至少6个字符'}" required
                style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px;" />
            </div>

            ${
              !isLogin
                ? `
              <div class="form-group" style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #2c3e50;">
                  <i class="fas fa-lock"></i> 确认密码
                </label>
                <input type="password" name="confirmPassword" placeholder="请再次输入密码" required
                  style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px;" />
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50;">
                  <i class="fas fa-palette"></i> 头像颜色选择
                </label>
                <div class="color-selection" style="
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 10px;
                ">
                  ${appState.availableColors.map(
                    (color) => `
                    <div class="color-option" data-color="${color.value}" style="
                      padding: 10px;
                      border: 2px solid #e0e0e0;
                      border-radius: 8px;
                      text-align: center;
                      cursor: pointer;
                      transition: all 0.3s;
                    ">
                      <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: ${color.value};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto;
                        color: white;
                        font-weight: 700;
                        font-size: 16px;
                      ">
                        A
                      </div>
                    </div>
                  `
                  ).join("")}
                </div>
                <input type="hidden" name="color" value="${
                  appState.availableColors[0]?.value || "#3498db"
                }" />
              </div>
            `
                : ""
            }

            <button type="submit" class="btn-submit" style="
              background: linear-gradient(to right, #3498db, #2ecc71);
              color: white;
              border: none;
              padding: 12px 20px;
              font-size: 1rem;
              border-radius: 8px;
              cursor: pointer;
              width: 100%;
              font-weight: 600;
            ">
              ${isLogin ? '<i class="fas fa-sign-in-alt"></i> 登录' : '<i class="fas fa-user-plus"></i> 注册'}
            </button>
          </form>

          <div class="auth-switch" style="
            margin-top: 16px;
            text-align: center;
            color: #7f8c8d;
          ">
            ${isLogin ? "还没有账号?" : "已有账号?"}
            <button class="switch-mode-btn" style="
              background: none;
              border: none;
              color: #3498db;
              cursor: pointer;
              font-weight: 600;
              padding: 0;
              margin-left: 4px;
            ">
              ${isLogin ? "立即注册" : "立即登录"}
            </button>
          </div>
        </div>
      </div>
    `;

    // 添加事件监听
    modal.querySelector(".close-btn").addEventListener("click", () => {
      appState.showAuthModal = false;
      this.renderAuthModal();
    });

    modal.querySelector(".modal-overlay").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        appState.showAuthModal = false;
        this.renderAuthModal();
      }
    });

    modal.querySelector(".switch-mode-btn").addEventListener("click", () => {
      appState.authMode = isLogin ? "register" : "login";
      this.renderAuthModal();
    });

    if (!isLogin) {
      // 颜色选择事件
      modal.querySelectorAll(".color-option").forEach((option) => {
        option.addEventListener("click", () => {
          modal.querySelectorAll(".color-option").forEach((o) => {
            o.style.borderColor = "#e0e0e0";
            o.style.background = "white";
          });
          option.style.borderColor = "#3498db";
          option.style.background = "rgba(52, 152, 219, 0.1)";
          modal.querySelector('input[name="color"]').value = option.dataset.color;
        });
      });

      // 默认选中第一个颜色
      const firstColor = modal.querySelector(".color-option");
      if (firstColor) {
        firstColor.click();
      }
    }

    // 表单提交
    modal.querySelector("#authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      if (isLogin) {
        handlers.handleLogin(data.username, data.password);
      } else {
        // 验证密码确认
        if (data.password !== data.confirmPassword) {
          utils.showNotification("两次输入的密码不一致", "error");
          return;
        }
        handlers.handleRegister(data.username, data.password, data.color);
      }
    });
  },

  // 渲染场次选择器
  renderSessionOptions() {
    let html = "";
    appState.sessions.forEach((session) => {
      const isSelected = appState.selectedSession === session.id;
      html += `
        <div class="session-option ${isSelected ? "selected" : ""}"
             data-session-id="${session.id}">
          <div class="session-icon">
            <i class="${session.icon}"></i>
          </div>
          <div class="session-name">${session.name}</div>
          <div class="session-time">${session.time}</div>
        </div>
      `;
    });

    elements.sessionOptions.innerHTML = html;

    // 添加点击事件
    document.querySelectorAll(".session-option").forEach((option) => {
      option.addEventListener("click", () => {
        appState.selectedSession = option.dataset.sessionId;
        this.renderSessionOptions();
      });
    });
  },

  // 渲染统计数据
  renderStats() {
    const { stats } = appState;

    elements.stats.innerHTML = `
      <div class="stat-item">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">总预定数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.morning}</div>
        <div class="stat-label">早场预定</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.afternoon}</div>
        <div class="stat-label">下午场预定</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.evening}</div>
        <div class="stat-label">夜场预定</div>
      </div>
    `;
  },

  // 渲染筛选按钮
  renderFilterButtons() {
    let html = "";
    appState.filters.forEach((filter) => {
      const isActive = appState.filter === filter.id;
      html += `
        <button class="filter-btn ${isActive ? "active" : ""}"
                data-filter-id="${filter.id}">
          ${filter.name}
        </button>
      `;
    });

    elements.filterButtons.innerHTML = html;

    // 添加点击事件
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        appState.filter = btn.dataset.filterId;
        this.renderFilterButtons();
        await loadBookings();
      });
    });
  },

  // 渲染预定列表
  renderBookingsList() {
    if (appState.bookings.length === 0) {
      elements.emptyBoard.style.display = "block";
      elements.bookingsList.innerHTML = "";
      return;
    }

    elements.emptyBoard.style.display = "none";

    let html = "";
    appState.bookings.forEach((booking) => {
      const sessionInfo = utils.getSessionInfo(booking.session);
      const sessionClass = utils.getSessionClass(booking.session);

      // 获取用户颜色和首字符
      const userColor = booking.color || "#3498db";
      const userName = booking.username || booking.name || "未知用户";
      const userInitial = authUtils.getUserInitial(userName);

      // 检查是否是当前用户的预定
      const isOwnBooking =
        appState.isAuthenticated &&
        appState.currentUser &&
        booking.user_id === appState.currentUser.id;

      html += `
        <div class="booking-item">
          <div class="booking-header">
            <div class="booking-name">
              <div class="user-avatar-inline" style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: ${userColor};
                color: white;
                margin-right: 6px;
                font-size: 0.8rem;
                font-weight: 700;
              ">
                ${userInitial}
              </div>
              ${userName}
            </div>
            <div class="booking-session ${sessionClass}">
              <i class="${sessionInfo.icon}"></i> ${sessionInfo.name}
            </div>
          </div>

          <div class="booking-time">
            <i class="far fa-clock"></i> ${utils.formatDate(booking.created_at)}
          </div>

          ${
            booking.remark
              ? `
            <div class="booking-remark">
              <i class="fas fa-quote-left"></i> ${booking.remark}
            </div>
          `
              : ""
          }

          ${
            isOwnBooking
              ? `
            <div class="booking-actions" style="margin-top: 10px;">
              <button class="delete-booking-btn" data-booking-id="${booking.id}" style="
                padding: 6px 12px;
                border-radius: 6px;
                border: 1px solid #e74c3c;
                background: white;
                color: #e74c3c;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.3s;
              ">
                <i class="fas fa-trash"></i> 删除
              </button>
            </div>
          `
              : ""
          }
        </div>
      `;
    });

    elements.bookingsList.innerHTML = html;

    // 添加删除按钮事件
    document.querySelectorAll(".delete-booking-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        handlers.handleDeleteBooking(parseInt(btn.dataset.bookingId));
      });
    });
  },

  // 渲染所有组件
  renderAll() {
    this.renderSessionOptions();
    this.renderStats();
    this.renderFilterButtons();
    this.renderBookingsList();
    this.renderAuthButton();

    // 更新登录提示状态
    if (elements.loginHint) {
      elements.loginHint.style.display = appState.isAuthenticated ? "none" : "block";
    }
  },
};

// 数据加载函数
async function loadBookings() {
  try {
    const [bookings, stats] = await Promise.all([
      api.getBookings(appState.filter),
      api.getStats(),
    ]);

    appState.bookings = bookings;
    appState.stats = stats;
    render.renderAll();
  } catch (error) {
    console.error("加载数据失败:", error);
    utils.showNotification("加载数据失败，请刷新页面重试", "error");
  }
}

// 事件处理函数
const handlers = {
  // 显示认证模态框
  showAuthModal(mode = "login") {
    appState.authMode = mode;
    appState.showAuthModal = true;
    render.renderAuthModal();
  },

  // 处理注册
  async handleRegister(username, password, color) {
    try {
      const submitBtn = document.querySelector("#authModal .btn-submit");
      utils.setButtonLoading(submitBtn, true, '<i class="fas fa-user-plus"></i> 注册');

      const result = await api.register({ username, password, color });

      if (result.success) {
        utils.showNotification("注册成功！请登录");
        appState.authMode = "login";
        render.renderAuthModal();
      } else {
        utils.showNotification(result.error || "注册失败", "error");
      }
    } catch (error) {
      console.error("注册失败:", error);
      utils.showNotification(error.message || "注册失败，请稍后重试", "error");
    } finally {
      const btn = document.querySelector("#authModal .btn-submit");
      if (btn) {
        utils.setButtonLoading(btn, false, '<i class="fas fa-user-plus"></i> 注册');
      }
    }
  },

  // 处理登录
  async handleLogin(username, password) {
    try {
      const submitBtn = document.querySelector("#authModal .btn-submit");
      utils.setButtonLoading(submitBtn, true, '<i class="fas fa-sign-in-alt"></i> 登录');

      const result = await api.login({ username, password });

      if (result.success) {
        if (result.token) {
          tokenStorage.setToken(result.token);
        }
        appState.currentUser = result.user;
        appState.isAuthenticated = true;
        appState.showAuthModal = false;

        render.renderAuthModal();
        render.renderAll();

        utils.showNotification(`欢迎回来，${result.user.username}!`);

        // 重新加载数据
        await loadBookings();
      } else {
        utils.showNotification(result.error || "登录失败", "error");
      }
    } catch (error) {
      console.error("登录失败:", error);
      utils.showNotification(error.message || "登录失败，请稍后重试", "error");
    } finally {
      const btn = document.querySelector("#authModal .btn-submit");
      if (btn) {
        utils.setButtonLoading(btn, false, '<i class="fas fa-sign-in-alt"></i> 登录');
      }
    }
  },

  // 处理登出
  async handleLogout() {
    if (!confirm("确定要登出吗？")) {
      return;
    }

    try {
      await api.logout();

      tokenStorage.clearToken();
      appState.currentUser = null;
      appState.isAuthenticated = false;

      render.renderAll();
      utils.showNotification("已登出");
    } catch (error) {
      console.error("登出失败:", error);
      utils.showNotification("登出失败", "error");
    }
  },

  // 处理删除预定
  async handleDeleteBooking(bookingId) {
    if (!confirm("确定要删除这条预定记录吗？")) {
      return;
    }

    try {
      const result = await api.deleteBooking(bookingId);

      if (result.success) {
        appState.bookings = result.bookings || [];
        appState.stats = result.stats || appState.stats;

        render.renderAll();

        utils.showNotification(result.message || "预定已删除");
      } else {
        utils.showNotification(result.error || "删除失败", "error");
      }
    } catch (error) {
      console.error("删除预定失败:", error);
      utils.showNotification(error.message || "删除预定失败，请稍后重试", "error");
    }
  },

  // 处理表单提交
  async handleFormSubmit(e) {
    e.preventDefault();

    // 检查登录状态
    if (!appState.isAuthenticated) {
      utils.showNotification("请先登录后再提交预定", "warning");
      this.showAuthModal("login");
      return;
    }

    const remarkInput = document.getElementById("remark");

    // 创建预定对象（不再需要name字段，使用登录用户的用户名）
    const booking = {
      remark: remarkInput.value.trim(),
      session: appState.selectedSession,
    };

    try {
      // 设置按钮加载状态
      utils.setButtonLoading(elements.submitBtn, true);

      // 提交预定
      const result = await api.addBooking(booking);

      if (result.success) {
        // 更新应用状态
        appState.bookings = result.bookings || [];
        appState.stats = result.stats || appState.stats;

        // 重新渲染
        render.renderAll();

        // 显示成功通知
        utils.showNotification("预定成功！已添加到看板");

        // 重置表单
        remarkInput.value = "";
      } else {
        utils.showNotification(result.error || "预定失败", "error");
      }
    } catch (error) {
      console.error("提交预定失败:", error);
      utils.showNotification(error.message || "提交预定失败，请稍后重试", "error");
    } finally {
      // 恢复按钮状态
      utils.setButtonLoading(elements.submitBtn, false);
    }
  },

  // 初始化事件监听
  initEventListeners() {
    // 表单提交事件
    elements.bookingForm.addEventListener("submit", (e) => {
      this.handleFormSubmit(e);
    });

    // 登录链接
    if (elements.loginLink) {
      elements.loginLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.showAuthModal("login");
      });
    }

    // 注册链接
    if (elements.registerLink) {
      elements.registerLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.showAuthModal("register");
      });
    }
  },
};

// 初始化应用
async function initApp() {
  try {
    // 显示加载状态
    utils.showNotification("正在加载数据...", "warning", 2000);

    // 检查登录状态
    await authUtils.checkAuthStatus();

    // 初始化事件监听
    handlers.initEventListeners();

    // 加载数据
    await loadBookings();

    // 初始渲染
    render.renderAll();
  } catch (error) {
    console.error("应用初始化失败:", error);
    utils.showNotification("应用初始化失败，请刷新页面重试", "error", 5000);
  }
}

// 页面加载完成后初始化应用
document.addEventListener("DOMContentLoaded", initApp);

// 处理离线/在线状态
window.addEventListener("online", () => {
  utils.showNotification("网络已恢复，正在同步数据...", "warning", 2000);
  loadBookings();
});

window.addEventListener("offline", () => {
  utils.showNotification("网络已断开，部分功能可能受限", "error", 3000);
});
