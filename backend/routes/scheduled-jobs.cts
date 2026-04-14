type SendJson = (res: unknown, statusCode: number, payload: unknown, headers?: Record<string, string>) => void;
type SendLocalizedError = (
  res: unknown,
  statusCode: number,
  error: any,
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, unknown>,
  code?: string,
  extraPayload?: Record<string, unknown>
) => void;

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

type RunScheduledJobs = () => Promise<unknown>;

function readAuthorizationHeader(req: RequestLike): string {
  const rawValue = req.headers?.authorization;
  return Array.isArray(rawValue) ? String(rawValue[0] || "") : String(rawValue || "");
}

async function handleScheduledJobsRoute(
  req: RequestLike,
  res: unknown,
  runScheduledJobs: RunScheduledJobs,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret || readAuthorizationHeader(req) !== `Bearer ${cronSecret}`) {
    sendLocalizedError(res, 401, null, "Accesso cron non autorizzato.", "server.cron.unauthorized", {}, "CRON_UNAUTHORIZED");
    return;
  }

  try {
    const payload = await runScheduledJobs();
    sendJson(res, 200, payload);
  } catch (error) {
    sendLocalizedError(res, 500, error, "Esecuzione job schedulati non riuscita.", "server.cron.failed");
  }
}

module.exports = {
  handleScheduledJobsRoute
};
