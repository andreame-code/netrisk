const crypto = require("node:crypto");

type PublicUser = {
  id: string;
  username: string;
  role?: string;
};

type AdminInviteRecord = {
  id: string;
  codeHash: string;
  label: string | null;
  emailHint: string | null;
  createdAt: string;
  createdBy: PublicUser | null;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  consumedByUsername: string | null;
};

type AdminInviteInput = {
  label?: string | null;
  email?: string | null;
  expiresInDays?: number | null;
};

const ADMIN_USER_INVITES_STATE_KEY = "adminUserInvites";
const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const MAX_INVITE_EXPIRY_DAYS = 90;

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function normalizeInviteCode(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function hashInviteCode(value: unknown): string {
  return crypto.createHash("sha256").update(normalizeInviteCode(value)).digest("hex");
}

function generateInviteCode(): string {
  return `NR-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function maskEmail(value: unknown): string | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return null;
  }

  const [local = "", domain = ""] = normalized.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function normalizePublicUser(value: unknown): PublicUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const id = asNonEmptyString(source.id);
  const username = asNonEmptyString(source.username);
  if (!id || !username) {
    return null;
  }

  return {
    id,
    username,
    ...(source.role === "admin" ? { role: "admin" } : {})
  };
}

function normalizeInviteRecords(raw: unknown): AdminInviteRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object")
    )
    .map((entry) => ({
      id: asNonEmptyString(entry.id) || crypto.randomBytes(8).toString("hex"),
      codeHash: asNonEmptyString(entry.codeHash) || "",
      label: asNonEmptyString(entry.label),
      emailHint: asNonEmptyString(entry.emailHint),
      createdAt: asNonEmptyString(entry.createdAt) || new Date().toISOString(),
      createdBy: normalizePublicUser(entry.createdBy),
      expiresAt:
        asNonEmptyString(entry.expiresAt) ||
        new Date(Date.now() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      consumedAt: asNonEmptyString(entry.consumedAt),
      consumedByUserId: asNonEmptyString(entry.consumedByUserId),
      consumedByUsername: asNonEmptyString(entry.consumedByUsername)
    }))
    .filter((entry) => Boolean(entry.codeHash))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function isInviteExpired(record: AdminInviteRecord, now = new Date()): boolean {
  const expiresAt = new Date(record.expiresAt);
  return Number.isNaN(expiresAt.getTime()) ? true : expiresAt.getTime() <= now.getTime();
}

function toInviteSummary(record: AdminInviteRecord) {
  const expired = isInviteExpired(record);

  return {
    id: record.id,
    label: record.label,
    emailHint: record.emailHint,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    expiresAt: record.expiresAt,
    consumedAt: record.consumedAt,
    consumedByUserId: record.consumedByUserId,
    consumedByUsername: record.consumedByUsername,
    status: record.consumedAt ? "consumed" : expired ? "expired" : "active"
  };
}

function listInviteSummaries(raw: unknown) {
  return normalizeInviteRecords(raw).map((record) => toInviteSummary(record));
}

function createInviteRecord(raw: unknown, actor: PublicUser, input: AdminInviteInput = {}) {
  const records = normalizeInviteRecords(raw);
  const code = generateInviteCode();
  const now = new Date();
  const requestedDays = Number(input.expiresInDays);
  const expiresInDays =
    Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= MAX_INVITE_EXPIRY_DAYS
      ? requestedDays
      : DEFAULT_INVITE_EXPIRY_DAYS;
  const emailHint = maskEmail(input.email);
  const label = asNonEmptyString(input.label) || emailHint || "User invite";
  const record: AdminInviteRecord = {
    id: crypto.randomBytes(8).toString("hex"),
    codeHash: hashInviteCode(code),
    label,
    emailHint,
    createdAt: now.toISOString(),
    createdBy: {
      id: actor.id,
      username: actor.username,
      ...(actor.role === "admin" ? { role: "admin" } : {})
    },
    expiresAt: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    consumedAt: null,
    consumedByUserId: null,
    consumedByUsername: null
  };

  return {
    code,
    record,
    summary: toInviteSummary(record),
    records: [record, ...records]
  };
}

function consumeInviteRecord(
  raw: unknown,
  inviteCode: unknown,
  user: { id: string; username: string }
) {
  const codeHash = hashInviteCode(inviteCode);
  const records = normalizeInviteRecords(raw);
  const recordIndex = records.findIndex((record) => record.codeHash === codeHash);

  if (recordIndex === -1) {
    return {
      ok: false,
      error: "Codice invito non valido.",
      errorKey: "auth.register.invalidInviteCode",
      records
    };
  }

  const record = records[recordIndex];
  if (!record || record.consumedAt) {
    return {
      ok: false,
      error: "Codice invito gia utilizzato.",
      errorKey: "auth.register.inviteCodeConsumed",
      records
    };
  }

  if (isInviteExpired(record)) {
    return {
      ok: false,
      error: "Codice invito scaduto.",
      errorKey: "auth.register.inviteCodeExpired",
      records
    };
  }

  const consumedRecord = {
    ...record,
    consumedAt: new Date().toISOString(),
    consumedByUserId: user.id,
    consumedByUsername: user.username
  };
  const nextRecords = records.slice();
  nextRecords[recordIndex] = consumedRecord;

  return {
    ok: true,
    record: consumedRecord,
    summary: toInviteSummary(consumedRecord),
    records: nextRecords
  };
}

function validateInviteRecord(raw: unknown, inviteCode: unknown) {
  const codeHash = hashInviteCode(inviteCode);
  const record = normalizeInviteRecords(raw).find((entry) => entry.codeHash === codeHash);

  if (!record) {
    return {
      ok: false,
      error: "Codice invito non valido.",
      errorKey: "auth.register.invalidInviteCode"
    };
  }

  if (record.consumedAt) {
    return {
      ok: false,
      error: "Codice invito gia utilizzato.",
      errorKey: "auth.register.inviteCodeConsumed"
    };
  }

  if (isInviteExpired(record)) {
    return {
      ok: false,
      error: "Codice invito scaduto.",
      errorKey: "auth.register.inviteCodeExpired"
    };
  }

  return {
    ok: true,
    record,
    summary: toInviteSummary(record)
  };
}

module.exports = {
  ADMIN_USER_INVITES_STATE_KEY,
  createInviteRecord,
  consumeInviteRecord,
  listInviteSummaries,
  normalizeInviteCode,
  validateInviteRecord
};
