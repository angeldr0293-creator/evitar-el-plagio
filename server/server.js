const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ENV_FILE = path.join(__dirname, "..", ".env");
const ROOT = path.join(__dirname, "..");
const CLIENT_ROOT = path.join(ROOT, "client");
const AUTH_ROOT = path.join(__dirname, "auth");
const FILES_PUBLIC_PATH = "/api/files";

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    return;
  }

  const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const PORT = process.env.PORT || 5173;
const HOST = process.env.HOST || "0.0.0.0";
const STORAGE_ROOT = process.env.APP_STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || "";
const UPLOADS_ROOT = STORAGE_ROOT ? path.join(STORAGE_ROOT, "uploads") : path.join(__dirname, "uploads");
const LOGS_ROOT = STORAGE_ROOT ? path.join(STORAGE_ROOT, "logs") : path.join(__dirname, "logs");
const SUPPORT_LOG_FILE = path.join(LOGS_ROOT, "support.log");
const EMAIL_OUTBOX_LOG_FILE = path.join(LOGS_ROOT, "email-outbox.log");
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || PUBLIC_APP_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "").toLowerCase();
const EMAIL_FROM = process.env.EMAIL_FROM || "";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || "";
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const CANONICAL_HOST = (process.env.CANONICAL_HOST || "").toLowerCase();
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_ENVIRONMENT = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase();
const PAYPAL_CURRENCY = "USD";
const PAYPAL_SUBSCRIPTION_PLAN_IDS = {
  inicial: process.env.PAYPAL_PLAN_ID_INICIAL || "",
  academico: process.env.PAYPAL_PLAN_ID_ACADEMICO || "",
  premium: process.env.PAYPAL_PLAN_ID_PREMIUM || ""
};
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";
const PAYPAL_API_BASE = PAYPAL_ENVIRONMENT === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${PUBLIC_APP_URL.replace(/\/$/, "")}/api/auth/google/callback`;
const SESSION_COOKIE_NAME = "oa_session";
const GOOGLE_OAUTH_STATE_COOKIE_NAME = "oa_google_oauth_state";
const GOOGLE_OAUTH_SCOPE = "openid email profile";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const FORCE_HTTPS = process.env.FORCE_HTTPS === "true" || process.env.NODE_ENV === "production";
const database = require("./data/database");

const defaultState = {
  oa_users: [],
  oa_requests: [],
  oa_subscriptions: []
};

const ALLOWED_USER_ROLES = ["client", "teacher"];
const ALLOWED_REQUEST_STATUSES = ["Pendiente de pago", "Recibida", "Asignada", "Visto", "Trabajando", "En proceso", "Lista", "Entrega subida", "Entregada"];
const ALLOWED_SUBSCRIPTION_STATUSES = ["Pendiente", "Pagado", "Activa", "Cancelada", "Rechazado", "Reembolsado", "Expirado", "Suspendida", "Pago fallido"];
const LEGACY_SUBSCRIPTION_STATUS_MAP = {
  Expirada: "Expirado"
};
const SUBSCRIPTION_PLANS = ["inicial", "academico", "premium"];
const CREDIT_PACK_PLANS = ["creditos10", "creditos20", "creditos50"];
const ALLOWED_PLANS = [...SUBSCRIPTION_PLANS, ...CREDIT_PACK_PLANS];
const ALLOWED_REQUEST_PACKAGES = [...ALLOWED_PLANS, "creditos"];
const REQUEST_FILE_EXTENSIONS = [".doc", ".docx", ".pdf", ".txt"];
const DELIVERY_FILE_EXTENSIONS = [".doc", ".docx", ".pdf", ".txt"];
const PAYMENT_PROOF_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const MAX_REQUEST_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_TOTAL_SIZE = 15 * 1024 * 1024;
const MAX_REQUEST_FILES = 5;
const MAX_DELIVERY_FILE_SIZE = 2 * 1024 * 1024;
const MAX_PAYMENT_PROOF_SIZE = 5 * 1024 * 1024;
const DANGEROUS_FILE_EXTENSIONS = new Set([
  ".bat", ".cmd", ".com", ".cpl", ".dll", ".exe", ".hta", ".jar", ".js", ".jse",
  ".lnk", ".msi", ".ps1", ".scr", ".sh", ".vb", ".vbe", ".vbs", ".wsf"
]);

fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
fs.mkdirSync(LOGS_ROOT, { recursive: true });

const rateLimitBuckets = new Map();

function logSecurityEvent(type, details = {}) {
  const entry = {
    at: new Date().toISOString(),
    type,
    ...details
  };

  try {
    fs.appendFileSync(path.join(LOGS_ROOT, "app.log"), `${JSON.stringify(entry)}\n`);
  } catch (error) {
    console.error(error);
  }
}

function logSupportMessage(message) {
  const entry = {
    at: new Date().toISOString(),
    ...message
  };

  fs.appendFileSync(SUPPORT_LOG_FILE, `${JSON.stringify(entry)}\n`);
}

function logEmailOutbox(email, status = "queued") {
  const entry = {
    at: new Date().toISOString(),
    status,
    ...email
  };

  fs.appendFileSync(EMAIL_OUTBOX_LOG_FILE, `${JSON.stringify(entry)}\n`);
}

function getPanelLink(pathname = "panel.html") {
  return `${PUBLIC_APP_URL.replace(/\/$/, "")}/${pathname.replace(/^\//, "")}`;
}

function getEmailVerificationLink(token) {
  return `${PUBLIC_APP_URL.replace(/\/$/, "")}/api/verify-email?token=${encodeURIComponent(token)}`;
}

function createEmailText({ greeting, lines = [], actionText = "Entrar a la plataforma", actionUrl = getPanelLink() }) {
  return [
    greeting,
    "",
    ...lines,
    "",
    `${actionText}: ${actionUrl}`,
    "",
    "Por seguridad, los archivos y el seguimiento se gestionan dentro de la plataforma."
  ].join("\n");
}

async function sendResendEmail(email) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email.to],
      reply_to: email.replyTo || EMAIL_REPLY_TO || undefined,
      subject: email.subject,
      text: email.text
    })
  });

  if (!response.ok) {
    throw new Error(`Resend respondio ${response.status}: ${await response.text()}`);
  }
}

async function sendTransactionalEmail(email) {
  const cleanEmail = {
    event: toCleanString(email.event, 80),
    to: normalizeEmail(email.to),
    replyTo: normalizeEmail(email.replyTo || ""),
    subject: toCleanString(email.subject, 160),
    text: toCleanString(email.text, 5000)
  };

  if (cleanEmail.replyTo && !isValidEmail(cleanEmail.replyTo)) {
    cleanEmail.replyTo = "";
  }

  if (!isValidEmail(cleanEmail.to) || !cleanEmail.subject || !cleanEmail.text) {
    logEmailOutbox(cleanEmail, "invalid");
    return { delivered: false, queued: false };
  }

  if (EMAIL_PROVIDER === "resend" && RESEND_API_KEY && EMAIL_FROM) {
    try {
      await sendResendEmail(cleanEmail);
      logEmailOutbox(cleanEmail, "sent");
      return { delivered: true, queued: false };
    } catch (error) {
      logEmailOutbox({ ...cleanEmail, error: error.message }, "failed");
      return { delivered: false, queued: true };
    }
  }

  logEmailOutbox(cleanEmail, "queued");
  return { delivered: false, queued: true };
}

function queueTransactionalEmail(email) {
  sendTransactionalEmail(email).catch((error) => {
    logEmailOutbox({ ...email, error: error.message }, "failed");
  });
}

function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: addDays(new Date(), 1).toISOString()
  };
}

function assignEmailVerificationToken(user) {
  const verification = createEmailVerificationToken();
  user.emailVerifiedAt = "";
  user.emailVerificationTokenHash = verification.tokenHash;
  user.emailVerificationTokenExpiresAt = verification.expiresAt;
  return verification.token;
}

function clearEmailVerificationToken(user) {
  user.emailVerificationTokenHash = "";
  user.emailVerificationTokenExpiresAt = "";
}

function isClientEmailVerified(user) {
  if (!user || (user.role || "client") !== "client") {
    return true;
  }

  if (user.emailVerifiedAt || user.authProvider === "google") {
    return true;
  }

  return !user.emailVerificationTokenHash && !user.emailVerificationTokenExpiresAt;
}

function queueEmailVerification(user, token) {
  queueTransactionalEmail({
    event: "email_verification",
    to: user.email,
    subject: "Confirma tu correo en ZeroCopy IA",
    text: createEmailText({
      greeting: `Hola ${user.name || "cliente"},`,
      lines: [
        "Confirma este correo para activar tu cuenta y proteger tus solicitudes.",
        "El enlace vence en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje."
      ],
      actionText: "Confirmar mi correo",
      actionUrl: getEmailVerificationLink(token)
    })
  });
}

function getOriginFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
}

function parseAllowedOrigins() {
  const configuredOrigins = ALLOWED_ORIGINS
    .split(",")
    .map((origin) => getOriginFromUrl(origin.trim()) || origin.trim())
    .filter(Boolean);
  const devOrigins = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  ];

  return new Set([...configuredOrigins, ...devOrigins]);
}

const allowedOrigins = parseAllowedOrigins();

const PASSWORD_HASH_PREFIX = "scrypt";

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}

function createPublicError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  return error;
}

function getPublicErrorMessage(error, fallbackMessage) {
  return error && error.publicMessage ? error.publicMessage : fallbackMessage;
}

function sendError(response, error, fallbackMessage = "No se pudo completar la solicitud.") {
  const statusCode = error && Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  if (safeStatusCode >= 500) {
    console.error(error);
    logSecurityEvent("server_error", { message: error?.message || fallbackMessage });
  }

  response.status(safeStatusCode).json({
    ok: false,
    error: getPublicErrorMessage(error, fallbackMessage)
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toCleanString(value, maxLength = 500) {
  return typeof value === "string"
    ? value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, maxLength)
    : "";
}

function requireCleanString(value, label, maxLength = 500) {
  const cleanValue = toCleanString(value, maxLength);

  if (!cleanValue) {
    throw createValidationError(`${label} es obligatorio.`);
  }

  return cleanValue;
}

function normalizeEmail(value) {
  return toCleanString(value, 254).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireValidEmail(value) {
  const email = normalizeEmail(value);

  if (!isValidEmail(email)) {
    throw createValidationError("Ingresa un correo valido.");
  }

  return email;
}

function requirePassword(value) {
  if (typeof value !== "string" || value.length < 6 || value.length > 200) {
    throw createValidationError("La contrasena debe tener al menos 6 caracteres.");
  }

  return value;
}

function requireAllowedValue(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    throw createValidationError(`${label} no es valido.`);
  }

  return value;
}

function isValidDateValue(value, allowDateOnly = false) {
  if (!value) {
    return true;
  }

  if (allowDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  }

  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function sanitizeOptionalDate(value, label, allowDateOnly = false) {
  const cleanValue = toCleanString(value, 40);

  if (!isValidDateValue(cleanValue, allowDateOnly)) {
    throw createValidationError(`${label} no es valido.`);
  }

  return cleanValue;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sanitizePositiveInteger(value, label, maxValue = 500) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > maxValue) {
    throw createValidationError(`${label} no es valido.`);
  }

  return numberValue;
}

function getFileExtension(fileName) {
  return path.extname(fileName).toLowerCase();
}

function validateSafeFileName(fileName, allowedExtensions, label) {
  const normalizedName = path.basename(fileName).trim();
  const extension = getFileExtension(normalizedName);

  if (
    normalizedName !== fileName
    || normalizedName.startsWith(".")
    || normalizedName.includes("..")
    || /[<>:"/\\|?*\x00-\x1F]/.test(normalizedName)
    || /\.(exe|bat|cmd|ps1|vbs|js|scr|msi|dll)(\.|$)/i.test(normalizedName)
  ) {
    throw createValidationError(`El nombre de ${label} no es seguro.`);
  }

  if (DANGEROUS_FILE_EXTENSIONS.has(extension) || !allowedExtensions.includes(extension)) {
    throw createValidationError(`${label} debe ser un archivo permitido.`);
  }

  return { name: normalizedName, extension };
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);

  if (!match || !match[2]) {
    throw createValidationError("El archivo debe enviarse en base64 valido.");
  }

  return {
    contentType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[3], "base64")
  };
}

function validateFileSignature(buffer, extension, label) {
  if (extension === ".pdf" && buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw createValidationError(`${label} no parece ser un PDF valido.`);
  }

  if (extension === ".docx" && buffer.subarray(0, 2).toString("ascii") !== "PK") {
    throw createValidationError(`${label} no parece ser un DOCX valido.`);
  }

  if (extension === ".doc") {
    const docHeader = buffer.subarray(0, 8).toString("hex");
    if (docHeader !== "d0cf11e0a1b11ae1") {
      throw createValidationError(`${label} no parece ser un DOC valido.`);
    }
  }

  if (extension === ".txt" && buffer.includes(0)) {
    throw createValidationError(`${label} no parece ser un TXT valido.`);
  }

  if (extension === ".png" && buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw createValidationError(`${label} no parece ser un PNG valido.`);
  }

  if ((extension === ".jpg" || extension === ".jpeg") && buffer.subarray(0, 3).toString("hex") !== "ffd8ff") {
    throw createValidationError(`${label} no parece ser un JPG valido.`);
  }
}

function storeAttachmentFile(file, allowedExtensions, maxSize, label) {
  const safeFile = validateSafeFileName(requireCleanString(file.name, `El nombre de ${label}`, 180), allowedExtensions, label);
  const { name, extension } = safeFile;
  const type = toCleanString(file.type || "application/octet-stream", 120) || "application/octet-stream";
  const dataUrl = typeof file.dataUrl === "string" ? file.dataUrl.trim() : "";

  if (!dataUrl || dataUrl.length > maxSize * 2 || !dataUrl.startsWith("data:")) {
    throw createValidationError(`${label} debe enviarse como archivo valido.`);
  }

  const parsedFile = parseDataUrl(dataUrl);
  const size = parsedFile.buffer.length;

  if (size <= 0 || size > maxSize) {
    throw createValidationError(`El tamano de ${label} no es valido.`);
  }

  validateFileSignature(parsedFile.buffer, extension, label);

  const storageKey = `${crypto.randomUUID()}${extension}`;
  const filePath = path.join(UPLOADS_ROOT, storageKey);

  fs.writeFileSync(filePath, parsedFile.buffer);

  return {
    name,
    type: type || parsedFile.contentType,
    size,
    storageKey,
    url: `${FILES_PUBLIC_PATH}/${storageKey}`
  };
}

function sanitizeAttachment(file, allowedExtensions, maxSize, label) {
  if (!isPlainObject(file)) {
    throw createValidationError(`${label} no es valido.`);
  }

  const safeFile = validateSafeFileName(requireCleanString(file.name, `El nombre de ${label}`, 180), allowedExtensions, label);
  const { name } = safeFile;
  const size = sanitizePositiveInteger(file.size, `El tamano de ${label}`, maxSize);
  const type = toCleanString(file.type || "application/octet-stream", 120) || "application/octet-stream";
  const storageKey = toCleanString(file.storageKey, 180);
  const url = toCleanString(file.url, 300);

  if (file.dataUrl) {
    return storeAttachmentFile(file, allowedExtensions, maxSize, label);
  }

  if (!storageKey || !url || !(url.startsWith(`${FILES_PUBLIC_PATH}/`) || url.startsWith("/uploads/"))) {
    throw createValidationError(`${label} debe tener almacenamiento valido.`);
  }

  return { name, type, size, storageKey, url: `${FILES_PUBLIC_PATH}/${storageKey}` };
}

function normalizeSubscriptionStatus(status) {
  const cleanStatus = toCleanString(status || "Pendiente", 40);
  return LEGACY_SUBSCRIPTION_STATUS_MAP[cleanStatus] || cleanStatus || "Pendiente";
}

function sanitizePaymentProof(file) {
  if (!file) {
    return null;
  }

  return sanitizeAttachment(file, PAYMENT_PROOF_EXTENSIONS, MAX_PAYMENT_PROOF_SIZE, "el comprobante de pago");
}

function removeStoredFile(storageKey) {
  const safeStorageKey = path.basename(toCleanString(storageKey, 180));

  if (!safeStorageKey) {
    return false;
  }

  const uploadsRoot = path.resolve(UPLOADS_ROOT);
  const filePath = path.resolve(uploadsRoot, safeStorageKey);

  if (!(filePath === uploadsRoot || filePath.startsWith(`${uploadsRoot}${path.sep}`)) || !fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    logSecurityEvent("stored_file_delete_failed", { storageKey: safeStorageKey, error: error.message });
    return false;
  }
}

function collectClientStorageKeys({ requests = [], subscriptions = [] }) {
  const storageKeys = new Set();

  requests.forEach((request) => {
    (request.attachments || []).forEach((file) => {
      if (file?.storageKey) {
        storageKeys.add(file.storageKey);
      }
    });

    if (request.delivery?.storageKey) {
      storageKeys.add(request.delivery.storageKey);
    }
  });

  subscriptions.forEach((subscription) => {
    if (subscription.paymentProof?.storageKey) {
      storageKeys.add(subscription.paymentProof.storageKey);
    }
  });

  return [...storageKeys];
}

function sanitizePaymentAmount(value, plan) {
  const planPrices = {
    inicial: 14.99,
    academico: 21.99,
    premium: 36.99,
    creditos10: 3.99,
    creditos20: 6.99,
    creditos50: 14.99
  };
  const amount = Number(value || planPrices[plan] || 0);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    throw createValidationError("El monto del pago no es valido.");
  }

  return Number(amount.toFixed(2));
}

