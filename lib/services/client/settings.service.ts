export async function fetchProfile() {
  const res = await fetch("/api/employees/profile", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateProfile(payload: unknown) {
  const res = await fetch("/api/employees/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updatePassword(payload: unknown) {
  const res = await fetch("/api/auth/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchSlaConfig() {
  const res = await fetch("/api/sla-config", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSlaConfig(id: string, payload: unknown) {
  const res = await fetch(`/api/sla-config/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchSignature() {
  const res = await fetch("/api/rh/signature", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadSignature(formData: FormData) {
  const res = await fetch("/api/rh/signature", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSignature() {
  const res = await fetch("/api/rh/signature", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function transferRhAccess(payload: unknown) {
  const res = await fetch("/api/rh/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dataUrlToSignatureFile(dataUrl: string, name: string) {
  const [header, body] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  if (!mimeMatch || !body) {
    throw new Error("Format de signature invalide");
  }

  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], name, { type: mimeMatch[1] || "image/png" });
}
