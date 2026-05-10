const AUTH_USER_KEY = "oa_current_user";
const AUTH_USERS_KEY = "oa_users";
const AUTH_REQUESTS_KEY = "oa_requests";
const AUTH_SUBSCRIPTIONS_KEY = "oa_subscriptions";
const SHARED_KEYS = [AUTH_USERS_KEY, AUTH_REQUESTS_KEY, AUTH_SUBSCRIPTIONS_KEY];

function getApiBaseUrl() {
  return (window.OA_API_BASE_URL || "").replace(/\/$/, "");
}

function createApiEndpoints(pathname) {
  const baseUrl = getApiBaseUrl();
  return baseUrl ? [`${baseUrl}${pathname}`, pathname] : [pathname];
}

const API_STATE_ENDPOINTS = createApiEndpoints("/api/state");
const API_REGISTER_ENDPOINTS = createApiEndpoints("/api/register");
const API_LOGIN_ENDPOINTS = createApiEndpoints("/api/login");
const API_ADMIN_LOGIN_ENDPOINTS = createApiEndpoints("/api/admin/login");
const API_ADMIN_EMAIL_CHECK_ENDPOINTS = createApiEndpoints("/api/admin/email-check");
const API_LOGOUT_ENDPOINTS = createApiEndpoints("/api/logout");
let sharedStateCache = null;
let sharedStateCacheAt = 0;
const SHARED_STATE_CACHE_MS = 500;

function clearSharedStateCache() {
  sharedStateCache = null;
  sharedStateCacheAt = 0;
}

function postApiAction(pathname, payload = {}) {
  const result = postJSONToFirstEndpoint(createApiEndpoints(pathname), payload);
  clearSharedStateCache();

  if (!result || !result.ok) {
    throw new Error(result?.error || "No se pudo completar la solicitud.");
  }

  return result;
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSubscriberId(user) {
  if (!user) {
    return "";
  }

  if (user.subscriberId) {
    return user.subscriberId;
  }

  let hash = 0;
  String(user.id || user.email || "").split("").forEach((char) => {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  });

  return `ZC-${hash.toString(16).padStart(8, "0").slice(0, 8).toUpperCase()}`;
}

function getDefaultSharedValue(key) {
  return SHARED_KEYS.includes(key) ? [] : null;
}

function getSharedState() {
  if (sharedStateCache && Date.now() - sharedStateCacheAt < SHARED_STATE_CACHE_MS) {
    return sharedStateCache;
  }

  for (const endpoint of API_STATE_ENDPOINTS) {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", endpoint, false);
      request.withCredentials = true;
      request.send();

      if (request.status >= 200 && request.status < 300) {
        sharedStateCache = JSON.parse(request.responseText || "{}");
        sharedStateCacheAt = Date.now();
        return sharedStateCache;
      }
    } catch (error) {
      // Se prueba el siguiente endpoint disponible.
    }
  }

  return null;
}

function saveSharedState(state) {
  for (const endpoint of API_STATE_ENDPOINTS) {
    try {
      const request = new XMLHttpRequest();
      request.open("POST", endpoint, false);
      request.setRequestHeader("Content-Type", "application/json");
      request.withCredentials = true;
      request.send(JSON.stringify(state));
      if (request.status >= 200 && request.status < 300) {
        sharedStateCache = state;
        sharedStateCacheAt = Date.now();
        return true;
      }
    } catch (error) {
      // Se prueba el siguiente endpoint disponible.
    }
  }

  return false;
}

function postJSONToFirstEndpoint(endpoints, payload) {
  for (const endpoint of endpoints) {
    try {
      const request = new XMLHttpRequest();
      request.open("POST", endpoint, false);
      request.setRequestHeader("Content-Type", "application/json");
      request.withCredentials = true;
      request.send(JSON.stringify(payload));

      if (request.status >= 200 && request.status < 300) {
        return JSON.parse(request.responseText || "{}");
      }

      if (request.status >= 400) {
        const error = JSON.parse(request.responseText || "{}");
        return { ok: false, error: error.error || "No se pudo completar la solicitud." };
      }
    } catch (error) {
      // Se prueba el siguiente endpoint disponible.
    }
  }

  return null;
}

function loginAdminUser(email, password) {
  const result = postJSONToFirstEndpoint(API_ADMIN_LOGIN_ENDPOINTS, { email, password });

  if (!result || !result.ok || !result.user) {
    return null;
  }

  setCurrentUser(result.user);
  return result.user;
}

