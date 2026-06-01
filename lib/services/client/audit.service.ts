export async function fetchAuditLogs(query: string) {
  const res = await fetch(`/api/audit-logs?${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportAuditLogs(query: string) {
  const res = await fetch(`/api/audit-logs/export?${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
}
