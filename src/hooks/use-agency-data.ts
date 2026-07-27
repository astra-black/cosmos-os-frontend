import { useCallback } from "react"
import {
  listAssets,
  listCampaigns,
  listClients,
  listProjects,
  listTasks,
  listTeamMembers,
  listVendors,
  normalizeAssets,
  normalizeProjects,
} from "@/lib/api/agency"
import type {
  AgencyClient,
  Asset,
  Campaign,
  Project,
  Task,
  TeamMember,
  Vendor,
} from "@/types/agency"
import { useAsyncList } from "@/hooks/use-async-list"

export function useClients() {
  return useAsyncList<AgencyClient>(
    useCallback(async () => {
      const res = await listClients()
      return res.data ?? []
    }, []),
  )
}

export function useProjects() {
  return useAsyncList<Project>(
    useCallback(async () => {
      const res = await listProjects()
      return normalizeProjects(res)
    }, []),
  )
}

export function useTasks(params?: { projectId?: string; status?: string }) {
  return useAsyncList<Task>(
    useCallback(async () => {
      const res = await listTasks(params)
      return res.data ?? []
    }, [params?.projectId, params?.status]),
  )
}

export function useTeamMembers() {
  return useAsyncList<TeamMember>(
    useCallback(async () => {
      const res = await listTeamMembers()
      return res.data ?? []
    }, []),
  )
}

export function useAssets(params?: { projectId?: string; status?: string }) {
  return useAsyncList<Asset>(
    useCallback(async () => {
      const res = await listAssets(params)
      return normalizeAssets(res)
    }, [params?.projectId, params?.status]),
  )
}

export function useVendors(params?: { category?: string; status?: string }) {
  return useAsyncList<Vendor>(
    useCallback(async () => {
      const res = await listVendors(params)
      return res.data ?? []
    }, [params?.category, params?.status]),
  )
}

export function useCampaigns() {
  return useAsyncList<Campaign>(
    useCallback(async () => {
      const res = await listCampaigns()
      return res.data ?? []
    }, []),
  )
}
