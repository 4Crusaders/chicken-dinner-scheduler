// API配置
const API_BASE_URL = "/api"; // Cloudflare Pages Functions路径

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
};

// DOM元素
const elements = {
  bookingForm: document.getElementById("bookingForm"),
  sessionOptions: document.getElementById("sessionOptions"),
  stats: document.getElementById("stats"),
  filterButtons: document.getElementById("filterButtons"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  bookingsList: document.getElementById("bookingsList"),
  emptyBoard: document.getElementById("emptyBoard"),
  notification: document.getElementById("notification"),
  submitBtn: document.getElementById("submitBtn"),
  nameInput: document.getElementById("name"),
};

// API服务
const api = {
  // 通用请求方法
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultOptions = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await fetch(url, {
        ...defaultOptions,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  // 清空所有预定
  async clearAllBookings() {
    return await this.request("/bookings", {
      method: "DELETE",
    });
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
    const date = new Date(dateString);
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
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.innerHTML = '<span class="loading"></span> 处理中...';
    } else {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-paper-plane"></i> 提交预定';
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

      html += `
                        <div class="booking-item">
                            <div class="booking-header">
                                <div class="booking-name">
                                    <i class="fas fa-user-circle"></i> ${booking.name}
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
                        </div>
                    `;
    });

    elements.bookingsList.innerHTML = html;
  },

  // 渲染所有组件
  renderAll() {
    this.renderSessionOptions();
    this.renderStats();
    this.renderFilterButtons();
    this.renderBookingsList();
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
  // 处理表单提交
  async handleFormSubmit(e) {
    e.preventDefault();

    const nameInput = elements.nameInput;
    const remarkInput = document.getElementById("remark");

    // 验证姓名
    if (!nameInput.value.trim()) {
      utils.showNotification("请填写预定人姓名", "warning");
      nameInput.focus();
      return;
    }

    // 创建预定对象
    const booking = {
      name: nameInput.value.trim(),
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
        nameInput.value = "";
        remarkInput.value = "";
        nameInput.focus();
      } else {
        utils.showNotification(result.error || "预定失败", "error");
      }
    } catch (error) {
      console.error("提交预定失败:", error);
      utils.showNotification("提交预定失败，请稍后重试", "error");
    } finally {
      // 恢复按钮状态
      utils.setButtonLoading(elements.submitBtn, false);
    }
  },

  // 处理清空所有预定
  async handleClearAll() {
    if (appState.bookings.length === 0) {
      utils.showNotification("没有预定记录可清空", "warning");
      return;
    }

    if (!confirm("确定要清空所有预定记录吗？此操作不可恢复。")) {
      return;
    }

    try {
      const result = await api.clearAllBookings();

      if (result.success) {
        // 更新应用状态
        appState.bookings = [];
        appState.stats = result.stats || appState.stats;

        // 重新渲染
        render.renderAll();

        // 显示成功通知
        utils.showNotification(result.message || "已清空所有预定记录");
      } else {
        utils.showNotification(result.error || "清空失败", "error");
      }
    } catch (error) {
      console.error("清空预定失败:", error);
      utils.showNotification("清空预定失败，请稍后重试", "error");
    }
  },

  // 初始化事件监听
  initEventListeners() {
    // 表单提交事件
    elements.bookingForm.addEventListener("submit", (e) => {
      this.handleFormSubmit(e);
    });

    // 清空按钮事件
    elements.clearAllBtn.addEventListener("click", () => {
      this.handleClearAll();
    });

    // 页面加载时焦点放在姓名输入框
    elements.nameInput.focus();
  },
};

// 初始化应用
async function initApp() {
  try {
    // 显示加载状态
    utils.showNotification("正在加载数据...", "warning", 2000);

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
