import { useQuery } from '@tanstack/react-query'
import EntityDiscussion, {
  type DiscussionAdapter,
  type DiscussionComment,
  type MentionableMember,
} from '../common/EntityDiscussion'
import { validationService, type ValidationCommentRow } from '../../services/validation.service'
import { projectService } from '../../services/project.service'

interface Props {
  projectId: string
  itemId: string
  currentUserId: string
}

function toDiscussion(c: ValidationCommentRow): DiscussionComment {
  return {
    id: c.id,
    body: c.body,
    authorUserId: c.authorUserId,
    author: c.author ?? null,
    parentId: c.parentId ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    deletedAt: c.deletedAt ?? null,
  }
}

export default function ValidationCommentsSection({ projectId, itemId, currentUserId }: Props) {
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const res = await projectService.getProjectMembers(projectId)
      return res.success && res.data ? res.data : []
    },
    staleTime: 5 * 60_000,
    enabled: !!projectId,
  })

  type MemberLite = { userId: string; user?: { name?: string | null; email?: string | null } }
  const mentionables: MentionableMember[] = (members as MemberLite[]).map((m) => ({
    id: m.userId,
    name: m.user?.name ?? null,
    email: m.user?.email ?? null,
  }))

  const adapter: DiscussionAdapter = {
    async list() {
      const res = await validationService.listComments(projectId, itemId)
      return res.success && res.data ? res.data.map(toDiscussion) : []
    },
    async create(body, parentId) {
      const res = await validationService.createComment(projectId, itemId, {
        body,
        parentId: parentId ?? undefined,
      })
      return res.success && res.data ? toDiscussion(res.data) : null
    },
    async update(id, body) {
      const res = await validationService.updateComment(projectId, itemId, id, body)
      return res.success && res.data ? toDiscussion(res.data) : null
    },
    async remove(id) {
      const res = await validationService.deleteComment(projectId, itemId, id)
      return res.success === true
    },
  }

  return (
    <EntityDiscussion
      adapter={adapter}
      queryKey={['validation-comments', projectId, itemId]}
      currentUserId={currentUserId}
      members={mentionables}
    />
  )
}
