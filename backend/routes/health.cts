import type * as HttpTypes from "node:http";
export async function handleHealthRoute(
  res: HttpTypes.ServerResponse,
  healthSnapshot: () => Promise<{ ok: boolean } & Record<string, unknown>>,
  sendJson: (
    res: HttpTypes.ServerResponse,
    statusCode: number,
    payload: unknown,
    headers?: Record<string, string>
  ) => void
): Promise<boolean> {
  const health = await healthSnapshot();
  sendJson(res, health.ok ? 200 : 503, health);
  return true;
}