function registerClientUser(data) {
  const result = postJSONToFirstEndpoint(API_REGISTER_ENDPOINTS, data);

  if (!result || !result.ok || !result.user) {
    throw new Error(result?.error || "No se pudo crear la cuenta.");
  }

  setCurrentUser(result.user);
  return result.user;
}

function loginClientUser(email, password) {
  const result = postJSONToFirstEndpoint(API_LOGIN_ENDPOINTS, { email, password });

  if (!result || !result.ok || !result.user) {
    throw new Error(result?.error || "Correo o contraseña incorrectos.");
  }

  setCurrentUser(result.user);
  return result.user;
}

function isReservedAdminEmail(email) {
  const result = postJSONToFirstEndpoint(API_ADMIN_EMAIL_CHECK_ENDPOINTS, { email });
  return Boolean(result && result.matches);
}

function getSharedItem(key) {
  const state = getSharedState();
  const fallback = JSON.parse(localStorage.getItem(key) || JSON.stringify(getDefaultSharedValue(key)));

  if (!state) {
    return fallback;
  }

  if (!Array.isArray(state[key]) && fallback) {
    return fallback;
  }

  return state[key] || getDefaultSharedValue(key);
}

function setSharedItem(key, value) {
  const state = getSharedState();
  let savedLocally = true;

  try {
    if (key !== AUTH_USERS_KEY) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    // Los adjuntos pueden superar el limite de localStorage; el servidor compartido queda como fuente principal.
    savedLocally = false;
  }

  if (!state) {
    if (!savedLocally) {
      throw new Error("No se pudo guardar porque el almacenamiento local está lleno y el servidor compartido no respondió.");
    }

    return;
  }

  state[key] = value;

  if (!saveSharedState(state)) {
    throw new Error("No se pudo guardar en el servidor compartido.");
  }
}

function getUsers() {
  return getSharedItem(AUTH_USERS_KEY);
}

function saveUsers(users) {
  setSharedItem(AUTH_USERS_KEY, users);
}

function getCurrentUser() {
  localStorage.removeItem("oa_auth_token");
  const storedUser = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");

  if (!storedUser) {
    return null;
  }

  if (storedUser.role === "admin") {
    return storedUser;
  }

  const storedEmail = String(storedUser.email || "").toLowerCase();
  const savedUser = getUsers().find((user) => (
    user.id === storedUser.id
    || (storedEmail && String(user.email || "").toLowerCase() === storedEmail)
  ));

  if (!savedUser) {
    return storedUser;
  }

  const normalizedUser = {
    id: savedUser.id,
    name: savedUser.name,
    email: savedUser.email,
    phone: savedUser.phone,
    subscriberId: getSubscriberId(savedUser),
    role: savedUser.role || "client"
  };

  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
  return normalizedUser;
}

function setCurrentUser(user) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function logout() {
  postJSONToFirstEndpoint(API_LOGOUT_ENDPOINTS, {});
  localStorage.removeItem(AUTH_USER_KEY);
  window.location.href = "index.html";
}

function authText(text) {
  return window.OAI18N ? window.OAI18N.t(text) : text;
}

function setupAuthLinks() {
  document.querySelectorAll("[data-auth-link]").forEach((link) => {
    const user = getCurrentUser();

    if (!user) {
      link.textContent = authText("Iniciar sesión / Registrarse");
      link.href = "registro.html";
      return;
    }

    link.textContent = authText("Cerrar sesión");
    link.href = "#";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
  });

  setupCreditBadges();
}

function getPlanCreditConfig() {
  return {
    inicial: { credits: 50, pages: 25 },
    academico: { credits: 100, pages: 50 },
    premium: { credits: 200, pages: 100 }
  };
}

function getPlanFinanceConfig() {
  return {
    inicial: { name: "Inicial", price: 14.99, includedPages: 25, teacherShare: 0.5, platformShare: 0.5 },
    academico: { name: "Académico", price: 21.99, includedPages: 50, teacherShare: 0.5, platformShare: 0.5 },
    premium: { name: "Premium", price: 36.99, includedPages: 100, teacherShare: 0.5, platformShare: 0.5 }
  };
}

function isPaidSubscription(subscription) {
  return Boolean(subscription && (
    subscription.status === "Pagado"
    || subscription.status === "Activa"
  ) && (!subscription.expiresAt || new Date(subscription.expiresAt) >= new Date()));
}

function getPlanValuePerPage(config) {
  return config && config.includedPages ? config.price / config.includedPages : 0;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 7);
}

function getDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function isRequestDelivered(request) {
  return Boolean(request && (
    request.status === "Lista"
    || request.status === "Entrega subida"
    || request.status === "Entregada"
    || request.delivery
    || request.deliveredAt
  ));
}