function getPlanPrice(plan) {
  return sanitizePaymentAmount(null, plan);
}

function isCreditPackPlan(plan) {
  return CREDIT_PACK_PLANS.includes(plan);
}

function isPayPalConfigured() {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}

function getPayPalSubscriptionPlanId(plan) {
  return PAYPAL_SUBSCRIPTION_PLAN_IDS[plan] || "";
}

function getPlanFromPayPalPlanId(planId) {
  return Object.entries(PAYPAL_SUBSCRIPTION_PLAN_IDS)
    .find(([, paypalPlanId]) => paypalPlanId && paypalPlanId === planId)?.[0] || "";
}

function arePayPalSubscriptionsConfigured() {
  return Boolean(isPayPalConfigured() && SUBSCRIPTION_PLANS.every((plan) => getPayPalSubscriptionPlanId(plan)));
}

async function getPayPalAccessToken() {
  if (!isPayPalConfigured()) {
    throw createPublicError(503, "PayPal no esta configurado todavia.");
  }

  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    throw createPublicError(502, "PayPal no autorizo la conexion.");
  }

  return payload.access_token;
}

async function requestPayPal(pathname, options = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    logSecurityEvent("paypal_api_error", {
      status: response.status,
      pathname,
      details: payload?.name || payload?.message || "paypal_error"
    });
    throw createPublicError(502, "PayPal no pudo completar la operacion.");
  }

  return payload;
}

function getPayPalCaptureDetails(order) {
  const purchaseUnit = Array.isArray(order?.purchase_units) ? order.purchase_units[0] : null;
  const captures = purchaseUnit?.payments?.captures || [];
  const capture = captures.find((item) => item.status === "COMPLETED") || captures[0] || null;
  return { purchaseUnit, capture };
}

function verifyPayPalCapture(order, plan) {
  const expectedAmount = getPlanPrice(plan).toFixed(2);
  const { purchaseUnit, capture } = getPayPalCaptureDetails(order);
  const paidAmount = capture?.amount?.value || purchaseUnit?.amount?.value || "";
  const paidCurrency = capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code || "";

  if (order?.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") {
    throw createPublicError(409, "El pago de PayPal no aparece como completado.");
  }

  if (paidCurrency !== PAYPAL_CURRENCY || Number(paidAmount).toFixed(2) !== expectedAmount) {
    throw createPublicError(409, "El monto confirmado por PayPal no coincide con el plan.");
  }

  return capture;
}

function getPayPalSubscriptionNextBilling(subscription, fallbackDate = new Date()) {
  return sanitizeOptionalDate(
    subscription?.billing_info?.next_billing_time || addDays(fallbackDate, 30).toISOString(),
    "La fecha de proxima renovacion",
    true
  );
}

function verifyPayPalSubscriptionDetails(subscription, plan) {
  const expectedPlanId = getPayPalSubscriptionPlanId(plan);

  if (!expectedPlanId) {
    throw createPublicError(503, "El plan recurrente de PayPal no esta configurado.");
  }

  if (!subscription?.id || subscription.plan_id !== expectedPlanId) {
    throw createPublicError(409, "La suscripcion de PayPal no coincide con el plan.");
  }

  if (!["APPROVED", "ACTIVE"].includes(subscription.status)) {
    throw createPublicError(409, "La suscripcion de PayPal no aparece activa todavia.");
  }

  return subscription;
}

function getPayPalSubscriptionUserId(subscription, fallbackUserId = "") {
  const customId = toCleanString(subscription?.custom_id, 120);
  return customId.includes(":") ? customId.split(":")[0] : customId || fallbackUserId;
}

function isPaidSubscription(subscription) {
  return subscription
    && ["Pagado", "Activa", "Cancelada"].includes(subscription.status)
    && (!subscription.expiresAt || new Date(subscription.expiresAt) >= new Date());
}

function getPlanCreditConfig() {
  return {
    inicial: { credits: 50, pages: 25 },
    academico: { credits: 100, pages: 50 },
    premium: { credits: 200, pages: 100 },
    creditos10: { credits: 10, pages: 5 },
    creditos20: { credits: 20, pages: 10 },
    creditos50: { credits: 50, pages: 25 }
  };
}

function isCreditGrantSubscription(subscription, activeRecurringSubscriptionIds = new Set()) {
  if (!subscription || !["Pagado", "Activa", "Cancelada"].includes(subscription.status)) {
    return false;
  }

  if (subscription.paymentMethod === "paypal-subscription" && subscription.paypalSubscriptionId) {
    return activeRecurringSubscriptionIds.has(subscription.paypalSubscriptionId);
  }

  return !subscription.expiresAt || new Date(subscription.expiresAt) >= new Date();
}

function getRequestPages(request) {
  const directPages = Number(request?.pages);

  if (Number.isFinite(directPages) && directPages > 0) {
    return directPages;
  }

  if (Array.isArray(request?.pageDetails)) {
    return request.pageDetails.reduce((total, item) => total + (Number(item.pages) || 0), 0);
  }

  return 0;
}

function getClientCreditSummaryForUser(userId, requests = [], subscriptions = []) {
  const planCredits = getPlanCreditConfig();
  const clientSubscriptions = subscriptions.filter((subscription) => subscription.userId === userId);
  const activeRecurringSubscriptionIds = new Set(
    clientSubscriptions
      .filter((subscription) => subscription.paymentMethod === "paypal-subscription" && isPaidSubscription(subscription) && subscription.paypalSubscriptionId)
      .map((subscription) => subscription.paypalSubscriptionId)
  );
  const creditSubscriptions = clientSubscriptions.filter((subscription) => isCreditGrantSubscription(subscription, activeRecurringSubscriptionIds));
  const purchasedCredits = creditSubscriptions.reduce((total, subscription) => (
    total + (planCredits[subscription.plan]?.credits || 0)
  ), 0);
  const clientRequests = requests.filter((request) => request.userId === userId);
  const inferredPlans = creditSubscriptions.length || clientSubscriptions.length ? [] : clientRequests.map((request) => request.package);
  const inferredCredits = inferredPlans.reduce((total, plan) => total + (planCredits[plan]?.credits || 0), 0);
  const totalCredits = purchasedCredits || inferredCredits;
  const usedCredits = clientRequests.reduce((total, request) => total + (getRequestPages(request) * 2), 0);
  const availableCredits = Math.max(totalCredits - usedCredits, 0);

  return {
    totalCredits,
    usedCredits,
    availableCredits
  };
}

function sanitizePageDetails(pageDetails, validFileNames) {
  if (!Array.isArray(pageDetails)) {
    return [];
  }

  return pageDetails.map((item) => {
    if (!isPlainObject(item)) {
      throw createValidationError("El detalle de paginas no es valido.");
    }

    const name = requireCleanString(item.name, "El nombre del archivo", 180);

    if (validFileNames.size && !validFileNames.has(name)) {
      throw createValidationError("El detalle de paginas no coincide con los archivos enviados.");
    }

    return {
      name,
      pages: sanitizePositiveInteger(item.pages, "La cantidad de paginas", 500),
      error: toCleanString(item.error, 200)
    };
  });
}

function createStatusHistoryEntry(status, actor, details = {}) {
  return {
    status,
    at: new Date().toISOString(),
    actorId: actor?.id || "",
    actorRole: actor?.role || "system",
    actorName: actor?.name || "",
    teacherId: details.teacherId || "",
    teacherName: details.teacherName || "",
    note: details.note || ""
  };
}

function appendStatusHistory(request, status, actor, details = {}) {
  const history = Array.isArray(request.statusHistory) ? request.statusHistory : [];

  request.statusHistory = [
    ...history,
    createStatusHistoryEntry(status, actor, details)
  ];
}

function sanitizeStatusHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.map((entry) => ({
    status: requireAllowedValue(entry.status || "Recibida", ALLOWED_REQUEST_STATUSES, "El estado del historial"),
    at: sanitizeOptionalDate(entry.at || new Date().toISOString(), "La fecha del historial"),
    actorId: toCleanString(entry.actorId, 80),
    actorRole: toCleanString(entry.actorRole, 40),
    actorName: toCleanString(entry.actorName, 120),
    teacherId: toCleanString(entry.teacherId, 80),
    teacherName: toCleanString(entry.teacherName, 120),
    note: toCleanString(entry.note, 240)
  }));
}

function isPasswordHash(value) {
  return typeof value === "string" && value.startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derivedKey = crypto.scryptSync(String(password), salt, 64).toString("base64url");

  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedPassword) {
  if (!isPasswordHash(storedPassword)) {
    return password === storedPassword;
  }

  const [, salt, storedKey] = storedPassword.split("$");

  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = crypto.scryptSync(String(password), salt, 64);
  const storedKeyBuffer = Buffer.from(storedKey, "base64url");

  return storedKeyBuffer.length === derivedKey.length
    && crypto.timingSafeEqual(storedKeyBuffer, derivedKey);
}

function normalizeUserPasswords(users = []) {
  return users.map((user) => {
    if (!user || !user.password || isPasswordHash(user.password)) {
      return user;
    }

    return {
      ...user,
      password: hashPassword(user.password)
    };
  });
}

function normalizeStateForStorage(state) {
  return {
    ...defaultState,
    ...state,
    oa_users: normalizeUserPasswords(state.oa_users || [])
  };
}

function readState() {
  try {
    return normalizeStateForStorage(database.readState());
  } catch (error) {
    return defaultState;
  }
}

function saveState(state) {
  database.saveState(normalizeStateForStorage(state));
}

saveState(readState());

const app = express();

