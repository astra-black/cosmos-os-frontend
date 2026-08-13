import { apiRequest } from "@/lib/api/client"
import type { ApiEnvelope, AuthUser } from "@/types/agency"

export async function updateProfile(name: string) {
  return apiRequest<ApiEnvelope<AuthUser>>("/api/v1/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ name }),
  })
}

export async function uploadProfilePhoto(form: FormData) {
  return apiRequest<ApiEnvelope<AuthUser>>("/api/v1/auth/profile/photo", {
    method: "POST",
    body: form,
  })
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return apiRequest<ApiEnvelope<null>>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}
