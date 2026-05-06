const AUTH_USER_KEY = "oa_current_user";
const AUTH_USERS_KEY = "oa_users";
const AUTH_REQUESTS_KEY = "oa_requests";
const AUTH_SUBSCRIPTIONS_KEY = "oa_subscriptions";
const ADMIN_EMAIL = "admin@originalidad.com";
const ADMIN_PASSWORD = "Admin2026!";
const SHARED_KEYS = [AUTH_USERS_KEY, AUTH_REQUESTS_KEY, AUTH_SUBSCRIPTIONS_KEY];
const API_STATE_ENDPOINTS = [
  "/api/state",
  "http://127.0.0.1:5173/api/state",
  "http://localhost:5173/api/state"
];

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultSharedValue(key) {
  return SHARED_KEYS.includes(key) ? [] : null;
}

function getSharedState() {
  for (const endpoint of API_STATE_ENDPOINTS) {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", endpoint, false);
      request.send();

      if (request.status >= 200 && request.status < 300) {
        return JSON.parse(request.responseText || "{}");
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
      request.send(JSON.stringify(state));
      if (request.status >= 200 && request.status < 300) {
        return true;
      }
    } catch (error) {
      // Se prueba el siguiente endpoint disponible.
    }
  }

  return false;
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
    localStorage.setItem(key, JSON.stringify(value));
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
  const storedUser = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");

  if (!storedUser) {
    return null;
  }

  if (storedUser.role === "admin") {
    return storedUser;
  }

  const savedUser = getUsers().find((user) => (
    user.id === storedUser.id || user.email.toLowerCase() === storedUser.email.toLowerCase()
  ));

  if (!savedUser) {
    return storedUser;
  }

  const normalizedUser = {
    id: savedUser.id,
    name: savedUser.name,
    email: savedUser.email,
    phone: savedUser.phone,
    role: savedUser.role || "client"
  };

  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
  return normalizedUser;
}

function setCurrentUser(user) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function logout() {
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
  const purchasedCredits = subscriptions.reduce((total, subscription) => (
    total + (planCredits[subscription.plan]?.credits || 0)
  ), 0);
  const purchasedPages = subscriptions.reduce((total, subscription) => (
    total + (planCredits[subscription.plan]?.pages || 0)
  ), 0);
  const inferredPlans = subscriptions.length ? [] : requests.map((request) => request.package);
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
  const accountControl = authLink || logoutButton;

  if (accountControl) {
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
  const users = getUsers();
  const exists = users.some((user) => user.email.toLowerCase() === data.email.toLowerCase())
    || data.email.toLowerCase() === ADMIN_EMAIL;

  if (exists) {
    throw new Error("Ya existe una cuenta con este correo.");
  }

  const user = {
    id: createId(),
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    password: data.password,
    role: "client",
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);
  setCurrentUser({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });

  return user;
}

function loginUser(email, password) {
  if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const admin = {
      id: "admin",
      name: "Administrador",
      email: ADMIN_EMAIL,
      role: "admin"
    };

    setCurrentUser(admin);
    return admin;
  }

  const user = getUsers().find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!user) {
    throw new Error("Correo o contraseña incorrectos.");
  }

  setCurrentUser({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role || "client" });
  return user;
}

function getTeachers() {
  return getUsers().filter((user) => user.role === "teacher");
}

function createTeacherUser(data) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede crear profesores.");
  }

  const users = getUsers();
  const exists = users.some((user) => user.email.toLowerCase() === data.email.toLowerCase())
    || data.email.toLowerCase() === ADMIN_EMAIL;

  if (exists) {
    throw new Error("Ya existe una cuenta con este correo.");
  }

  const teacher = {
    id: createId(),
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    password: data.password,
    role: "teacher",
    specialty: data.specialty || "",
    createdAt: new Date().toISOString()
  };

  users.push(teacher);
  saveUsers(users);

  return teacher;
}

function resetTeacherPassword(teacherId, password) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede cambiar contraseñas de profesores.");
  }

  const users = getUsers();
  const teacher = users.find((user) => user.id === teacherId && user.role === "teacher");

  if (!teacher) {
    throw new Error("No se encontró el profesor.");
  }

  const updatedUsers = users.map((user) => (
    user.id === teacherId ? { ...user, password } : user
  ));

  saveUsers(updatedUsers);
}

function resetClientPassword(clientId, password) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede cambiar contraseñas de clientes.");
  }

  const users = getUsers();
  const client = users.find((user) => user.id === clientId && (user.role || "client") === "client");

  if (!client) {
    throw new Error("No se encontró el cliente.");
  }

  saveUsers(users.map((user) => (
    user.id === clientId ? { ...user, password } : user
  )));

  return { ...client, password };
}