app.locals.sessionSecretConfigured = Boolean(SESSION_SECRET);
app.set("trust proxy", 1);

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJSON(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function signTokenPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function createAuthToken(user) {
  if (!SESSION_SECRET) {
    return "";
  }

  const payload = base64UrlJSON({
    id: user.id,
    email: user.email,
    role: user.role || "client",
    issuedAt: Date.now()
  });

  return `${payload}.${signTokenPayload(payload)}`;
}

function readCookie(request, name) {
  const cookieHeader = request.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function getClientIp(request) {
  return (request.headers["x-forwarded-for"] || request.socket.remoteAddress || "")
    .toString()
    .split(",")[0]
    .trim();
}

function createRateLimiter({ windowMs, max, keyPrefix }) {
  return (request, response, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(request)}`;
    const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    if (bucket.count > max) {
      response.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      logSecurityEvent("rate_limited", { ip: getClientIp(request), route: request.originalUrl });
      sendError(response, createPublicError(429, "Demasiados intentos. Intenta nuevamente mas tarde."));
      return;
    }

    next();
  };
}

async function verifyTurnstileToken(token, request) {
  const cleanToken = toCleanString(token, 2048);

  if (!TURNSTILE_SECRET_KEY) {
    return false;
  }

  if (!cleanToken) {
    throw createPublicError(400, "Completa la verificacion anti-spam.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const verification = new URLSearchParams();
    verification.set("secret", TURNSTILE_SECRET_KEY);
    verification.set("response", cleanToken);
    verification.set("remoteip", getClientIp(request));

    const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verification,
      signal: controller.signal
    });
    const result = await turnstileResponse.json().catch(() => ({}));

    if (!turnstileResponse.ok || !result.success) {
      logSecurityEvent("turnstile_rejected", { ip: getClientIp(request), errors: result["error-codes"] || [] });
      throw createPublicError(400, "No se pudo validar la verificacion anti-spam.");
    }

    return true;
  } catch (error) {
    if (error.publicMessage) {
      throw error;
    }

    logSecurityEvent("turnstile_error", { ip: getClientIp(request), error: error.message });
    throw createPublicError(400, "No se pudo validar la verificacion anti-spam.");
  } finally {
    clearTimeout(timeout);
  }
}

async function validateRegistrationSpamBarrier(body = {}, request) {
  const website = toCleanString(body.website, 120);
  const captchaAnswer = toCleanString(body.captchaAnswer, 40).toLowerCase();
  const formStartedAt = Number(body.formStartedAt || 0);
  const elapsedMs = Date.now() - formStartedAt;

  if (website) {
    throw createPublicError(400, "No se pudo validar el registro.");
  }

  if (await verifyTurnstileToken(body.turnstileToken, request)) {
    return;
  }

  if (captchaAnswer !== "original") {
    throw createPublicError(400, "Completa la verificacion anti-spam.");
  }

  if (!Number.isFinite(elapsedMs) || elapsedMs < 1500) {
    throw createPublicError(400, "Intenta enviar el registro nuevamente.");
  }
}

function validateFormSpamBarrier(body = {}) {
  const website = toCleanString(body.website, 120);
  const formStartedAt = Number(body.formStartedAt || 0);
  const elapsedMs = Date.now() - formStartedAt;

  if (website) {
    throw createPublicError(400, "No se pudo validar el formulario.");
  }

  if (!Number.isFinite(elapsedMs) || elapsedMs < 1200) {
    throw createPublicError(400, "Intenta enviar el formulario nuevamente.");
  }
}

function getSessionCookieOptions(maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const options = [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];

  if (process.env.NODE_ENV === "production") {
    options.push("Secure");
  }

  return options.join("; ");
}

function appendSetCookie(response, cookieValue) {
  const currentValue = response.getHeader("Set-Cookie");

  if (!currentValue) {
    response.setHeader("Set-Cookie", cookieValue);
    return;
  }

  response.setHeader(
    "Set-Cookie",
    Array.isArray(currentValue) ? [...currentValue, cookieValue] : [currentValue, cookieValue]
  );
}

function setSessionCookie(response, user) {
  const token = createAuthToken(user);

  if (token) {
    appendSetCookie(
      response,
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${getSessionCookieOptions()}`
    );
  }
}

function clearSessionCookie(response) {
  appendSetCookie(
    response,
    `${SESSION_COOKIE_NAME}=; ${getSessionCookieOptions(0)}`
  );
}

