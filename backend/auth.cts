const path = require("path");
const crypto = require("crypto");
const { createAuthRepository } = require("./auth-repository.cjs");
const { SESSION_MAX_AGE_MS } = require("./session-policy.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");

interface ThemePreferences {
  theme?: string;
}

interface UserProfile {
  displayName?: string;
  preferences?: ThemePreferences;
  contact?: {
    emailEncrypted?: string;
    emailHint?: string;
  };
  [key: string]: unknown;
}

interface PasswordHashRecord {
  algorithm?: string;
  salt?: string;
  keylen?: number;
  hash?: string;
  digest?: string;
  iterations?: number;
  secret?: string;
}

interface UserCredentials {
  password?: PasswordHashRecord;
  [key: string]: unknown;
}

interface StoredUser {
  id: string;
  username: string;
  role?: string;
  credentials?: UserCredentials;
  profile?: UserProfile;
  createdAt?: string;
}

interface PublicUser {
  id: string;
  username: string;
  role: string;
  authMethods: string[];
  hasEmail: boolean;
  preferences: ThemePreferences;
}

interface AuthSession {
  user_id?: string;
  userId?: string;
  created_at?: number;
  createdAt?: number;
}

interface AuthRepository {
  listUsers(): Promise<StoredUser[]> | StoredUser[];
  findUserByUsername(username: string): Promise<StoredUser | null> | StoredUser | null;
  findUserById(userId: string): Promise<StoredUser | null> | StoredUser | null;
  createUser(user: StoredUser): Promise<StoredUser | null> | StoredUser | null;
  updateUserCredentials(
    userId: string,
    credentials: UserCredentials
  ): Promise<StoredUser | null> | StoredUser | null;
  updateUserProfile(
    userId: string,
    profile: UserProfile
  ): Promise<StoredUser | null> | StoredUser | null;
  updateUserThemePreference?(
    userId: string,
    theme: string
  ): Promise<StoredUser | null> | StoredUser | null;
  createSession(token: string, userId: string, createdAt: number): Promise<void> | void;
  findSession(token: string): Promise<AuthSession | null> | AuthSession | null;
  deleteSession(token: string): Promise<void> | void;
}

interface AuthStoreOptions {
  datastore?: AuthRepository;
  driver?: string;
  dbFile?: string;
  dataFile?: string;
  sessionsFile?: string;
  gamesFile?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseSchema?: string;
  encryptionKey?: string;
}

interface RegistrationInput {
  username: string;
  password: string;
  email: string;
}

