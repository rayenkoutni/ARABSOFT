export async function fetchSlaStats() {
  const res = await fetch("/api/sla/stats", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDashboardEmployeeProfile() {
  const res = await fetch("/api/employees/profile", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDashboardTasks() {
  const res = await fetch("/api/tasks", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDashboardEmployees() {
  const res = await fetch("/api/employees", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDashboardReport() {
  const res = await fetch("/api/dashboard/report", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
}
