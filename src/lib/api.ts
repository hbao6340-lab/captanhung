const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = input.toString();
  // When BASE_URL is empty, use the path directly (relative to origin).
  // When BASE_URL is set, join properly to avoid protocol-relative URLs like "//api/...".
  const url = BASE_URL
    ? BASE_URL.replace(/\/$/, "") + (path.startsWith("/") ? "" : "/") + path
    : path;
  const res = await fetch(url, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
    cache: "no-store",
  });
  return res;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await request(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postJson(path: string, body: unknown): Promise<Response> {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

export async function postForm(path: string, formData: FormData): Promise<Response> {
  return request(path, { method: "POST", body: formData });
}

export async function patchJson(path: string, body: unknown): Promise<Response> {
  return request(path, { method: "PATCH", body: JSON.stringify(body) });
}
