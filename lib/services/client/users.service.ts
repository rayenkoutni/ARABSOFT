export async function fetchUsers() {
  const res = await fetch("/api/employees", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUser(payload: unknown) {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUser(employeeId: string, payload: unknown) {
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(employeeId: string, payload?: unknown) {
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDeleteImpact(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}?mode=delete-impact`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchSalaryGrades() {
  const res = await fetch("/api/salary-grades", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
