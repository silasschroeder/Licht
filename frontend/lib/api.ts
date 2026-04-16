export const API_BASE = "";
// process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export async function apiGet(path: string): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
  });
  return res;
}

export async function apiPost(path: string, body: any): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return res;
}

export async function apiPut(path: string, body: any): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return res;
}
