export async function fetchChatEmployees() {
  const res = await fetch("/api/employees/chat", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchConversations() {
  const res = await fetch("/api/conversations", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createConversation(payload: unknown) {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMessages(conversationId: string, limit = 50) {
  const res = await fetch(`/api/conversations/${conversationId}/messages?limit=${limit}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markAsRead(conversationId: string) {
  const res = await fetch(`/api/conversations/${conversationId}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
