import EntityDiscussion, {
  type DiscussionAdapter,
  type DiscussionComment,
} from '../common/EntityDiscussion'
import { validationService, type ValidationCommentRow } from '../../services/validation.service'

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
    />
  )
}
