export async function fetchBonuses(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}/bonuses`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