function registerSubscription(plan, paymentToken = "") {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("Debes iniciar sesión para guardar la suscripción.");
  }

  const subscriptions = getSubscriptions();
  const existingByToken = paymentToken
    ? subscriptions.find((subscription) => subscription.userId === user.id && subscription.paymentToken === paymentToken)
    : null;

  if (existingByToken) {
    return existingByToken;
  }

  const latestActive = subscriptions.find((subscription) => (
    subscription.userId === user.id &&
    subscription.plan === plan &&
    subscription.status === "Activa" &&
    new Date(subscription.expiresAt) >= new Date()
  ));

  if (!paymentToken && latestActive) {
    return latestActive;
  }

  const createdAt = new Date();
  const subscription = {
    id: createId(),
    userId: user.id,
    plan,
    status: "Activa",
    paymentToken: paymentToken || createId(),
    createdAt: createdAt.toISOString(),
    startsAt: createdAt.toISOString(),
    expiresAt: addDays(createdAt, 30).toISOString()
  };

  subscriptions.unshift(subscription);
  saveSubscriptions(subscriptions);

  return subscription;
}

function registerPendingSubscription() {
  const allowedPlans = ["inicial", "academico", "premium"];
  const plan = sessionStorage.getItem("oa_selected_plan");
  const paymentToken = sessionStorage.getItem("oa_payment_token");

  if (!allowedPlans.includes(plan) || !paymentToken || !getCurrentUser()) {
    return null;
  }

  return registerSubscription(plan, paymentToken);
}

function createRequest(data) {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("Debes iniciar sesión para guardar tu solicitud.");
  }

  const requests = getRequests();
  const savedUser = getUsers().find((item) => item.id === user.id);
  const assignedTeacher = savedUser && savedUser.teacherId
    ? getTeachers().find((teacher) => teacher.id === savedUser.teacherId)
    : null;
  const request = {
    id: createId(),
    userId: user.id,
    status: "Recibida",
    createdAt: new Date().toISOString(),
    teacherId: assignedTeacher ? assignedTeacher.id : "",
    teacherName: assignedTeacher ? assignedTeacher.name : "",
    assignedAt: assignedTeacher ? new Date().toISOString() : "",
    ...data
  };

  requests.unshift(request);
  saveRequests(requests);

  return request;
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
      status: "Activa",
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
      activeSubscription: clientSubscriptions.find((subscription) => (
        subscription.status === "Activa" && new Date(subscription.expiresAt) >= new Date()
      )) || null
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

  const requests = getRequests();
  const updatedRequests = requests.map((request) => (
    request.id === requestId ? { ...request, status, updatedAt: new Date().toISOString() } : request
  ));

  saveRequests(updatedRequests);
}

function saveTeacherDelivery(requestId, delivery) {
  const user = getCurrentUser();
  const request = getRequests().find((item) => item.id === requestId);
  const canDeliver = isTeacherUser(user) && request && request.teacherId === user.id;

  if (!canDeliver) {
    throw new Error("Solo el profesor asignado puede subir la entrega.");
  }

  const requests = getRequests();
  const updatedRequests = requests.map((request) => (
    request.id === requestId
      ? {
          ...request,
          status: "Entregada",
          delivery,
          deliveredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      : request
  ));

  saveRequests(updatedRequests);
}

function assignRequestToTeacher(requestId, teacherId) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede asignar trabajos.");
  }

  const teacher = getTeachers().find((user) => user.id === teacherId);
  const requests = getRequests();
  const selectedRequest = requests.find((request) => request.id === requestId);
  const updatedRequests = requests.map((request) => (
    request.id === requestId
      ? {
          ...request,
          teacherId: teacher ? teacher.id : "",
          teacherName: teacher ? teacher.name : "",
          assignedAt: teacher ? new Date().toISOString() : "",
          updatedAt: new Date().toISOString()
        }
      : request
  ));

  saveRequests(updatedRequests);

  if (selectedRequest && teacher) {
    const users = getUsers();
    const updatedUsers = users.map((user) => (
      user.id === selectedRequest.userId
        ? { ...user, teacherId: teacher.id, teacherName: teacher.name }
        : user
    ));
    saveUsers(updatedUsers);
  }
}

function clearClientTeacher(clientId) {
  if (!isAdminUser()) {
    throw new Error("Solo el administrador puede quitar profesores responsables.");
  }

  const users = getUsers();
  saveUsers(users.map((user) => (
    user.id === clientId ? { ...user, teacherId: "", teacherName: "" } : user
  )));
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
