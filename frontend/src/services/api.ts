import type { ApiOptions } from "../types";
class ApiError extends Error {
  status: number = 0;
}
export async function api<T = any>(
  path: string,
  { body, ...options }: ApiOptions = {},
) {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const data = await res
    .json()
    .catch(() => ({ message: "Réponse du serveur illisible." }));
  if (!res.ok) {
    const e = new ApiError(data.message || "Opération impossible.");
    e.status = res.status;
    throw e;
  }
  return data;
}
