export async function fetchRequests(
  params: { page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  const res = await fetch(`/api/requests${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