function getRequestDeliveredAt(request) {
  return request?.deliveredAt || request?.updatedAt || request?.createdAt || "";
}

function getRequestFinance(request) {
  const config = getPlanFinanceConfig()[request?.package] || getPlanFinanceConfig().academico;
  const pages = getRequestPages(request);
  const clientPerPage = getPlanValuePerPage(config);
  const teacherPerPage = clientPerPage * config.teacherShare;
  const platformPerPage = clientPerPage * config.platformShare;
  const teacherTotal = pages * teacherPerPage;
  const gross = pages * clientPerPage;

  return {
    plan: request?.package || "creditos",
    planName: config.name,
    pages,
    clientPerPage,
    teacherPerPage,
    platformPerPage,
    teacherShare: config.teacherShare,
    platformShare: config.platformShare,
    gross,
    teacherTotal,
    adminNet: pages * platformPerPage
  };
}

function getDeliveredRequestsForMonth(requests, monthKey = getMonthKey()) {
  return requests.filter((request) => (
    isRequestDelivered(request) && getMonthKey(getRequestDeliveredAt(request)) === monthKey
  ));
}

function summarizeDeliveredRequests(requests) {
  return requests.reduce((summary, request) => {
    const finance = getRequestFinance(request);
    summary.pages += finance.pages;
    summary.gross += finance.gross;
    summary.teacherTotal += finance.teacherTotal;
    summary.adminNet += finance.adminNet;
    summary.works += 1;
    return summary;
  }, { pages: 0, gross: 0, teacherTotal: 0, adminNet: 0, works: 0 });
}

function getRequestPages(request) {
  const directPages = Number(request.pages);

  if (Number.isFinite(directPages) && directPages > 0) {
    return directPages;
  }

  if (Array.isArray(request.pageDetails)) {
    return request.pageDetails.reduce((total, item) => total + (Number(item.pages) || 0), 0);
  }

  return 0;
}

function getClientCreditSummary(requests = getCurrentUserRequests(), subscriptions = getCurrentUserSubscriptions()) {
  const planCredits = getPlanCreditConfig();
  const paidSubscriptions = subscriptions.filter(isPaidSubscription);
  const purchasedCredits = paidSubscriptions.reduce((total, subscription) => (
    total + (planCredits[subscription.plan]?.credits || 0)
  ), 0);
  const purchasedPages = paidSubscriptions.reduce((total, subscription) => (
    total + (planCredits[subscription.plan]?.pages || 0)
  ), 0);
  const inferredPlans = paidSubscriptions.length || subscriptions.length ? [] : requests.map((request) => request.package);
  const inferredCredits = inferredPlans.reduce((total, plan) => total + (planCredits[plan]?.credits || 0), 0);
  const inferredPages = inferredPlans.reduce((total, plan) => total + (planCredits[plan]?.pages || 0), 0);
  const totalCredits = purchasedCredits || inferredCredits;
  const totalPages = purchasedPages || inferredPages;
  const usedPages = requests.reduce((total, request) => total + getRequestPages(request), 0);
  const usedCredits = usedPages * 2;
  const availableCredits = Math.max(totalCredits - usedCredits, 0);

  return {
    availableCredits,
    availablePages: Math.floor(availableCredits / 2),
    totalCredits,
    totalPages,
    usedCredits,
    percentage: totalCredits ? Math.round((availableCredits / totalCredits) * 100) : 0
  };
}

function setupCreditBadges() {
  const user = getCurrentUser();
  const nav = document.querySelector(".nav");

  if (!nav || !user || isAdminUser(user) || isTeacherUser(user)) {
    document.querySelectorAll(".header-credits").forEach((badge) => badge.remove());
    return;
  }

  let badge = document.querySelector(".header-credits");
  const summary = getClientCreditSummary();

  if (!badge) {
    badge = document.createElement("div");
    badge.className = "header-credits";
    badge.setAttribute("aria-label", "Créditos disponibles");
    badge.innerHTML = `
      <span class="credit-gem-mini" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 5.5h8l3.5 4.2L12 18.5 4.5 9.7 8 5.5Z"></path><path d="M4.5 9.7h15"></path><path d="M9 9.7 12 18.5l3-8.8"></path><path d="M8 5.5 9 9.7"></path><path d="M16 5.5 15 9.7"></path></svg>
      </span>
      <span class="header-credits-count"></span>
    `;

  }

  const authLink = document.querySelector("[data-auth-link]");
  const logoutButton = document.querySelector(".nav-actions button[onclick*='logout']");
  const creditsTarget = document.querySelector(".credits-target");
  const accountControl = authLink || logoutButton;

  if (creditsTarget) {
    creditsTarget.appendChild(badge);
  } else if (accountControl) {
    let accountGroup = accountControl.closest(".nav-account-group");

    if (!accountGroup) {
      accountGroup = document.createElement("span");
      accountGroup.className = "nav-account-group";
      accountControl.parentNode.insertBefore(accountGroup, accountControl);
      accountGroup.appendChild(accountControl);
    }

    accountGroup.appendChild(badge);
  } else if (!badge.parentNode) {
    const anchor = document.querySelector(".nav-actions") || document.querySelector(".nav-links") || document.querySelector(".nav-toggle");
    if (anchor) {
      nav.insertBefore(badge, anchor);
    } else {
      nav.appendChild(badge);
    }
  }

  badge.querySelector(".header-credits-count").textContent = authText(`${summary.availableCredits} créditos`);
}

