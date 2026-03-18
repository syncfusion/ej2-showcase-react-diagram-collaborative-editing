/**
 * DiagramEditor Component
 * Main diagram canvas with Syncfusion Diagram component
 * Handles diagram interactions and collaboration integration
 */

import {
    HttpTransportType,
    HubConnectionBuilder,
    LogLevel,
    HubConnectionState,
    type HubConnection
} from '@microsoft/signalr';
import { Toast } from '@syncfusion/ej2-notifications';
import {
    BpmnDiagrams,
    ConnectorModel,
    DiagramComponent,
    DiagramConstraints,
    DiagramTools,
    GridlinesModel,
    Inject,
    ISelectionChangeEventArgs,
    ITextEditEventArgs,
    NodeModel,
    PrintAndExport,
    UndoRedo,
    type IHistoryChangeArgs,
    DiagramCollaboration,
    NodeConstraints,
    ConnectorBridging,
    Gradient,
    BpmnShape
} from '@syncfusion/ej2-react-diagrams';
import { createSpinner } from '@syncfusion/ej2-popups';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { initialConnectors, initialNodes } from './initialDiagramData';
import type { ConnectorProperties, DiagramState, NodeProperties, SelectedItem } from './diagramTypes';
import React from 'react';
import '../assets/dbstyle/diagrambuilder.css';


interface DiagramEditorProps {
    onSelectionChange?: (selected: SelectedItem) => void;
    onDiagramChange?: (state: DiagramState) => void;
    onTextEdit?: (args: ITextEditEventArgs) => void;
    onPositionChange?: (args: any) => void;
    onSizeChange?: (args: any) => void;
    onUserCountChange?: (count: number) => void;
    onSpinnerChange?: (visible: boolean) => void;
}
export interface DiagramRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SelectorBounds {
    bounds?: DiagramRect | null;
    rotationAngle: number;
}

export interface SelectionEvent {
    connectionId?: string | null;
    userId?: string | null;
    userName?: string | null;
    elementIds?: string[] | null;
    selectorBounds?: SelectorBounds | null;
}

export interface DiagramData {
    diagramId: string | null;
    data: string | null;
    version: number;
}


export interface DiagramEditorRef {
    getDiagram: () => DiagramComponent | null;
    clearDiagram: () => void;
    loadDiagram: (data: string) => void;
    saveDiagram: () => string;
    // Accept either a format string ('JPG' | 'PNG' | 'SVG') or a full options object
    exportDiagram: (formatOrOptions: any) => void;
    print: () => void;
    updateNodeProperties: (properties: Partial<NodeProperties>) => void;
    updateConnectorProperties: (properties: Partial<ConnectorProperties>) => void;
    updateMultiSelectionProperties: (properties: any) => void;
    // New methods for toolbar functionality
    cut: () => void;
    copy: () => void;
    paste: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    setDrawingTool: (tool: 'Default' | 'Text' | 'Pan') => void;
    drawShape: (shape: 'Rectangle' | 'Ellipse' | 'Polygon') => void;
    drawConnector: (type: 'Straight' | 'Orthogonal' | 'Bezier') => void;
    group: () => void;
    ungroup: () => void;
    getSelectionCount: () => number;
    // Zoom operations
    zoomIn: () => void;
    zoomOut: () => void;
    fitToPage: () => void;
    // Broadcast load to other clients via SignalR (clears selection then loads diagram)
    broadcastLoadDiagram: (data: string) => Promise<void>;
}
const GRID_LINE_INTERVALS: number[] = [
    1, 9, 0.25, 9.75, 0.25,
    9.75, 0.25, 9.75, 0.25,
    9.75, 0.25, 9.75, 0.25,
    9.75, 0.25, 9.75, 0.25,
    9.75, 0.25, 9.75
];

const DEFAULT_GRIDLINES: GridlinesModel = {
    lineColor: "lightgray",
    lineIntervals: GRID_LINE_INTERVALS,
    snapIntervals: [20]
};

const TOAST_NOTIFICATION: Toast = new Toast({
    content: '',
    target: '#diagram',
    position: { X: 'Right', Y: 'Top' }
});

/**
 * Represents a remote peer's current selection state
 */
type PeerSelection = {
    /** Display name or ID of the peer user */
    userName: string;
    /** Set of node and connector IDs selected by this peer */
    nodeIds: Set<string>;
    /** Bounds and rotation of the peer's selection rectangle */
    selectorBounds?: SelectorBounds | null;
};

/** Map of peer connection IDs to their current selection state */
const peerSelections: Map<string, PeerSelection> = new Map();

function setToArray(elementIdSet: Set<string>): string[] {
    const elementIdArray: string[] = [];
    elementIdSet.forEach(elementId => elementIdArray.push(elementId));
    return elementIdArray;
}

function setsEqual(setA: Set<string>, setB: Set<string>): boolean {
    if (setA.size !== setB.size) { return false; }
    let isEqual = true;
    setA.forEach(elementId => {
        if (!setB.has(elementId)) {
            isEqual = false;
        }
    });
    return isEqual;
}

function renderPeerBadges(): void {
    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
    const diagramLayerElement = document.getElementById('diagram_diagramLayer') as unknown as SVGSVGElement | null;
    if (!diagramLayerElement) { return; }

    const previousBadgeLayer = diagramLayerElement.querySelector('#badge-layer');
    if (previousBadgeLayer) { previousBadgeLayer.remove(); }

    const badgeGroupElement = document.createElementNS(SVG_NAMESPACE, 'g');
    badgeGroupElement.setAttribute('id', 'badge-layer');

    const renderedElementIds = new Set<string>();

    peerSelections.forEach((peer) => {
        const selectorBounds = peer.selectorBounds;
        if (!selectorBounds || !selectorBounds.bounds) { return; }

        const boundsRect = selectorBounds.bounds!;
        const centerX = boundsRect.x;
        const centerY = boundsRect.y;
        const boundsWidth = (boundsRect.width || 0) + 2;
        const boundsHeight = (boundsRect.height || 0) + 2;
        const rotationAngle = selectorBounds.rotationAngle || 0;

        const startX = centerX - (boundsRect.width || 0) / 2;
        const startY = centerY - (boundsRect.height || 0) / 2;

        // Render outline rectangle for peer selection
        const outlineRect = document.createElementNS(SVG_NAMESPACE, 'rect');
        outlineRect.setAttribute('x', startX.toString());
        outlineRect.setAttribute('y', startY.toString());
        outlineRect.setAttribute('width', boundsWidth.toString());
        outlineRect.setAttribute('height', boundsHeight.toString());
        outlineRect.setAttribute('stroke', '#3b82f6');
        outlineRect.setAttribute('stroke-width', '2');
        outlineRect.setAttribute('fill', 'none');
        outlineRect.setAttribute('transform', `rotate(${rotationAngle},${centerX},${centerY})`);
        badgeGroupElement.appendChild(outlineRect);

        // Calculate overlap with already rendered peer selections
        let overlapCountWithOtherPeers = 0;
        if (peer.nodeIds) {
            peer.nodeIds.forEach((elementId: string) => {
                if (renderedElementIds.has(elementId)) { overlapCountWithOtherPeers++; }
            });
        }
        const hasMultiplePeersOnSameElements = overlapCountWithOtherPeers > 0;
        const badgeOffsetX = 5;
        const badgeOffsetY = 20 * (hasMultiplePeersOnSameElements ? overlapCountWithOtherPeers : 0) - 15;

        // Apply rotation to badge position
        const rotationRadians = rotationAngle * Math.PI / 180;
        const originalBadgeX = centerX + boundsWidth / 2.0;
        const originalBadgeY = centerY - boundsHeight / 2.0;
        let finalBadgeX = centerX + (originalBadgeX - centerX) * Math.cos(rotationRadians) - (originalBadgeY - centerY) * Math.sin(rotationRadians);
        let finalBadgeY = centerY + (originalBadgeX - centerX) * Math.sin(rotationRadians) + (originalBadgeY - centerY) * Math.cos(rotationRadians);
        finalBadgeX += badgeOffsetX;
        finalBadgeY += badgeOffsetY;

        // Render peer user badge
        const peerUserName = (peer.userName || '').toString();
        const peerUserId = parseInt(peerUserName, 10);
        if (!isNaN(peerUserId)) {
            const badgeTitle = `Guest ID: SF${('0000' + peerUserId).slice(-4)}`;
            const badgeLabel = `G-${('0000' + peerUserId).slice(-4)}`;

            const foreignObjectElement = document.createElementNS(SVG_NAMESPACE, 'foreignObject');
            foreignObjectElement.setAttribute('x', finalBadgeX.toString());
            foreignObjectElement.setAttribute('y', finalBadgeY.toString());
            foreignObjectElement.setAttribute('width', '50');
            foreignObjectElement.setAttribute('height', '30');

            const badgeContainer = document.createElement('div');
            badgeContainer.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
            badgeContainer.title = badgeTitle;
            badgeContainer.className = 'peer-badge';
            badgeContainer.textContent = badgeLabel;
            foreignObjectElement.appendChild(badgeContainer);
            badgeGroupElement.appendChild(foreignObjectElement);
        }

        // Mark these node IDs as seen for next peer's overlap calculation
        if (peer.nodeIds) {
            peer.nodeIds.forEach((elementId: string) => renderedElementIds.add(elementId));
        }
    });

    diagramLayerElement.appendChild(badgeGroupElement);
}

