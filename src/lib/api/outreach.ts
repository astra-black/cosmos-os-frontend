/**
 * Outreach Pipeline API Client
 * Apollo integration for lead extraction and syncing
 */

import { apiRequest } from "@/lib/api/client"
import type { ApiEnvelope } from "@/types/agency"

// Types for Apollo integration
export interface ApolloContact {
  id: string
  first_name: string
  last_name?: string
  last_name_obfuscated?: string
  name?: string
  title?: string
  email?: string
  email_status?: "verified" | "unverified" | "unavailable"
  linkedin_url?: string
  phone?: string
  direct_phone?: string
  company_id?: string
  company_name?: string
  organization?: {
    id?: string
    name: string
    website_url?: string
    industry?: string
    size?: string
    location?: {
      country?: string
      state?: string
      city?: string
    }
    estimated_revenue?: number
    has_industry?: boolean
    has_phone?: boolean
    has_city?: boolean
    has_state?: boolean
    has_country?: boolean
    has_zip_code?: boolean
    has_revenue?: boolean
    has_employee_count?: boolean
  }
  country?: string
  state?: string
  city?: string
  department?: string
  seniority?: string
  person_id?: string
  last_refreshed_at?: string
  has_email?: boolean
  has_city?: boolean
  has_state?: boolean
  has_country?: boolean
  has_direct_phone?: boolean | string
}

export interface ApolloOrganization {
  id: string
  name: string
  website_url?: string
  linkedin_url?: string
  twitter_url?: string
  facebook_url?: string
  phone?: string
  industry?: string
  size?: string
  revenue_range?: string
  estimated_revenue?: number
  employee_count?: number
  location?: {
    country?: string
    state?: string
    city?: string
    street?: string
    postal_code?: string
  }
  description?: string
  founded_year?: number
  technologies?: string[]
  ticker?: string
  current_employee_estimate?: number
  total_employee_estimate?: number
}

export interface ApolloSearchParams {
  titles?: string[]
  locations?: string[]
  companyNames?: string[]
  industries?: string[]
  companyLocations?: string[]
  revenueRanges?: string[]
  companySizes?: string[]
  keywords?: string
  page?: number
  perPage?: number
}

export interface ApolloSearchResponse {
  contacts: ApolloContact[]
  organizations?: ApolloOrganization[]
  pagination?: {
    page: number
    per_page: number
    total_pages: number
    total_entries: number
  }
}

export interface SyncResult {
  synced: number
  skipped: number
  errors: Array<{
    email: string
    error: string
  }>
}

export interface SearchAndSyncResult {
  search: ApolloSearchResponse
  sync: SyncResult
}

/**
 * Get Apollo API quota status
 */
export async function getApolloQuota() {
  return apiRequest<ApiEnvelope<{ current_period: { remaining: number; limit: number } }>>(
    "/api/v1/outreach/quota",
  )
}

/**
 * Get monthly usage stats for current user
 */
export async function getOutreachUsage() {
  return apiRequest<
    ApiEnvelope<{
      used: number
      limit: number
      remaining: number
      resetDate: string
      percentage: number
    }>
  >("/api/v1/outreach/usage")
}

/**
 * Search Apollo for contacts
 */
export async function searchApolloContacts(searchParams: ApolloSearchParams) {
  return apiRequest<ApiEnvelope<ApolloSearchResponse>>("/api/v1/outreach/search", {
    method: "POST",
    body: JSON.stringify(searchParams),
  })
}

/**
 * Extract contacts from a specific Apollo organization
 */
export async function extractOrganizationContacts(
  organizationId: string,
  options: {
    page?: number
    perPage?: number
    titles?: string[]
    departments?: string[]
    seniorities?: string[]
  } = {},
) {
  return apiRequest<ApiEnvelope<ApolloSearchResponse>>(
    `/api/v1/outreach/organizations/${organizationId}/contacts`,
    {
      method: "POST",
      body: JSON.stringify(options),
    },
  )
}

/**
 * Enrich a single contact by email
 */
export async function enrichContact(email: string) {
  return apiRequest<ApiEnvelope<ApolloContact>>("/api/v1/outreach/enrich", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

/**
 * Sync Apollo contacts to Airtable Outreach Hub
 */
export async function syncContactsToAirtable(
  contacts: ApolloContact[],
  tableName?: string,
) {
  return apiRequest<ApiEnvelope<SyncResult>>("/api/v1/outreach/sync/contacts", {
    method: "POST",
    body: JSON.stringify({ contacts, tableName }),
  })
}

/**
 * Sync Apollo organization to Airtable
 */
export async function syncOrganizationToAirtable(
  organization: ApolloOrganization,
  tableName?: string,
) {
  return apiRequest<
    ApiEnvelope<{ synced: boolean; action: "created" | "updated"; recordId: string }>
  >("/api/v1/outreach/sync/organization", {
    method: "POST",
    body: JSON.stringify({ organization, tableName }),
  })
}

/**
 * Search Apollo and sync to Airtable in one operation
 */
export async function searchAndSyncContacts(
  searchParams: ApolloSearchParams,
  syncOptions?: { tableName?: string },
) {
  return apiRequest<ApiEnvelope<SearchAndSyncResult>>("/api/v1/outreach/search-and-sync", {
    method: "POST",
    body: JSON.stringify({ searchParams, syncOptions }),
  })
}

/**
 * Filter contacts by email verification status
 */
export async function filterContactsByEmailStatus(
  contacts: ApolloContact[],
  filter: "all" | "verified" | "personal" | "professional" = "verified",
) {
  return apiRequest<ApiEnvelope<ApolloContact[]>>("/api/v1/outreach/filter", {
    method: "POST",
    body: JSON.stringify({ contacts, filter }),
  })
}

/**
 * Verify an email address
 */
export async function verifyEmail(email: string) {
  return apiRequest<
    ApiEnvelope<{ email: string; status: "valid" | "invalid" | "accept_all" | "unknown"; score?: number }>
  >("/api/v1/outreach/verify-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}