function readTokenUser(request) {
  const authorization = request.get("Authorization") || "";
  const token = readCookie(request, SESSION_COOKIE_NAME)
    || (authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
  const [payload, signature] = token.split(".");

  if (!SESSION_SECRET || !payload || !signature || signTokenPayload(payload) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return {
      id: parsed.id || "",
      email: parsed.email || "",
      role: parsed.role || "client"
    };
  } catch (error) {
    return null;
  }
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const {
    password,
    googleId,
    emailVerificationTokenHash,
    emailVerificationTokenExpiresAt,
    ...safeUser
  } = user;
  return {
    ...safeUser,
    emailVerified: isClientEmailVerified(user),
    subscriberId: (safeUser.role || "client") === "client"
      ? safeUser.subscriberId || createSubscriberId(safeUser.id)
      : safeUser.subscriberId || ""
  };
}

function createSubscriberId(userId = "") {
  return `ZC-${crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 8).toUpperCase()}`;
}

function sanitizeUserForTeacher(user) {
  if (!user) {
    return null;
  }

  const safeUser = sanitizeUser(user);

  if ((safeUser.role || "client") !== "client") {
    return safeUser;
  }

  return {
    id: safeUser.id,
    name: safeUser.name,
    role: safeUser.role,
    subscriberId: safeUser.subscriberId || createSubscriberId(safeUser.id),
    createdAt: safeUser.createdAt
  };
}

function validateAuthUser(tokenUser, state = readState()) {
  if (!tokenUser) {
    return null;
  }

  if (tokenUser.role === "admin" && ADMIN_EMAIL && tokenUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return {
      id: "admin",
      name: "Administrador",
      email: ADMIN_EMAIL,
      role: "admin"
    };
  }

  const savedUser = state.oa_users.find((user) => (
    user.id === tokenUser.id && user.email.toLowerCase() === tokenUser.email.toLowerCase()
  ));

  return savedUser ? sanitizeUser(savedUser) : null;
}

function requireAuth(request, response) {
  const state = readState();
  const user = validateAuthUser(readTokenUser(request), state);

  if (!user) {
    sendError(response, createPublicError(401, "Debes iniciar sesion."));
    return null;
  }

  return { state, user };
}

function requireVerifiedClient(auth, response) {
  if (!auth || auth.user.role !== "client") {
    return true;
  }

  const savedUser = auth.state.oa_users.find((user) => user.id === auth.user.id && user.role === "client");

  if (!savedUser || isClientEmailVerified(savedUser)) {
    return true;
  }

  sendError(response, createPublicError(403, "Confirma tu correo antes de continuar. Te enviamos un enlace de verificacion."));
  return false;
}

function isGoogleAuthConfigured() {
  return Boolean(SESSION_SECRET && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function sanitizeOAuthNextPath(value = "") {
  const cleanValue = toCleanString(value, 300).replace(/^\/+/, "");

  if (
    !cleanValue
    || cleanValue.includes("\\")
    || cleanValue.startsWith("//")
    || /^[a-z][a-z0-9+.-]*:/i.test(cleanValue)
  ) {
    return "panel.html";
  }

  const pathname = cleanValue.split(/[?#]/)[0].toLowerCase();
  const blockedPaths = new Set(["admin.html", "profesor.html", "registro.html"]);

  if (blockedPaths.has(pathname) || pathname.startsWith("api/")) {
    return "panel.html";
  }

  return cleanValue;
}

function createGoogleOAuthStateToken(nextPath) {
  if (!SESSION_SECRET) {
    throw createPublicError(503, "El inicio de sesion con Google no esta configurado todavia.");
  }

  const payload = base64UrlJSON({
    nonce: crypto.randomBytes(16).toString("base64url"),
    next: sanitizeOAuthNextPath(nextPath),
    issuedAt: Date.now()
  });

  return `${payload}.${signTokenPayload(payload)}`;
}

function parseGoogleOAuthStateToken(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature || !SESSION_SECRET || signTokenPayload(payload) !== signature) {
    throw createPublicError(400, "La sesion de Google expiro. Intenta nuevamente.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const ageMs = Date.now() - Number(parsed.issuedAt || 0);

  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60 * 1000) {
    throw createPublicError(400, "La sesion de Google expiro. Intenta nuevamente.");
  }

  return {
    next: sanitizeOAuthNextPath(parsed.next),
    nonce: toCleanString(parsed.nonce, 80)
  };
}

function setGoogleOAuthStateCookie(response, token) {
  appendSetCookie(
    response,
    `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(token)}; ${getSessionCookieOptions(10 * 60)}`
  );
}

function clearGoogleOAuthStateCookie(response) {
  appendSetCookie(
    response,
    `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=; ${getSessionCookieOptions(0)}`
  );
}

function getGoogleOAuthUrl(stateToken) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
  url.searchParams.set("state", stateToken);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

function redirectToGoogleAuthError(response, message) {
  clearGoogleOAuthStateCookie(response);
  response.redirect(`/registro.html?auth_error=${encodeURIComponent(message)}`);
}

function getRootRelativeRedirectPath(pathname) {
  return `/${sanitizeOAuthNextPath(pathname).replace(/^\/+/, "")}`;
}

async function exchangeGoogleCodeForTokens(code) {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", GOOGLE_CLIENT_ID);
  body.set("client_secret", GOOGLE_CLIENT_SECRET);
  body.set("redirect_uri", GOOGLE_REDIRECT_URI);
  body.set("grant_type", "authorization_code");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    logSecurityEvent("google_token_exchange_failed", { status: response.status });
    throw createPublicError(502, "Google no pudo confirmar el inicio de sesion.");
  }

  return payload;
}

async function getGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await response.json().catch(() => ({}));

  if (!response.ok || !profile.sub || !profile.email) {
    logSecurityEvent("google_profile_failed", { status: response.status });
    throw createPublicError(502, "No se pudo leer tu perfil de Google.");
  }

  if (profile.email_verified === false) {
    throw createPublicError(403, "Tu correo de Google debe estar verificado.");
  }

  return profile;
}

function findOrCreateGoogleClient(profile) {
  const state = readState();
  const email = requireValidEmail(profile.email);

  if (ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase()) {
    throw createPublicError(403, "Usa el acceso de administrador con contrasena.");
  }

  const googleId = requireCleanString(profile.sub, "El id de Google", 120);
  let user = state.oa_users.find((item) => (
    item.googleId === googleId || normalizeEmail(item.email) === email
  ));

  if (user && (user.role || "client") !== "client") {
    throw createPublicError(403, "Esta cuenta debe iniciar sesion con correo y contrasena.");
  }

  if (user) {
    user.googleId = googleId;
    user.authProvider = user.authProvider || "google";
    user.name = toCleanString(user.name, 120) || toCleanString(profile.name, 120) || email.split("@")[0];
    user.avatarUrl = toCleanString(profile.picture, 300);
    user.emailVerifiedAt = user.emailVerifiedAt || new Date().toISOString();
    clearEmailVerificationToken(user);
    saveState(state);
    return sanitizeUser(user);
  }

  user = sanitizeUserForStorage({
    id: crypto.randomUUID(),
    name: toCleanString(profile.name, 120) || email.split("@")[0],
    email,
    phone: "",
    password: hashPassword(crypto.randomBytes(32).toString("base64url")),
    role: "client",
    authProvider: "google",
    googleId,
    avatarUrl: toCleanString(profile.picture, 300),
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });

  state.oa_users.push(user);
  saveState(state);
  return sanitizeUser(user);
}

function filterStateForUser(state, user) {
  if (user.role === "admin") {
    return {
      ...state,
      oa_users: state.oa_users.map(sanitizeUser)
    };
  }

  if (user.role === "teacher") {
    const assignedRequests = state.oa_requests.filter((request) => request.teacherId === user.id);
    const assignedClientIds = new Set(assignedRequests.map((request) => request.userId));

    return {
      oa_users: state.oa_users
        .filter((savedUser) => savedUser.id === user.id || assignedClientIds.has(savedUser.id))
        .map((savedUser) => savedUser.id === user.id ? sanitizeUser(savedUser) : sanitizeUserForTeacher(savedUser)),
      oa_requests: assignedRequests,
      oa_subscriptions: []
    };
  }

  return {
    oa_users: state.oa_users
      .filter((savedUser) => savedUser.id === user.id)
      .map(sanitizeUser),
    oa_requests: state.oa_requests.filter((request) => request.userId === user.id),
    oa_subscriptions: state.oa_subscriptions.filter((subscription) => subscription.userId === user.id)
  };
}

function restoreMissingUserPasswords(currentState, nextState) {
  const currentUsersById = new Map((currentState.oa_users || []).map((savedUser) => [savedUser.id, savedUser]));
  const currentUsersByEmail = new Map((currentState.oa_users || []).map((savedUser) => [savedUser.email, savedUser]));
  const incomingUsers = Array.isArray(nextState.oa_users) ? nextState.oa_users : [];

  return {
    ...nextState,
    oa_users: incomingUsers.map((incomingUser) => {
      if (!isPlainObject(incomingUser) || incomingUser.password) {
        return incomingUser;
      }

      const savedUser = currentUsersById.get(incomingUser.id) || currentUsersByEmail.get(normalizeEmail(incomingUser.email));

      return savedUser && savedUser.password
        ? { ...incomingUser, password: savedUser.password }
        : incomingUser;
    })
  };
}

function sanitizeUserForStorage(user) {
  if (!isPlainObject(user)) {
    throw createValidationError("El usuario no es valido.");
  }

  const role = requireAllowedValue(user.role || "client", ALLOWED_USER_ROLES, "El rol");
  const email = requireValidEmail(user.email);
  const password = isPasswordHash(user.password) ? user.password : requirePassword(user.password);

  return {
    id: requireCleanString(user.id, "El id del usuario", 80),
    name: requireCleanString(user.name, "El nombre", 120),
    email,
    phone: toCleanString(user.phone, 40),
    password,
    role,
    subscriberId: role === "client" ? toCleanString(user.subscriberId, 40) || createSubscriberId(user.id) : "",
    specialty: role === "teacher" ? toCleanString(user.specialty, 120) : "",
    teacherId: role === "client" ? toCleanString(user.teacherId, 80) : "",
    teacherName: role === "client" ? toCleanString(user.teacherName, 120) : "",
    authProvider: role === "client" ? toCleanString(user.authProvider, 40) : "",
    googleId: role === "client" ? toCleanString(user.googleId, 120) : "",
    avatarUrl: role === "client" ? toCleanString(user.avatarUrl, 300) : "",
    emailVerifiedAt: role === "client" ? sanitizeOptionalDate(user.emailVerifiedAt, "La fecha de verificacion de correo", true) : "",
    emailVerificationTokenHash: role === "client" ? toCleanString(user.emailVerificationTokenHash, 160) : "",
    emailVerificationTokenExpiresAt: role === "client" ? sanitizeOptionalDate(user.emailVerificationTokenExpiresAt, "La expiracion de verificacion de correo", true) : "",
    createdAt: sanitizeOptionalDate(user.createdAt || new Date().toISOString(), "La fecha de creacion")
  };
}

function sanitizeSubscription(subscription, usersById) {
  if (!isPlainObject(subscription)) {
    throw createValidationError("La suscripcion no es valida.");
  }

  const userId = requireCleanString(subscription.userId, "El cliente de la suscripcion", 80);
  const owner = usersById.get(userId);

  if (!owner || (owner.role || "client") !== "client") {
    throw createValidationError("La suscripcion debe pertenecer a un cliente valido.");
  }

  return {
    id: requireCleanString(subscription.id, "El id de la suscripcion", 80),
    userId,
    plan: requireAllowedValue(subscription.plan, ALLOWED_PLANS, "El plan"),
    status: requireAllowedValue(normalizeSubscriptionStatus(subscription.status), ALLOWED_SUBSCRIPTION_STATUSES, "El estado de la suscripcion"),
    paymentMethod: requireCleanString(subscription.paymentMethod || "manual", "El metodo de pago", 80),
    amount: sanitizePaymentAmount(subscription.amount, subscription.plan),
    currency: toCleanString(subscription.currency || "USD", 8) || "USD",
    transactionId: toCleanString(subscription.transactionId || subscription.paymentToken, 120),
    paymentToken: toCleanString(subscription.paymentToken || subscription.transactionId, 120),
    paymentProof: sanitizePaymentProof(subscription.paymentProof),
    paymentContact: toCleanString(subscription.paymentContact, 80),
    paymentNote: toCleanString(subscription.paymentNote, 240),
    paypalSubscriptionId: toCleanString(subscription.paypalSubscriptionId, 120),
    paypalPlanId: toCleanString(subscription.paypalPlanId, 120),
    billingCycle: Math.max(0, Math.floor(Number(subscription.billingCycle || 0))),
    cancelledAt: sanitizeOptionalDate(subscription.cancelledAt, "La fecha de cancelacion", true),
    cancellationEffectiveAt: sanitizeOptionalDate(subscription.cancellationEffectiveAt, "La fecha efectiva de cancelacion", true),
    lastPaymentFailedAt: sanitizeOptionalDate(subscription.lastPaymentFailedAt, "La fecha de pago fallido", true),
    reviewedAt: sanitizeOptionalDate(subscription.reviewedAt, "La fecha de revision", true),
    reviewedBy: toCleanString(subscription.reviewedBy, 80),
    createdAt: sanitizeOptionalDate(subscription.createdAt || new Date().toISOString(), "La fecha de creacion"),
    startsAt: sanitizeOptionalDate(subscription.startsAt || subscription.createdAt || new Date().toISOString(), "La fecha de inicio", true),
    expiresAt: sanitizeOptionalDate(subscription.expiresAt, "La fecha de expiracion", true),
    inferred: Boolean(subscription.inferred)
  };
}

function sanitizeRequest(request, usersById, subscriptionsById) {
  if (!isPlainObject(request)) {
    throw createValidationError("La solicitud no es valida.");
  }

  const userId = requireCleanString(request.userId, "El cliente de la solicitud", 80);
  const owner = usersById.get(userId);

  if (!owner || (owner.role || "client") !== "client") {
    throw createValidationError("La solicitud debe pertenecer a un cliente valido.");
  }

  const teacherId = toCleanString(request.teacherId, 80);
  const teacher = teacherId ? usersById.get(teacherId) : null;
  const packageName = requireAllowedValue(request.package || "creditos", ALLOWED_REQUEST_PACKAGES, "El paquete");
  const subscriptionId = toCleanString(request.subscriptionId, 80);

  if (teacherId && (!teacher || teacher.role !== "teacher")) {
    throw createValidationError("El profesor asignado no es valido.");
  }

  if (subscriptionId) {
    const subscription = subscriptionsById.get(subscriptionId);

    if (!subscription || subscription.userId !== userId) {
      throw createValidationError("La suscripcion de la solicitud no es valida.");
    }
  }

  const attachments = Array.isArray(request.attachments)
    ? request.attachments.map((file) => sanitizeAttachment(file, REQUEST_FILE_EXTENSIONS, MAX_REQUEST_FILE_SIZE, "el archivo adjunto"))
    : [];

  if (attachments.length > MAX_REQUEST_FILES) {
    throw createValidationError(`La solicitud permite maximo ${MAX_REQUEST_FILES} archivos.`);
  }

  const totalAttachmentSize = attachments.reduce((total, file) => total + file.size, 0);

  if (totalAttachmentSize > MAX_REQUEST_TOTAL_SIZE) {
    throw createValidationError("El peso total de la solicitud supera el limite permitido.");
  }

  const files = attachments.length
    ? attachments.map((file) => file.name)
    : (Array.isArray(request.files) ? request.files.map((fileName) => requireCleanString(fileName, "El archivo", 180)) : []);
  const validFileNames = new Set(files);
  const pageDetails = sanitizePageDetails(request.pageDetails, validFileNames);
  const pages = sanitizePositiveInteger(request.pages || pageDetails.reduce((total, item) => total + item.pages, 0), "La cantidad de paginas", 500);
  const workCount = sanitizePositiveInteger(request.workCount || files.length, "La cantidad de archivos", 50);
  const delivery = request.delivery
    ? sanitizeAttachment(request.delivery, DELIVERY_FILE_EXTENSIONS, MAX_DELIVERY_FILE_SIZE, "la entrega")
    : null;

  if (attachments.length && workCount !== attachments.length) {
    throw createValidationError("La cantidad de archivos no coincide con los adjuntos.");
  }

  return {
    id: requireCleanString(request.id, "El id de la solicitud", 80),
    userId,
    status: requireAllowedValue(request.status || "Recibida", ALLOWED_REQUEST_STATUSES, "El estado"),
    createdAt: sanitizeOptionalDate(request.createdAt || new Date().toISOString(), "La fecha de creacion"),
    updatedAt: sanitizeOptionalDate(request.updatedAt, "La fecha de actualizacion"),
    teacherId: teacher ? teacher.id : "",
    teacherName: teacher ? teacher.name : "",
    assignedAt: teacher ? sanitizeOptionalDate(request.assignedAt || new Date().toISOString(), "La fecha de asignacion") : "",
    subscriptionId,
    package: packageName,
    helpType: requireCleanString(request.helpType, "El tipo de ayuda", 120),
    documentType: requireCleanString(request.documentType, "El tipo de documento", 120),
    deliveryTime: requireCleanString(request.deliveryTime, "La hora de entrega", 20),
    format: requireCleanString(request.format, "El formato", 80),
    deadline: sanitizeOptionalDate(request.deadline, "La fecha limite", true),
    workCount,
    pages,
    pageDetails,
    instructions: toCleanString(request.instructions, 5000),
    files,
    attachments,
    delivery,
    deliveredAt: delivery ? sanitizeOptionalDate(request.deliveredAt || new Date().toISOString(), "La fecha de entrega") : "",
    statusHistory: sanitizeStatusHistory(request.statusHistory)
  };
}

function validateStateForStorage(state) {
  if (!isPlainObject(state)) {
    throw createValidationError("Los datos enviados no son validos.");
  }

  const users = Array.isArray(state.oa_users) ? state.oa_users.map(sanitizeUserForStorage) : [];
  const emailSet = new Set();
  const userIds = new Set();

  users.forEach((user) => {
    if (emailSet.has(user.email) || (ADMIN_EMAIL && user.email === ADMIN_EMAIL.toLowerCase())) {
      throw createValidationError("Ya existe una cuenta con este correo.");
    }

    if (userIds.has(user.id)) {
      throw createValidationError("Hay usuarios duplicados.");
    }

    emailSet.add(user.email);
    userIds.add(user.id);
  });

  const usersById = new Map(users.map((user) => [user.id, user]));
  const subscriptions = Array.isArray(state.oa_subscriptions)
    ? state.oa_subscriptions.map((subscription) => sanitizeSubscription(subscription, usersById))
    : [];
  const subscriptionsById = new Map();

  subscriptions.forEach((subscription) => {
    if (subscriptionsById.has(subscription.id)) {
      throw createValidationError("Hay suscripciones duplicadas.");
    }

    subscriptionsById.set(subscription.id, subscription);
  });

  const requests = Array.isArray(state.oa_requests)
    ? state.oa_requests.map((request) => sanitizeRequest(request, usersById, subscriptionsById))
    : [];
  const requestIds = new Set();

  requests.forEach((request) => {
    if (requestIds.has(request.id)) {
      throw createValidationError("Hay solicitudes duplicadas.");
    }

    requestIds.add(request.id);
  });

  return {
    oa_users: users,
    oa_requests: requests,
    oa_subscriptions: subscriptions
  };
}

function getValidatedState() {
  return validateStateForStorage(readState());
}

function saveValidatedState(state) {
  saveState(validateStateForStorage(state));
}

function createPayPalSubscriptionRecord(state, {
  userId,
  plan,
  paypalSubscriptionId,
  paypalPlanId,
  transactionId,
  status = "Activa",
  amount,
  startsAt,
  expiresAt,
  reviewedBy = "paypal",
  paymentNote = ""
}) {
  const usersById = new Map(state.oa_users.map((user) => [user.id, user]));
  const existingByTransaction = transactionId
    ? state.oa_subscriptions.find((subscription) => (
      subscription.paypalSubscriptionId === paypalSubscriptionId
      && subscription.transactionId === transactionId
    ))
    : null;

  if (existingByTransaction) {
    return existingByTransaction;
  }

  const placeholder = state.oa_subscriptions.find((subscription) => (
    subscription.paypalSubscriptionId === paypalSubscriptionId
    && subscription.transactionId === paypalSubscriptionId
    && new Date(subscription.expiresAt) >= new Date(startsAt || Date.now())
  ));

  if (placeholder && transactionId && transactionId !== paypalSubscriptionId) {
    placeholder.transactionId = transactionId;
    placeholder.paymentToken = paypalSubscriptionId;
    placeholder.status = status;
    placeholder.amount = amount;
    placeholder.reviewedAt = new Date().toISOString();
    placeholder.reviewedBy = reviewedBy;
    placeholder.paymentNote = paymentNote || placeholder.paymentNote;
    return sanitizeSubscription(placeholder, usersById);
  }

  const currentCycles = state.oa_subscriptions.filter((subscription) => (
    subscription.paypalSubscriptionId === paypalSubscriptionId
    && ["Pagado", "Activa", "Cancelada", "Expirado"].includes(subscription.status)
  )).length;
  const createdAt = new Date();
  const subscription = sanitizeSubscription({
    id: crypto.randomUUID(),
    userId,
    plan,
    status,
    paymentMethod: "paypal-subscription",
    amount,
    currency: PAYPAL_CURRENCY,
    transactionId: transactionId || paypalSubscriptionId,
    paymentToken: paypalSubscriptionId,
    paymentProof: null,
    paymentNote,
    paypalSubscriptionId,
    paypalPlanId,
    billingCycle: currentCycles + 1,
    reviewedAt: createdAt.toISOString(),
    reviewedBy,
    createdAt: startsAt || createdAt.toISOString(),
    startsAt: startsAt || createdAt.toISOString(),
    expiresAt: expiresAt || addDays(createdAt, 30).toISOString()
  }, usersById);

  state.oa_subscriptions.unshift(subscription);
  return subscription;
}

async function verifyPayPalWebhook(request) {
  if (!PAYPAL_WEBHOOK_ID) {
    throw createPublicError(503, "PAYPAL_WEBHOOK_ID no esta configurado.");
  }

  const rawBody = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : JSON.stringify(request.body || {});
  const webhookEvent = JSON.parse(rawBody || "{}");
  const verification = await requestPayPal("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: request.get("paypal-auth-algo"),
      cert_url: request.get("paypal-cert-url"),
      transmission_id: request.get("paypal-transmission-id"),
      transmission_sig: request.get("paypal-transmission-sig"),
      transmission_time: request.get("paypal-transmission-time"),
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent
    })
  });

  if (verification.verification_status !== "SUCCESS") {
    throw createPublicError(401, "No se pudo verificar el webhook de PayPal.");
  }

  return webhookEvent;
}

