import type { Project } from 'shared/types/project.types'

/**
 * Returns the URL segment (slug or id) for a project.
 * Use this when building project URLs for navigation and links.
 */
export function getProjectUrlParam(project: Pick<Project, 'slug' | 'id'>): string {
  return project.slug ?? project.id
}
