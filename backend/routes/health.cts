export async function handleHealthRoute(
  res: import("node:http").ServerResponse,
  healthSnapshot: () => Promise<{ ok: boolean } & Record<string, unknown>>,
  sendJson: (
    res: import("node:http").ServerResponse,
    statusCode: number,
    payload: unknown,
    headers?: Record<string, string>
  ) => void
): Promise<boolean> {
  const health = await healthSnapshot();
  sendJson(res, health.ok ? 200 : 503, health);
  return true;
}
