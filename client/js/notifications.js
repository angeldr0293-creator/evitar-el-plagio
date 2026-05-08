(function () {
  const RECENT_LIMIT = 4;
  const SEEN_KEY = "oa_seen_notifications";
  const FLASH_KEY = "oa_flash_message";

  function escapeHTML(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (!value) {
      return "Ahora";
    }

    return new Intl.DateTimeFormat("es", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function getPanelUrl(user) {
    if (isAdminUser(user)) {
      return "admin.html";
    }

    if (isTeacherUser(user)) {
      return "profesor.html";
    }

    return "panel.html";
  }

  function getSeenState() {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  }

  function saveSeenState(state) {
    localStorage.setItem(SEEN_KEY, JSON.stringify(state));
  }

  function getNotificationKey(user) {
    return user ? `${user.role || "client"}:${user.id || user.email}` : "";
  }

  function getLatestNotificationDate(notifications) {
    return notifications[0] && notifications[0].date ? notifications[0].date : "";
  }

  function getPlanName(plan) {
    return {
      inicial: "Inicial",
      academico: "Académico",
      premium: "Premium"
    }[plan] || plan || "plan";
  }

  function byNewest(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
  }

  function buildClientNotifications(user) {
    return getCurrentUserRequests().map((request) => {
      const statusLabel = getClientRequestStatusLabel(request);
      const ready = statusLabel === "Listo" || statusLabel === "Entregado";
      return {
        title: ready ? "Tu trabajo está listo" : `Tu solicitud está ${statusLabel.toLowerCase()}`,
        text: request.documentType || "Documento académico",
        date: request.updatedAt || request.deliveredAt || request.assignedAt || request.createdAt,
        tone: ready ? "success" : "info"
      };
    });
  }

  function buildTeacherNotifications(user) {
    const requests = getTeacherRequests().map((request) => ({
      title: `Trabajo ${getTeacherRequestStatusLabel(request.status).toLowerCase()}`,
      text: `${request.user && request.user.name ? request.user.name : "Cliente"} · ${request.documentType || "Documento académico"}`,
      date: request.updatedAt || request.assignedAt || request.createdAt,
      tone: request.status === "Lista" || request.status === "Entrega subida" || request.status === "Entregada" ? "success" : "info"
    }));

    const assignedClientIds = new Set(getTeacherRequests().map((request) => request.userId));
    const usersById = getUsers().reduce((result, item) => {
      result[item.id] = item;
      return result;
    }, {});

    const subscriptions = getSubscriptions()
      .filter((subscription) => assignedClientIds.has(subscription.userId))
      .map((subscription) => ({
        title: "Cliente suscrito",
        text: `${usersById[subscription.userId] ? usersById[subscription.userId].name : "Cliente"} vuelve con su profesor asignado`,
        date: subscription.createdAt,
        tone: "success"
      }));

    return requests.concat(subscriptions);
  }

  function buildAdminNotifications() {
    const usersById = getUsers().reduce((result, item) => {
      result[item.id] = item;
      return result;
    }, {});

    const workNotifications = getRequests().map((request) => ({
      title: "Ha llegado un trabajo",
      text: `${usersById[request.userId] ? usersById[request.userId].name : "Cliente"} · ${request.documentType || "Documento académico"}`,
      date: request.createdAt,
      tone: "info"
    }));

    const subscriptionNotifications = getSubscriptions().map((subscription) => ({
      title: "Cliente suscrito",
      text: `${usersById[subscription.userId] ? usersById[subscription.userId].name : "Cliente"} contrató ${getPlanName(subscription.plan)}`,
      date: subscription.createdAt,
      tone: "success"
    }));

    return workNotifications.concat(subscriptionNotifications);
  }

  function getNotifications(user) {
    if (isAdminUser(user)) {
      return buildAdminNotifications().sort(byNewest);
    }

    if (isTeacherUser(user)) {
      return buildTeacherNotifications(user).sort(byNewest);
    }

    return buildClientNotifications(user).sort(byNewest);
  }

  function renderItems(items) {
    if (!items.length) {
      return `
        <div class="notification-empty">
          <strong>Sin notificaciones recientes</strong>
          <span>Cuando haya novedades importantes, aparecerán aquí.</span>
        </div>
      `;
    }

    return items.map((item) => `
      <article class="notification-item ${item.tone === "success" ? "is-success" : ""}">
        <span class="notification-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHTML(item.title)}</strong>
          <p>${escapeHTML(item.text)}</p>
          <time>${escapeHTML(formatDateTime(item.date))}</time>
        </div>
      </article>
    `).join("");
  }

  function mountNotifications() {
    const user = getCurrentUser();
    const nav = document.querySelector(".nav");
    const target = document.querySelector(".notification-target")
      || document.querySelector(".nav-tools")
      || document.querySelector(".nav-actions")
      || document.querySelector(".nav-links");

    if (!user || !nav || document.querySelector(".notification-bell")) {
      return;
    }

    const panelUrl = getPanelUrl(user);
    const notifications = getNotifications(user);
    const visibleItems = notifications.slice(0, RECENT_LIMIT);
    const allItems = notifications;
    const seenState = getSeenState();
    const notificationKey = getNotificationKey(user);
    const seenLatestDate = seenState[notificationKey] || "";
    const unreadCount = Math.min(notifications.filter((item) => (
      item.date && (!seenLatestDate || new Date(item.date) > new Date(seenLatestDate))
    )).length, 9);
    const host = document.createElement("div");

    host.className = "notification-bell";
    host.innerHTML = `
      <button class="notification-trigger" type="button" aria-label="Abrir notificaciones" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        ${unreadCount ? `<span class="notification-count">${unreadCount}</span>` : ""}
      </button>
      <div class="notification-menu" role="dialog" aria-label="Notificaciones recientes">
        <div class="notification-head">
          <strong>Notificaciones</strong>
          <span>${notifications.length ? `${notifications.length} recientes` : "Al día"}</span>
        </div>
        <div class="notification-list" data-short="${escapeHTML(renderItems(visibleItems))}" data-full="${escapeHTML(renderItems(allItems))}">
          ${renderItems(visibleItems)}
        </div>
        <div class="notification-footer">
          <button class="notification-more" type="button" ${notifications.length <= RECENT_LIMIT ? "disabled" : ""}>Ver más</button>
          <a href="${panelUrl}">Ir al panel</a>
        </div>
      </div>
    `;

    if (target) {
      target.insertBefore(host, target.firstChild);
    } else {
      nav.appendChild(host);
    }

    const trigger = host.querySelector(".notification-trigger");
    const more = host.querySelector(".notification-more");
    const list = host.querySelector(".notification-list");
    const count = host.querySelector(".notification-count");

    function markAsSeen() {
      const latestDate = getLatestNotificationDate(notifications);

      if (!latestDate || !notificationKey) {
        return;
      }

      seenState[notificationKey] = latestDate;
      saveSeenState(seenState);
      count?.remove();
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = host.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(isOpen));

      if (isOpen) {
        markAsSeen();
      }
    });

    host.addEventListener("mouseenter", markAsSeen);

    more.addEventListener("click", () => {
      const expanded = list.dataset.expanded === "true";
      list.innerHTML = expanded ? list.dataset.short : list.dataset.full;
      list.dataset.expanded = String(!expanded);
      more.textContent = expanded ? "Ver más" : "Ver menos";
    });

    document.addEventListener("click", (event) => {
      if (!host.contains(event.target)) {
        host.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  function showToast(message, tone = "success") {
    const toast = document.createElement("div");
    toast.className = `screen-toast ${tone === "error" ? "is-error" : ""}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 250);
    }, 3600);
  }

  function showPendingFlash() {
    const message = sessionStorage.getItem(FLASH_KEY);

    if (!message) {
      return;
    }

    sessionStorage.removeItem(FLASH_KEY);
    showToast(message);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountNotifications();
      showPendingFlash();
    });
  } else {
    mountNotifications();
    showPendingFlash();
  }

  window.refreshNotifications = function () {
    document.querySelector(".notification-bell")?.remove();
    mountNotifications();
  };

  window.showScreenNotification = showToast;
  window.queueScreenNotification = function (message) {
    sessionStorage.setItem(FLASH_KEY, message);
  };
})();
