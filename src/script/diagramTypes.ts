/**
 * Type definitions for collaborative diagram editor
 */

import type { NodeModel, ConnectorModel } from '@syncfusion/ej2-react-diagrams';

// Diagram state representation for collaboration
export interface DiagramState {
  nodes: NodeModel[];
  connectors: ConnectorModel[];
  timestamp?: number;
}

// Collaboration message types
export enum MessageType {
  DIAGRAM_UPDATE = 'DIAGRAM_UPDATE',
  REQUEST_STATE = 'REQUEST_STATE',
  STATE_SYNC = 'STATE_SYNC',
  NODE_ADDED = 'NODE_ADDED',
  NODE_UPDATED = 'NODE_UPDATED',
  NODE_DELETED = 'NODE_DELETED',
  CONNECTOR_ADDED = 'CONNECTOR_ADDED',
  CONNECTOR_UPDATED = 'CONNECTOR_UPDATED',
  CONNECTOR_DELETED = 'CONNECTOR_DELETED'
}

// Base collaboration message
export interface CollaborationMessage {
  type: MessageType;
  payload: any;
  clientId?: string;
  timestamp: number;
}

// Specific message payloads
export interface DiagramUpdatePayload {
  state: DiagramState;
}

export interface NodeOperationPayload {
  node: NodeModel;
}

export interface ConnectorOperationPayload {
  connector: ConnectorModel;
}

// Property panel data for selected node
export interface NodeProperties {
  id: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotateAngle?: number;
  fillColor?: string;
  aspectRatio?: boolean;
  gradientColor?: string;
  gradientDirection?: string;
  isGradient?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  borderDashArray?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  textAlign?: 'Left' | 'Center' | 'Right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textOpacity?: number;
}

// Selection models for property panel
export interface SelectedNodeItem {
  type: 'node';
  node: import('@syncfusion/ej2-react-diagrams').NodeModel;
}

export interface SelectedConnectorItem {
  type: 'connector';
  connector: import('@syncfusion/ej2-react-diagrams').ConnectorModel;
}

export interface SelectedAnnotationItem {
  type: 'annotation';
  nodeId: string; // parent node id
  annotationIndex: number;
  annotation: any;
}

export interface SelectedMultipleItem {
  type: 'multiple';
  nodes: import('@syncfusion/ej2-react-diagrams').NodeModel[];
  connectors: import('@syncfusion/ej2-react-diagrams').ConnectorModel[];
}

export type SelectedItem = SelectedNodeItem | SelectedConnectorItem | SelectedAnnotationItem | SelectedMultipleItem | null;

// Toolbar action types
export type ToolbarAction =
  | 'new'
  | 'open'
  | 'save'
  | 'print'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'exportJPG'
  | 'exportPNG'
  | 'exportSVG'
  | 'fitToPage'
  | 'zoomIn'
  | 'zoomOut'
  | 'select'
  | 'pointer'
  | 'text'
  | 'connector'
  | 'pan'
  | 'undo'
  | 'redo';

// Symbol palette shape types
export interface SymbolInfo {
  id: string;
  shape: string;
  category: 'flow' | 'basic' | 'connector';
}
// Property panel data for selected connector
export interface ConnectorProperties {
  id: string;
  sourceID: string;
  targetID: string;
  type: string;
  connectorType?: 'Straight' | 'Orthogonal' | 'Bezier';
  strokeColor?: string;
  strokeWidth?: number;
  strokeDashArray?: string;
  startArrowSize?: number;
  endArrowSize?: number;
  sourceDecorator?: 'None' | 'Arrow' | 'Circle' | 'Diamond' | 'OpenArrow' | 'Square' | 'DoubleArrow';
  targetDecorator?: 'None' | 'Arrow' | 'Circle' | 'Diamond' | 'OpenArrow' | 'Square' | 'DoubleArrow';
  bridging?: boolean;
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  textAlign?: 'Left' | 'Center' | 'Right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textOpacity?: number;
}