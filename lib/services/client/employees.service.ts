export async function fetchEmployees(
  params: { page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  const res = await fetch(`/api/employees${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEmployeesList(params: { page?: number; limit?: number } = {}) {
  return fetchEmployees(params);
}

export async function fetchEmployeeDetails(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEmployeeSalary(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}/salary`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEmployeeBonuses(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}/bonuses`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEmployeePayslips(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}/payslips`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEmployeeEvaluations(employeeId: string) {
  const res = await fetch(`/api/evaluations?employeeId=${employeeId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTasks(
  _projectId?: string,
  params: { page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  const res = await fetch(`/api/tasks${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTeamTasks(query = "") {
  const res = await fetch(`/api/tasks${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
