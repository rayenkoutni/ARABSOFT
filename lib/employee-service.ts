export async function getEmployees() {
  const res = await fetch("/api/employees", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch employees")
  return res.json()
}