interface AccountSettingsInput {
  userId: string;
  currentPassword: string;
  email?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

interface AuthFailure {
  ok: false;
  error: string;
  errorKey: string;
  errorParams: Record<string, unknown>;
}

function passwordRecord(
  secret: unknown
): Required<Pick<PasswordHashRecord, "algorithm" | "salt" | "keylen" | "hash">> {
  const salt = crypto.randomBytes(16).toString("hex");
  const keylen = 64;
  const hash = crypto.scryptSync(String(secret || ""), salt, keylen).toString("hex");
  return {
    algorithm: "scrypt",
    salt,
    keylen,
    hash
  };
}

function normalizeUsername(username: unknown): string {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function normalizeEmail(email: unknown): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function userRole(user: StoredUser | null | undefined): string {
  return user && user.role === "admin" ? "admin" : "user";
}

function publicUser(user: StoredUser | null | undefined): PublicUser | null {
  if (!user) {
    return null;
  }

  const preferences: ThemePreferences = {};
  if (typeof user.profile?.preferences?.theme === "string" && user.profile.preferences.theme) {
    preferences.theme = user.profile.preferences.theme;
  }

  return {
    id: user.id,
    username: user.username,
    role: userRole(user),
    authMethods: Object.keys(user.credentials || {}),
    hasEmail: Boolean(user.profile?.contact?.emailEncrypted),
    preferences
  };
}

function verifyPassword(credentials: UserCredentials | undefined, password: unknown): boolean {
  const record = credentials && credentials.password ? credentials.password : null;
  if (!record) {
    return false;
  }

  if (!record.salt || !record.hash) {
    return false;
  }

  let candidate = "";
  if (record.algorithm === "scrypt" || !record.digest) {
    const keylen = Number.isInteger(record.keylen) ? record.keylen : 64;
    candidate = crypto.scryptSync(String(password || ""), record.salt, keylen).toString("hex");
  } else {
    const iterations = Number.isInteger(record.iterations) ? record.iterations : 120000;
    const digest = record.digest || "sha256";
    candidate = crypto
      .pbkdf2Sync(String(password || ""), record.salt, iterations, 32, digest)
      .toString("hex");
  }

  const expectedBuffer = Buffer.from(record.hash, "hex");
  const candidateBuffer = Buffer.from(candidate, "hex");

  // We use timingSafeEqual to prevent timing attacks.
  // If the lengths differ (e.g. legacy hash vs new hash), we compare the expected buffer with itself
  // to ensure a constant-time execution path before returning false.
  if (expectedBuffer.length !== candidateBuffer.length) {
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

function dataProtectionKey(options: AuthStoreOptions = {}): Buffer | null {
  const raw = String(options.encryptionKey || process.env.AUTH_ENCRYPTION_KEY || "").trim();

  return raw ? crypto.createHash("sha256").update(raw).digest() : null;
}

function createFieldProtector(options: AuthStoreOptions = {}) {
  const key = dataProtectionKey(options);

  return {
    isConfigured(): boolean {
      return Boolean(key);
    },
    encrypt(value: unknown): string {
      if (!key) {
        throw createLocalizedError(
          "AUTH_ENCRYPTION_KEY mancante.",
          "auth.internal.missingEncryptionKey"
        );
      }

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [
        "v1",
        iv.toString("base64url"),
        tag.toString("base64url"),
        encrypted.toString("base64url")
      ].join(".");
    }
  };
}

function registrationInput(inputOrUsername: unknown, password?: unknown): RegistrationInput {
  if (inputOrUsername && typeof inputOrUsername === "object" && !Array.isArray(inputOrUsername)) {
    const input = inputOrUsername as Record<string, unknown>;
    return {
      username: String(input.username || "")
        .trim()
        .slice(0, 32),
      password: String(input.password || ""),
      email: normalizeEmail(input.email)
    };
  }

  return {
    username: String(inputOrUsername || "")
      .trim()
      .slice(0, 32),
    password: String(password || ""),
    email: ""
  };
}

function accountSettingsInput(input: Record<string, unknown>): AccountSettingsInput {
  return {
    userId: String(input.userId || "").trim(),
    currentPassword: String(input.currentPassword || ""),
    email: normalizeEmail(input.email),
    newPassword: String(input.newPassword || ""),
    confirmNewPassword: String(input.confirmNewPassword || "")
  };
}

function authFailure(
  error: string,
  errorKey: string,
  errorParams: Record<string, unknown> = {}
): AuthFailure {
  return { ok: false, error, errorKey, errorParams };
}

function registrationValidationError(
  input: RegistrationInput,
  protector: ReturnType<typeof createFieldProtector>
): AuthFailure | null {
  if (!input.username || !input.password) {
    return authFailure("Inserisci utente e password.", "auth.register.requiredFields");
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(input.username)) {
    return authFailure(
      "Username valido: 3-32 caratteri, lettere, numeri, underscore e trattino.",
      "auth.register.invalidUsername"
    );
  }

  if (input.password.length < 8 || input.password.length > 128) {
    return authFailure(
      "Password non valida: usa tra 8 e 128 caratteri.",
      "auth.register.shortPassword"
    );
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return authFailure("Email non valida.", "auth.register.invalidEmail");
  }

  if (input.email && !protector.isConfigured()) {
    return authFailure(
      "Email opzionale disponibile solo con AUTH_ENCRYPTION_KEY configurata sul server.",
      "auth.register.emailProtectionUnavailable"
    );
  }

  return null;
}

function accountSettingsValidationError(
  input: AccountSettingsInput,
  protector: ReturnType<typeof createFieldProtector>
): AuthFailure | null {
  const nextEmail = normalizeEmail(input.email);
  const nextPassword = String(input.newPassword || "");
  const confirmNewPassword = String(input.confirmNewPassword || "");
  const hasEmailChange = Boolean(nextEmail);
  const hasPasswordChange = Boolean(nextPassword || confirmNewPassword);

  if (!hasEmailChange && !hasPasswordChange) {
    return authFailure("Nessuna modifica da salvare.", "auth.account.noChanges");
  }

  if (input.currentPassword.length > 128) {
    return authFailure("Password attuale non valida.", "auth.account.currentPasswordInvalid");
  }

  if (hasEmailChange && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    return authFailure("Email non valida.", "auth.register.invalidEmail");
  }

  if (hasEmailChange && !protector.isConfigured()) {
    return authFailure(
      "Email opzionale disponibile solo con AUTH_ENCRYPTION_KEY configurata sul server.",
      "auth.register.emailProtectionUnavailable"
    );
  }

  if (hasPasswordChange && !nextPassword) {
    return authFailure("Inserisci la nuova password.", "auth.account.newPasswordRequired");
  }

  if (nextPassword && (nextPassword.length < 8 || nextPassword.length > 128)) {
    return authFailure(
      "Password non valida: usa tra 8 e 128 caratteri.",
      "auth.register.shortPassword"
    );
  }

  if (hasPasswordChange && nextPassword !== confirmNewPassword) {
    return authFailure("Le password non coincidono.", "auth.account.passwordMismatch");
  }

  return null;
}

function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return "";
  }

  const local = parts[0];
  const domain = parts[1];
  const visible = local.length <= 2 ? local.charAt(0) : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function buildProfile(
  username: string,
  email: string,
  protector: ReturnType<typeof createFieldProtector>
): UserProfile {
  const profile: UserProfile = {
    displayName: username
  };

  if (email) {
    profile.contact = {
      emailEncrypted: protector.encrypt(email),
      emailHint: maskEmail(email)
    };
  }

  return profile;
}

function withUpdatedContactEmail(
  profile: UserProfile | undefined,
  email: string,
  protector: ReturnType<typeof createFieldProtector>
): UserProfile {
  return {
    ...(profile || {}),
    contact: {
      ...((profile?.contact as UserProfile["contact"] | undefined) || {}),
      emailEncrypted: protector.encrypt(email),
      emailHint: maskEmail(email)
    }
  };
}

function createAuthStore(options: AuthStoreOptions = {}) {
  const datastore = (options.datastore ||
    createAuthRepository({
      driver: options.driver || process.env.DATASTORE_DRIVER || "local",
      dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
      dataFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
      sessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json"),
      gamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json"),
      supabaseUrl: options.supabaseUrl,
      supabaseServiceRoleKey: options.supabaseServiceRoleKey,
      supabaseSchema: options.supabaseSchema
    })) as AuthRepository;
  const protector = createFieldProtector(options);

  async function listUsers() {
    return datastore.listUsers();
  }

  async function findByUsername(username: string) {
    const normalized = normalizeUsername(username);
    return normalized ? datastore.findUserByUsername(normalized) : null;
  }

  function runDummyPasswordVerification() {
    const dummySecret = "netrisk-auth-dummy";
    const dummyCredentials: UserCredentials = {
      password: {
        algorithm: "scrypt",
        salt: "00000000000000000000000000000000",
        keylen: 64,
        hash: "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
      }
    };

    verifyPassword(dummyCredentials, dummySecret);
  }

  async function verifyUserPasswordAndMigrate(user: StoredUser | null, password: unknown) {
    if (String(password || "").length > 128) {
      // Avoid expensive hashing for extremely long passwords.
      runDummyPasswordVerification();
      return null;
    }

    if (!user) {
      // Dummy verification to mitigate timing-based username enumeration.
      // This ensures that the response time for non-existent users is similar to real ones.
      runDummyPasswordVerification();
      return null;
    }

    if (typeof user.credentials?.password?.secret === "string") {
      const providedSecret = String(password || "");
      const expectedSecret = user.credentials.password.secret;

      // Use timing-safe comparison for legacy plaintext secrets.
      const expectedBuffer = Buffer.from(expectedSecret);
      const providedBuffer = Buffer.from(providedSecret);

      // If lengths differ, we compare expected with itself to maintain timing parity
      // and satisfy CodeQL without using SHA-256 on password data.
      if (expectedBuffer.length !== providedBuffer.length) {
        crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
        runDummyPasswordVerification();
        return null;
      }

      if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        runDummyPasswordVerification();
        return null;
      }

      const migratedCredentials = {
        ...(user.credentials || {}),
        password: passwordRecord(password)
      };

      return (
        (await datastore.updateUserCredentials(user.id, migratedCredentials)) || {
          ...user,
          credentials: migratedCredentials
        }
      );
    }

    if (!verifyPassword(user.credentials, password)) {
      return null;
    }

    if (user.credentials?.password?.algorithm !== "scrypt") {
      const migratedCredentials = {
        ...(user.credentials || {}),
        password: passwordRecord(password)
      };

      return (
        (await datastore.updateUserCredentials(user.id, migratedCredentials)) || {
          ...user,
          credentials: migratedCredentials
        }
      );
    }

    return user;
  }

  async function registerPasswordUserWithRole(
    inputOrUsername: unknown,
    password: unknown,
    role: "admin" | "user"
  ) {
    const input = registrationInput(inputOrUsername, password);
    const validationError = registrationValidationError(input, protector);
    if (validationError) {
      return validationError;
    }

    if (await findByUsername(input.username)) {
      return authFailure("Utente gia registrato.", "auth.register.userExists");
    }

    const user = {
      id: crypto.randomBytes(8).toString("hex"),
      username: input.username,
      credentials: {
        password: passwordRecord(input.password)
      },
      role,
      profile: buildProfile(input.username, input.email, protector),
      createdAt: new Date().toISOString()
    };

    return { ok: true, user: publicUser(await datastore.createUser(user)) };
  }

  async function registerPasswordUser(inputOrUsername: unknown, password?: unknown) {
    return registerPasswordUserWithRole(inputOrUsername, password, "user");
  }

  async function registerAdminPasswordUser(inputOrUsername: unknown, password?: unknown) {
    return registerPasswordUserWithRole(inputOrUsername, password, "admin");
  }

  async function loginWithPassword(username: string, password: unknown) {
    const user = await findByUsername(username);
    const verifiedUser = await verifyUserPasswordAndMigrate(user, password);
    if (!verifiedUser) {
      return authFailure("Credenziali non valide.", "auth.login.invalidCredentials");
    }

    const sessionToken = crypto.randomBytes(16).toString("hex");
    await datastore.createSession(sessionToken, verifiedUser.id, Date.now());

    return {
      ok: true,
      sessionToken,
      user: publicUser(verifiedUser)
    };
  }

  async function getUserFromSession(sessionToken: string | null | undefined) {
    if (!sessionToken) {
      return null;
    }

    const session = await datastore.findSession(sessionToken);
    if (!session) {
      return null;
    }

    const createdAt = session.created_at || session.createdAt || 0;
    if (Date.now() - Number(createdAt) > SESSION_MAX_AGE_MS) {
      await datastore.deleteSession(sessionToken);
      return null;
    }

    const sessionUserId = session.user_id || session.userId || "";
    return sessionUserId ? (await datastore.findUserById(sessionUserId)) || null : null;
  }

  async function logout(sessionToken: string | null | undefined) {
    if (sessionToken) {
      await datastore.deleteSession(sessionToken);
    }

    return null;
  }

  async function updateUserProfile(userId: string, profile: UserProfile) {
    const updatedUser = await datastore.updateUserProfile(userId, profile || {});
    return updatedUser ? publicUser(updatedUser) : null;
  }

  async function updateUserThemePreference(userId: string, theme: string) {
    let updatedUser: StoredUser | null = null;

    if (typeof datastore.updateUserThemePreference === "function") {
      updatedUser = await datastore.updateUserThemePreference(userId, theme);
    } else {
      const currentUser = await datastore.findUserById(userId);
      updatedUser = await datastore.updateUserProfile(userId, {
        ...(currentUser?.profile || {}),
        preferences: {
          ...((currentUser?.profile?.preferences as ThemePreferences | undefined) || {}),
          theme: String(theme || "")
        }
      });
    }

    return updatedUser ? publicUser(updatedUser) : null;
  }

  async function updateUserAccountSettings(input: Record<string, unknown>) {
    const normalizedInput = accountSettingsInput(input);
    const validationError = accountSettingsValidationError(normalizedInput, protector);
    if (validationError) {
      return validationError;
    }

    const currentUser = await datastore.findUserById(normalizedInput.userId);
    const verifiedUser = await verifyUserPasswordAndMigrate(
      currentUser,
      normalizedInput.currentPassword
    );
    if (!verifiedUser) {
      return authFailure("Password attuale non valida.", "auth.account.currentPasswordInvalid");
    }

    let updatedUser = verifiedUser;
    const nextEmail = normalizeEmail(normalizedInput.email);
    const nextPassword = String(normalizedInput.newPassword || "");

    if (nextEmail) {
      updatedUser =
        (await datastore.updateUserProfile(
          updatedUser.id,
          withUpdatedContactEmail(updatedUser.profile, nextEmail, protector)
        )) || updatedUser;
    }

    if (nextPassword) {
      updatedUser =
        (await datastore.updateUserCredentials(updatedUser.id, {
          ...(updatedUser.credentials || {}),
          password: passwordRecord(nextPassword)
        })) || updatedUser;
    }

    return {
      ok: true,
      user: publicUser(updatedUser)
    };
  }

  return {
    datastore,
    findByUsername,
    getUserFromSession,
    listUsers,
    loginWithPassword,
    logout,
    publicUser,
    registerAdminPasswordUser,
    registerPasswordUser,
    updateUserAccountSettings,
    updateUserProfile,
    updateUserThemePreference
  };
}

module.exports = {
  createAuthStore,
  normalizeUsername,
  publicUser,
  userRole
};
