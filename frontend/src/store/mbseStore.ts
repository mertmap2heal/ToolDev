import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DiagramType } from '../components/mbse/MBSEDiagramMenu'

/**
 * Represents an open diagram tab in the MBSE workspace
 */
export interface DiagramTab {
  id: string
  type: DiagramType
  name: string
  isPinned: boolean
  isModified: boolean
}

/**
 * Represents a selected element in the model
 */
export interface SelectedElement {
  id: string
  type: 'requirement' | 'function' | 'useCase' | 'package' | 'diagram'
  name: string
  data?: Record<string, unknown>
}

/**
 * Tree node expansion state tracking
 */
export interface TreeState {
  expandedNodes: Set<string>
}

/**
 * Panel visibility configuration
 */
export interface PanelVisibility {
  modelBrowser: boolean
  propertiesPanel: boolean
}

/**
 * Panel width configuration for resizable panels
 */
export interface PanelWidths {
  modelBrowser: number
  propertiesPanel: number
}

interface MBSEState {
  // Tab management
  openTabs: DiagramTab[]
  activeTabId: string | null
  
  // Selection state
  selectedElement: SelectedElement | null
  
  // Tree expansion state (stored as array for persistence)
  expandedNodes: string[]
  
  // Panel visibility
  panelVisibility: PanelVisibility
  
  // Panel widths
  panelWidths: PanelWidths
  
