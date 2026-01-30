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
  timeSlotBookings: [],
  selectedDate: new Date().toISOString().split('T')[0],
  stats: {
    total: 0,
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
  timePickerContainer: document.getElementById("timePickerContainer"),
  stats: document.getElementById("stats"),
  boardContent: document.getElementById("boardContent"),
  emptyBoard: document.getElementById("emptyBoard"),
  notification: document.getElementById("notification"),
  submitBtn: document.getElementById("submitBtn"),
  // resetBookingsBtn: document.getElementById("resetBookingsBtn"), // 已移除
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
    const { timeoutMs = 15000, ...fetchOptions } = options;
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

    const controller = new AbortController();
    const signal = fetchOptions.signal || controller.signal;
    const timeoutId = fetchOptions.signal
      ? null
      : setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...defaultOptions,
        ...fetchOptions,
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("请求超时，请稍后重试");
      }
      console.error("API请求失败:", error);
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
    return await this.request("/auth", { timeoutMs: 5000 });
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

  // ============= 时间段预定相关API =============

  // 获取时间段预定列表
  async getTimeSlotBookings(date = null) {
    const query = date ? `?date=${date}` : '';
    return await this.request(`/time-slots${query}`);
  },

  // 添加时间段预定
  async addTimeSlotBooking({ startTime, endTime, remark }) {
    return await this.request('/time-slots', {
      method: 'POST',
      body: JSON.stringify({ startTime, endTime, remark }),
    });
  },

  // 删除时间段预定
  async deleteTimeSlotBooking(id) {
    return await this.request(`/time-slots/${id}`, { method: 'DELETE' });
  },

  // clearAllTimeSlotBookings 已移除
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
      button.innerHTML = '<span class="loading"></span> 部署中...';
    } else {
      button.disabled = false;
      button.innerHTML = originalText || button.dataset.originalText || '<i class="fas fa-rocket"></i> 确认部署';
    }
  },
};

// 时间工具函数
const timeUtils = {
  // 生成时间选项（每30分钟，从8点开始）
  generateTimeOptions() {
    const options = [];
    for (let h = 8; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        options.push({ value: time, label: time });
      }
    }
    return options;
  },

  // 验证时间格式
  isValidTime(timeStr) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
  },

  // 验证时间范围
  validateTimeRange(start, end) {
    if (!start || !end) return { valid: false, error: "请选择完整的时间范围" };
    if (end <= start) return { valid: false, error: "结束时间必须大于开始时间" };
    return { valid: true };
  },

  // 计算时长（分钟）
  calculateDuration(start, end) {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  },

  // 检测时间冲突（返回有冲突的预定列表）
  detectConflicts(startTime, endTime, existingBookings, currentUserId) {
    const [newStartH, newStartM] = startTime.split(':').map(Number);
    const [newEndH, newEndM] = endTime.split(':').map(Number);
    const newStartMinutes = newStartH * 60 + newStartM;
    const newEndMinutes = newEndH * 60 + newEndM;

    // 只检测当前用户自己的预定冲突
    const userBookings = existingBookings.filter(b => b.user_id === currentUserId);
    const conflicts = [];

    userBookings.forEach(booking => {
      const [existStartH, existStartM] = booking.start_time.split(':').map(Number);
      const [existEndH, existEndM] = booking.end_time.split(':').map(Number);
      const existStartMinutes = existStartH * 60 + existStartM;
      const existEndMinutes = existEndH * 60 + existEndM;

      // 检测时间重叠：两个时间段有交集即冲突
      // 新时间段开始 < 旧时间段结束 AND 新时间段结束 > 旧时间段开始
      if (newStartMinutes < existEndMinutes && newEndMinutes > existStartMinutes) {
        conflicts.push(booking);
      }
    });

    return conflicts;
  },
};

