export function isAllowedOrigin(
  origin: any,
  host: any,
  appOrigin: any,
  apiPort: any,
) {
  const accepted = new Set([
    appOrigin || "http://localhost:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    `http://localhost:${apiPort}`,
    `http://127.0.0.1:${apiPort}`,
  ]);
  if (host) {
    accepted.add(`http://${host}`);
    accepted.add(`https://${host}`);
  }
  return accepted.has(origin);
}
