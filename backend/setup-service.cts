type StoredUser = {
  id: string;
  username: string;
  role?: string;
};

type PublicUser = {
  id: string;
  username: string;
  role?: string;
};

type SetupStatus = {
  setupRequired: boolean;
  setupCompleted: boolean;
  hasAdminUser: boolean;
  datastoreOk: boolean;
  missingRequiredSecrets: boolean;
};

type AuthFailure = {
  ok: false;
  error: string;
  errorKey: string;
  errorParams?: Record<string, unknown>;
};

type SetupFailure = AuthFailure & {
  statusCode: number;
  code: string;
};

type AuthStore = {
  listUsers(): Promise<StoredUser[]> | StoredUser[];
  registerAdminPasswordUser(input: {
    username?: string;
    password?: string;
  }): Promise<{ ok: true; user: PublicUser } | AuthFailure>;
};

type Datastore = {
  healthSummary?(): Promise<{ ok?: boolean }> | { ok?: boolean };
  getAppState(key: string): Promise<unknown> | unknown;
  setAppState(key: string, value: unknown): Promise<unknown> | unknown;
};

type SetupServiceOptions = {
  auth: AuthStore;
  datastore: Datastore;
  missingRequiredSecrets?: boolean;
};

function setupFailure(
  statusCode: number,
  code: string,
  error: string,
  errorKey: string,
  errorParams: Record<string, unknown> = {}
): SetupFailure {
  return { ok: false, statusCode, code, error, errorKey, errorParams };
}

function hasAdmin(users: Array<StoredUser | null | undefined>): boolean {
  return users.some((user) => user?.role === "admin");
}

function createSetupService({
  auth,
  datastore,
  missingRequiredSecrets = false
}: SetupServiceOptions) {
  let adminCreationLock: Promise<void> | null = null;

  async function getSetupStatus(): Promise<SetupStatus> {
    let datastoreHealthy: boolean;
    let usersReadable: boolean;
    let appStateReadable: boolean;
    let adminExists = false;
    let setupCompleted = false;

    try {
      const health = await datastore.healthSummary?.();
      datastoreHealthy = health ? Boolean(health.ok) : true;
    } catch {
      datastoreHealthy = false;
    }

    try {
      adminExists = hasAdmin(await auth.listUsers());
      usersReadable = true;
    } catch {
      usersReadable = false;
    }

    try {
      setupCompleted = (await datastore.getAppState("setupCompleted")) === true;
      appStateReadable = true;
    } catch {
      appStateReadable = false;
    }

    return {
      setupRequired: !adminExists || !setupCompleted,
      setupCompleted,
      hasAdminUser: adminExists,
      datastoreOk: datastoreHealthy && usersReadable && appStateReadable,
      missingRequiredSecrets
    };
  }

  async function createFirstAdmin(input: { username?: string; password?: string }) {
    while (adminCreationLock) {
      await adminCreationLock;
    }

    let releaseLock: () => void = () => undefined;
    adminCreationLock = new Promise((resolve) => {
      releaseLock = resolve;
    });

    try {
      const status = await getSetupStatus();
      if (!status.setupRequired) {
        return setupFailure(
          409,
          "SETUP_ALREADY_COMPLETED",
          "Setup gia completato.",
          "setup.alreadyCompleted"
        );
      }

      if (status.hasAdminUser) {
        return setupFailure(
          409,
          "SETUP_ADMIN_EXISTS",
          "Esiste gia un amministratore.",
          "setup.adminExists"
        );
      }

      const result = await auth.registerAdminPasswordUser({
        username: input.username,
        password: input.password
      });
      if (!result.ok) {
        return {
          ...result,
          statusCode: 400,
          code: "SETUP_ADMIN_INVALID"
        };
      }

      return {
        ok: true,
        user: result.user,
        status: await getSetupStatus()
      };
    } finally {
      const lockToRelease = adminCreationLock;
      releaseLock();
      if (adminCreationLock === lockToRelease) {
        adminCreationLock = null;
      }
    }
  }

  async function completeSetup() {
    const status = await getSetupStatus();
    if (!status.hasAdminUser) {
      return setupFailure(
        400,
        "SETUP_ADMIN_REQUIRED",
        "Crea un amministratore prima di completare il setup.",
        "setup.adminRequired"
      );
    }

    await datastore.setAppState("setupCompleted", true);

    return {
      ok: true,
      status: await getSetupStatus()
    };
  }

  return {
    completeSetup,
    createFirstAdmin,
    getSetupStatus
  };
}

module.exports = {
  createSetupService
};