async function handlePayPalSubscriptionWebhook(event) {
  const state = getValidatedState();
  const resource = event.resource || {};
  const eventType = event.event_type || "";
  const paypalSubscriptionId = toCleanString(
    resource.billing_agreement_id || resource.billing_agreementId || resource.subscription_id || resource.id,
    120
  );

  if (!paypalSubscriptionId) {
    logSecurityEvent("paypal_webhook_ignored", { eventType, reason: "missing_subscription_id" });
    return null;
  }

  const subscriptionDetails = await requestPayPal(`/v1/billing/subscriptions/${encodeURIComponent(paypalSubscriptionId)}`, {
    method: "GET"
  });
  const plan = getPlanFromPayPalPlanId(subscriptionDetails.plan_id);
  const existingSeriesSubscription = state.oa_subscriptions.find((subscription) => subscription.paypalSubscriptionId === paypalSubscriptionId);
  const userId = getPayPalSubscriptionUserId(subscriptionDetails, existingSeriesSubscription?.userId || "");
  const user = state.oa_users.find((item) => item.id === userId);

  if (!plan || !user) {
    logSecurityEvent("paypal_webhook_ignored", { eventType, paypalSubscriptionId, reason: "unknown_plan_or_user" });
    return null;
  }

  if (eventType === "PAYMENT.SALE.COMPLETED") {
    const paidAt = sanitizeOptionalDate(resource.create_time || event.create_time || new Date().toISOString(), "La fecha del pago", true);
    const saleId = toCleanString(resource.id, 120) || paypalSubscriptionId;
    const amount = sanitizePaymentAmount(resource.amount?.total || resource.amount?.value || getPlanPrice(plan), plan);
    const handled = createPayPalSubscriptionRecord(state, {
      userId,
      plan,
      paypalSubscriptionId,
      paypalPlanId: subscriptionDetails.plan_id,
      transactionId: saleId,
      status: "Pagado",
      amount,
      startsAt: paidAt,
      expiresAt: getPayPalSubscriptionNextBilling(subscriptionDetails, new Date(paidAt)),
      paymentNote: "Renovacion PayPal confirmada"
    });
    saveValidatedState(state);
    return handled;
  }

  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
    const handled = createPayPalSubscriptionRecord(state, {
      userId,
      plan,
      paypalSubscriptionId,
      paypalPlanId: subscriptionDetails.plan_id,
      transactionId: paypalSubscriptionId,
      status: "Activa",
      amount: getPlanPrice(plan),
      startsAt: sanitizeOptionalDate(event.create_time || new Date().toISOString(), "La fecha de activacion", true),
      expiresAt: getPayPalSubscriptionNextBilling(subscriptionDetails),
      paymentNote: "Suscripcion PayPal activada"
    });
    saveValidatedState(state);
    return handled;
  }

  const latest = state.oa_subscriptions.find((subscription) => subscription.paypalSubscriptionId === paypalSubscriptionId);

  if (latest && eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
    latest.status = "Cancelada";
    latest.cancelledAt = sanitizeOptionalDate(resource.status_update_time || event.create_time || new Date().toISOString(), "La fecha de cancelacion", true);
    latest.cancellationEffectiveAt = latest.expiresAt;
    latest.paymentNote = "Cancelada en PayPal";
    saveValidatedState(state);
    return latest;
  }

  if (latest && eventType === "BILLING.SUBSCRIPTION.SUSPENDED") {
    latest.status = "Suspendida";
    latest.paymentNote = "Suspendida en PayPal";
    saveValidatedState(state);
    return latest;
  }

  if (latest && eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
    latest.lastPaymentFailedAt = sanitizeOptionalDate(event.create_time || new Date().toISOString(), "La fecha de pago fallido", true);
    latest.paymentNote = "PayPal reporto un pago fallido";
    saveValidatedState(state);
    return latest;
  }

  return latest;
}

function findStoredFile(state, storageKey) {
  for (const request of state.oa_requests) {
    const attachment = (request.attachments || []).find((file) => file.storageKey === storageKey);

    if (attachment) {
      return { request, file: attachment };
    }

    if (request.delivery?.storageKey === storageKey) {
      return { request, file: request.delivery };
    }
  }

  return null;
}

function canAccessRequestFile(user, request) {
  return user.role === "admin"
    || request.userId === user.id
    || (user.role === "teacher" && request.teacherId === user.id);
}

function mergeRoleState(currentState, nextState, user) {
  const validatedCurrentState = validateStateForStorage(currentState);

  if (user.role === "admin") {
    return validateStateForStorage(restoreMissingUserPasswords(validatedCurrentState, { ...defaultState, ...nextState }));
  }

  const incomingRequests = Array.isArray(nextState.oa_requests) ? nextState.oa_requests : [];
  const incomingSubscriptions = Array.isArray(nextState.oa_subscriptions) ? nextState.oa_subscriptions : [];

  if (user.role === "teacher") {
    const teacherRequestIds = new Set(
      validatedCurrentState.oa_requests
        .filter((request) => request.teacherId === user.id)
        .map((request) => request.id)
    );
    const updatedTeacherRequests = incomingRequests
      .filter((request) => teacherRequestIds.has(request.id))
      .map((request) => {
        const currentRequest = validatedCurrentState.oa_requests.find((item) => item.id === request.id);
        const nextStatus = requireAllowedValue(request.status || currentRequest.status, ALLOWED_REQUEST_STATUSES, "El estado");
        const delivery = request.delivery
          ? sanitizeAttachment(request.delivery, DELIVERY_FILE_EXTENSIONS, MAX_DELIVERY_FILE_SIZE, "la entrega")
          : currentRequest.delivery;
        return {
          ...currentRequest,
          status: delivery ? "Entrega subida" : nextStatus,
          delivery,
          deliveredAt: delivery ? sanitizeOptionalDate(request.deliveredAt || new Date().toISOString(), "La fecha de entrega") : currentRequest.deliveredAt,
          updatedAt: sanitizeOptionalDate(request.updatedAt || new Date().toISOString(), "La fecha de actualizacion")
        };
      });

    return validateStateForStorage({
      ...validatedCurrentState,
      oa_requests: validatedCurrentState.oa_requests.map((request) => (
        teacherRequestIds.has(request.id)
          ? updatedTeacherRequests.find((item) => item.id === request.id) || request
          : request
      ))
    });
  }

  const ownRequestIds = new Set(
    validatedCurrentState.oa_requests
      .filter((request) => request.userId === user.id)
      .map((request) => request.id)
  );
  const safeIncomingRequests = incomingRequests
    .filter((request) => request.userId === user.id)
    .map((request) => ({
      ...request,
      userId: user.id,
      status: ownRequestIds.has(request.id) ? validatedCurrentState.oa_requests.find((item) => item.id === request.id).status : "Recibida",
      teacherId: ownRequestIds.has(request.id) ? validatedCurrentState.oa_requests.find((item) => item.id === request.id).teacherId : request.teacherId,
      teacherName: ownRequestIds.has(request.id) ? validatedCurrentState.oa_requests.find((item) => item.id === request.id).teacherName : request.teacherName,
      assignedAt: ownRequestIds.has(request.id) ? validatedCurrentState.oa_requests.find((item) => item.id === request.id).assignedAt : request.assignedAt,
      delivery: ownRequestIds.has(request.id) ? validatedCurrentState.oa_requests.find((item) => item.id === request.id).delivery : request.delivery,
      deliveredAt: ownRequestIds.has(request.id) ? validatedCurrentState.oa_requests.find((item) => item.id === request.id).deliveredAt : request.deliveredAt
    }));
  const safeIncomingSubscriptions = incomingSubscriptions
    .filter((subscription) => subscription.userId === user.id)
    .map((subscription) => ({ ...subscription, userId: user.id }));

  return validateStateForStorage({
    ...validatedCurrentState,
    oa_requests: [
      ...safeIncomingRequests,
      ...validatedCurrentState.oa_requests.filter((request) => request.userId !== user.id)
    ],
    oa_subscriptions: [
      ...safeIncomingSubscriptions,
      ...validatedCurrentState.oa_subscriptions.filter((subscription) => subscription.userId !== user.id)
    ]
  });
}

app.use((request, response, next) => {
  const forwardedProto = request.get("x-forwarded-proto");

  if (FORCE_HTTPS && request.method === "GET" && !request.secure && forwardedProto !== "https") {
    response.redirect(301, `https://${request.get("host")}${request.originalUrl}`);
    return;
  }

  if (FORCE_HTTPS && request.method !== "GET" && !request.secure && forwardedProto !== "https") {
    sendError(response, createPublicError(403, "HTTPS es obligatorio."));
    return;
  }

  next();
});

app.use((request, response, next) => {
  const requestHost = (request.get("host") || "").toLowerCase();
  const hostWithoutPort = requestHost.split(":")[0];

  if (!CANONICAL_HOST || !hostWithoutPort || hostWithoutPort === CANONICAL_HOST) {
    next();
    return;
  }

  if (hostWithoutPort === `www.${CANONICAL_HOST}`) {
    const forwardedProto = request.get("x-forwarded-proto");
    const protocol = FORCE_HTTPS || forwardedProto === "https" || request.secure ? "https" : request.protocol;
    response.redirect(308, `${protocol}://${CANONICAL_HOST}${request.originalUrl}`);
    return;
  }

  next();
});

app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https://www.paypalobjects.com https://*.paypal.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com; connect-src 'self' https://challenges.cloudflare.com https://*.paypal.com https://*.paypalobjects.com; frame-src https://challenges.cloudflare.com https://www.paypal.com https://*.paypal.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://*.paypal.com"
  );

  if (FORCE_HTTPS) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

app.use((request, response, next) => {
  const origin = request.get("Origin");

  response.header("Vary", "Origin");

  if (origin) {
    if (!allowedOrigins.has(origin)) {
      sendError(response, createPublicError(403, "Origen no permitido."));
      return;
    }

    response.header("Access-Control-Allow-Origin", origin);
  }

  response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.header("Access-Control-Allow-Credentials", "true");
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.use((request, response, next) => {
  const blockedPath = decodeURIComponent(request.path).toLowerCase();

  if (
    blockedPath.includes(".env")
    || blockedPath.includes("/server/")
    || blockedPath.includes("/data/")
    || blockedPath.includes("/backups/")
    || blockedPath.includes("/logs/")
    || blockedPath.endsWith(".sqlite")
    || blockedPath.endsWith(".sqlite-wal")
    || blockedPath.endsWith(".sqlite-shm")
  ) {
    logSecurityEvent("blocked_internal_file", { ip: getClientIp(request), path: request.path });
    sendError(response, createPublicError(404, "Ruta no encontrada."));
    return;
  }

  next();
});

app.post("/api/paypal/webhooks", express.raw({ type: "application/json", limit: "2mb" }), async (request, response) => {
  try {
    const event = await verifyPayPalWebhook(request);
    const handledSubscription = await handlePayPalSubscriptionWebhook(event);

    logSecurityEvent("paypal_webhook_received", {
      eventType: event.event_type || "",
      paypalSubscriptionId: handledSubscription?.paypalSubscriptionId || ""
    });
    response.json({ ok: true });
  } catch (error) {
    sendError(response, error, "No se pudo procesar el webhook de PayPal.");
  }
});

app.use(express.json({ limit: "25mb" }));

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    sendError(response, createPublicError(400, "El cuerpo JSON no es valido."));
    return;
  }

  if (error && error.type === "entity.too.large") {
    sendError(response, createPublicError(413, "El contenido enviado es demasiado grande."));
    return;
  }

  next(error);
});

app.get("/api/state", (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  response.json(filterStateForUser(auth.state, auth.user));
});

app.get("/api/public-config", (request, response) => {
  response.json({
    ok: true,
    turnstileSiteKey: TURNSTILE_SITE_KEY
  });
});

app.post("/api/state", (request, response) => {
  sendError(response, createPublicError(405, "Usa endpoints especificos para modificar datos."));
});

const loginRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login" });
const registerRateLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "register" });
const formRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 8, keyPrefix: "form" });
const adminActionRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: "admin-action" });

app.get("/api/me", (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  response.json({ ok: true, user: auth.user });
});

app.get("/api/auth/google/start", loginRateLimit, (request, response) => {
  try {
    if (!isGoogleAuthConfigured()) {
      throw createPublicError(503, "El inicio de sesion con Google no esta configurado todavia.");
    }

    const stateToken = createGoogleOAuthStateToken(request.query?.next || "");
    setGoogleOAuthStateCookie(response, stateToken);
    response.redirect(getGoogleOAuthUrl(stateToken));
  } catch (error) {
    logSecurityEvent("google_oauth_start_failed", { ip: getClientIp(request), reason: error.publicMessage || error.message });
    redirectToGoogleAuthError(response, getPublicErrorMessage(error, "No se pudo iniciar sesion con Google."));
  }
});

app.get("/api/auth/google/callback", loginRateLimit, async (request, response) => {
  try {
    if (!isGoogleAuthConfigured()) {
      throw createPublicError(503, "El inicio de sesion con Google no esta configurado todavia.");
    }

    if (request.query?.error) {
      throw createPublicError(400, "Google cancelo el inicio de sesion.");
    }

    const code = requireCleanString(request.query?.code, "El codigo de Google", 1600);
    const stateToken = requireCleanString(request.query?.state, "La sesion de Google", 3000);
    const stateCookie = readCookie(request, GOOGLE_OAUTH_STATE_COOKIE_NAME);

    if (!stateCookie || stateCookie !== stateToken) {
      throw createPublicError(400, "La sesion de Google expiro. Intenta nuevamente.");
    }

    const oauthState = parseGoogleOAuthStateToken(stateToken);
    const googleTokens = await exchangeGoogleCodeForTokens(code);
    const googleProfile = await getGoogleProfile(googleTokens.access_token);
    const safeUser = findOrCreateGoogleClient(googleProfile);

    setSessionCookie(response, safeUser);
    clearGoogleOAuthStateCookie(response);
    logSecurityEvent("google_oauth_success", { userId: safeUser.id, ip: getClientIp(request) });
    response.redirect(getRootRelativeRedirectPath(oauthState.next || "panel.html"));
  } catch (error) {
    logSecurityEvent("google_oauth_callback_failed", { ip: getClientIp(request), reason: error.publicMessage || error.message });
    redirectToGoogleAuthError(response, getPublicErrorMessage(error, "No se pudo iniciar sesion con Google."));
  }
});

