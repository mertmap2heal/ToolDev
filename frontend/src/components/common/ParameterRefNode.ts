import { Node, mergeAttributes } from '@tiptap/core'

/**
 * TipTap inline node for parameter references in requirement/function descriptions.
 * Parses and renders <span data-param-id="..." class="param-ref">Name</span> so only
 * the parameter name is visible (bold, clickable via .param-ref CSS). Serialized HTML
 * stays compatible with editorSpansToPlaceholders() for storage as {{param:id}}.
 */
export const ParameterRefNode = Node.create({
  name: 'parameterRef',

  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-param-id'),
        renderHTML: (attrs) => (attrs.id ? { 'data-param-id': attrs.id } : {}),
      },
      name: {
        default: '',
        parseHTML: (element) => (element as HTMLElement).textContent?.trim() ?? '',
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-param-id]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement
          return {
            id: el.getAttribute('data-param-id'),
            name: el.textContent?.trim() ?? '',
          }
        },
      },
      {
        tag: 'span.param-ref',
        getAttrs: (dom) => {
          const el = dom as HTMLElement
          return {
            id: el.getAttribute('data-param-id'),
            name: el.textContent?.trim() ?? '',
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-param-id': node.attrs.id,
        class: 'param-ref',
      }),
      node.attrs.name ?? '',
    ]
  },
})