// 甘特图渲染器
const ganttChart = {
  config: {
    hourWidth: 35,
    startHour: 8,
    endHour: 24,
    rowHeight: 45,
  },

  // 合并同一用户的重叠时间段
  mergeOverlappingBookings(bookings) {
    const userMap = new Map();

    // 按用户分组
    bookings.forEach(b => {
      if (!userMap.has(b.user_id)) userMap.set(b.user_id, []);
      userMap.get(b.user_id).push(b);
    });

    const merged = [];
    userMap.forEach(userBookings => {
      userBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));

      let current = { ...userBookings[0] };
      for (let i = 1; i < userBookings.length; i++) {
        const next = userBookings[i];
        const [curEndH, curEndM] = current.end_time.split(':').map(Number);
        const [nextStartH, nextStartM] = next.start_time.split(':').map(Number);

        // 检测重叠（结束时间 >= 下一个开始时间）
        if ((curEndH * 60 + curEndM) >= (nextStartH * 60 + nextStartM)) {
          // 合并
          const [nextEndH, nextEndM] = next.end_time.split(':').map(Number);
          if ((nextEndH * 60 + nextEndM) > (curEndH * 60 + curEndM)) {
            current.end_time = next.end_time;
          }
          current.remark = [current.remark, next.remark].filter(Boolean).join('; ');
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);
    });

    return merged.sort((a, b) => a.start_time.localeCompare(b.start_time));
  },

  // 计算位置和宽度
  calculateLayout(booking) {
    const [startH, startM] = booking.start_time.split(':').map(Number);
    const [endH, endM] = booking.end_time.split(':').map(Number);

    const startMinutes = (startH - this.config.startHour) * 60 + startM;
    const duration = (endH * 60 + endM) - (startH * 60 + startM);

    const left = Math.max(0, (startMinutes / 60) * this.config.hourWidth);
    const width = (duration / 60) * this.config.hourWidth;

    return { left, width };
  },

  // 渲染甘特图
  render(bookings, currentUserId) {
    // 按用户分组并合并重叠时间段
    const userMap = new Map();
    bookings.forEach(b => {
      if (!userMap.has(b.user_id)) userMap.set(b.user_id, []);
      userMap.get(b.user_id).push(b);
    });

    // 为每个用户合并重叠时间段
    const userRows = [];
    userMap.forEach((userBookings, userId) => {
      userBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));

      // 合并重叠时间段
      const merged = [];
      let current = { ...userBookings[0] };
      for (let i = 1; i < userBookings.length; i++) {
        const next = userBookings[i];
        const [curEndH, curEndM] = current.end_time.split(':').map(Number);
        const [nextStartH, nextStartM] = next.start_time.split(':').map(Number);

        if ((curEndH * 60 + curEndM) >= (nextStartH * 60 + nextStartM)) {
          const [nextEndH, nextEndM] = next.end_time.split(':').map(Number);
          if ((nextEndH * 60 + nextEndM) > (curEndH * 60 + curEndM)) {
            current.end_time = next.end_time;
          }
          current.remark = [current.remark, next.remark].filter(Boolean).join('; ');
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);

      // 保存该用户的行数据
      userRows.push({
        userId,
        username: userBookings[0].username || '未知用户',
        color: userBookings[0].color || '#3498db',
        timeSlots: merged,
      });
    });

    // 按第一个时间段开始时间排序行
    userRows.sort((a, b) => a.timeSlots[0].start_time.localeCompare(b.timeSlots[0].start_time));

    // 计算甘特图总宽度和动态高度
    const totalWidth = (this.config.endHour - this.config.startHour) * this.config.hourWidth;
    const bodyHeight = Math.max(200, userRows.length * this.config.rowHeight);

    let html = '<div class="gantt-chart"><div class="gantt-scroll-container">';

    // 渲染时间轴
    html += `<div class="timeline-header" style="width: ${totalWidth}px;">`;
    for (let h = this.config.startHour; h < this.config.endHour; h++) {
      html += `<div class="timeline-hour">${String(h).padStart(2, '0')}:00</div>`;
    }
    html += '</div>';

    // 渲染用户行
    html += `<div class="gantt-body" style="width: ${totalWidth}px; height: ${bodyHeight}px;">`;
    userRows.forEach((row, rowIndex) => {
      const rowTop = rowIndex * this.config.rowHeight;

      // 该用户的所有时间段条
      row.timeSlots.forEach(slot => {
        const { left, width } = this.calculateLayout(slot);
        const isOwnBooking = slot.user_id === currentUserId;

        // 根据宽度智能显示内容
        const minWidthForTime = 80;  // 最小显示时间的宽度
        const minWidthForRemark = 150; // 最小显示备注的宽度
        const showTime = width >= minWidthForTime;
        const showRemark = width >= minWidthForRemark && slot.remark;
        const isCompact = width < minWidthForTime;

        html += `
          <div class="gantt-bar ${isOwnBooking ? 'own-booking' : ''} ${isCompact ? 'gantt-bar-compact' : ''}"
            role="${isOwnBooking ? 'button' : 'article'}"
            ${isOwnBooking ? 'tabindex="0"' : ''}
            style="
            left: ${left}px;
            width: ${width}px;
            top: ${rowTop}px;
            background: ${row.color};
            opacity: 0.9;
            ${isOwnBooking ? 'cursor: pointer;' : ''}
          "
          data-id="${slot.id}"
          data-username="${row.username}"
          data-time="${slot.start_time}-${slot.end_time}"
          data-remark="${slot.remark || ''}"
          ${isOwnBooking ? `aria-label="删除预定: ${slot.start_time}-${slot.end_time}"` : ''}>
            <span class="gantt-bar-username">${isCompact ? row.username.charAt(0) : row.username}</span>
            ${showTime ? `<span class="gantt-bar-text">${slot.start_time}-${slot.end_time}</span>` : ''}
            ${showRemark ? `<span class="gantt-bar-remark">${slot.remark}</span>` : ''}

            <!-- Tactical Tooltip -->
            <div class="gantt-tooltip">
              <div class="gantt-tooltip-header">
                <i class="fas fa-user-shield"></i> ${row.username}
              </div>
              <div class="gantt-tooltip-time">
                <i class="fas fa-clock"></i> ${slot.start_time} - ${slot.end_time}
              </div>
              ${slot.remark ? `
                <div class="gantt-tooltip-remark">
                  <i class="fas fa-comment-dots"></i> ${slot.remark}
                </div>
              ` : ''}
              ${isOwnBooking ? `
                <div class="gantt-tooltip-action">
                  <i class="fas fa-trash-alt"></i> 点击删除此部署
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });
    });
    html += '</div></div></div>';

    return html;
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

  isTimePickerInitialized: false,

  // 渲染时间选择器
  renderTimePicker() {
    if (this.isTimePickerInitialized) return;

    const options = timeUtils.generateTimeOptions();
    let html = '<div class="form-group">';
    html += '<label><i class="fas fa-clock"></i> 作战时间段</label>';
    html += '<div class="time-picker-container">';
    html += '<select id="startTime" class="time-select"><option value="">开始时间</option>';
    options.forEach(o => html += `<option value="${o.value}">${o.label}</option>`);
    html += '</select>';
    html += '<span class="time-separator">至</span>';
    html += '<select id="endTime" class="time-select"><option value="">结束时间</option>';
    options.forEach(o => html += `<option value="${o.value}">${o.label}</option>`);
    html += '</select>';
    html += '</div>';
    html += '<div id="timeValidation" class="time-validation"></div>';
    html += '</div>';

    if (elements.timePickerContainer) {
      elements.timePickerContainer.innerHTML = html;
    }

    // 添加时间验证事件
    document.getElementById('startTime')?.addEventListener('change', validateTimeRange);
    document.getElementById('endTime')?.addEventListener('change', validateTimeRange);

    this.isTimePickerInitialized = true;
  },

  // 渲染统计数据
  renderStats() {
    const { stats } = appState;

    elements.stats.innerHTML = `
      <div class="stat-item">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">总部署数</div>
      </div>
    `;
  },

  // 渲染甘特图
  renderGanttChart() {
    if (appState.timeSlotBookings.length === 0) {
      elements.emptyBoard.style.display = "block";
      elements.boardContent.innerHTML = "";
      return;
    }

    elements.emptyBoard.style.display = "none";

    const html = ganttChart.render(appState.timeSlotBookings, appState.currentUser?.id);
    elements.boardContent.innerHTML = html;
  },

  // 渲染所有组件
  renderAll() {
    this.renderStats();
    this.renderGanttChart();
    this.renderAuthButton();

    // 更新登录提示状态
    if (elements.loginHint) {
      elements.loginHint.style.display = appState.isAuthenticated ? "none" : "block";
    }

    // resetBookingsBtn 事件绑定已移除
  },
};

