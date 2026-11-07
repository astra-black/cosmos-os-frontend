import { apiRequest } from "@/lib/api/client"
import type { ApiEnvelope, AuthUser } from "@/types/agency"

/** Organization profile from GET /api/v1/auth/agency (session-scoped). */
export type AgencyOrganization = {
  id?: string
  agencyId?: string
  name?: string
  slug?: string
  domain?: string | null
  billingContactEmail?: string | null
  billingEmail?: string | null
  contactPerson?: string | null
  description?: string | null
  website?: string | null
  phone?: string | null
  headquarters?: string | null
  timezone?: string | null
  legalName?: string | null
  avatarUrl?: string | null
  logoUrl?: string | null
  status?: string | null
  memberCount?: number
  teamMembers?: Array<{
    id: string
    name?: string | null
    email?: string | null
    jobFunction?: string | null
    permissionRole?: string | null
    status?: string | null
  }>
  settings?: Record<string, unknown> | null
  updatedAt?: string
  createdAt?: string
}

export type AgencyOrganizationUpdate = {
  name?: string
  legalName?: string
  description?: string
  website?: string
  phone?: string
  headquarters?: string
  timezone?: string
  domain?: string
  billingContactEmail?: string
  contactPerson?: string
}

export async function getAgencyOrganization() {
  return apiRequest<ApiEnvelope<AgencyOrganization>>("/api/v1/auth/agency")
}

/** Update session organization. Never send agencyId — server uses JWT scope. */
export async function updateAgencyOrganization(
  payload: AgencyOrganizationUpdate | FormData,
) {
  if (payload instanceof FormData) {
    return apiRequest<ApiEnvelope<AgencyOrganization>>("/api/v1/auth/agency", {
      method: "PUT",
      body: payload,
    })
  }
  return apiRequest<ApiEnvelope<AgencyOrganization>>("/api/v1/auth/agency", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function updateProfile(payload: {
  name?: string
  title?: string | null
  phone?: string | null
}) {
  return apiRequest<ApiEnvelope<AuthUser>>("/api/v1/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
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

export async function listInvitations(options?: { status?: string }) {
  const params = new URLSearchParams()
  if (options?.status) params.set("status", options.status)
  const query = params.toString()
  return apiRequest<ApiEnvelope<InvitationData[]>>(
    `/invitations${query ? `?${query}` : ""}`,
  )
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
  return apiRequest<ApiEnvelope<{ token: string; accessToken: string; refreshToken?: string; user: AuthUser }>>(
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