function isAdminUser(user = getCurrentUser()) {
  return Boolean(user && user.role === "admin");
}

function isTeacherUser(user = getCurrentUser()) {
  return Boolean(user && user.role === "teacher");
}

function getRequests() {
  return getSharedItem(AUTH_REQUESTS_KEY);
}

function saveRequests(requests) {
  setSharedItem(AUTH_REQUESTS_KEY, requests);
}

function getSubscriptions() {
  return getSharedItem(AUTH_SUBSCRIPTIONS_KEY);
}

function saveSubscriptions(subscriptions) {
  setSharedItem(AUTH_SUBSCRIPTIONS_KEY, subscriptions);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function registerUser(data) {
  return registerClientUser(data);
}

function loginUser(email, password) {
  const admin = loginAdminUser(email, password);

  if (admin) {
    return admin;
  }

  return loginClientUser(email, password);
}

function getTeachers() {
  return getUsers().filter((user) => user.role === "teacher");
}

function createTeacherUser(data) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede crear profesores.");
  }

  return postApiAction("/api/teachers", data).user;
}

function resetTeacherPassword(teacherId, password) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede cambiar contraseñas de profesores.");
  }

  return postApiAction(`/api/users/${encodeURIComponent(teacherId)}/password`, { password }).user;
}

function resetClientPassword(clientId, password) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede cambiar contraseñas de clientes.");
  }

  return postApiAction(`/api/users/${encodeURIComponent(clientId)}/password`, { password }).user;
}

function updateUserProfile(userId, data) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede editar usuarios.");
  }

  return postApiAction(`/api/users/${encodeURIComponent(userId)}`, data).user;
}

function changeOwnPassword(currentPassword, newPassword) {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("Debes iniciar sesion.");
  }

  return postApiAction("/api/me/password", { currentPassword, newPassword }).user;
}

function registerSubscription(plan, paymentData = "") {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("Debes iniciar sesión para guardar la suscripción.");
  }

  const payload = typeof paymentData === "object" && paymentData
    ? { plan, ...paymentData }
    : { plan, paymentToken: paymentData };

  return postApiAction("/api/subscriptions", payload).subscription;
}

function createAdminSubscription(data) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede crear pagos.");
  }

  return postApiAction("/api/admin/subscriptions", data).subscription;
}

function updateAdminSubscription(subscriptionId, data) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede actualizar pagos.");
  }

  return postApiAction(`/api/subscriptions/${encodeURIComponent(subscriptionId)}`, data).subscription;
}

function sendUrgentClientEmail(userId, data) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede enviar correos urgentes.");
  }

  return postApiAction("/api/admin/urgent-email", { userId, ...data });
}

function registerPendingSubscription() {
  const allowedPlans = ["inicial", "academico", "premium"];
  const plan = sessionStorage.getItem("oa_selected_plan");
  const paymentToken = sessionStorage.getItem("oa_payment_token");
  const paymentData = JSON.parse(sessionStorage.getItem("oa_payment_data") || "{}");

  if (!allowedPlans.includes(plan) || !paymentToken || !getCurrentUser()) {
    return null;
  }

  return registerSubscription(plan, { ...paymentData, paymentToken, transactionId: paymentData.transactionId || paymentToken });
}

function createRequest(data) {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("Debes iniciar sesión para guardar tu solicitud.");
  }

  return postApiAction("/api/requests", data).request;
}

function getCurrentUserRequests() {
  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  return getRequests().filter((request) => request.userId === user.id);
}

