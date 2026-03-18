/**
 * Toolbar Component - Reorganized into Two Sections
 *
 * LAYOUT STRUCTURE:
 * 1. Banner Container (Top): Title + Guest Info + Branding
 * 2. Primary Toolbar (Below Banner): Main editing tools and actions
 */

import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  ToolbarComponent,
  ItemsDirective,
  ItemDirective
} from '@syncfusion/ej2-react-navigations';
import { DropDownButtonComponent } from '@syncfusion/ej2-react-splitbuttons';
import type { ClickEventArgs } from '@syncfusion/ej2-navigations';
import type { MenuEventArgs } from '@syncfusion/ej2-splitbuttons';
import type { ToolbarAction } from './diagramTypes';
import React from 'react';

interface ToolbarProps {
  onAction: (action: ToolbarAction) => void;
  onExport: (format: 'JPG' | 'PNG' | 'SVG') => void;
  onDrawShape: (shape: 'Rectangle' | 'Ellipse' | 'Polygon') => void;
  onDrawConnector: (type: 'Straight' | 'Orthogonal' | 'Bezier') => void;
  onGroupAction: (action: 'Group' | 'Ungroup') => void;
  availableGuests?: number;
  isUndoEnabled?: boolean;
  isRedoEnabled?: boolean;
  isCutEnabled?: boolean;
  isCopyEnabled?: boolean;
  isPasteEnabled?: boolean;
}

