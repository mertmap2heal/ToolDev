/**
 * MBSE Custom Node Types
 * Export all custom ReactFlow nodes for SysML/UML diagrams
 */

import RequirementNode from './RequirementNode'
import BlockNode from './BlockNode'
import ActorNode from './ActorNode'
import UseCaseNode from './UseCaseNode'
import StateNode from './StateNode'
import ActivityNode from './ActivityNode'

/**
 * Node type registry for ReactFlow
 * Maps node type strings to their React components
 */
export const nodeTypes = {
  requirement: RequirementNode,
  block: BlockNode,
  actor: ActorNode,
  useCase: UseCaseNode,
  state: StateNode,
  activity: ActivityNode,
}

export {
  RequirementNode,
  BlockNode,
  ActorNode,
  UseCaseNode,
  StateNode,
  ActivityNode,
}
