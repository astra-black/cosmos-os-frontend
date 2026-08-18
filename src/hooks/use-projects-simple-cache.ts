import { useSimpleCache } from "@/hooks/use-simple-cache"
import { listProjects } from "@/lib/api/agency"
import type { Project } from "@/types/agency"

export function useProjectsSimpleCache() {
  return useSimpleCache<Project[]>(async () => {
    const res = await listProjects()
    return res.data ?? []
  }, "projects")
}