// 数据加载函数
async function loadTimeSlotBookings(skipRender = false) {
  try {
    const result = await api.getTimeSlotBookings(appState.selectedDate);
    if (result.success) {
      appState.timeSlotBookings = result.bookings || [];
      appState.stats = result.stats || { total: 0 };
      if (!skipRender) render.renderAll();
    }
  } catch (error) {
    console.error("加载预定失败:", error);
    utils.showNotification("加载预定失败，请刷新页面重试", "error");
  }
}

// 时间范围验证函数
function validateTimeRange() {
  const start = document.getElementById('startTime')?.value;
  const end = document.getElementById('endTime')?.value;
  const el = document.getElementById('timeValidation');

  if (!start || !end) {
    if (el) el.textContent = '';
    return;
  }

  const validation = timeUtils.validateTimeRange(start, end);
  if (!validation.valid) {
    if (el) {
      el.textContent = validation.error;
      el.style.color = '#e74c3c';
    }
  } else {
    const duration = timeUtils.calculateDuration(start, end);
    if (el) {
      el.textContent = `时长：${Math.floor(duration / 60)}小时${duration % 60}分钟`;
      el.style.color = '#27ae60';
    }
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
        await loadTimeSlotBookings();
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
      await api.deleteTimeSlotBooking(bookingId);
      await loadTimeSlotBookings();
      utils.showNotification("预定已删除");
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

    const startTime = document.getElementById('startTime')?.value;
    const endTime = document.getElementById('endTime')?.value;
    const remark = document.getElementById('remark')?.value.trim();

    // 验证时间
    const validation = timeUtils.validateTimeRange(startTime, endTime);
    if (!validation.valid) {
      const el = document.getElementById('timeValidation');
      if (el) {
        el.textContent = validation.error;
        el.style.color = '#e74c3c';
      }
      return;
    }

    try {
      // 设置按钮加载状态
      utils.setButtonLoading(elements.submitBtn, true);

      // 检测时间冲突
      const conflicts = timeUtils.detectConflicts(
        startTime,
        endTime,
        appState.timeSlotBookings,
        appState.currentUser?.id
      );

      if (conflicts.length > 0) {
        // 有冲突，询问用户是否覆盖
        const conflictTimes = conflicts.map(c => `${c.start_time}-${c.end_time}`).join('、');
        const confirmed = confirm(
          `检测到时间冲突：\n${conflictTimes}\n\n是否覆盖原有预定？\n\n• 点击"确定"：删除原有预定，创建新预定\n• 点击"取消"：取消本次操作`
        );

        if (confirmed) {
          // 用户选择覆盖，先删除冲突的预定
          await this.handleOverwriteConflicts(conflicts, { startTime, endTime, remark });
        } else {
          // 用户取消
          utils.showNotification("已取消预定", "warning");
        }
        return;
      }

      // 无冲突，直接提交预定
      const result = await api.addTimeSlotBooking({ startTime, endTime, remark });

      if (result.success) {
        appState.timeSlotBookings = result.bookings || [];
        appState.stats = result.stats || appState.stats;

        // 重新渲染
        render.renderAll();

        // 显示成功通知
        utils.showNotification("预定成功！已添加到看板");

        // 重置表单
        document.getElementById('remark').value = '';
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
        const validationEl = document.getElementById('timeValidation');
        if (validationEl) validationEl.textContent = '';
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

  // 处理覆盖冲突预定
  async handleOverwriteConflicts(conflicts, newBooking) {
    try {
      // 并行执行删除请求
      await Promise.all(conflicts.map(conflict => api.deleteTimeSlotBooking(conflict.id)));

      // 创建新预定
      const result = await api.addTimeSlotBooking(newBooking);

      if (result.success) {
        appState.timeSlotBookings = result.bookings || [];
        appState.stats = result.stats || appState.stats;

        // 重新渲染
        render.renderAll();

        // 显示成功通知
        utils.showNotification(`已覆盖 ${conflicts.length} 条预定，新预定已创建`);

        // 重置表单
        document.getElementById('remark').value = '';
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
        const validationEl = document.getElementById('timeValidation');
        if (validationEl) validationEl.textContent = '';
      } else {
        utils.showNotification(result.error || "创建新预定失败", "error");
      }
    } catch (error) {
      console.error("覆盖预定失败:", error);
      utils.showNotification(error.message || "覆盖预定失败，请稍后重试", "error");
    }
  },

  // handleResetBookings 已移除

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

    // 甘特图条目点击事件委托
    elements.boardContent.addEventListener("click", (e) => {
      const bar = e.target.closest('.gantt-bar.own-booking');
      if (bar) {
        this.handleDeleteBooking(bar.dataset.id);
      }
    });

    // 甘特图条目键盘事件委托
    elements.boardContent.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const bar = e.target.closest('.gantt-bar.own-booking');
        if (bar) {
          e.preventDefault();
          this.handleDeleteBooking(bar.dataset.id);
        }
      }
    });
  },
};

// 初始化应用
async function initApp() {
  try {
    // 显示加载状态
    utils.showNotification("正在加载数据...", "warning", 2000);

    // 初始化事件监听
    handlers.initEventListeners();

    // 初始化时间选择器
    render.renderTimePicker();

    // 并行加载登录态和数据，仅在最后渲染一次
    const authPromise = authUtils.checkAuthStatus();
    const bookingsPromise = loadTimeSlotBookings(true);

    await Promise.allSettled([authPromise, bookingsPromise]);
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
  loadTimeSlotBookings();
});

window.addEventListener("offline", () => {
  utils.showNotification("网络已断开，部分功能可能受限", "error", 3000);
});