export const Toolbar = forwardRef<ToolbarComponent | null, ToolbarProps>(({
  onAction,
  onExport,
  onDrawShape,
  onDrawConnector,
  onGroupAction,
  availableGuests = 1,
  isUndoEnabled = false,
  isRedoEnabled = false,
  isCutEnabled = false,
  isCopyEnabled = false,
  isPasteEnabled = false,
}: ToolbarProps,
  ref
) => {
  const toolbarRef = useRef<ToolbarComponent>(null);
  useImperativeHandle(ref, () => toolbarRef.current as ToolbarComponent, []);

  useEffect(() => {
  }, [availableGuests]);

  const handleClick = (args: ClickEventArgs) => {
    const action = args.item.id as ToolbarAction;
    onAction(action);
  };

  // Dropdown menu items
  const exportItems = [
    { text: 'JPG' },
    { text: 'PNG' },
    { text: 'SVG' }
  ];

  const shapeItems = [
    { text: 'Rectangle', iconCss: 'e-rectangle e-icons' },
    { text: 'Ellipse', iconCss: ' e-circle e-icons' },
    { text: 'Polygon', iconCss: 'e-line e-icons' }
  ];

  const connectorItems = [
    { text: 'Straight', iconCss: 'e-icons e-line' },
    { text: 'Orthogonal', iconCss: 'sf-diagram-icon-orthogonal' },
    { text: 'Bezier', iconCss: 'sf-diagram-icon-bezier' }
  ];

  const groupItems = [
    { iconCss: 'e-icons e-group-1', text: 'Group' },
    { iconCss: 'e-icons e-ungroup-1', text: 'Ungroup' }
  ];

  const handleExportSelect = (args: MenuEventArgs) => {
    // Build the IExportOptions-like object and pass it to the parent handler
    let exportOptions: any = {};
    exportOptions.format = args.item.text; // 'JPG' | 'PNG' | 'SVG'
    exportOptions.mode = 'Download';
    exportOptions.region = 'PageSettings';
    exportOptions.fileName = 'Export';
    exportOptions.margin = { left: 0, top: 0, bottom: 0, right: 0 };
    onExport(exportOptions);
  };

  const handleShapeSelect = (args: MenuEventArgs) => {
    const shape = args.item.text as 'Rectangle' | 'Ellipse' | 'Polygon';
    onDrawShape(shape);
  };

  const handleConnectorSelect = (args: MenuEventArgs) => {
    const type = args.item.text as 'Straight' | 'Orthogonal' | 'Bezier';
    onDrawConnector(type);
  };

  const handleGroupSelect = (args: MenuEventArgs) => {
    const action = args.item.text as 'Group' | 'Ungroup';
    onGroupAction(action);
  };

  return (
    <>
      {/* ============================================
          CONTAINER 1: BANNER (Top Section)
          Contains: Title, Guest Counter, Branding
          ============================================ */}
      <div className="banner-container">
        <div className="banner-left">
          <h1 className="banner-title">Live Diagram Collaboration</h1>
        </div>

        <div className="banner-right">
          <div className="guest-counter">
            <span className="guest-label">Available Guests:</span>
            <span className="guest-count">{availableGuests}</span>
          </div>
          <div className="branding">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-icon">
              <g clipPath="url(#clip0_289_40)">
                <path d="M6.20884 3.2207H1.66846V7.76109H6.20884V3.2207Z" fill="#3543A8" />
                <path d="M16.4785 0.833896L13.4849 4.35742L17.0084 7.3511L20.0021 3.82757L16.4785 0.833896Z" fill="#FF8600" />
                <path d="M11.6058 3.2207H7.06543V7.76109H11.6058V3.2207Z" fill="#3543A8" />
                <path d="M6.20884 8.61914H1.66846V13.1595H6.20884V8.61914Z" fill="#3543A8" />
                <path d="M11.6058 8.61914H7.06543V13.1595H11.6058V8.61914Z" fill="#3543A8" />
                <path d="M17.0074 8.61914H12.467V13.1595H17.0074V8.61914Z" fill="#FF8600" />
                <path d="M6.20884 14.0449H1.66846V18.5853H6.20884V14.0449Z" fill="#3543A8" />
                <path d="M11.6058 14.0449H7.06543V18.5853H11.6058V14.0449Z" fill="#3543A8" />
                <path d="M17.034 14.0449H12.4937V18.5853H17.034V14.0449Z" fill="#3543A8" />
              </g>
              <defs>
                <clipPath id="clip0_289_40">
                  <rect width="20" height="20" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span className='powered-by'>Powered by</span>
            <a href="https://www.syncfusion.com/react-components/react-diagram?tag=es-freetools-diagram-collaboration-sample-ft"
              target="_blank" className='bannerText'>
              Syncfusion Diagram Component
            </a>
          </div>
        </div>
      </div>

      {/* ============================================
          CONTAINER 2: PRIMARY TOOLBAR
          Contains: Main editing tools and actions
          ============================================ */}
      <div className="collab-header">
        <div className="primary-toolbar-container">
          <ToolbarComponent
            id="toolbarEditor"
            ref={toolbarRef}
            clicked={handleClick}
            height={40}
            cssClass="clean-toolbar"
            statelessTemplates={['directiveTemplates']}
            width={"100%"}
          >
            <ItemsDirective>
              {/* === File Operations Group === */}
              <ItemDirective
                id="new"
                prefixIcon="e-icons e-circle-add"
                tooltipText="New Diagram"
              />
              <ItemDirective
                id="open"
                prefixIcon="e-icons e-folder-open"
                tooltipText="Open Diagram"
              />
              <ItemDirective
                id="save"
                prefixIcon="e-icons e-save"
                tooltipText="Save Diagram"
              />
              <ItemDirective
                id="print"
                prefixIcon="e-icons e-print"
                tooltipText="Print"
              />
              <ItemDirective
                template={() => (
                  <DropDownButtonComponent
                    items={exportItems}
                    iconCss="e-icons e-export"
                    cssClass="custom-export-dropdown"
                    select={handleExportSelect}
                  />
                )}
              />
              <ItemDirective type="Separator" />

              {/* === Clipboard Group === */}
              <ItemDirective
                id="cut"
                prefixIcon="e-icons e-cut"
                tooltipText="Cut"
                disabled={!isCutEnabled}
              />
              <ItemDirective
                id="copy"
                prefixIcon="e-icons e-copy"
                tooltipText="Copy"
                disabled={!isCopyEnabled}
              />
              <ItemDirective
                id="paste"
                prefixIcon="e-icons e-paste"
                tooltipText="Paste"
                disabled={!isPasteEnabled}
              />
              <ItemDirective type="Separator" />

              {/* === History Group === */}
              <ItemDirective
                id="undo"
                prefixIcon="e-icons e-undo"
                tooltipText="Undo"
                disabled={!isUndoEnabled}
              />
              <ItemDirective
                id="redo"
                prefixIcon="e-icons e-redo"
                tooltipText="Redo"
                disabled={!isRedoEnabled}
              />
              <ItemDirective type="Separator" />

              {/* === Drawing Tools Group === */}
              <ItemDirective
                template={() => (
                  <DropDownButtonComponent
                    items={shapeItems}
                    iconCss="e-shapes e-icons"
                    cssClass="tb-item-middle"
                    select={handleShapeSelect}
                  />
                )}
              />
              <ItemDirective
                template={() => (
                  <DropDownButtonComponent
                    items={connectorItems}
                    cssClass="tb-item-middle"
                    iconCss="e-icons e-line"
                    select={handleConnectorSelect}
                  />
                )}
              />
              <ItemDirective
                template={() => (
                  <DropDownButtonComponent
                    items={groupItems}
                    iconCss="e-icons e-group-1"
                    select={handleGroupSelect}
                    disabled={false}
                  />
                )}
              />
              <ItemDirective type="Separator" />

              {/* === Selection Tools Group === */}
              <ItemDirective
                id="pointer"
                prefixIcon="e-icons e-mouse-pointer"
                tooltipText="Pointer Tool"
              />
              <ItemDirective
                id="text"
                prefixIcon="e-icons e-caption"
                tooltipText="Text Tool"
              />
              <ItemDirective
                id="pan"
                prefixIcon="e-icons e-pan"
                tooltipText="Pan Tool"
              />
              <ItemDirective type="Separator" />

              {/* === View Controls Group === */}
              <ItemDirective
                id="zoomIn"
                prefixIcon="e-icons e-zoom-in"
                tooltipText="Zoom In"
              />
              <ItemDirective
                id="zoomOut"
                prefixIcon="e-icons e-zoom-out"
                tooltipText="Zoom Out"
              />
              <ItemDirective
                id="fitToPage"
                prefixIcon="e-icons e-zoom-to-fit"
                tooltipText="Fit to Page"
              />
            </ItemsDirective>
          </ToolbarComponent>
        </div>
      </div>
    </>
  );
});