import type { CSSProperties } from 'react'

/**
 * Same width as EditRequirementModal side panel ΓÇö keeps workbench squeeze aligned.
 * max(300px, min(560px, 46vw))
 */
export const SIDE_EDITOR_WIDTH_CSS = 'max(300px, min(560px, 46vw))'

export function sideEditorPanelStyle(): CSSProperties {
  return {
    width: SIDE_EDITOR_WIDTH_CSS,
    maxWidth: '100%',
  }
}

/** Left region when workbench shares the screen with the editor */
export function qualityWorkbenchSqueezeStyle(): CSSProperties {
  return {
    width: `calc(100% - ${SIDE_EDITOR_WIDTH_CSS})`,
  }
}