function getCurrentUserSubscriptions() {
  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  return getSubscriptions().filter((subscription) => subscription.userId === user.id);
}

function getAdminRequests() {
  if (!isAdminUser()) {
    return [];
  }

  const usersById = getUsers().reduce((result, user) => {
    result[user.id] = user;
    return result;
  }, {});

  return getRequests().map((request) => ({
    ...request,
    user: usersById[request.userId] || null
  }));
}

function getAdminClients() {
  if (!isAdminUser()) {
    return [];
  }

  const requests = getRequests();
  const subscriptions = getSubscriptions();

  return getUsers().filter((user) => (user.role || "client") === "client").map((client) => {
    const clientRequests = requests.filter((request) => request.userId === client.id);
    const savedSubscriptions = subscriptions.filter((subscription) => subscription.userId === client.id);
    const inferredSubscriptions = savedSubscriptions.length ? [] : clientRequests.map((request) => ({
      id: `inferred-${request.id}`,
      userId: client.id,
      plan: request.package,
      status: "Pagado",
      paymentToken: "",
      createdAt: request.createdAt,
      startsAt: request.createdAt,
      expiresAt: addDays(request.createdAt, 30).toISOString(),
      inferred: true
    }));
    const clientSubscriptions = savedSubscriptions.length ? savedSubscriptions : inferredSubscriptions;
    const latestSubscription = clientSubscriptions[0] || null;
    const teacher = client.teacherId
      ? getTeachers().find((item) => item.id === client.teacherId) || null
      : null;

    return {
      ...client,
      teacher,
      requests: clientRequests,
      subscriptions: clientSubscriptions,
      latestSubscription,
      activeSubscription: clientSubscriptions.find(isPaidSubscription) || null
    };
  });
}

function updateRequestStatus(requestId, status) {
  const user = getCurrentUser();
  const request = getRequests().find((item) => item.id === requestId);
  const canUpdate = isAdminUser(user) || (isTeacherUser(user) && request && request.teacherId === user.id);

  if (!canUpdate) {
    throw new Error("No tienes permiso para cambiar solicitudes.");
  }

  return postApiAction(`/api/requests/${encodeURIComponent(requestId)}/status`, { status }).request;
}

function saveTeacherDelivery(requestId, delivery) {
  const user = getCurrentUser();
  const request = getRequests().find((item) => item.id === requestId);
  const canDeliver = user && user.role === "teacher" && request && request.teacherId === user.id;

  if (!canDeliver) {
    throw new Error("Solo el profesor asignado puede subir la entrega.");
  }

  return postApiAction(`/api/requests/${encodeURIComponent(requestId)}/delivery`, { delivery }).request;
}

function assignRequestToTeacher(requestId, teacherId) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede asignar trabajos.");
  }

  return postApiAction(`/api/requests/${encodeURIComponent(requestId)}/teacher`, { teacherId }).request;
}

function getClientRequestStatusLabel(request, subscriptions = getCurrentUserSubscriptions()) {
  const subscription = request.subscriptionId
    ? subscriptions.find((item) => item.id === request.subscriptionId)
    : null;

  if (subscription && subscription.status === "Pendiente") {
    return "Pendiente de pago";
  }

  return {
    "Pendiente de pago": "Pendiente de pago",
    Recibida: "Recibido",
    Asignada: "Asignado",
    Visto: "En proceso",
    Trabajando: "En proceso",
    "En proceso": "En proceso",
    Lista: "Listo",
    "Entrega subida": "Entregado",
    Entregada: "Entregado"
  }[request.status] || request.status || "Recibido";
}

function getTeacherRequestStatusLabel(status) {
  return {
    Recibida: "Asignado",
    Asignada: "Asignado",
    Visto: "Descargado/visto",
    Trabajando: "Trabajando",
    "En proceso": "Trabajando",
    Lista: "Entrega subida",
    "Entrega subida": "Entrega subida",
    Entregada: "Entrega subida"
  }[status] || status || "Asignado";
}

function clearClientTeacher(clientId) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede quitar profesores responsables.");
  }

  return postApiAction(`/api/users/${encodeURIComponent(clientId)}/teacher`, { teacherId: "" }).user;
}

function getTeacherRequests() {
  const user = getCurrentUser();

  if (!isTeacherUser(user)) {
    return [];
  }

  const usersById = getUsers().reduce((result, item) => {
    result[item.id] = item;
    return result;
  }, {});

  return getRequests()
    .filter((request) => request.teacherId === user.id)
    .map((request) => ({
      ...request,
      user: usersById[request.userId] || null
    }));
}