  // Actions - Tab management
  openTab: (tab: Omit<DiagramTab, 'isPinned' | 'isModified'>) => void
  closeTab: (tabId: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  pinTab: (tabId: string) => void
  unpinTab: (tabId: string) => void
  markTabModified: (tabId: string, isModified: boolean) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  
  // Actions - Selection
  selectElement: (element: SelectedElement | null) => void
  clearSelection: () => void
  
  // Actions - Tree state
  toggleNodeExpansion: (nodeId: string) => void
  expandNode: (nodeId: string) => void
  collapseNode: (nodeId: string) => void
  expandAll: () => void
  collapseAll: () => void
  
  // Actions - Panel visibility
  toggleModelBrowser: () => void
  togglePropertiesPanel: () => void
  setPanelVisibility: (panel: keyof PanelVisibility, visible: boolean) => void
  
  // Actions - Panel widths
  setPanelWidth: (panel: keyof PanelWidths, width: number) => void
}

/**
 * MBSE workspace state management store
 * Handles diagram tabs, element selection, tree navigation, and panel configuration
 */
export const useMBSEStore = create<MBSEState>()(
  persist(
    (set, get) => ({
      // Initial state
      openTabs: [],
      activeTabId: null,
      selectedElement: null,
      expandedNodes: [],
      panelVisibility: {
        modelBrowser: true,
        propertiesPanel: true,
      },
      panelWidths: {
        modelBrowser: 280,
        propertiesPanel: 320,
      },

      // Tab management actions
      openTab: (tab) => {
        const { openTabs, activeTabId } = get()
        const existingTab = openTabs.find((t) => t.id === tab.id)
        
        if (existingTab) {
          // Tab already open, just activate it
          set({ activeTabId: tab.id })
        } else {
          // Add new tab
          const newTab: DiagramTab = {
            ...tab,
            isPinned: false,
            isModified: false,
          }
          set({
            openTabs: [...openTabs, newTab],
            activeTabId: tab.id,
          })
        }
      },

      closeTab: (tabId) => {
        const { openTabs, activeTabId } = get()
        const tabIndex = openTabs.findIndex((t) => t.id === tabId)
        const tab = openTabs[tabIndex]
        
        // Prevent closing pinned tabs
        if (tab?.isPinned) return
        
        const newTabs = openTabs.filter((t) => t.id !== tabId)
        
        // If closing active tab, select adjacent tab
        let newActiveTabId = activeTabId
        if (activeTabId === tabId) {
          if (newTabs.length > 0) {
            const newIndex = Math.min(tabIndex, newTabs.length - 1)
            newActiveTabId = newTabs[newIndex].id
          } else {
            newActiveTabId = null
          }
        }
        
        set({ openTabs: newTabs, activeTabId: newActiveTabId })
      },

      closeAllTabs: () => {
        const { openTabs } = get()
        const pinnedTabs = openTabs.filter((t) => t.isPinned)
        set({
          openTabs: pinnedTabs,
          activeTabId: pinnedTabs.length > 0 ? pinnedTabs[0].id : null,
        })
      },

      closeOtherTabs: (tabId) => {
        const { openTabs } = get()
        const keptTabs = openTabs.filter((t) => t.id === tabId || t.isPinned)
        set({ openTabs: keptTabs, activeTabId: tabId })
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
      },

      pinTab: (tabId) => {
        const { openTabs } = get()
        set({
          openTabs: openTabs.map((t) =>
            t.id === tabId ? { ...t, isPinned: true } : t
          ),
        })
      },

      unpinTab: (tabId) => {
        const { openTabs } = get()
        set({
          openTabs: openTabs.map((t) =>
            t.id === tabId ? { ...t, isPinned: false } : t
          ),
        })
      },

      markTabModified: (tabId, isModified) => {
        const { openTabs } = get()
        set({
          openTabs: openTabs.map((t) =>
            t.id === tabId ? { ...t, isModified } : t
          ),
        })
      },

      reorderTabs: (fromIndex, toIndex) => {
        const { openTabs } = get()
        const newTabs = [...openTabs]
        const [movedTab] = newTabs.splice(fromIndex, 1)
        newTabs.splice(toIndex, 0, movedTab)
        set({ openTabs: newTabs })
      },

      // Selection actions
      selectElement: (element) => {
        set({ selectedElement: element })
      },

      clearSelection: () => {
        set({ selectedElement: null })
      },

      // Tree state actions
      toggleNodeExpansion: (nodeId) => {
        const { expandedNodes } = get()
        const isExpanded = expandedNodes.includes(nodeId)
        set({
          expandedNodes: isExpanded
            ? expandedNodes.filter((id) => id !== nodeId)
            : [...expandedNodes, nodeId],
        })
      },

      expandNode: (nodeId) => {
        const { expandedNodes } = get()
        if (!expandedNodes.includes(nodeId)) {
          set({ expandedNodes: [...expandedNodes, nodeId] })
        }
      },

      collapseNode: (nodeId) => {
        const { expandedNodes } = get()
        set({ expandedNodes: expandedNodes.filter((id) => id !== nodeId) })
      },

      expandAll: () => {
        // This will be populated by the component with all node IDs
        // For now, set a flag that components can check
        set({ expandedNodes: ['__all__'] })
      },

      collapseAll: () => {
        set({ expandedNodes: [] })
      },

      // Panel visibility actions
      toggleModelBrowser: () => {
        const { panelVisibility } = get()
        set({
          panelVisibility: {
            ...panelVisibility,
            modelBrowser: !panelVisibility.modelBrowser,
          },
        })
      },

      togglePropertiesPanel: () => {
        const { panelVisibility } = get()
        set({
          panelVisibility: {
            ...panelVisibility,
            propertiesPanel: !panelVisibility.propertiesPanel,
          },
        })
      },

      setPanelVisibility: (panel, visible) => {
        const { panelVisibility } = get()
        set({
          panelVisibility: {
            ...panelVisibility,
            [panel]: visible,
          },
        })
      },

      // Panel width actions
      setPanelWidth: (panel, width) => {
        const { panelWidths } = get()
        set({
          panelWidths: {
            ...panelWidths,
            [panel]: width,
          },
        })
      },
    }),
    {
      name: 'mbse-workspace-storage',
      partialize: (state) => ({
        // Only persist these specific state properties
        panelVisibility: state.panelVisibility,
        panelWidths: state.panelWidths,
        expandedNodes: state.expandedNodes,
      }),
    }
  )
)

/**
 * Helper hook to get the active tab data
 */
export const useActiveTab = () => {
  const { openTabs, activeTabId } = useMBSEStore()
  return openTabs.find((t) => t.id === activeTabId) || null
}

/**
 * Helper hook to check if a node is expanded
 */
export const useIsNodeExpanded = (nodeId: string) => {
  const { expandedNodes } = useMBSEStore()
  return expandedNodes.includes(nodeId) || expandedNodes.includes('__all__')
}
