/**
 * Main App Component
 * Integrates all components: Toolbar, DiagramEditor, and SymbolPalette
 * Provides the main layout for the collaborative diagram editor
 */

import { useRef, useState, useEffect } from 'react';
import { DiagramEditor, DiagramEditorRef } from './script/diagramEditor';
import { Toolbar } from './script/toolbar';
import { AdvancedSymbolPalette as SymbolPalette } from './script/advancedSymbolPalette';
import { PropertyPanel } from './script/propertyPanel';
import { type NodeModel, type ConnectorModel } from '@syncfusion/ej2-react-diagrams';
import type { ToolbarAction, NodeProperties, ConnectorProperties, SelectedItem } from './script/diagramTypes';
import { ConnectorPropertyPanel } from './script/connectorPropertyPanel';
import { MultiSelectionPropertyPanel } from './script/multiSelectionPropertyPanel';
import { createSpinner, showSpinner, hideSpinner } from '@syncfusion/ej2-popups';
import './App.css';
import "./assets/db-icons1/style.css";
import './assets/dbstyle/diagrambuilder.css'
import React from 'react';

// Selection type for property panel
type SelectionType = 'none' | 'node' | 'connector' | 'annotation' | 'multiple';

interface SelectionState {
  type: SelectionType;
  element: NodeModel | ConnectorModel | null;
  count: number;
}

