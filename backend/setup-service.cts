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

function createSetupService({ auth, datastore }: SetupServiceOptions) {
  let adminCreationLock: Promise<void> | null = null;

  async function getSetupStatus(): Promise<SetupStatus> {
    let datastoreOk = true;
    let adminExists = false;
    let setupCompleted = false;

    try {
      const health = await datastore.healthSummary?.();
      datastoreOk = health ? Boolean(health.ok) : true;
    } catch {
      datastoreOk = false;
    }

    try {
      adminExists = hasAdmin(await auth.listUsers());
    } catch {
      datastoreOk = false;
    }

    try {
      setupCompleted = (await datastore.getAppState("setupCompleted")) === true;
    } catch {
      datastoreOk = false;
    }

    return {
      setupRequired: !adminExists || !setupCompleted,
      setupCompleted,
      hasAdminUser: adminExists,
      datastoreOk
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