function boundsEqual(boundsA?: DiagramRect | null, boundsB?: DiagramRect | null): boolean {
    if (!boundsA && !boundsB) { return true; }
    if (!boundsA || !boundsB) { return false; }
    return boundsA.x === boundsB.x && boundsA.y === boundsB.y && boundsA.width === boundsB.width && boundsA.height === boundsB.height;
}

export const DiagramEditor = forwardRef<DiagramEditorRef, DiagramEditorProps>((props, ref) => {
    const { onSelectionChange, onTextEdit, onPositionChange, onSizeChange, onUserCountChange, onSpinnerChange } = props;
    const diagramRef = useRef<DiagramComponent>(null);

    const connectionRef = useRef<HubConnection | null>(null);

    // Room and user count
    const roomName = 'ej2_react_diagram';
    const userCountRef = useRef<number>(1);

    const isLocalChange = useRef(false);
    let isGroupAction = false;
    let editedElements: string[] = [];
    const clientVersionRef = useRef<number>(0);

    useImperativeHandle(ref, () => ({
        getDiagram: () => diagramRef.current,
        clearDiagram: handleClearDiagram,
        loadDiagram: handleLoadDiagram,
        saveDiagram: handleSaveDiagram,
        exportDiagram: handleExportDiagram,
        print: handlePrint,
        updateNodeProperties: handleUpdateNodeProperties,
        updateConnectorProperties: handleConnectorPropertyChange,
        updateMultiSelectionProperties: handleMultiSelectionPropertyChange,
        // Clipboard operations
        cut: () => diagramRef.current?.cut(),
        copy: () => diagramRef.current?.copy(),
        paste: () => diagramRef.current?.paste(),
        // History operations
        undo: () => diagramRef.current?.undo(),
        redo: () => diagramRef.current?.redo(),
        canUndo: () => diagramRef.current?.historyManager?.canUndo ?? false,
        canRedo: () => diagramRef.current?.historyManager?.canRedo ?? false,
        // Tool selection
        setDrawingTool: (tool) => {
            if (!diagramRef.current) return;
            if (tool === 'Default') {
                diagramRef.current.tool = DiagramTools.Default;
            } else if (tool === 'Text') {
                diagramRef.current.tool = DiagramTools.DrawOnce;
                diagramRef.current.drawingObject = { shape: { type: 'Text' } };
            } else if (tool === 'Pan') {
                diagramRef.current.tool = DiagramTools.ZoomPan;
            }
        },
        // Shape drawing
        drawShape: (shape) => {
            if (!diagramRef.current) return;
            diagramRef.current.tool = DiagramTools.ContinuousDraw;
            diagramRef.current.drawingObject = {
                shape: {
                    type: 'Basic',
                    shape: shape
                }
            };
        },
        // Connector drawing
        drawConnector: (type) => {
            if (!diagramRef.current) return;
            diagramRef.current.tool = DiagramTools.ContinuousDraw;
            const connector: ConnectorModel = {
                id: `connector_${Date.now()}`,
                type: type
            };
            diagramRef.current.drawingObject = connector;
        },
        // Group operations
        group: () => diagramRef.current?.group(),
        ungroup: () => diagramRef.current?.unGroup(),
        getSelectionCount: () => {
            if (!diagramRef.current) return 0;
            const selectedNodes = diagramRef.current.selectedItems?.nodes?.length ?? 0;
            const selectedConnectors = diagramRef.current.selectedItems?.connectors?.length ?? 0;
            return selectedNodes + selectedConnectors;
        },
        // Zoom operations
        zoomIn: () => {
            if (!diagramRef.current) return;
            diagramRef.current.zoomTo({ type: 'ZoomIn', zoomFactor: 0.2 });
        },
        zoomOut: () => {
            if (!diagramRef.current) return;
            diagramRef.current.zoomTo({ type: 'ZoomOut', zoomFactor: 0.2 });
        },
        fitToPage: () => {
            if (!diagramRef.current) return;
            diagramRef.current.fitToPage({
                mode: 'Page',
                region: 'Content'
            });
        }
        ,
        // Broadcast load diagram to other clients via SignalR: clear selection then load
        broadcastLoadDiagram: async (data: string) => {
            try {
                const currentConnection = connectionRef.current;
                if (currentConnection && currentConnection.state !== HubConnectionState.Disconnected) {
                    await currentConnection.invoke('ClearSelectionForAll');
                    // send LoadDiagram request with payload (server expects string or object)
                    await currentConnection.send('LoadDiagram', data);
                }
            } catch (err) {
                console.error('broadcastLoadDiagram failed:', err);
            }
        }
    }));

    // Initialize collaboration on mount
    useEffect(() => {
        TOAST_NOTIFICATION.appendTo('#diagramMessage');
        // Initialize spinner element (App.tsx controls visibility via callback)
        try {
            const spinnerEl = document.getElementById('spinner');
            if (spinnerEl) {
                createSpinner({ target: spinnerEl as HTMLElement });
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to initialize spinner in DiagramEditor:', err);
        }
        // Ensure diagram is fitted once after first render
        diagramRef.current?.fitToPage();
    }, []);

    /**
     * Handle diagram selection change events
     */
    const handleSelectionChange = (selectionChangeArgs: ISelectionChangeEventArgs) => {
        try {
            const selectedValues = Array.isArray(selectionChangeArgs.newValue)
                ? selectionChangeArgs.newValue
                : (selectionChangeArgs.newValue ? [selectionChangeArgs.newValue] : []);

            if (selectedValues.length === 0) {
                onSelectionChange?.(null);
                return;
            }

            if (selectedValues.length > 1) {
                const selectedNodes = selectedValues.filter((item: any) => item && item.offsetX !== undefined) as NodeModel[];
                const selectedConnectors = selectedValues.filter((item: any) => item && (item.sourceID !== undefined || item.targetID !== undefined)) as any[];
                const multipleSelection = { type: 'multiple', nodes: selectedNodes, connectors: selectedConnectors } as import('./diagramTypes').SelectedMultipleItem;
                onSelectionChange?.(multipleSelection);
                return;
            }

            const selectedItem = selectedValues[0] as any;

            // Detect if selected item is a Node (nodes have offsetX property)
            if (selectedItem && selectedItem.offsetX !== undefined) {
                const nodeSelection = { type: 'node', node: selectedItem } as import('./diagramTypes').SelectedNodeItem;
                onSelectionChange?.(nodeSelection);
                return;
            }

            // Detect if selected item is a Connector (connectors have sourceID/targetID or sourcePoint)
            if (selectedItem && (selectedItem.sourceID !== undefined || selectedItem.targetID !== undefined || selectedItem.sourcePoint !== undefined)) {
                const connectorSelection = { type: 'connector', connector: selectedItem } as import('./diagramTypes').SelectedConnectorItem;
                onSelectionChange?.(connectorSelection);
                return;
            }

            // No valid selection detected, fallback to null
            onSelectionChange?.(null);
        } catch (selectionError) {
            // Handle any errors during selection change processing
            // eslint-disable-next-line no-console
            console.error('Error during selection change processing:', selectionError);
            onSelectionChange?.(null);
        }
    };

    const handleClearDiagram = () => {
        if (diagramRef.current) {
            const nodes = diagramRef.current.nodes;
            const connectors = diagramRef.current.connectors;
            diagramRef.current.startGroupAction();
            // remove nodes (loop backwards)
            for (let index = nodes.length - 1; index >= 0; index--) {
                diagramRef.current.remove(nodes[index]);
            }

            // remove connectors (loop backwards)
            for (let index = connectors.length - 1; index >= 0; index--) {
                diagramRef.current.remove(connectors[index]);
            }
            diagramRef.current.endGroupAction();
        }
    };

    /**
     * Load diagram from JSON
     */
    const handleLoadDiagram = (data: string) => {
        if (diagramRef.current) {
            try {
                isLocalChange.current = true;
                // Clear existing diagram first
                diagramRef.current.clear();
                // Load the new diagram
                diagramRef.current.loadDiagram(data);
                isLocalChange.current = false;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to load diagram data:', error);
                isLocalChange.current = false;
            }
        }
    };

    /**
     * Save diagram as JSON
     */
    const handleSaveDiagram = (): string => {
        if (diagramRef.current) {
            try {
                // Save the diagram as JSON string
                const json = diagramRef.current.saveDiagram();
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'flowchart.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                return json;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to save diagram:', error);
                return '{}';
            }
        }
        return '{}';
    };

    /**
     * Export diagram to image format
     */
    const handleExportDiagram = (formatOrOptions: any) => {
        if (!diagramRef.current) return;

        let options: any;
        // If caller passed a full options object, use it directly
        if (formatOrOptions && typeof formatOrOptions === 'object' && (formatOrOptions.format || formatOrOptions.mode)) {
            options = formatOrOptions;
        } else {
            options = {
                format: formatOrOptions,
                mode: 'Download',
                region: 'Content',
                fileName: `Diagram`
            } as any;
        }

        try {
            diagramRef.current.exportDiagram(options);
        } catch (err) {
            // Attempt a simpler fallback and log errors if both fail
            // eslint-disable-next-line no-console
            console.error('Primary export failed, attempting fallback export:', err);
            try {
                diagramRef.current.exportDiagram({ format: options.format, mode: options.mode || 'Download' });
            } catch (fallbackErr) {
                // eslint-disable-next-line no-console
                console.error('Fallback export also failed:', fallbackErr);
            }
        }
    };

    /**
     * Print the diagram
     */
    const handlePrint = () => {
        if (diagramRef.current) {
            const printOptions = {
                region: 'Content',
                fileName: `Diagram`
            } as any;
            diagramRef.current.print(printOptions);
        }
    };

    /**
     * Update properties of selected node
     */
    const handleUpdateNodeProperties = (properties: Partial<NodeProperties>) => {
        if (!diagramRef.current) return;

        const selectedItems = diagramRef.current.selectedItems;
        if (selectedItems.nodes && selectedItems.nodes.length > 0) {
            const node: NodeModel = selectedItems.nodes[0] as NodeModel;

            // Update node properties
            if (properties.offsetX !== undefined) node.offsetX = properties.offsetX;
            if (properties.offsetY !== undefined) node.offsetY = properties.offsetY;
            if (properties.width !== undefined) {
                const widthDifference = properties.width - (node.width ?? 0);
                node.width = properties.width;
                if (node.constraints && (node.constraints & NodeConstraints.AspectRatio)) {
                    node.height = (node.height ?? 0) + widthDifference;
                }
            }
            if (properties.height !== undefined) {
                const heightDifference = properties.height - (node.height ?? 0);
                node.height = properties.height;
                if (node.constraints && (node.constraints & NodeConstraints.AspectRatio)) {
                    node.width = (node.width ?? 0) + heightDifference;
                }
            }
            if (properties.rotateAngle !== undefined) node.rotateAngle = properties.rotateAngle;
            if (properties.aspectRatio !== undefined) node.constraints = properties.aspectRatio ? ((node.constraints ?? 0) | NodeConstraints.AspectRatio) : ((node.constraints ?? 0) & ~NodeConstraints.AspectRatio);
            // Update style properties
            if (properties.fillColor !== undefined || properties.strokeColor !== undefined ||
                properties.strokeWidth !== undefined || properties.opacity !== undefined ||
                properties.borderDashArray !== undefined) {
                node.style = {
                    ...node.style,
                    fill: properties.fillColor ?? node.style?.fill,
                    strokeColor: properties.strokeColor ?? node.style?.strokeColor,
                    strokeWidth: properties.strokeWidth ?? node.style?.strokeWidth,
                    opacity: properties.opacity ?? node.style?.opacity,
                    strokeDashArray: properties.borderDashArray ?? node.style?.strokeDashArray
                };

                // If fillColor changed and gradient is active, rebuild gradient so Stop 1 occupies the first half
                if (properties.fillColor !== undefined && (node.style as any)?.gradient) {
                    const currentGradient = (node.style as any).gradient || {};
                    (node.style as any).gradient = {
                        ...currentGradient,
                        stops: [
                            { color: properties.fillColor, offset: 0 },
                            { color: currentGradient.stops?.[1]?.color ?? '#37909A', offset: 50 }
                        ]
                    };
                }
            }

            if (properties.isGradient !== undefined) {
                if (properties.isGradient) {
                    // Apply a simple linear gradient using provided gradientColor and fillColor as fallbacks
                    const gradient = {
                        x1: 0, y1: 0,
                        x2: 100, y2: 100,
                        stops: [
                            { color: properties.fillColor ?? properties.gradientColor ?? '#00555b', offset: 0 },
                            { color: properties.gradientColor ?? properties.fillColor ?? '#379a69ff', offset: 50 }
                        ],
                        type: 'Linear'
                    } as any;
                    if ((node.style as any).gradient.type !== 'Linear') {
                        (node.style as any).gradient = gradient;
                    }
                }
                else {
                    ((node.style as any).gradient as Gradient).type = 'None';

                }
            }

            if (properties.gradientColor !== undefined) {
                // Only apply gradient color if a gradient already exists on the node
                const existing = (node.style as any)?.gradient;
                if (existing) {
                    const gradient = {
                        x1: existing.x1 ?? 0, y1: existing.y1 ?? 0,
                        x2: existing.x2 ?? 100, y2: existing.y2 ?? 100,
                        stops: [
                            { color: existing.stops?.[0]?.color ?? '#00555b', offset: 0 },
                            { color: properties.gradientColor ?? existing.stops?.[1]?.color ?? '#37909A', offset: 50 }
                        ],
                        type: 'Linear'
                    } as any;
                    if (!node.style) node.style = {} as any;
                    (node.style as any).gradient = gradient;
                }
            }
            if (properties.gradientDirection !== undefined) {
                // Update gradient coordinates based on direction string
                const dir = (properties.gradientDirection || '').toString().toLowerCase();
                const key = dir.replace(/[^a-z]/g, '');
                // Only update direction if a gradient already exists
                const existing = (node.style as any)?.gradient;
                if (existing) {
                    const gradient = {
                        x1: existing.x1 ?? 0, y1: existing.y1 ?? 0,
                        x2: existing.x2 ?? 100, y2: existing.y2 ?? 100,
                        stops: [
                            { color: properties.fillColor ?? properties.gradientColor ?? existing.stops?.[0]?.color ?? '#00555b', offset: 0 },
                            { color: properties.gradientColor ?? properties.fillColor ?? existing.stops?.[1]?.color ?? '#37909A', offset: 50 }
                        ],
                        type: 'Linear'
                    } as any;
                    if (!node.style) node.style = {} as any;
                    switch (key) {
                        case 'lefttoright':
                            gradient.x1 = 0; gradient.y1 = 0; gradient.x2 = 100; gradient.y2 = 0; break;
                        case 'righttoleft':
                            gradient.x1 = 100; gradient.y1 = 0; gradient.x2 = 0; gradient.y2 = 0; break;
                        case 'toptobottom':
                            gradient.x1 = 0; gradient.y1 = 0; gradient.x2 = 0; gradient.y2 = 100; break;
                        case 'bottomtotop':
                            gradient.x1 = 0; gradient.y1 = 100; gradient.x2 = 0; gradient.y2 = 0; break;
                        case 'diagonaltrbl':
                            gradient.x1 = 100; gradient.y1 = 0; gradient.x2 = 0; gradient.y2 = 100; break;
                        default:
                            // default diagonal top-left to bottom-right
                            gradient.x1 = 0; gradient.y1 = 0; gradient.x2 = 100; gradient.y2 = 100; break;
                    }
                    (node.style as any).gradient = gradient;
                }
            }

            // Update text annotations - use direct property mutation for Syncfusion compatibility
            if (properties.text !== undefined || properties.fontSize !== undefined ||
                properties.fontFamily !== undefined || properties.fontColor !== undefined ||
                properties.textAlign !== undefined || properties.bold !== undefined ||
                properties.italic !== undefined || properties.textOpacity !== undefined ||
                properties.underline !== undefined) {
                if (node.annotations && node.annotations.length > 0) {
                    // Allow callers to pass `annotationIndex` to target a specific annotation; default to 0
                    const annIndex = (properties as any).annotationIndex ?? 0;
                    const idx = Math.max(0, Math.min(annIndex, node.annotations.length - 1));
                    const annotation = node.annotations[idx];

                    // Ensure style object exists
                    if (!annotation.style) {
                        annotation.style = {};
                    }

                    // Update annotation content directly
                    if (properties.text !== undefined) {
                        annotation.content = properties.text;
                    }

                    // Update style properties directly (better for Syncfusion change detection)
                    if (properties.fontSize !== undefined) {
                        annotation.style.fontSize = properties.fontSize;
                    }
                    if (properties.fontFamily !== undefined) {
                        annotation.style.fontFamily = properties.fontFamily;
                    }
                    if (properties.fontColor !== undefined) {
                        annotation.style.color = properties.fontColor;
                    }
                    if (properties.textAlign !== undefined) {
                        annotation.style.textAlign = properties.textAlign;
                    }
                    if (properties.bold !== undefined) {
                        annotation.style.bold = properties.bold;
                    }
                    if (properties.italic !== undefined) {
                        annotation.style.italic = properties.italic;
                    }
                    if (properties.underline !== undefined) {
                        annotation.style.textDecoration = properties.underline ? 'Underline' : 'None';
                    }
                    if (properties.textOpacity !== undefined) {
                        annotation.style.opacity = properties.textOpacity;
                    }

                }
            }

            // Update the diagram
            (diagramRef.current as any)?.dataBind?.();
        }
    };
    /**
    * Update properties of selected connector
    */
    const handleConnectorPropertyChange = (properties: Partial<ConnectorProperties>) => {
        if (!diagramRef.current) return;

        const selectedItems = diagramRef.current.selectedItems;
        if (selectedItems.connectors && selectedItems.connectors.length > 0) {
            const connector = selectedItems.connectors[0] as ConnectorModel;

            // Update connector type
            if (properties.connectorType !== undefined) connector.type = properties.connectorType as any;

            // Update connector style properties
            if (properties.strokeColor !== undefined || properties.strokeWidth !== undefined || properties.strokeDashArray !== undefined || properties.opacity !== undefined) {
                connector.style = {
                    ...connector.style,
                    strokeColor: properties.strokeColor ?? connector.style?.strokeColor,
                    strokeWidth: properties.strokeWidth ?? connector.style?.strokeWidth,
                    strokeDashArray: properties.strokeDashArray ?? connector.style?.strokeDashArray,
                    opacity: properties.opacity ?? connector.style?.opacity
                };
            }

            // Update source decorator (apply same value to width and height)
            if (properties.sourceDecorator !== undefined || properties.startArrowSize !== undefined) {
                connector.sourceDecorator = {
                    ...connector.sourceDecorator,
                    shape: properties.sourceDecorator ?? connector.sourceDecorator?.shape,
                    width: properties.startArrowSize ?? connector.sourceDecorator?.width,
                    height: properties.startArrowSize ?? connector.sourceDecorator?.height
                };
            }

            // Update target decorator (apply same value to width and height)
            if (properties.targetDecorator !== undefined || properties.endArrowSize !== undefined) {
                connector.targetDecorator = {
                    ...connector.targetDecorator,
                    shape: properties.targetDecorator ?? connector.targetDecorator?.shape,
                    width: properties.endArrowSize ?? connector.targetDecorator?.width,
                    height: properties.endArrowSize ?? connector.targetDecorator?.height
                };
            }

            // Update bridging
            if (properties.bridging !== undefined) {
                connector.bridgeSpace = properties.bridging ? 10 : 0;
            }

            // Update annotation properties (text, font, colors, formatting)
            if (properties.text !== undefined || properties.fontSize !== undefined ||
                properties.fontFamily !== undefined || properties.fontColor !== undefined ||
                properties.textAlign !== undefined || properties.bold !== undefined ||
                properties.italic !== undefined || properties.underline !== undefined ||
                properties.textOpacity !== undefined) {

                if (connector.annotations && connector.annotations.length > 0) {
                    // Update first annotation
                    const annotation = connector.annotations[0];

                    // Ensure style object exists
                    if (!annotation.style) {
                        annotation.style = {};
                    }

                    // Update annotation content
                    if (properties.text !== undefined) {
                        annotation.content = properties.text;
                    }

                    // Update style properties
                    if (properties.fontSize !== undefined) {
                        annotation.style.fontSize = properties.fontSize;
                    }
                    if (properties.fontFamily !== undefined) {
                        annotation.style.fontFamily = properties.fontFamily;
                    }
                    if (properties.fontColor !== undefined) {
                        annotation.style.color = properties.fontColor;
                    }
                    if (properties.textAlign !== undefined) {
                        annotation.style.textAlign = properties.textAlign;
                    }
                    if (properties.bold !== undefined) {
                        annotation.style.bold = properties.bold;
                    }
                    if (properties.italic !== undefined) {
                        annotation.style.italic = properties.italic;
                    }
                    if (properties.underline !== undefined) {
                        annotation.style.textDecoration = properties.underline ? 'Underline' : 'None';
                    }
                    if (properties.textOpacity !== undefined) {
                        annotation.style.opacity = properties.textOpacity;
                    }
                }
            }

            (diagramRef.current as any)?.dataBind?.();
        }
    };

    /**
     * Handle property updates for multiple selected items (nodes and/or connectors)
     * Applies common properties to all selected items
     */
    const handleMultiSelectionPropertyChange = (properties: any) => {
        if (!diagramRef.current) return;

        const selectedItems = diagramRef.current.selectedItems;
        const nodes = (selectedItems.nodes || []) as NodeModel[];
        const connectors = (selectedItems.connectors || []) as ConnectorModel[];

        // Update all selected nodes
        nodes.forEach((node: any) => {
            // Fill color (nodes only)
            if (properties.fillColor !== undefined) {
                if (!node.style) node.style = {};
                node.style.fill = properties.fillColor;
            }

            // Stroke color
            if (properties.strokeColor !== undefined) {
                if (!node.style) node.style = {};
                node.style.strokeColor = properties.strokeColor;
            }

            // Stroke width
            if (properties.strokeWidth !== undefined) {
                if (!node.style) node.style = {};
                node.style.strokeWidth = properties.strokeWidth;
            }

            // Border type (stroke dash array) for nodes - accept either key
            if (properties.borderDashArray !== undefined || properties.strokeDashArray !== undefined) {
                if (!node.style) node.style = {};
                node.style.strokeDashArray = properties.borderDashArray ?? properties.strokeDashArray;
            }

            // Opacity
            if (properties.opacity !== undefined) {
                if (!node.style) node.style = {};
                node.style.opacity = properties.opacity;
            }

            // Text properties
            if (properties.fontSize !== undefined || properties.fontFamily !== undefined ||
                properties.fontColor !== undefined || properties.bold !== undefined ||
                properties.italic !== undefined || properties.underline !== undefined ||
                properties.textOpacity !== undefined) {
                if (node.annotations && node.annotations.length > 0) {
                    node.annotations.forEach((ann: any) => {
                        if (!ann.style) ann.style = {};

                        if (properties.fontSize !== undefined) ann.style.fontSize = properties.fontSize;
                        if (properties.fontFamily !== undefined) ann.style.fontFamily = properties.fontFamily;
                        if (properties.fontColor !== undefined) ann.style.color = properties.fontColor;
                        if (properties.bold !== undefined) ann.style.bold = properties.bold;
                        if (properties.italic !== undefined) ann.style.italic = properties.italic;
                        if (properties.underline !== undefined) ann.style.textDecoration = properties.underline ? 'Underline' : 'None';
                        if (properties.textOpacity !== undefined) ann.style.opacity = properties.textOpacity;
                    });
                }
            }
        });

        // Update all selected connectors
        connectors.forEach((connector: any) => {
            // Stroke color
            if (properties.strokeColor !== undefined) {
                if (!connector.style) connector.style = {};
                connector.style.strokeColor = properties.strokeColor;
            }

            // Stroke width
            if (properties.strokeWidth !== undefined) {
                if (!connector.style) connector.style = {};
                connector.style.strokeWidth = properties.strokeWidth;
            }

            // Stroke dash array (border type) - accept either key
            if (properties.strokeDashArray !== undefined || properties.borderDashArray !== undefined) {
                if (!connector.style) connector.style = {};
                connector.style.strokeDashArray = properties.strokeDashArray ?? properties.borderDashArray;
            }

            // Opacity
            if (properties.opacity !== undefined) {
                if (!connector.style) connector.style = {};
                connector.style.opacity = properties.opacity;
            }

            // Text properties
            if (properties.fontSize !== undefined || properties.fontFamily !== undefined ||
                properties.fontColor !== undefined || properties.bold !== undefined ||
                properties.italic !== undefined || properties.underline !== undefined ||
                properties.textOpacity !== undefined) {
                if (connector.annotations && connector.annotations.length > 0) {
                    connector.annotations.forEach((ann: any) => {
                        if (!ann.style) ann.style = {};

                        if (properties.fontSize !== undefined) ann.style.fontSize = properties.fontSize;
                        if (properties.fontFamily !== undefined) ann.style.fontFamily = properties.fontFamily;
                        if (properties.fontColor !== undefined) ann.style.color = properties.fontColor;
                        if (properties.bold !== undefined) ann.style.bold = properties.bold;
                        if (properties.italic !== undefined) ann.style.italic = properties.italic;
                        if (properties.underline !== undefined) ann.style.textDecoration = properties.underline ? 'Underline' : 'None';
                        if (properties.textOpacity !== undefined) ann.style.opacity = properties.textOpacity;
                    });
                }
            }
        });
        // Trigger diagram refresh
        (diagramRef.current as any)?.dataBind?.();
    };

    // Initialize SignalR connection for real-time collaboration
    useEffect(() => {
        const hubConnection = new HubConnectionBuilder()
            .withUrl('https://diagram-collaborative-editing-hxhkc9dsbeb2f2et.eastus2-01.azurewebsites.net/diagramhub', {
                skipNegotiation: false,
                transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling
            })
            .withAutomaticReconnect([0, 1000, 5000, 30000])
            .configureLogging(LogLevel.Information)
            .build();

        connectionRef.current = hubConnection;

        /**
         * Handler invoked when client connects to the SignalR hub
         * Joins the diagram collaboration room
         */
        const handleConnectionEstablished = async (connectionId: string) => {
            if (!connectionId) return;
            try {
                await hubConnection.send(
                    'JoinDiagram',
                    roomName,
                    'react_diagram',
                    null
                );
            } catch (connectionError) {
                try { onSpinnerChange?.(false); } catch { /* ignore spinner error */ }
                console.error('Failed to join diagram:', connectionError);
            }
        };

        /**
         * Handler for receiving remote diagram updates from other clients
         */
        const handleReceiveRemoteDiagramUpdates = (remoteUpdateData: IHistoryChangeArgs) => {
            const diagram = diagramRef.current as any;
            try {
                diagram.setDiagramUpdates(remoteUpdateData as unknown as string[]);
            } catch (updateError) {
                console.error('Error applying remote updates:', updateError);
            }
        };
        // Register client-side event handlers
        hubConnection.on('OnConnectedAsync', handleConnectionEstablished); // Must match server’s client method name
        hubConnection.on('ReceiveDataForEj2', handleReceiveRemoteDiagramUpdates);
        // Additional collaborative message handlers
        hubConnection.on('OnSaveDiagramState', async (requestId: string) => {
            const diagramState: string = (diagramRef.current as any)?.saveDiagram?.() || '';
            await hubConnection.invoke('ProvideDiagramState', requestId, diagramState).catch((error) => {
                console.error('Error providing diagram state:', error);
            });
        });
        hubConnection.on('LoadDiagramData', (remoteData: DiagramData) => {
            if (remoteData && remoteData.data) {
                (diagramRef.current as any)?.loadDiagram?.(remoteData.data);
                diagramRef.current?.fitToPage();
            }
        });
        hubConnection.on('UserJoined', (message: string) => {
            const userIdNumber = parseInt(message, 10);
            const userMessage = `SF${('0000' + userIdNumber.toString()).slice(-4)} joined the diagram.`;
            (TOAST_NOTIFICATION as any).content = userMessage;
            try { (TOAST_NOTIFICATION as any).show?.(); } catch { /* ignore show errors */ }
        });
        hubConnection.on('UserLeft', (message: string) => {
            const userIdNumber = parseInt(message, 10);
            const userMessage = `SF${('0000' + userIdNumber.toString()).slice(-4)} left the diagram.`;
            (TOAST_NOTIFICATION as any).content = userMessage;
            try { (TOAST_NOTIFICATION as any).show?.(); } catch { /* ignore show errors */ }
        });
        hubConnection.on('ShowConflict', () => {
            (TOAST_NOTIFICATION as any).content = 'You have a conflicts in your page. Your changes could not be merged.';
            try { (TOAST_NOTIFICATION as any).show?.(); } catch { /* ignore show errors */ }
        });
        hubConnection.on('UpdateVersion', (serverVersion: number) => { /* no-op: clientVersion not tracked here */ });

        hubConnection.on('ReceiveData', (data: string[], serverVersion: number, evt: SelectionEvent) => {
            try {
                (diagramRef.current as any)?.setDiagramUpdates?.(data);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Error applying diagram updates from ReceiveData:', err);
            }
            clientVersionRef.current = serverVersion || clientVersionRef.current;
            try {
                peerSelectionChanged(evt);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('peerSelectionChanged threw an error:', err);
            }
        });

        hubConnection.on('PeerSelectionChanged', async (evt: SelectionEvent | null) => {
            if (!evt) { return; }
            peerSelectionChanged(evt);
        });

        hubConnection.on('PeerSelectionCleared', async (evt: { connectionId?: string } | null) => {
            if (!evt) { return; }
            peerSelections.delete(evt.connectionId || '');
            renderPeerBadges();
        });

        hubConnection.on('ClearAllSelection', async () => {
            peerSelections.clear();
            renderPeerBadges();
        });

        hubConnection.on('PeerSelectionsBootstrap', async (list: SelectionEvent[] | null) => {
            if (!list || !list.length) { return; }
            for (let index = 0; index < list.length; index++) {
                const evt = list[index];
                const connId = evt.connectionId || (evt as any).connectionId || '';
                const nodeIds = new Set<string>((evt.elementIds || []) as string[]);
                peerSelections.set(connId, {
                    userName: evt.userName || '',
                    nodeIds,
                    selectorBounds: evt.selectorBounds || null
                });
            }
            renderPeerBadges();
        });

        hubConnection.on('CurrentUsers', async (list: string[] | null) => {
            const count = list ? list.length : 1;
            userCountRef.current = count;
            onUserCountChange?.(count);
            try { onSpinnerChange?.(false); } catch (err) { console.error('onSpinnerChange error:', err); }
        });

        // Start connection with automatic retry
        const startHubConnection = async () => {
            try {
                await hubConnection.start();
            } catch (connectionError) {
                console.error('Failed to start SignalR connection:', connectionError);
                setTimeout(startHubConnection, 3000);
            }
        };
        startHubConnection();

        return () => {
            hubConnection.off('OnConnectedAsync', handleConnectionEstablished);
            hubConnection.off('ReceiveDataForEj2', handleReceiveRemoteDiagramUpdates);
            hubConnection.off('OnSaveDiagramState');
            hubConnection.off('LoadDiagramData');
            hubConnection.off('UserJoined');
            hubConnection.off('UserLeft');
            hubConnection.off('ShowConflict');
            hubConnection.off('UpdateVersion');
            hubConnection.off('ReceiveData');
            hubConnection.off('PeerSelectionChanged');
            hubConnection.off('PeerSelectionCleared');
            hubConnection.off('ClearAllSelection');
            hubConnection.off('PeerSelectionsBootstrap');
        };

    }, []);

    function updateOtherClientSelectorBounds(currentConnectionId?: string): { ids: string[]; bounds: SelectorBounds } {
        const diagramInstance: any = diagramRef.current;
        const diagramSelectionSettings = diagramInstance?.selectedItems;
        const currentlySelectedElementIds = new Set<string>();
        let currentSelectionBounds: SelectorBounds = { bounds: null, rotationAngle: 0 };
        let shouldRefreshBadges = false;

        if (!diagramSelectionSettings) {
            return { ids: [], bounds: currentSelectionBounds };
        }

        // Collect currently selected node IDs
        (diagramInstance.selectedItems.nodes || []).forEach((node: any) => {
            if (node && node.id) currentlySelectedElementIds.add((node.id || '').trim());
        });

        // Collect currently selected connector IDs
        (diagramInstance.selectedItems.connectors || []).forEach((connector: any) => {
            if (connector && connector.id) currentlySelectedElementIds.add((connector.id || '').trim());
        });

        // Build selector bounds for current selection
        currentSelectionBounds = {
            bounds: {
                x: diagramSelectionSettings.offsetX,
                y: diagramSelectionSettings.offsetY,
                width: diagramSelectionSettings.width,
                height: diagramSelectionSettings.height
            },
            rotationAngle: diagramSelectionSettings.rotateAngle
        };

        const peerConnectionIdsToRemove: string[] = [];

        // Update peer selections based on current selection
        peerSelections.forEach((peerSelection, peerConnectionId) => {
            if (peerConnectionId === currentConnectionId) { return; }
            const peerSelectedNodeIds = peerSelection.nodeIds;

            // If nothing is currently selected, check for peer selections that need cleanup
            if (currentlySelectedElementIds.size === 0) {
                const editedElementsSet = new Set<string>(editedElements);
                const commonElementIds = setToArray(peerSelectedNodeIds).filter((elementId: string) => editedElementsSet.has(elementId));

                if (commonElementIds.length > 0) {
                    for (const elementId of commonElementIds) {
                        const diagramObject = (diagramInstance as any).getObject(elementId);
                        if (!diagramObject) {
                            peerSelectedNodeIds.delete(elementId);
                            shouldRefreshBadges = true;
                        }
                    }
                    if (peerSelectedNodeIds.size === 0) {
                        peerConnectionIdsToRemove.push(peerConnectionId);
                        shouldRefreshBadges = true;
                    }
                }
            } else if (setsEqual(peerSelectedNodeIds, currentlySelectedElementIds)) {
                // Update peer's selector bounds if selecting same elements
                peerSelections.set(peerConnectionId, { userName: peerSelection.userName, nodeIds: peerSelectedNodeIds, selectorBounds: currentSelectionBounds });
                shouldRefreshBadges = true;
            } else if (peerSelectedNodeIds && peerSelectedNodeIds.size > 0) {
                // currently selected node(s), compute connector bounds and update the peer selection.
                const firstElementId = Array.from(peerSelectedNodeIds)[0];
                let isConnector = false;

                if (diagramSelectionSettings && diagramSelectionSettings.nodes && diagramSelectionSettings.nodes.length > 0 && firstElementId) {
                    const currentNode = diagramSelectionSettings.nodes[0] as any;
                    try {
                        isConnector = (currentNode && currentNode.inEdges && currentNode.inEdges.indexOf(firstElementId) !== -1) ||
                            (currentNode && currentNode.outEdges && currentNode.outEdges.indexOf(firstElementId) !== -1);
                    } catch (e) {
                        isConnector = false;
                    }

                    if (isConnector) {
                        const connectorObj = (diagramInstance as any).getObject(firstElementId) as any;
                        if (connectorObj) {
                            const sourcePoint = connectorObj.sourcePoint || (connectorObj.points && connectorObj.points[0]);
                            const targetPoint = connectorObj.targetPoint || (connectorObj.points && connectorObj.points[connectorObj.points.length - 1]);
                            if (sourcePoint && targetPoint) {
                                const sourceX = sourcePoint.x || 0;
                                const sourceY = sourcePoint.y || 0;
                                const targetX = targetPoint.x || 0;
                                const targetY = targetPoint.y || 0;
                                const minX = Math.min(sourceX, targetX);
                                const minY = Math.min(sourceY, targetY);
                                const width = Math.abs(targetX - sourceX);
                                const height = Math.abs(targetY - sourceY);
                                const selectorBounds = {
                                    bounds: {
                                        x: minX + width / 2,
                                        y: minY + height / 2,
                                        width,
                                        height
                                    },
                                    rotationAngle: diagramSelectionSettings.rotateAngle
                                } as SelectorBounds;

                                peerSelections.set(peerConnectionId, { userName: peerSelection.userName, nodeIds: peerSelectedNodeIds, selectorBounds });
                                shouldRefreshBadges = true;
                            }
                        }
                    }
                    if (peerSelectedNodeIds && peerSelectedNodeIds.size > 1) {
                        let minLeft = Number.POSITIVE_INFINITY;
                        let minTop = Number.POSITIVE_INFINITY;
                        let maxRight = Number.NEGATIVE_INFINITY;
                        let maxBottom = Number.NEGATIVE_INFINITY;

                        // Iterate peerSelectedNodeIds and obtain each diagram object to compute its rect
                        Array.from(peerSelectedNodeIds).forEach((elementId: string) => {
                            const obj = (diagramInstance as any).getObject(elementId);
                            if (!obj) return;

                            // Node-like object with offset/width/height
                            if (obj.offsetX !== undefined && obj.width !== undefined && obj.height !== undefined) {
                                const nx = obj.offsetX ?? 0;
                                const ny = obj.offsetY ?? 0;
                                const w = obj.width ?? 0;
                                const h = obj.height ?? 0;
                                const left = nx - w / 2;
                                const top = ny - h / 2;
                                const right = nx + w / 2;
                                const bottom = ny + h / 2;
                                if (left < minLeft) minLeft = left;
                                if (top < minTop) minTop = top;
                                if (right > maxRight) maxRight = right;
                                if (bottom > maxBottom) maxBottom = bottom;
                            }
                            else if (obj.sourcePoint && obj.targetPoint) {
                                const pts = [obj.sourcePoint, obj.targetPoint];
                                pts.forEach((pt: any) => {
                                    const px = pt.x ?? 0;
                                    const py = pt.y ?? 0;
                                    if (px < minLeft) minLeft = px;
                                    if (py < minTop) minTop = py;
                                    if (px > maxRight) maxRight = px;
                                    if (py > maxBottom) maxBottom = py;
                                });
                            }
                        });

                        const width = isFinite(maxRight - minLeft) ? (maxRight - minLeft) : 0;
                        const height = isFinite(maxBottom - minTop) ? (maxBottom - minTop) : 0;
                        const selectorBounds = {
                            bounds: {
                                x: minLeft + width / 2,
                                y: minTop + height / 2,
                                width,
                                height
                            },
                            rotationAngle: diagramSelectionSettings.rotateAngle
                        } as SelectorBounds;
                        peerSelections.set(peerConnectionId, { userName: peerSelection.userName, nodeIds: peerSelectedNodeIds, selectorBounds });
                        shouldRefreshBadges = true;
                    }
                }
            }
        });

        // Remove peer selections that no longer exist
        for (const connectionIdToRemove of peerConnectionIdsToRemove) {
            peerSelections.delete(connectionIdToRemove);
        }

        if (shouldRefreshBadges) {
            renderPeerBadges();
        }

        return { ids: setToArray(currentlySelectedElementIds), bounds: currentSelectionBounds };
    }

    const historyChange = (historyChangeArgs: IHistoryChangeArgs) => {
        // Update toolbar undo/redo button states
        const toolbarEditorElement = (document.getElementById('toolbarEditor') as any)?.ej2_instances?.[0];
        const diagramInstance = (document.getElementById('diagram') as any)?.ej2_instances?.[0];
        if (toolbarEditorElement && diagramInstance) {
            const undoToolbarButton = toolbarEditorElement.items.find((item: { id: string; }) => item.id === 'undo');
            if (undoToolbarButton) {
                undoToolbarButton.disabled = diagramInstance.historyManager.undoStack.length > 0 ? false : true;
            }
            const redoToolbarButton = toolbarEditorElement.items.find((item: { id: string; }) => item.id === 'redo');
            if (redoToolbarButton) {
                redoToolbarButton.disabled = diagramInstance.historyManager.redoStack.length > 0 ? false : true;
            }
        }

        try {
            const diagram = diagramRef.current as any;
            const diagramUpdateChanges: string[] = diagram.getDiagramUpdates(historyChangeArgs) || [];
            const isUndoAction = (historyChangeArgs.action === 'Undo');
            const isGroupActionStart = ((historyChangeArgs.change as any)?.type === (isUndoAction ? 'EndGroup' : 'StartGroup'));
            const isGroupActionEnd = ((historyChangeArgs.change as any)?.type === (isUndoAction ? 'StartGroup' : 'EndGroup'));

            if (isGroupActionStart) {
                editedElements = [];
                isGroupAction = true;
            }

            // Collect edited element IDs from history change args
            if (historyChangeArgs && (historyChangeArgs as any).source && (historyChangeArgs as any).source.length) {
                for (let sourceIndex: number = 0; sourceIndex < (historyChangeArgs as any).source.length; sourceIndex++) {
                    const sourceElement = (historyChangeArgs as any).source[parseInt(sourceIndex.toString(), 10)];
                    if (sourceElement && (sourceElement as any).id) {
                        editedElements.push((sourceElement as any).id as string);
                    }
                }
            }

            // Broadcast changes to other connected clients
            if (diagramUpdateChanges.length > 0) {
                const { ids: selectedElementIds, bounds: selectorBounds } = updateOtherClientSelectorBounds();
                const peerSelectionBounds: SelectionEvent = { elementIds: selectedElementIds, selectorBounds: selectorBounds } as any;
                connectionRef.current?.send('BroadcastToOtherClients', diagramUpdateChanges, clientVersionRef.current, editedElements, peerSelectionBounds, roomName)
                    .catch((broadcastError: any) => console.error('BroadcastToOtherClients failed:', broadcastError));
            }

            if (isGroupActionEnd || !isGroupAction) {
                editedElements = [];
                isGroupAction = false;
            }
        } catch (historyProcessingError) {
            console.error('Error processing history change:', historyProcessingError);
        }
    };

    function peerSelectionChanged(selectionEvent: SelectionEvent | null): void {
        if (!diagramRef.current || !selectionEvent || !selectionEvent.userId || !(selectionEvent.elementIds && selectionEvent.elementIds.length)) {
            // Clear selection for peer if no valid event
            if (selectionEvent && selectionEvent.connectionId) {
                peerSelections.delete(selectionEvent.connectionId);
            }
        }
        else {
            const peerConnectionId = selectionEvent.connectionId || '';
            const peerSelectedNodeIds = new Set<string>((selectionEvent.elementIds || []) as string[]);
            const peerSelectorBounds = selectionEvent.selectorBounds || null;

            // Register/update this peer's selection
            peerSelections.set(peerConnectionId, {
                userName: selectionEvent.userName || '',
                nodeIds: peerSelectedNodeIds,
                selectorBounds: peerSelectorBounds
            });

            // Check for other peers selecting the same elements and update their bounds if needed
            peerSelections.forEach((existingPeerSelection, existingPeerConnectionId) => {
                if (existingPeerConnectionId === peerConnectionId) { return; }
                if (existingPeerSelection.nodeIds && setsEqual(existingPeerSelection.nodeIds, peerSelectedNodeIds)) {
                    const existingPeerBounds = existingPeerSelection.selectorBounds || null;
                    const newPeerBounds = peerSelectorBounds;
                    if (!boundsEqual(existingPeerBounds?.bounds, newPeerBounds?.bounds) ||
                        (existingPeerBounds?.rotationAngle || 0) !== (newPeerBounds?.rotationAngle || 0)) {
                        peerSelections.set(existingPeerConnectionId, { userName: existingPeerSelection.userName, nodeIds: existingPeerSelection.nodeIds, selectorBounds: peerSelectorBounds });
                    }
                }
            });
        }
        renderPeerBadges();
    }

    function sendSelectionToServer(args: ISelectionChangeEventArgs) {
        if (!args || args.state !== 'Changed') return;
        const values = Array.isArray(args.newValue) ? args.newValue : (args.newValue ? [args.newValue] : []);
        if (!values || !Array.isArray(values)) { return; }
        const selectedElements: string[] = [];
        values.forEach((element: any) => { if (element && element.id) selectedElements.push(element.id); });
        const settings: any = (diagramRef.current as any)?.selectedItems;
        if (!settings) { return; }

        const bounds = {
            bounds: {
                x: settings.offsetX,
                y: settings.offsetY,
                width: settings.width,
                height: settings.height
            },
            rotationAngle: settings.rotateAngle
        } as SelectorBounds;

        try {
            connectionRef.current?.invoke('SelectElements', selectedElements, bounds);
        } catch (err) {
            console.error('SelectElements invoke failed:', err);
        }
    }

    return (
        <div className="diagram-editor-wrapper">
            {/* Collaboration status indicator */}
            <div id="diagramMessage"></div>
            <DiagramComponent
                id="diagram"
                ref={diagramRef}
                width="100%"
                height="100%"
                nodes={initialNodes}
                connectors={initialConnectors}
                // collaborative editing handled via SignalR
                enableCollaborativeEditing={true}
                constraints={
                    DiagramConstraints.Default |
                    DiagramConstraints.Bridging |
                    DiagramConstraints.UndoRedo
                }
                tool={DiagramTools.Default}
                snapSettings={{
                    constraints: 1 | 2 | 4,
                    horizontalGridlines: DEFAULT_GRIDLINES,
                    verticalGridlines: DEFAULT_GRIDLINES
                }}
                scrollSettings={{
                    scrollLimit: 'Infinity',
                    canAutoScroll: true
                }}
                getNodeDefaults={(node: NodeModel) => {
                    if (node.id === 'TitleNode') {
                        node.style = {
                            fill: 'transparent',
                            strokeColor: 'transparent',
                            strokeWidth: 0
                        };
                    } else if ((node.shape as BpmnShape).shape === 'Group') {
                        node.width = 60;
                        node.height = 60;
                    }
                    else if (node.style?.fill === 'white' && node.style.strokeColor === 'black') {
                        node.style = {
                            fill: '#ffffffff',
                            strokeColor: '#000000ff',
                        };
                    }
                    return node;
                }}
                historyChange={(args: IHistoryChangeArgs) => {
                    historyChange(args);
                }}
                selectionChange={async (args: ISelectionChangeEventArgs) => {
                    // existing local selection handling
                    handleSelectionChange(args);
                    try {
                        sendSelectionToServer(args);
                    } catch (ex) {
                        // eslint-disable-next-line no-console
                        console.error('sendSelectionToServer error:', ex);
                    }
                }}
                // selectionChange handler: propagate selection to server
                textEdit={(args: ITextEditEventArgs) => {
                    if (onTextEdit) onTextEdit(args);
                    try {
                        // args.element is the node being edited, args.annotation is the annotation
                        if (args && (args as any).element && (args as any).annotation) {
                            const node = (args as any).element as NodeModel;
                            const annotation = (args as any).annotation;
                            const index = node.annotations ? node.annotations.findIndex((a: any) => a === annotation) : 0;
                            const sel = { type: 'annotation', nodeId: node.id as string, annotationIndex: Math.max(0, index), annotation } as import('./diagramTypes').SelectedAnnotationItem;
                            onSelectionChange?.(sel);
                        }
                    } catch (ex) {
                        // eslint-disable-next-line no-console
                        console.error('Error in textEdit handler:', ex);
                    }
                }}
                positionChange={(args: any) => {
                    if (onPositionChange) onPositionChange(args);
                }}
                sizeChange={(args: any) => {
                    if (onSizeChange) onSizeChange(args);
                }}
            >
                <Inject services={[UndoRedo, PrintAndExport, BpmnDiagrams, DiagramCollaboration, ConnectorBridging]} />
            </DiagramComponent>
        </div>
    );
}
);
DiagramEditor.displayName = 'ReactDiagramEditor';