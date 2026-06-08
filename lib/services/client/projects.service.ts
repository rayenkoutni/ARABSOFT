export async function fetchProjects(
  params: { page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  const res = await fetch(`/api/projects${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchProjectById(projectId: string) {
  const res = await fetch(`/api/projects?projectId=${projectId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createProject(payload: unknown) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateProject(projectId: string, payload: unknown) {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProject(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchProjectTeam(endpoint: string) {
  const res = await fetch(endpoint, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchProjectTechnicalSkills() {
  const res = await fetch("/api/skills?type=TECHNICAL", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateProjectTask(projectId: string, payload: unknown) {
  const res = await fetch(`/api/projects/${projectId}/tasks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProjectTask(projectId: string, taskId: string) {
  const res = await fetch(`/api/projects/${projectId}/tasks?taskId=${taskId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateProjectTasks(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}/generate-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateProjectTasksFromDraft(payload: unknown) {
  const res = await fetch("/api/projects/generate-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveGeneratedProjectTasks(projectId: string, payload: unknown) {
  const res = await fetch(`/api/projects/${projectId}/generate-tasks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitProjectTaskForReview(taskId: string, payload: unknown) {
  const res = await fetch(`/api/tasks/${taskId}/submit-review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reviewProjectTaskDecision(taskId: string, payload: unknown) {
  const res = await fetch(`/api/tasks/${taskId}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reviewProjectTasks(projectId: string, payload: unknown) {
  const res = await fetch(`/api/projects/${projectId}/tasks/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
