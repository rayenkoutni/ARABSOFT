export async function fetchNotifications(
  params: { page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  const res = await fetch(`/api/notifications${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markNotificationAsRead(id: string) {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function clearNotifications() {
  const res = await fetch("/api/notifications", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