app.get("/api/verify-email", loginRateLimit, (request, response) => {
  try {
    const token = requireCleanString(request.query?.token, "El enlace de verificacion", 300);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const state = getValidatedState();
    const user = state.oa_users.find((item) => (
      item.role === "client"
      && item.emailVerificationTokenHash
      && item.emailVerificationTokenHash === tokenHash
    ));

    if (!user) {
      throw createPublicError(400, "El enlace de verificacion no es valido.");
    }

    const expiresAt = new Date(user.emailVerificationTokenExpiresAt || 0);

    if (!Number.isFinite(expiresAt.getTime()) || expiresAt < new Date()) {
      throw createPublicError(400, "El enlace de verificacion expiro. Inicia sesion para solicitar uno nuevo.");
    }

    user.emailVerifiedAt = new Date().toISOString();
    clearEmailVerificationToken(user);
    saveValidatedState(state);
    const safeUser = sanitizeUser(user);
    setSessionCookie(response, safeUser);
    logSecurityEvent("email_verified", { userId: user.id, ip: getClientIp(request) });
    response.redirect("/panel.html?email_verified=1");
  } catch (error) {
    logSecurityEvent("email_verification_failed", { ip: getClientIp(request), reason: error.publicMessage || error.message });
    response.redirect(`/registro.html?verification_error=${encodeURIComponent(getPublicErrorMessage(error, "No se pudo verificar el correo."))}`);
  }
});

app.post("/api/email-verification/resend", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden verificar correo."));
    return;
  }

  try {
    const state = getValidatedState();
    const user = state.oa_users.find((item) => item.id === auth.user.id && item.role === "client");

    if (!user) {
      throw createPublicError(404, "Usuario no encontrado.");
    }

    if (isClientEmailVerified(user)) {
      response.json({ ok: true, alreadyVerified: true, user: sanitizeUser(user) });
      return;
    }

    const token = assignEmailVerificationToken(user);
    saveValidatedState(state);
    queueEmailVerification(user, token);
    logSecurityEvent("email_verification_resent", { userId: user.id, ip: getClientIp(request) });
    response.json({ ok: true, sent: true, user: sanitizeUser(user) });
  } catch (error) {
    sendError(response, error, "No se pudo reenviar la verificacion.");
  }
});

app.post("/api/teachers", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para crear profesores."));
    return;
  }

  try {
    const state = getValidatedState();
    const email = requireValidEmail(request.body?.email);
    const exists = state.oa_users.some((user) => user.email === email)
      || (ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase());

    if (exists) {
      throw createPublicError(409, "Ya existe una cuenta con este correo.");
    }

    const teacher = sanitizeUserForStorage({
      id: crypto.randomUUID(),
      name: request.body?.name,
      email,
      phone: request.body?.phone,
      password: request.body?.password,
      role: "teacher",
      specialty: request.body?.specialty,
      createdAt: new Date().toISOString()
    });

    state.oa_users.push(teacher);
    saveValidatedState(state);
    logSecurityEvent("teacher_created", { actorId: auth.user.id, teacherId: teacher.id });
    response.json({ ok: true, user: sanitizeUser(teacher) });
  } catch (error) {
    sendError(response, error, "No se pudo crear el profesor.");
  }
});

app.post("/api/users/:userId/password", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para cambiar contrasenas."));
    return;
  }

  try {
    const state = getValidatedState();
    const userId = requireCleanString(request.params.userId, "El usuario", 80);
    const password = requirePassword(request.body?.password);
    const targetUser = state.oa_users.find((user) => user.id === userId);

    if (!targetUser) {
      throw createPublicError(404, "Usuario no encontrado.");
    }

    targetUser.password = hashPassword(password);
    saveValidatedState(state);
    logSecurityEvent("password_reset", { actorId: auth.user.id, userId: targetUser.id });
    response.json({ ok: true, user: sanitizeUser(targetUser) });
  } catch (error) {
    sendError(response, error, "No se pudo cambiar la contrasena.");
  }
});

app.post("/api/me/password", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  try {
    const state = getValidatedState();
    const currentPassword = requirePassword(request.body?.currentPassword);
    const nextPassword = requirePassword(request.body?.newPassword);
    const targetUser = state.oa_users.find((user) => user.id === auth.user.id);

    if (!targetUser || !verifyPassword(currentPassword, targetUser.password)) {
      throw createPublicError(403, "La contrasena actual no es correcta.");
    }

    targetUser.password = hashPassword(nextPassword);
    saveValidatedState(state);
    logSecurityEvent("self_password_changed", { actorId: auth.user.id });
    response.json({ ok: true, user: sanitizeUser(targetUser) });
  } catch (error) {
    sendError(response, error, "No se pudo cambiar la contrasena.");
  }
});

app.post("/api/users/:userId", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para editar usuarios."));
    return;
  }

  try {
    const state = getValidatedState();
    const userId = requireCleanString(request.params.userId, "El usuario", 80);
    const targetUser = state.oa_users.find((user) => user.id === userId);

    if (!targetUser) {
      throw createPublicError(404, "Usuario no encontrado.");
    }

    const email = requireValidEmail(request.body?.email);
    const exists = state.oa_users.some((user) => user.id !== userId && user.email === email)
      || (ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase());

    if (exists) {
      throw createPublicError(409, "Ya existe una cuenta con este correo.");
    }

    targetUser.name = requireCleanString(request.body?.name, "El nombre", 120);
    targetUser.email = email;
    targetUser.phone = toCleanString(request.body?.phone, 40);

    saveValidatedState(state);
    logSecurityEvent("user_updated", { actorId: auth.user.id, userId: targetUser.id });
    response.json({ ok: true, user: sanitizeUser(targetUser) });
  } catch (error) {
    sendError(response, error, "No se pudo actualizar el usuario.");
  }
});

app.post("/api/users/:userId/delete", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para eliminar clientes."));
    return;
  }

  try {
    const confirmation = toCleanString(request.body?.confirmation, 40).toUpperCase();

    if (confirmation !== "ELIMINAR") {
      throw createPublicError(400, "Escribe ELIMINAR para confirmar.");
    }

    const state = getValidatedState();
    const userId = requireCleanString(request.params.userId, "El cliente", 80);
    const targetUser = state.oa_users.find((user) => user.id === userId);

    if (!targetUser || targetUser.role !== "client") {
      throw createPublicError(404, "Cliente no encontrado.");
    }

    const removedRequests = state.oa_requests.filter((request) => request.userId === userId);
    const removedSubscriptions = state.oa_subscriptions.filter((subscription) => subscription.userId === userId);
    const storageKeys = collectClientStorageKeys({
      requests: removedRequests,
      subscriptions: removedSubscriptions
    });

    state.oa_users = state.oa_users.filter((user) => user.id !== userId);
    state.oa_requests = state.oa_requests.filter((request) => request.userId !== userId);
    state.oa_subscriptions = state.oa_subscriptions.filter((subscription) => subscription.userId !== userId);

    saveValidatedState(state);

    const deletedFiles = storageKeys.reduce((count, storageKey) => (
      removeStoredFile(storageKey) ? count + 1 : count
    ), 0);

    logSecurityEvent("client_deleted", {
      actorId: auth.user.id,
      userId,
      requests: removedRequests.length,
      subscriptions: removedSubscriptions.length,
      files: deletedFiles
    });
    response.json({
      ok: true,
      deleted: {
        userId,
        requests: removedRequests.length,
        subscriptions: removedSubscriptions.length,
        files: deletedFiles
      }
    });
  } catch (error) {
    sendError(response, error, "No se pudo eliminar el cliente.");
  }
});

app.post("/api/users/:userId/teacher", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para asignar profesores."));
    return;
  }

  try {
    const state = getValidatedState();
    const userId = requireCleanString(request.params.userId, "El cliente", 80);
    const teacherId = toCleanString(request.body?.teacherId, 80);
    const client = state.oa_users.find((user) => user.id === userId && user.role === "client");
    const teacher = teacherId ? state.oa_users.find((user) => user.id === teacherId && user.role === "teacher") : null;

    if (!client) {
      throw createPublicError(404, "Cliente no encontrado.");
    }

    if (teacherId && !teacher) {
      throw createPublicError(404, "Profesor no encontrado.");
    }

    client.teacherId = teacher ? teacher.id : "";
    client.teacherName = teacher ? teacher.name : "";
    saveValidatedState(state);
    response.json({ ok: true, user: sanitizeUser(client) });
  } catch (error) {
    sendError(response, error, "No se pudo actualizar el profesor del cliente.");
  }
});

app.post("/api/admin/subscriptions", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para gestionar pagos."));
    return;
  }

  try {
    const state = getValidatedState();
    const usersById = new Map(state.oa_users.map((user) => [user.id, user]));
    const createdAt = new Date();
    const startsAt = sanitizeOptionalDate(request.body?.startsAt || createdAt.toISOString(), "La fecha de inicio", true);
    const plan = requireAllowedValue(request.body?.plan, ALLOWED_PLANS, "El plan");
    const status = requireAllowedValue(normalizeSubscriptionStatus(request.body?.status || "Pagado"), ALLOWED_SUBSCRIPTION_STATUSES, "El estado de la suscripcion");
    const isConfirmedPayment = ["Pagado", "Activa"].includes(status);
    const expiresAt = sanitizeOptionalDate(request.body?.expiresAt || (isCreditPackPlan(plan) ? "" : addDays(createdAt, 30).toISOString()), "La fecha de expiracion", true);
    const subscription = sanitizeSubscription({
      id: crypto.randomUUID(),
      userId: request.body?.userId,
      plan,
      status,
      paymentMethod: request.body?.paymentMethod || "manual-admin",
      amount: request.body?.amount,
      currency: request.body?.currency || "USD",
      transactionId: request.body?.transactionId || request.body?.paymentToken || `admin-${crypto.randomUUID()}`,
      paymentToken: request.body?.paymentToken || request.body?.transactionId || `admin-${crypto.randomUUID()}`,
      paymentProof: request.body?.paymentProof || null,
      reviewedAt: isConfirmedPayment ? createdAt.toISOString() : "",
      reviewedBy: isConfirmedPayment ? auth.user.id : "",
      createdAt: createdAt.toISOString(),
      startsAt,
      expiresAt
    }, usersById);

    state.oa_subscriptions.unshift(subscription);
    saveValidatedState(state);
    logSecurityEvent("subscription_created_by_admin", { actorId: auth.user.id, subscriptionId: subscription.id, userId: subscription.userId });
    response.json({ ok: true, subscription });
  } catch (error) {
    sendError(response, error, "No se pudo crear el pago.");
  }
});

app.post("/api/subscriptions/:subscriptionId", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para gestionar pagos."));
    return;
  }

  try {
    const state = getValidatedState();
    const subscriptionId = requireCleanString(request.params.subscriptionId, "La suscripcion", 80);
    const targetSubscription = state.oa_subscriptions.find((subscription) => subscription.id === subscriptionId);

    if (!targetSubscription) {
      throw createPublicError(404, "Suscripcion no encontrada.");
    }

    targetSubscription.plan = requireAllowedValue(request.body?.plan || targetSubscription.plan, ALLOWED_PLANS, "El plan");
    const nextStatus = requireAllowedValue(normalizeSubscriptionStatus(request.body?.status || targetSubscription.status), ALLOWED_SUBSCRIPTION_STATUSES, "El estado de la suscripcion");
    targetSubscription.status = nextStatus;
    targetSubscription.expiresAt = sanitizeOptionalDate(request.body?.expiresAt || targetSubscription.expiresAt, "La fecha de expiracion", true);
    targetSubscription.startsAt = sanitizeOptionalDate(request.body?.startsAt || targetSubscription.startsAt, "La fecha de inicio", true);
    targetSubscription.paymentMethod = toCleanString(request.body?.paymentMethod || targetSubscription.paymentMethod, 80);
    targetSubscription.amount = request.body?.amount ? sanitizePaymentAmount(request.body.amount, targetSubscription.plan) : targetSubscription.amount;
    targetSubscription.currency = toCleanString(request.body?.currency || targetSubscription.currency || "USD", 8);
    targetSubscription.transactionId = toCleanString(request.body?.transactionId || targetSubscription.transactionId || targetSubscription.paymentToken, 120);
    targetSubscription.paymentToken = toCleanString(request.body?.paymentToken || targetSubscription.paymentToken || targetSubscription.transactionId, 120);

    if (request.body?.paymentProof) {
      targetSubscription.paymentProof = sanitizePaymentProof(request.body.paymentProof);
    }

    if (["Pagado", "Activa"].includes(nextStatus)) {
      if (!targetSubscription.reviewedAt) {
        targetSubscription.reviewedAt = new Date().toISOString();
      }
      targetSubscription.reviewedBy = auth.user.id;
      state.oa_requests.forEach((item) => {
        if (item.subscriptionId === targetSubscription.id && item.status === "Pendiente de pago") {
          item.status = "Recibida";
          item.updatedAt = new Date().toISOString();
          appendStatusHistory(item, "Recibida", auth.user, { note: "Pago confirmado" });
        }
      });
    }

    saveValidatedState(state);
    logSecurityEvent("subscription_updated_by_admin", { actorId: auth.user.id, subscriptionId: targetSubscription.id });
    response.json({ ok: true, subscription: targetSubscription });
  } catch (error) {
    sendError(response, error, "No se pudo actualizar el pago.");
  }
});

app.get("/api/paypal/config", (request, response) => {
  response.json({
    ok: true,
    enabled: isPayPalConfigured(),
    subscriptionsEnabled: arePayPalSubscriptionsConfigured(),
    clientId: PAYPAL_CLIENT_ID,
    currency: PAYPAL_CURRENCY,
    environment: PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox",
    planIds: PAYPAL_SUBSCRIPTION_PLAN_IDS
  });
});

app.post("/api/paypal/orders", formRateLimit, async (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden pagar planes."));
    return;
  }

  if (!requireVerifiedClient(auth, response)) {
    return;
  }

  try {
    const plan = requireAllowedValue(request.body?.plan, ALLOWED_PLANS, "El plan");
    const amount = getPlanPrice(plan).toFixed(2);
    const order = await requestPayPal("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: plan,
          custom_id: `${auth.user.id}:${plan}`,
          description: `ZeroCopy IA - ${plan}`,
          amount: {
            currency_code: PAYPAL_CURRENCY,
            value: amount
          }
        }]
      })
    });

    logSecurityEvent("paypal_order_created", { userId: auth.user.id, orderId: order.id, plan });
    response.json({ ok: true, id: order.id });
  } catch (error) {
    sendError(response, error, "No se pudo crear la orden de PayPal.");
  }
});

