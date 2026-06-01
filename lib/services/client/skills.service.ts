export async function fetchSkills(query = "") {
  const res = await fetch(`/api/skills${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEmployeeSkills(employeeId: string) {
  const res = await fetch(`/api/employees/${employeeId}/skills`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchSkillsEmployees() {
  const res = await fetch("/api/skills/employees", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addSkill(payload: unknown) {
  const res = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSkill(skillId: string, payload: unknown) {
  const res = await fetch(`/api/skills/${skillId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeSkill(skillId: string) {
  const res = await fetch(`/api/skills/${skillId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateEmployeeSkills(employeeId: string, payload: unknown) {
  const res = await fetch(`/api/employees/${employeeId}/skills`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
