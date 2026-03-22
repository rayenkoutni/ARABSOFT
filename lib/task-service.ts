export async function getTasks() {
  const res = await fetch("/api/tasks", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch tasks")
  return res.json()
}

export async function createTask(data: any) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error("Failed to create task")
  return res.json()
}