function App() {
  const diagramRef = useRef<DiagramEditorRef>(null);
  const [selectedNode, setSelectedNode] = useState<NodeModel | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorModel | null>(null);

  // Enhanced selection state for dynamic property panel updates
  const [selectionState, setSelectionState] = useState<SelectionState>({
    type: 'none',
    element: null,
    count: 0
  });

  // Full-page spinner state (moved from DiagramEditor)
  const [showSpinnerOverlay, setShowSpinnerOverlay] = useState<boolean>(true);

  // Guest count shown in Toolbar banner
  const [guestCount, setGuestCount] = useState<number>(1);

  // Initialize spinner on mount and manage visibility
  useEffect(() => {
    try {
      const spinnerEl = document.getElementById('spinner');
      if (!spinnerEl) return;

      if (showSpinnerOverlay) {
        // initialize and show spinner; let any error be caught below
        createSpinner({ target: spinnerEl as HTMLElement });
        showSpinner(spinnerEl as HTMLElement);
      } else {
        // hide spinner when overlay disabled
        hideSpinner(spinnerEl as HTMLElement);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Spinner initialization error:', err);
    }
  }, [showSpinnerOverlay]);

  const handleUserCountChange = (count: number) => {
    setGuestCount(count);
  };

  // Annotation selection state
  const [annotationInfo, setAnnotationInfo] = useState<{ node: NodeModel | null; index: number | null }>({ node: null, index: null });

  // Toolbar state
  const [toolbarState, setToolbarState] = useState({
    isUndoEnabled: false,
    isRedoEnabled: false,
    isCutEnabled: false,
    isCopyEnabled: false,
    isPasteEnabled: false,
    isGroupEnabled: true
  });

  /**
   * Handle toolbar actions
   */
  const handleToolbarAction = (action: ToolbarAction) => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    //let action = action.toLowerCase();
    switch (action) {
      case 'new':
        diagram.clearDiagram();
        // Reset toolbar state
        setToolbarState({
          isUndoEnabled: false,
          isRedoEnabled: false,
          isCutEnabled: false,
          isCopyEnabled: false,
          isPasteEnabled: false,
          isGroupEnabled: true
        });
        break;

      case 'open':
        handleOpenDiagram();
        break;

      case 'save':
        handleSaveDiagram();
        break;

      case 'print':
        btnPrintClick();
        break;

      case 'cut':
        diagram.cut();
        enablePasteButton();
        break;

      case 'copy':
        diagram.copy();
        enablePasteButton();
        break;

      case 'paste':
        diagram.paste();
        break;

      case 'select':
        diagram.setDrawingTool('Default');
        break;

      case 'text':
        diagram.setDrawingTool('Text');
        break;

      case 'undo':
        diagram.undo();
        updateToolbarState();
        break;

      case 'redo':
        diagram.redo();
        updateToolbarState();
        break;

      case 'pan':
        diagram.setDrawingTool('Pan');
        break;

      case 'pointer':
        diagram.setDrawingTool('Default');
        break;

      case 'zoomIn':
        diagram.zoomIn();
        break;

      case 'zoomOut':
        diagram.zoomOut();
        break;

      case 'fitToPage':
        diagram.fitToPage();
        break;

      default:

    }
  };

  /**
   * Handle export actions
   */
  const handleExport = (format: any) => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    diagram.exportDiagram(format);
  };

  /**
   * Handle draw shape actions
   */
  const handleDrawShape = (shape: 'Rectangle' | 'Ellipse' | 'Polygon') => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    diagram.drawShape(shape);
  };

  /**
   * Handle draw connector actions
   */
  const handleDrawConnector = (type: 'Straight' | 'Orthogonal' | 'Bezier') => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    diagram.drawConnector(type);
  };

  /**
   * Handle group actions
   */
  const handleGroupAction = (action: 'Group' | 'Ungroup') => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    if (action === 'Group') {
      diagram.group();
    } else {
      diagram.ungroup();
    }
    updateToolbarState();
  };

  /**
   * Update toolbar state based on diagram selection and history
   */
  const updateToolbarState = () => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    const selectionCount = diagram.getSelectionCount();
    const canUndo = diagram.canUndo();
    const canRedo = diagram.canRedo();

    const newState = {
      isUndoEnabled: canUndo,
      isRedoEnabled: canRedo,
      isCutEnabled: selectionCount > 0,
      isCopyEnabled: selectionCount > 0,
      isGroupEnabled: selectionCount >= 2,
      isPasteEnabled: false
    };

    setToolbarState(newState);
  };

  /**
   * Watch for selection state changes and update toolbar accordingly
   */
  useEffect(() => {
    updateToolbarState();
  }, [selectionState]);

  /**
   * Handle opening a diagram from file
   */
  const handleOpenDiagram = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (inputEvent: Event) => {
      const file = (inputEvent.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        const data = (readerEvent.target as any)?.result as string;
        try {
          if (!data) throw new Error('File read returned empty content');

          // Validate JSON before loading
          JSON.parse(data);

          if (diagramRef.current) {
            // Hide property panels by clearing selection state so layout won't reserve right pane
            setSelectedNode(null);
            setSelectedConnector(null);
            setSelectionState({ type: 'none', element: null, count: 0 });
            setAnnotationInfo({ node: null, index: null });

            // Allow React to apply DOM changes / repaint before we load the diagram
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

            // Load locally after panels hidden and selection cleared
            diagramRef.current.loadDiagram(data);
            diagramRef.current.fitToPage();
            
            // Broadcast load to other connected clients if available
            if (typeof diagramRef.current.broadcastLoadDiagram === 'function') {
              await diagramRef.current.broadcastLoadDiagram(data);
            }

            // Update toolbar state after loading
            setTimeout(() => updateToolbarState(), 100);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to open diagram file:', err);
        }
      };

      reader.readAsText(file);
    };
    input.click();
  };

  /**
   * Handle saving diagram to file
   * Note: The actual download is handled in DiagramEditor.saveDiagram()
   */
  const handleSaveDiagram = () => {
    if (diagramRef.current) {
      // DiagramEditor.saveDiagram() already handles the download
      diagramRef.current.saveDiagram();
    }
  };

  /**
   * Enhanced selection change handler - detects element type and updates property panel
   * This creates a dynamic, event-driven property panel that automatically refreshes
   */
  const handleSelectionChange = (selected?: SelectedItem | null) => {
    // If caller provided selection info (DiagramEditor), use it
    if (selected) {
      switch (selected.type) {
        case 'node':
          setSelectedNode(selected.node as NodeModel);
          setSelectedConnector(null);
          setSelectionState({ type: 'node', element: selected.node as NodeModel, count: 1 });
          enableItems(false);  // Enable items when node is selected
          break;
        case 'connector':
          setSelectedNode(null);
          setSelectionState({ type: 'connector', element: selected.connector as ConnectorModel, count: 1 });
          setSelectedConnector(selected.connector as ConnectorModel);
          enableItems(false);  // Enable items when connector is selected
          break;
        case 'annotation':
          // Find the node and set annotation info
          const diagram = diagramRef.current?.getDiagram();
          const node = diagram?.getObject((selected as any).nodeId) as NodeModel | undefined;
          setSelectedNode(node ?? null);
          setSelectedConnector(null);
          setSelectionState({ type: 'annotation', element: node ?? null, count: 1 });
          setAnnotationInfo({ node: node ?? null, index: (selected as any).annotationIndex ?? 0 });
          enableItems(false);  // Enable items when annotation is selected
          break;
        case 'multiple':
          setSelectedNode(null);
          setSelectedConnector(null);
          setSelectionState({ type: 'multiple', element: null, count: ((selected as any).nodes?.length || 0) + ((selected as any).connectors?.length || 0) });
          setAnnotationInfo({ node: null, index: null });
          enableItems(false);  // Enable items when multiple items are selected
          break;
        default:
          setSelectedNode(null);
          setSelectedConnector(null);
          setSelectionState({ type: 'none', element: null, count: 0 });
          setAnnotationInfo({ node: null, index: null });
          enableItems(true);  // Disable items when nothing is selected
      }
      updateToolbarState();
      return;
    }

    // Fallback: read current diagram selection (used during polling or initial sync)
    const diagram = diagramRef.current?.getDiagram();
    if (!diagram || !diagram.selectedItems) {
      setSelectedNode(null);
      setSelectedConnector(null);
      setAnnotationInfo({ node: null, index: null });
      setSelectionState({ type: 'none', element: null, count: 0 });
      enableItems(true);  // Disable items
      updateToolbarState();
      return;
    }

    const selectedNodes = diagram.selectedItems.nodes || [];
    const selectedConnectors = diagram.selectedItems.connectors || [];
    const totalSelected = selectedNodes.length + selectedConnectors.length;

    if (totalSelected > 1) {
      setSelectionState({ type: 'multiple', element: null, count: totalSelected });
      setSelectedNode(null);
      setSelectedConnector(null);
      setAnnotationInfo({ node: null, index: null });
      enableItems(false);  // Enable items
      updateToolbarState();
      return;
    }

    if (selectedNodes.length === 1) {
      const selectedNode = selectedNodes[0] as NodeModel;
      setSelectedNode(selectedNode);
      setSelectedConnector(null);
      setSelectionState({ type: 'node', element: selectedNode, count: 1 });
      setAnnotationInfo({ node: null, index: null });
      enableItems(false);  // Enable items
      updateToolbarState();
      return;
    }

    if (selectedConnectors.length === 1) {
      const selectedConnector = selectedConnectors[0] as ConnectorModel;
      setSelectedNode(null);
      setSelectedConnector(null);
      setSelectionState({ type: 'connector', element: selectedConnector, count: 1 });
      setAnnotationInfo({ node: null, index: null });
      enableItems(false);  // Enable items
      updateToolbarState();
      return;
    }

    setSelectedNode(null);
    setSelectedConnector(null);
    setSelectionState({ type: 'none', element: null, count: 0 });
    setAnnotationInfo({ node: null, index: null });
    enableItems(true);  // Disable items
    updateToolbarState();
  };

  /**
   * Monitor diagram selection changes in real-time
   * This ensures property panel stays in sync with diagram interactions
   */
  useEffect(() => {
    const diagram = diagramRef.current?.getDiagram();
    if (diagram) {
      // Force an initial update to sync state
      const checkSelection = () => {
        const selectedNodes = diagram.selectedItems?.nodes || [];
        const selectedConnectors = diagram.selectedItems?.connectors || [];
        const totalSelected = selectedNodes.length + selectedConnectors.length;

        if (totalSelected === 0) {
          setSelectedNode(null);
          setSelectionState({ type: 'none', element: null, count: 0 });
        } else if (selectedNodes.length === 1 && selectedConnectors.length === 0) {
          const node = selectedNodes[0] as NodeModel;
          setSelectedNode(node);
          setSelectionState({ type: 'node', element: node, count: 1 });
        } else if (selectedConnectors.length === 1 && selectedNodes.length === 0) {
          const connector = selectedConnectors[0] as ConnectorModel;
          setSelectedNode(null);
          setSelectionState({ type: 'connector', element: connector, count: 1 });
        } else if (totalSelected > 1) {
          setSelectionState({ type: 'multiple', element: null, count: totalSelected });
        }
      };

      // Check selection periodically to catch any missed updates
      const interval = setInterval(checkSelection, 500);
      return () => clearInterval(interval);
    }
    return undefined;
  }, []);
  // Function to handle the print button click and initiate the print process.
  const btnPrintClick = () => {
    const diagram = diagramRef.current?.getDiagram();
    if (diagram) {
      diagram.print({
        "region": 'Content',
      });
    }
  }
  const handleTextEditEvent = (args: any) => {
    // args.annotation and args.element are provided by DiagramComponent
    if (args && args.annotation && args.element) {
      const node = args.element as NodeModel;
      let annIndex = 0;
      if (node.annotations) {
        annIndex = node.annotations.findIndex((a: any) => a.content === args.annotation.content);
        if (annIndex < 0) annIndex = 0;
      }
      setAnnotationInfo({ node, index: annIndex });
    }
  };

  /**
   * Handle property changes from PropertyPanel
   */
  const handlePropertyChange = (properties: Partial<NodeProperties>) => {
    if (diagramRef.current) {
      diagramRef.current.updateNodeProperties(properties);
    }
  };

  /**
 * Handle property changes from ConnectorPropertyPanel
 */
  const handleConnectorPropertyChange = (properties: Partial<ConnectorProperties>) => {
    if (diagramRef.current) {
      diagramRef.current.updateConnectorProperties(properties);
    }
  };

  /**
   * Handle property changes from MultiSelectionPropertyPanel
   */
  const handleMultiSelectionPropertyChange = (properties: any) => {
    if (diagramRef.current) {
      diagramRef.current.updateMultiSelectionProperties(properties);
    }
  };

  const getSelectedItemForPanel = (): SelectedItem => {
    if (selectionState.type === 'node' && selectedNode) {
      return { type: 'node', node: selectedNode } as any;
    }
    if (selectionState.type === 'connector' && selectionState.element) {
      return { type: 'connector', connector: selectionState.element as ConnectorModel } as any;
    }
    if (selectionState.type === 'annotation' && annotationInfo.node && annotationInfo.index !== null) {
      const node = annotationInfo.node as NodeModel;
      const annotation = node.annotations?.[annotationInfo.index as number] ?? null;
      return { type: 'annotation', nodeId: node.id as string, annotationIndex: annotationInfo.index as number, annotation } as any;
    }
    if (selectionState.type === 'multiple') {
      const diagram = diagramRef.current?.getDiagram();
      const nodes = (diagram?.selectedItems?.nodes ?? []) as NodeModel[];
      const connectors = (diagram?.selectedItems?.connectors ?? []) as ConnectorModel[];
      return { type: 'multiple', nodes, connectors } as any;
    }
    return null;
  };

  const selectedItemForPanel = getSelectedItemForPanel();

  return (
    <div className="app-container">
      {/* Top Toolbar */}
      <div className="toolbar-region">
        <Toolbar
          key={guestCount}
          onAction={handleToolbarAction}
          onExport={handleExport}
          onDrawShape={handleDrawShape}
          onDrawConnector={handleDrawConnector}
          onGroupAction={handleGroupAction}
          availableGuests={guestCount}
          isUndoEnabled={toolbarState.isUndoEnabled}
          isRedoEnabled={toolbarState.isRedoEnabled}
          isCutEnabled={toolbarState.isCutEnabled}
          isCopyEnabled={toolbarState.isCopyEnabled}
          isPasteEnabled={toolbarState.isPasteEnabled}
        />
      </div>

      {/* Main Content Area */}
      <div className="content-region">
        {/* Left: Symbol Palette */}
        <div className="symbol-palette-region">

          <SymbolPalette />
        </div>

        {/* Center: Diagram Canvas */}
        <div className="diagram-region">
          <DiagramEditor
            ref={diagramRef}
            onUserCountChange={handleUserCountChange}
            onSelectionChange={handleSelectionChange}
            onTextEdit={handleTextEditEvent}
            onSpinnerChange={setShowSpinnerOverlay}
            onPositionChange={() => {
              // keep selectedNode in sync on drag
              const diagram = diagramRef.current?.getDiagram();
              if (diagram && diagram.selectedItems && diagram.selectedItems.nodes && diagram.selectedItems.nodes.length > 0) {
                setSelectedNode(diagram.selectedItems.nodes[0] as NodeModel);
              }
            }}
            onSizeChange={() => {
              const diagram = diagramRef.current?.getDiagram();
              if (diagram && diagram.selectedItems && diagram.selectedItems.nodes && diagram.selectedItems.nodes.length > 0) {
                setSelectedNode(diagram.selectedItems.nodes[0] as NodeModel);
              }
            }}
          />
        </div>

        {/* Right: Property Panel */}
        {/* Right: Property Panel - Only visible when node is selected */}
        {selectionState.type === 'node' && selectedItemForPanel && (
          <div className="property-panel-region" id='nodePropertyContainer'>
            <PropertyPanel
              selectedItem={selectedItemForPanel}
              onPropertyChange={handlePropertyChange}
            />
          </div>
        )}

        {/* Right: Connector Property Panel - Only visible when connector is selected */}
        {selectionState.type === 'connector' && selectedConnector && (
          <div className="property-panel-region" id='connectorPropertyContainer'>
            <ConnectorPropertyPanel
              selectedConnector={{ type: 'connector', connector: selectedConnector }}
              onPropertyChange={handleConnectorPropertyChange}
            />
          </div>
        )}

        {/* Right: Multi-Selection Property Panel - visible when multiple items are selected */}
        {selectionState.type === 'multiple' && (
          <div className="property-panel-region" id='multiSelectionPropertyContainer'>
            <MultiSelectionPropertyPanel
              selectedNodes={(diagramRef.current?.getDiagram()?.selectedItems?.nodes || []) as NodeModel[]}
              selectedConnectors={(diagramRef.current?.getDiagram()?.selectedItems?.connectors || []) as ConnectorModel[]}
              onPropertyChange={handleMultiSelectionPropertyChange}
            />
          </div>
        )}
      </div>
      {/* Bottom Promotional Banner */}
      <div className="bottom-banner">
        <div className="banner-content">
          <div className="banner-icon">
            <svg width="92" height="92" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M36.3333 3H9.66669C5.98478 3 3 5.98478 3 9.66669V36.3333C3 40.0152 5.98478 43 9.66669 43H36.3333C40.0152 43 43 40.0152 43 36.3333V9.66669C43 5.98478 40.0152 3 36.3333 3Z" fill="url(#paint0_linear_289_18)" fillOpacity="0.2" />
              <rect x="1" y="1" width="44" height="44" rx="6.6" fill="url(#paint1_linear_289_18)" />
              <rect x="0.5" y="0.5" width="45" height="45" rx="7.1" stroke="white" strokeOpacity="0.4" />
              <path fillRule="evenodd" clipRule="evenodd" d="M17.6965 11.035L28.4129 11.035C28.8902 11.035 29.2772 11.4219 29.2772 11.8992L29.2772 17.9488C29.2772 18.4261 28.8902 18.8131 28.4129 18.8131L17.6965 18.8131C17.2192 18.8131 16.8323 18.4261 16.8323 17.9488L16.8323 11.8992C16.8323 11.4219 17.2192 11.035 17.6965 11.035Z" stroke="#133B84" strokeWidth="1.5" />
              <path fillRule="evenodd" clipRule="evenodd" d="M7.8254 29.7801L18.5418 29.7801C19.0191 29.7801 19.4061 30.1671 19.4061 30.6444L19.4061 34.1013C19.4061 34.5786 19.0191 34.9655 18.5418 34.9655L7.8254 34.9655C7.3481 34.9655 6.96117 34.5786 6.96117 34.1013L6.96117 30.6444C6.96117 30.1671 7.3481 29.7801 7.8254 29.7801Z" stroke="#133B84" strokeWidth="1.5" />
              <path fillRule="evenodd" clipRule="evenodd" d="M27.4563 29.7801L38.1727 29.7801C38.65 29.7801 39.0369 30.1671 39.0369 30.6444L39.0369 34.1013C39.0369 34.5786 38.65 34.9655 38.1727 34.9655L27.4563 34.9655C26.979 34.9655 26.592 34.5786 26.592 34.1013L26.592 30.6444C26.592 30.1671 26.979 29.7801 27.4563 29.7801Z" stroke="#133B84" strokeWidth="1.5" />
              <path d="M23.123 18.7842V24.1729" stroke="#133B84" strokeWidth="1.5" />
              <path d="M32.8938 30.3582V25.9013C32.8938 24.9467 32.1199 24.1729 31.1653 24.1729H14.8339C13.8793 24.1729 13.1055 24.9467 13.1055 25.9013V30.3582" stroke="#133B84" strokeWidth="1.5" />
              <defs>
                <linearGradient id="paint0_linear_289_18" x1="43" y1="6.32943" x2="3" y2="39.6706" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2F77FB" />
                  <stop offset="1" stopColor="#A6C5FF" />
                </linearGradient>
                <linearGradient id="paint1_linear_289_18" x1="6.37769" y1="1" x2="39.6223" y2="45" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ECF3FF" />
                  <stop offset="1" stopColor="#76A7FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="banner-text">
            <span className="banner-message">
              Want interactive diagramming in your app? <span className="banner-em">Try our Diagram Component</span> — build, connect, and customize!
            </span>
          </div>
          <div className="banner-actions">
            <a
              className="e-trial-btn banner-btn-primary e-btn"
              href="https://www.syncfusion.com/account/manage-trials/downloads"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Start Free Trial"
            />
            <button
              className="banner-btn banner-btn-secondary"
              onClick={() => window.open('https://www.syncfusion.com/request-demo', '_blank', 'noopener,noreferrer')}
            >
              Request Demo
            </button>
          </div>
        </div>
      </div>

      {/* Full-page Spinner Overlay */}
      {showSpinnerOverlay && (
        <div className="spinner-overlay">
          <div id="loader" className="spinner-loader">
            <div id="spinner"></div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Enable or disable toolbar items directly via DOM manipulation
 * This is necessary for Syncfusion toolbar to properly update button states
 */
function enableItems(isLocked: boolean = false) {
  const itemIds = ['cut', 'copy'];
  const toolbarEl = document.getElementById('toolbarEditor') as any | null;
  const toolbarRef = toolbarEl?.ej2_instances?.[0];
  if (!toolbarRef || !Array.isArray(toolbarRef.items)) return;

  itemIds.forEach(itemId => {
    const item = toolbarRef.items.find((it: { id: string; }) => it.id === itemId);
    if (item) {
      item.disabled = isLocked;
    }
  });
}

/**
 * Enable paste button directly via DOM manipulation
 * Called when cut or copy is clicked
 */
function enablePasteButton() {
  const toolbarEl = document.getElementById('toolbarEditor') as any | null;
  const toolbarRef = toolbarEl?.ej2_instances?.[0];
  if (!toolbarRef || !Array.isArray(toolbarRef.items)) return;

  const pasteItem = toolbarRef.items.find((it: { id: string; }) => it.id === 'paste');
  if (pasteItem) {
    pasteItem.disabled = false;
  }
}

export default App;