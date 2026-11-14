const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${input.toString().startsWith("http") ? "" : "/"}${input}`, {
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