app.post("/api/paypal/orders/:orderId/capture", formRateLimit, async (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden confirmar pagos."));
    return;
  }

  if (!requireVerifiedClient(auth, response)) {
    return;
  }

  try {
    const state = getValidatedState();
    const usersById = new Map(state.oa_users.map((user) => [user.id, user]));
    const plan = requireAllowedValue(request.body?.plan, ALLOWED_PLANS, "El plan");
    const orderId = requireCleanString(request.params.orderId, "La orden de PayPal", 120);
    const existingByToken = state.oa_subscriptions.find((subscription) => (
      subscription.userId === auth.user.id && subscription.paymentToken === orderId
    ));

    if (existingByToken) {
      response.json({ ok: true, subscription: existingByToken });
      return;
    }

    const order = await requestPayPal(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      body: "{}"
    });
    const capture = verifyPayPalCapture(order, plan);
    const createdAt = new Date();
    const subscription = sanitizeSubscription({
      id: crypto.randomUUID(),
      userId: auth.user.id,
      plan,
      status: "Pagado",
      paymentMethod: isCreditPackPlan(plan) ? "paypal-credits" : "paypal",
      amount: getPlanPrice(plan),
      currency: PAYPAL_CURRENCY,
      transactionId: capture.id || orderId,
      paymentToken: orderId,
      paymentProof: null,
      paymentNote: isCreditPackPlan(plan) ? "Compra unica de creditos" : "",
      reviewedAt: createdAt.toISOString(),
      reviewedBy: "paypal",
      createdAt: createdAt.toISOString(),
      startsAt: createdAt.toISOString(),
      expiresAt: isCreditPackPlan(plan) ? "" : addDays(createdAt, 30).toISOString()
    }, usersById);

    state.oa_subscriptions.unshift(subscription);
    state.oa_requests.forEach((item) => {
      if (item.subscriptionId === subscription.id && item.status === "Pendiente de pago") {
        item.status = "Recibida";
        item.updatedAt = new Date().toISOString();
        appendStatusHistory(item, "Recibida", auth.user, { note: "Pago PayPal confirmado" });
      }
    });

    saveValidatedState(state);
    logSecurityEvent("paypal_order_captured", { userId: auth.user.id, orderId, captureId: capture.id, subscriptionId: subscription.id });
    response.json({ ok: true, subscription });
  } catch (error) {
    sendError(response, error, "No se pudo confirmar el pago de PayPal.");
  }
});

app.post("/api/paypal/subscriptions/:paypalSubscriptionId/activate", formRateLimit, async (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden confirmar suscripciones."));
    return;
  }

  if (!requireVerifiedClient(auth, response)) {
    return;
  }

  try {
    const state = getValidatedState();
    const plan = requireAllowedValue(request.body?.plan, SUBSCRIPTION_PLANS, "El plan");
    const paypalSubscriptionId = requireCleanString(request.params.paypalSubscriptionId, "La suscripcion de PayPal", 120);
    const existing = state.oa_subscriptions.find((subscription) => (
      subscription.userId === auth.user.id
      && subscription.paypalSubscriptionId === paypalSubscriptionId
    ));

    if (existing) {
      response.json({ ok: true, subscription: existing });
      return;
    }

    const paypalSubscription = await requestPayPal(`/v1/billing/subscriptions/${encodeURIComponent(paypalSubscriptionId)}`, {
      method: "GET"
    });

    verifyPayPalSubscriptionDetails(paypalSubscription, plan);

    const paypalUserId = getPayPalSubscriptionUserId(paypalSubscription, auth.user.id);

    if (paypalUserId !== auth.user.id) {
      throw createPublicError(403, "La suscripcion de PayPal pertenece a otro cliente.");
    }

    const createdAt = new Date();
    const subscription = createPayPalSubscriptionRecord(state, {
      userId: auth.user.id,
      plan,
      paypalSubscriptionId,
      paypalPlanId: paypalSubscription.plan_id,
      transactionId: paypalSubscriptionId,
      status: "Activa",
      amount: getPlanPrice(plan),
      startsAt: createdAt.toISOString(),
      expiresAt: getPayPalSubscriptionNextBilling(paypalSubscription, createdAt),
      paymentNote: "Suscripcion PayPal aprobada"
    });

    saveValidatedState(state);
    logSecurityEvent("paypal_subscription_activated", { userId: auth.user.id, paypalSubscriptionId, subscriptionId: subscription.id, plan });
    response.json({ ok: true, subscription });
  } catch (error) {
    sendError(response, error, "No se pudo activar la suscripcion de PayPal.");
  }
});

