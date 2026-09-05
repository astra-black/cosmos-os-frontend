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

export type InvitationData = {
  id: string
  token?: string
  agencyId?: string
  email?: string | null
  jobFunction: string
  permissionRole: string
  agencyName?: string
  agencySlug?: string
  invitedBy?: string
  expiresAt: string
  status: string
}

export async function createInvitation(payload: {
  email?: string
  jobFunction: string
  permissionRole: string
}) {
  return apiRequest<ApiEnvelope<InvitationData>>("/invitations", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getInvitationDetails(token: string) {
  return apiRequest<ApiEnvelope<InvitationData>>(`/invitations/${encodeURIComponent(token)}`)
}

export async function acceptInvitation(payload: {
  token: string
  name: string
  password: string
  email?: string
}) {
  return apiRequest<ApiEnvelope<{ token: string; accessToken: string; user: AuthUser }>>(
    `/invitations/${encodeURIComponent(payload.token)}/accept`,
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        password: payload.password,
        email: payload.email,
      }),
    },
  )
}