app.post("/api/subscriptions/:subscriptionId/cancel", formRateLimit, async (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  try {
    const state = getValidatedState();
    const subscriptionId = requireCleanString(request.params.subscriptionId, "La suscripcion", 80);
    const targetSubscription = state.oa_subscriptions.find((subscription) => subscription.id === subscriptionId);

    if (!targetSubscription) {
      throw createPublicError(404, "Suscripcion no encontrada.");
    }

    if (auth.user.role !== "admin" && targetSubscription.userId !== auth.user.id) {
      throw createPublicError(403, "No tienes permiso para cancelar esta suscripcion.");
    }

    if (targetSubscription.paymentMethod !== "paypal-subscription" || !targetSubscription.paypalSubscriptionId) {
      throw createPublicError(409, "Esta suscripcion no es recurrente de PayPal.");
    }

    await requestPayPal(`/v1/billing/subscriptions/${encodeURIComponent(targetSubscription.paypalSubscriptionId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cancelada desde ZeroCopy IA" })
    });

    const cancelledAt = new Date().toISOString();
    state.oa_subscriptions.forEach((subscription) => {
      if (subscription.paypalSubscriptionId === targetSubscription.paypalSubscriptionId && ["Pagado", "Activa"].includes(subscription.status)) {
        subscription.status = "Cancelada";
        subscription.cancelledAt = cancelledAt;
        subscription.cancellationEffectiveAt = subscription.expiresAt;
        subscription.paymentNote = "Cancelada desde la plataforma";
      }
    });

    saveValidatedState(state);
    logSecurityEvent("paypal_subscription_cancelled", { actorId: auth.user.id, subscriptionId, paypalSubscriptionId: targetSubscription.paypalSubscriptionId });
    response.json({ ok: true, subscription: targetSubscription });
  } catch (error) {
    sendError(response, error, "No se pudo cancelar la suscripcion.");
  }
});

app.post("/api/bank-payment-requests", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden solicitar datos bancarios."));
    return;
  }

  if (!requireVerifiedClient(auth, response)) {
    return;
  }

  try {
    const state = getValidatedState();
    const usersById = new Map(state.oa_users.map((user) => [user.id, user]));
    const plan = requireAllowedValue(request.body?.plan, ALLOWED_PLANS, "El plan");
    const whatsapp = requireCleanString(request.body?.whatsapp || auth.user.phone, "El WhatsApp", 40);
    const existingPending = state.oa_subscriptions.find((subscription) => (
      subscription.userId === auth.user.id
      && subscription.plan === plan
      && subscription.paymentMethod === "ach-deposito"
      && subscription.status === "Pendiente"
    ));

    if (existingPending) {
      existingPending.paymentContact = whatsapp;
      existingPending.paymentNote = "Cliente solicita datos bancarios por WhatsApp.";
      existingPending.updatedAt = new Date().toISOString();
      saveValidatedState(state);
      response.json({ ok: true, subscription: existingPending });
      return;
    }

    const createdAt = new Date();
    const paymentToken = `bank-${crypto.randomUUID()}`;
    const subscription = sanitizeSubscription({
      id: crypto.randomUUID(),
      userId: auth.user.id,
      plan,
      status: "Pendiente",
      paymentMethod: "ach-deposito",
      amount: getPlanPrice(plan),
      currency: PAYPAL_CURRENCY,
      transactionId: paymentToken,
      paymentToken,
      paymentProof: null,
      paymentContact: whatsapp,
      paymentNote: "Cliente solicita datos bancarios por WhatsApp.",
      createdAt: createdAt.toISOString(),
      startsAt: createdAt.toISOString(),
      expiresAt: isCreditPackPlan(plan) ? "" : addDays(createdAt, 30).toISOString()
    }, usersById);

    state.oa_subscriptions.unshift(subscription);
    saveValidatedState(state);
    logSecurityEvent("bank_payment_requested", { userId: auth.user.id, subscriptionId: subscription.id, plan });
    response.json({ ok: true, subscription });
  } catch (error) {
    sendError(response, error, "No se pudo solicitar el pago bancario.");
  }
});

app.post("/api/subscriptions", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden crear suscripciones."));
    return;
  }

  if (!requireVerifiedClient(auth, response)) {
    return;
  }

  try {
    const state = getValidatedState();
    const plan = requireAllowedValue(request.body?.plan, ALLOWED_PLANS, "El plan");
    const paymentMethod = requireCleanString(request.body?.paymentMethod || "transferencia", "El metodo de pago", 80);
    const transactionId = requireCleanString(request.body?.transactionId || request.body?.paymentToken || crypto.randomUUID(), "La referencia de pago", 120);
    const amount = sanitizePaymentAmount(request.body?.amount, plan);
    const paymentProof = sanitizePaymentProof(request.body?.paymentProof);
    const paymentToken = transactionId;

    if (!paymentProof) {
      throw createValidationError("Debes subir un comprobante de pago.");
    }
    const existingByToken = state.oa_subscriptions.find((subscription) => (
      subscription.userId === auth.user.id && subscription.paymentToken === paymentToken
    ));

    if (existingByToken) {
      response.json({ ok: true, subscription: existingByToken });
      return;
    }

    const latestActive = state.oa_subscriptions.find((subscription) => (
      subscription.userId === auth.user.id
      && subscription.plan === plan
      && isPaidSubscription(subscription)
      && new Date(subscription.expiresAt) >= new Date()
    ));

    if (!request.body?.paymentToken && latestActive) {
      response.json({ ok: true, subscription: latestActive });
      return;
    }

    const createdAt = new Date();
    const subscription = {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      plan,
      status: "Pendiente",
      paymentMethod,
      amount,
      currency: request.body?.currency || "USD",
      transactionId,
      paymentToken,
      paymentProof,
      createdAt: createdAt.toISOString(),
      startsAt: createdAt.toISOString(),
      expiresAt: isCreditPackPlan(plan) ? "" : addDays(createdAt, 30).toISOString()
    };

    state.oa_subscriptions.unshift(subscription);
    saveValidatedState(state);
    response.json({ ok: true, subscription });
  } catch (error) {
    sendError(response, error, "No se pudo crear la suscripcion.");
  }
});

app.post("/api/requests", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "client") {
    sendError(response, createPublicError(403, "Solo clientes pueden crear solicitudes."));
    return;
  }

  if (!requireVerifiedClient(auth, response)) {
    return;
  }

  try {
    const state = getValidatedState();
    const savedUser = state.oa_users.find((user) => user.id === auth.user.id);
    const assignedTeacher = savedUser?.teacherId
      ? state.oa_users.find((teacher) => teacher.id === savedUser.teacherId && teacher.role === "teacher")
      : null;
    const subscriptionsById = new Map(state.oa_subscriptions.map((subscription) => [subscription.id, subscription]));
    const usersById = new Map(state.oa_users.map((user) => [user.id, user]));
    const requestSubscription = request.body?.subscriptionId ? subscriptionsById.get(toCleanString(request.body.subscriptionId, 80)) : null;
    const initialStatus = requestSubscription && !isPaidSubscription(requestSubscription)
      ? "Pendiente de pago"
      : assignedTeacher ? "Asignada" : "Recibida";
    const nextRequest = sanitizeRequest({
      ...request.body,
      id: crypto.randomUUID(),
      userId: auth.user.id,
      status: initialStatus,
      createdAt: new Date().toISOString(),
      teacherId: assignedTeacher && initialStatus !== "Pendiente de pago" ? assignedTeacher.id : "",
      teacherName: assignedTeacher && initialStatus !== "Pendiente de pago" ? assignedTeacher.name : "",
      assignedAt: assignedTeacher && initialStatus !== "Pendiente de pago" ? new Date().toISOString() : ""
    }, usersById, subscriptionsById);
    const creditSummary = getClientCreditSummaryForUser(auth.user.id, state.oa_requests, state.oa_subscriptions);
    const requiredCredits = getRequestPages(nextRequest) * 2;

    if (!creditSummary.totalCredits) {
      throw createPublicError(402, "Para enviar tu solicitud, primero debes elegir y comprar un plan o creditos.");
    }

    if (requiredCredits > creditSummary.availableCredits) {
      throw createPublicError(
        409,
        `Credito insuficiente. Este envio requiere ${requiredCredits} credito(s) y tienes ${creditSummary.availableCredits} disponible(s).`
      );
    }

    appendStatusHistory(nextRequest, "Recibida", auth.user, { note: "Solicitud creada" });

    if (assignedTeacher && initialStatus !== "Pendiente de pago") {
      appendStatusHistory(nextRequest, "Asignada", auth.user, {
        teacherId: assignedTeacher.id,
        teacherName: assignedTeacher.name,
        note: "Profesor asignado automaticamente"
      });
    }

    state.oa_requests.unshift(nextRequest);
    saveValidatedState(state);
    logSecurityEvent("request_created", { actorId: auth.user.id, requestId: nextRequest.id, files: nextRequest.attachments.length });
    queueTransactionalEmail({
      event: "request_created",
      to: auth.user.email,
      subject: "Recibimos tu solicitud",
      text: createEmailText({
        greeting: `Hola ${auth.user.name || "cliente"},`,
        lines: [
          `Recibimos tu solicitud: ${nextRequest.documentType || "Documento academico"}.`,
          "Puedes revisar el estado y cualquier novedad desde tu panel."
        ]
      })
    });
    response.json({ ok: true, request: nextRequest });
  } catch (error) {
    sendError(response, error, "No se pudo crear la solicitud.");
  }
});

app.post("/api/requests/:requestId/status", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  try {
    const state = getValidatedState();
    const requestId = requireCleanString(request.params.requestId, "La solicitud", 80);
    const targetRequest = state.oa_requests.find((item) => item.id === requestId);
    const status = requireAllowedValue(request.body?.status, ALLOWED_REQUEST_STATUSES, "El estado");
    const canUpdate = auth.user.role === "admin" || (auth.user.role === "teacher" && targetRequest?.teacherId === auth.user.id);

    if (!targetRequest) {
      throw createPublicError(404, "Solicitud no encontrada.");
    }

    if (!canUpdate) {
      throw createPublicError(403, "No tienes permiso para cambiar solicitudes.");
    }

    targetRequest.status = status;
    targetRequest.updatedAt = new Date().toISOString();
    appendStatusHistory(targetRequest, status, auth.user, { note: "Estado actualizado" });
    saveValidatedState(state);
    logSecurityEvent("request_status_changed", { actorId: auth.user.id, requestId, status });
    response.json({ ok: true, request: targetRequest });
  } catch (error) {
    sendError(response, error, "No se pudo actualizar el estado.");
  }
});

app.post("/api/requests/:requestId/teacher", adminActionRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "Solo el administrador puede asignar trabajos."));
    return;
  }

  try {
    const state = getValidatedState();
    const requestId = requireCleanString(request.params.requestId, "La solicitud", 80);
    const teacherId = toCleanString(request.body?.teacherId, 80);
    const targetRequest = state.oa_requests.find((item) => item.id === requestId);
    const teacher = teacherId ? state.oa_users.find((user) => user.id === teacherId && user.role === "teacher") : null;

    if (!targetRequest) {
      throw createPublicError(404, "Solicitud no encontrada.");
    }

    if (targetRequest.status === "Pendiente de pago") {
      throw createPublicError(409, "Confirma el pago antes de asignar profesor.");
    }

    if (teacherId && !teacher) {
      throw createPublicError(404, "Profesor no encontrado.");
    }

    targetRequest.teacherId = teacher ? teacher.id : "";
    targetRequest.teacherName = teacher ? teacher.name : "";
    targetRequest.assignedAt = teacher ? new Date().toISOString() : "";
    targetRequest.status = teacher ? "Asignada" : "Recibida";
    targetRequest.updatedAt = new Date().toISOString();
    appendStatusHistory(targetRequest, "Asignada", auth.user, {
      teacherId: teacher ? teacher.id : "",
      teacherName: teacher ? teacher.name : "",
      note: teacher ? "Profesor asignado" : "Profesor removido"
    });

    if (teacher) {
      const client = state.oa_users.find((user) => user.id === targetRequest.userId && user.role === "client");
      if (client) {
        client.teacherId = teacher.id;
        client.teacherName = teacher.name;
      }
    }

    saveValidatedState(state);
    logSecurityEvent("request_teacher_changed", { actorId: auth.user.id, requestId, teacherId: targetRequest.teacherId });
    response.json({ ok: true, request: targetRequest });
  } catch (error) {
    sendError(response, error, "No se pudo asignar el profesor.");
  }
});

app.post("/api/requests/:requestId/delivery", formRateLimit, (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  try {
    const state = getValidatedState();
    const requestId = requireCleanString(request.params.requestId, "La solicitud", 80);
    const targetRequest = state.oa_requests.find((item) => item.id === requestId);

    if (!targetRequest) {
      throw createPublicError(404, "Solicitud no encontrada.");
    }

    if (auth.user.role !== "teacher" || targetRequest.teacherId !== auth.user.id) {
      throw createPublicError(403, "Solo el profesor asignado puede subir la entrega.");
    }

    targetRequest.delivery = sanitizeAttachment(request.body?.delivery, DELIVERY_FILE_EXTENSIONS, MAX_DELIVERY_FILE_SIZE, "la entrega");
    targetRequest.status = "Entrega subida";
    targetRequest.deliveredAt = new Date().toISOString();
    targetRequest.updatedAt = new Date().toISOString();
    appendStatusHistory(targetRequest, "Entrega subida", auth.user, { note: "Entrega subida" });
    saveValidatedState(state);
    const client = state.oa_users.find((user) => user.id === targetRequest.userId && user.role === "client");

    if (client) {
      queueTransactionalEmail({
        event: "delivery_uploaded",
        to: client.email,
        subject: "Tu trabajo ya está listo",
        text: createEmailText({
          greeting: `Hola ${client.name || "cliente"},`,
          lines: [
            `Tu trabajo "${targetRequest.documentType || "Documento academico"}" ya fue entregado.`,
            "Entra a tu panel para descargarlo. No adjuntamos archivos por correo para mantener tu información protegida."
          ]
        })
      });
    }

    logSecurityEvent("delivery_uploaded", { actorId: auth.user.id, requestId, storageKey: targetRequest.delivery.storageKey });
    response.json({ ok: true, request: targetRequest });
  } catch (error) {
    sendError(response, error, "No se pudo guardar la entrega.");
  }
});

app.post("/api/register", registerRateLimit, async (request, response) => {
  const state = readState();
  const { name = "", email = "", phone = "", password = "" } = request.body || {};
  let normalizedEmail = "";

  try {
    await validateRegistrationSpamBarrier(request.body || {}, request);
    normalizedEmail = requireValidEmail(email);
    requireCleanString(name, "El nombre", 120);
    requirePassword(password);
  } catch (error) {
    logSecurityEvent("register_rejected", { ip: getClientIp(request), reason: error.publicMessage || "validation" });
    sendError(response, error, "No se pudo crear la cuenta.");
    return;
  }
  const exists = state.oa_users.some((user) => user.email.toLowerCase() === normalizedEmail)
    || (ADMIN_EMAIL && normalizedEmail === ADMIN_EMAIL.toLowerCase());

  if (!name.trim() || !normalizedEmail || !password) {
    sendError(response, createPublicError(400, "Completa nombre, correo y contrasena."));
    return;
  }

  if (exists) {
    logSecurityEvent("register_duplicate", { ip: getClientIp(request), email: normalizedEmail });
    sendError(response, createPublicError(409, "Ya existe una cuenta con este correo."));
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    name: requireCleanString(name, "El nombre", 120),
    email: normalizedEmail,
    phone: toCleanString(phone, 40),
    password: hashPassword(password),
    role: "client",
    createdAt: new Date().toISOString()
  };
  const verificationToken = assignEmailVerificationToken(user);

  state.oa_users.push(user);
  saveState(state);

  const safeUser = sanitizeUser(user);
  setSessionCookie(response, safeUser);
  queueEmailVerification(user, verificationToken);
  logSecurityEvent("register_success", { userId: user.id, ip: getClientIp(request) });
  response.json({ ok: true, user: safeUser, verificationEmailSent: true });
});

app.post("/api/login", loginRateLimit, (request, response) => {
  const state = readState();
  const { email = "", password = "" } = request.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail) || typeof password !== "string" || !password) {
    logSecurityEvent("login_failed", { ip: getClientIp(request), email: normalizedEmail });
    sendError(response, createPublicError(401, "Correo o contrasena incorrectos."));
    return;
  }
  const user = state.oa_users.find((item) => (
    item.email.toLowerCase() === normalizedEmail && verifyPassword(password, item.password)
  ));

  if (!user) {
    logSecurityEvent("login_failed", { ip: getClientIp(request), email: normalizedEmail });
    sendError(response, createPublicError(401, "Correo o contrasena incorrectos."));
    return;
  }

  if (!isPasswordHash(user.password)) {
    user.password = hashPassword(password);
    saveState(state);
  }

  const safeUser = sanitizeUser(user);
  setSessionCookie(response, safeUser);
  logSecurityEvent("login_success", { userId: user.id, ip: getClientIp(request) });
  response.json({ ok: true, user: safeUser });
});

app.post("/api/admin/login", loginRateLimit, (request, response) => {
  const { email = "", password = "" } = request.body || {};
  const normalizedEmail = normalizeEmail(email);
  const hasAdminCredentials = ADMIN_EMAIL && ADMIN_PASSWORD;
  const isAdmin = hasAdminCredentials
    && isValidEmail(normalizedEmail)
    && normalizedEmail === ADMIN_EMAIL.toLowerCase()
    && typeof password === "string"
    && password === ADMIN_PASSWORD;

  if (!isAdmin) {
    logSecurityEvent("admin_login_failed", { ip: getClientIp(request), email: normalizedEmail });
    sendError(response, createPublicError(401, "Correo o contrasena incorrectos."));
    return;
  }

  const adminUser = {
    id: "admin",
    name: "Administrador",
    email: ADMIN_EMAIL,
    role: "admin"
  };

  setSessionCookie(response, adminUser);
  logSecurityEvent("admin_login_success", { ip: getClientIp(request) });
  response.json({ ok: true, user: adminUser });
});

app.post("/api/logout", (request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

app.post("/api/admin/email-check", (request, response) => {
  const { email = "" } = request.body || {};
  const normalizedEmail = normalizeEmail(email);

  response.json({
    matches: Boolean(ADMIN_EMAIL && isValidEmail(normalizedEmail) && normalizedEmail === ADMIN_EMAIL.toLowerCase())
  });
});

app.post("/api/admin/urgent-email", adminActionRateLimit, async (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  if (auth.user.role !== "admin") {
    sendError(response, createPublicError(403, "No tienes permiso para enviar mensajes de soporte."));
    return;
  }

  try {
    const state = getValidatedState();
    const userId = requireCleanString(request.body?.userId, "El cliente", 80);
    const subject = requireCleanString(request.body?.subject, "El asunto", 160);
    const message = requireCleanString(request.body?.message, "El mensaje", 1800);
    const client = state.oa_users.find((user) => user.id === userId && user.role === "client");

    if (!client) {
      throw createPublicError(404, "Cliente no encontrado.");
    }

    const result = await sendTransactionalEmail({
      event: "support_admin_message",
      to: client.email,
      subject,
      text: createEmailText({
        greeting: `Hola ${client.name || "cliente"},`,
        lines: [
          message,
          "Este mensaje fue enviado por soporte desde la plataforma."
        ]
      })
    });

    logSecurityEvent("support_email_sent", { actorId: auth.user.id, userId: client.id, delivered: result.delivered, queued: result.queued });
    response.json({ ok: true, delivered: result.delivered, queued: result.queued });
  } catch (error) {
    sendError(response, error, "No se pudo enviar el mensaje de soporte.");
  }
});

app.post("/api/support", formRateLimit, async (request, response) => {
  try {
    validateFormSpamBarrier(request.body || {});

    const name = requireCleanString(request.body?.name, "El nombre", 120);
    const email = requireValidEmail(request.body?.email);
    const topic = requireCleanString(request.body?.topic, "El motivo", 120);
    const message = requireCleanString(request.body?.message, "El mensaje", 3000);
    const currentUser = validateAuthUser(readTokenUser(request), readState());
    const supportRecipient = normalizeEmail(EMAIL_REPLY_TO || ADMIN_EMAIL);

    logSupportMessage({
      id: crypto.randomUUID(),
      name,
      email,
      topic,
      message,
      userId: currentUser?.id || "",
      ip: getClientIp(request)
    });

    if (isValidEmail(supportRecipient)) {
      await sendTransactionalEmail({
        event: "support_contact_message",
        to: supportRecipient,
        replyTo: email,
        subject: `Nuevo mensaje de soporte: ${topic}`,
        text: [
          "Nuevo mensaje recibido desde el formulario de soporte.",
          "",
          `Nombre: ${name}`,
          `Correo: ${email}`,
          `Motivo: ${topic}`,
          `Usuario autenticado: ${currentUser?.id || "No"}`,
          "",
          "Mensaje:",
          message
        ].join("\n")
      });
    }

    response.json({ ok: true });
  } catch (error) {
    sendError(response, error, "No se pudo enviar el mensaje de soporte.");
  }
});

app.get("/api/files/:storageKey", (request, response) => {
  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  try {
    const storageKey = path.basename(requireCleanString(request.params.storageKey, "El archivo", 180));
    const storedFile = findStoredFile(auth.state, storageKey);

    if (!storedFile) {
      throw createPublicError(404, "Archivo no encontrado.");
    }

    if (!canAccessRequestFile(auth.user, storedFile.request)) {
      throw createPublicError(403, "No tienes permiso para descargar este archivo.");
    }

    const filePath = path.join(UPLOADS_ROOT, storageKey);

    if (!filePath.startsWith(UPLOADS_ROOT) || !fs.existsSync(filePath)) {
      throw createPublicError(404, "Archivo no encontrado.");
    }

    response.download(filePath, storedFile.file.name);
  } catch (error) {
    sendError(response, error, "No se pudo descargar el archivo.");
  }
});

app.use("/auth", express.static(AUTH_ROOT, { dotfiles: "deny", index: false }));
app.use(express.static(CLIENT_ROOT, { dotfiles: "deny", index: false }));

app.get("/", (request, response) => {
  response.sendFile(path.join(CLIENT_ROOT, "index.html"));
});

app.use("/api", (request, response) => {
  sendError(response, createPublicError(404, "Ruta no encontrada."));
});

app.use((request, response) => {
  response.status(404).sendFile(path.join(CLIENT_ROOT, "404.html"));
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  sendError(response, error, "Ocurrio un error inesperado. Intenta nuevamente.");
});

app.listen(PORT, HOST, () => {
  console.log(`ZeroCopy IA listo en ${PUBLIC_APP_URL}/`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el entorno.");
  }

  if (!SESSION_SECRET) {
    console.warn("SESSION_SECRET no esta configurado; sera necesario al activar sesiones reales.");
  }
});
