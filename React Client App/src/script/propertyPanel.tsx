/**
 * PropertyPanel Component
 * Context-sensitive property editor for selected diagram elements
 */

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { NumericTextBoxComponent, SliderComponent, ColorPickerComponent } from '@syncfusion/ej2-react-inputs';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import type { NodeProperties, SelectedItem } from './diagramTypes';
import React from 'react';
import { AnnotationAlignment, Diagram, NodeConstraints } from '@syncfusion/ej2-react-diagrams';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import { lineItemTemplate, lineValueTemplate, strokeStyles } from './connectorPropertyPanel';

// Normalize a couple of common CSS color names to hex for the ColorPicker display
const normalizeColorForPicker = (c?: string, fallback = '#000000') => {
  if (!c) return fallback;
  const v = String(c).toLowerCase().trim();
  if (v === 'black') return '#000000';
  if (v === 'blue') return '#0000ff';
  return c;
};

interface PropertyPanelProps {
  selectedItem: SelectedItem;
  onPropertyChange: (properties: Partial<NodeProperties>) => void;
}

// Helper function to determine gradient direction from gradient object
const getGradientDirection = (gradient: any): string => {
  if (!gradient || gradient.type !== 'Linear') return 'BottomToTop';
  const { x1 = 0, y1 = 0, x2 = 0, y2 = 0 } = gradient;

  if (y1 === 0 && y2 === 0) {
    return (x1 === 100 && x2 === 0) ? 'LeftToRight' : 'RightToLeft';
  } else {
    return (y1 === 100 && y2 === 0) ? 'TopToBottom' : 'BottomToTop';
  }
};

function getDiagramById(id: string): Diagram | null {
  const host = document.getElementById(id) as any;
  return (host?.ej2_instances?.[0] ?? null) as Diagram | null;
}
const toolbarTextSubAlignChange = (propertyName: string, propertyValue: string) => {
  textPropertyChange(propertyName, propertyValue);
}

export function textPropertyChange(
  propertyName: string, propertyValue: string

) {
  let diagram = getDiagramById("diagram")
  const objects = [
    ...(diagram?.selectedItems?.nodes || []),
    ...(diagram?.selectedItems?.connectors || [])
  ];

  if (objects.length === 0) return;

  const prop = propertyName.toLowerCase();

  for (const obj of objects) {
    const annotations = obj.annotations || [];

    // ---- Case 2: Update each annotation ----
    annotations.forEach((annotation: any) => {

      // Text position (offset / alignment)
      if (prop === 'textposition') {
        if (annotation.offset) {
          // shape annotation offset
          annotation.offset = getOffsetForPosition(propertyValue);
        }
        if (annotation.alignment) {
          // connector path annotation alignment
          annotation.alignment = propertyValue as AnnotationAlignment;
        }
      }

      // Horizontal alignment
      if (prop === 'left' || prop === 'center' || prop === 'right') {
        annotation.horizontalAlignment = capitalize(propertyName);
        updateHorizontalVerticalAlign(annotation);
      }

      // Vertical alignment
      else if (prop === 'top' || prop === 'middle' || prop === 'bottom') {
        annotation.verticalAlignment =
          propertyValue === 'middle' ? 'Center' : capitalize(propertyValue);
        updateHorizontalVerticalAlign(annotation);
      }

      else if (prop === 'textalign') {
        annotation.offset = getOffsetForPosition(propertyValue);
      }

    });
  }

  diagram?.dataBind();
}

function capitalize(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function updateHorizontalVerticalAlign(annotation: any) {
  if (!annotation.horizontalAlignment) annotation.horizontalAlignment = 'Center';
  if (!annotation.verticalAlignment) annotation.verticalAlignment = 'Center';
}

function getOffsetForPosition(pos: string) {
  switch (pos.toLowerCase()) {
    case 'topleft': return { x: 0, y: 0 };
    case 'topcenter': return { x: 0.5, y: 0 };
    case 'topright': return { x: 1, y: 0 };
    case 'middleleft': return { x: 0, y: 0.5 };
    case 'middleright': return { x: 1, y: 0.5 };
    case 'bottomleft': return { x: 0, y: 1 };
    case 'bottomcenter': return { x: 0.5, y: 1 };
    case 'bottomright': return { x: 1, y: 1 };
    case 'center':
    default:
      return { x: 0.5, y: 0.5 };
  }
}

export const PropertyPanel = ({ selectedItem, onPropertyChange }: PropertyPanelProps) => {

  const [properties, setProperties] = useState<NodeProperties | null>(null);
  const [showGradient, setShowGradient] = useState(false);
  const [hasAnnotation, setHasAnnotation] = useState<boolean>(false);
  // --- Dialog state ---

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  // Use DOM refs for inputs so typing never triggers a React re-render
  const hyperlinkUrlInputRef = useRef<HTMLInputElement>(null);
  const hyperlinkTextInputRef = useRef<HTMLInputElement>(null);
  const insertDialogRef = useRef<DialogComponent>(null);
  // Track if we've already seeded the inputs to prevent clearing user input on re-renders
  const hasSeededInputsRef = useRef(false);
  // Track last node ID to only rebuild when node selection actually changes (not on every selectedItem reference change)
  const lastSelectedNodeIdRef = useRef<string | null>(null);

  // IMPORTANT: stable objects for EJ2 props (prevents re-init)
  const dialogAnimation = useMemo(() => ({ effect: 'None' as const }), []);
  const hyperlinkButtons = useMemo(
    () => [
      { click: () => onApplyLink(), buttonModel: { content: 'Apply', cssClass: 'e-flat e-db-primary', isPrimary: true } },
      { click: () => onCancelLink(), buttonModel: { content: 'Cancel', cssClass: 'e-flat' } }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [/* deliberately empty: keep buttons identity stable; handlers below call latest state via refs if needed */]
  );

  // Helper to build node properties from selectedItem.node
  const buildNodeProperties = (selectedNode: any) => {
    const rawTextAlign = selectedNode.annotations?.[0]?.style?.textAlign;
    const textAlignValue =
      rawTextAlign === 'Left' || rawTextAlign === 'Center' || rawTextAlign === 'Right'
        ? rawTextAlign
        : 'Center';

    const gradient = (selectedNode.style as any)?.gradient;
    // Treat explicit "None" type as no-gradient; otherwise consider gradient present
    const isGradient = !!gradient && ((gradient as any).type ? ((gradient as any).type !== 'None') : (gradient.stops && gradient.stops.length > 1));

    // Derive fill/gradient stop colors: when gradient active, map stop0 -> fillColor (Stop1), stop1 -> gradientColor (Stop2)
    const stop0 = (gradient && gradient.stops && gradient.stops[0]) ? gradient.stops[0].color : undefined;
    const stop1 = (gradient && gradient.stops && gradient.stops[1]) ? gradient.stops[1].color : undefined;

    const nodeProps: NodeProperties = {
      id: selectedNode.id || '',
      offsetX: (selectedNode.offsetX as number) || 0,
      offsetY: (selectedNode.offsetY as number) || 0,
      width: (selectedNode.width as number) || 100,
      height: (selectedNode.height as number) || 100,
      rotateAngle: (selectedNode.rotateAngle as number) || 0,
      aspectRatio: !!(selectedNode.constraints && (selectedNode.constraints & NodeConstraints.AspectRatio)),
      fillColor: isGradient ? (stop0 ?? ((selectedNode.style as any)?.fill ?? '#ffffffff')) : ((selectedNode.style as any)?.fill || '#6BA5D7'),
      isGradient: isGradient || false,
      gradientColor: isGradient ? (stop1 ?? '#37909A') : '#37909A',
      gradientDirection: isGradient ? getGradientDirection(gradient) : 'BottomToTop',
      strokeColor: (selectedNode.style as any)?.strokeColor || '#000000ff',
      strokeWidth: (selectedNode.style as any)?.strokeWidth || 1,
      opacity: (selectedNode.style as any)?.opacity !== undefined ? (selectedNode.style as any).opacity : 1,
      borderDashArray: (selectedNode.style as any)?.strokeDashArray || 'None',
      text: selectedNode.annotations?.[0]?.content || '',
      fontSize: selectedNode.annotations?.[0]?.style?.fontSize || 12,
      fontFamily: selectedNode.annotations?.[0]?.style?.fontFamily || 'Arial',
      fontColor: (selectedNode.annotations?.[0]?.style?.color) || '#ffffffff',
      textAlign: textAlignValue as NodeProperties['textAlign'],
      bold: selectedNode.annotations?.[0]?.style?.bold || false,
      italic: selectedNode.annotations?.[0]?.style?.italic || false,
      underline: selectedNode.annotations?.[0]?.style?.textDecoration === 'Underline',
      textOpacity: selectedNode.annotations?.[0]?.style?.opacity !== undefined
        ? selectedNode.annotations[0].style.opacity
        : 1,
    };

    return { nodeProps, isGradient, hasAnnotations: selectedNode.annotations && selectedNode.annotations.length > 0 };
  };

  useEffect(() => {
    // Only rebuild properties if the selected node ID actually changed
    // Property updates during drag/resize will be caught by the effect below
    const currentNodeId = selectedItem?.type === 'node' ? (selectedItem.node as any)?.id : null;

    if (currentNodeId === lastSelectedNodeIdRef.current && properties !== null) {
      // Same node still selected - let the live update effect handle drag updates
      return;
    }
    lastSelectedNodeIdRef.current = currentNodeId;

    // Build properties object depending on selected item type
    if (!selectedItem) {
      setProperties(null);
      setShowGradient(false);
      setHasAnnotation(false);
      return;
    }

    if (selectedItem.type === 'node') {
      const selectedNode = selectedItem.node;
      const { nodeProps, isGradient, hasAnnotations } = buildNodeProperties(selectedNode);
      setProperties(nodeProps);
      setShowGradient(isGradient || false);
      setHasAnnotation(hasAnnotations);
      return;
    }

    if (selectedItem.type === 'connector') {
      const selectedConnectorObj = selectedItem.connector;
      const connectorProps: NodeProperties = {
        id: selectedConnectorObj.id || '',
        strokeColor: selectedConnectorObj.style?.strokeColor || '#424242',
        strokeWidth: selectedConnectorObj.style?.strokeWidth || 2,
        opacity: selectedConnectorObj.style?.opacity !== undefined ? selectedConnectorObj.style.opacity : 1
      } as NodeProperties;
      setProperties(connectorProps);
      setShowGradient(false);
      return;
    }

    // multiple selection or unknown
    setProperties(null);
    setShowGradient(false);
  }, [isLinkDialogOpen, (selectedItem as any)?.type, (selectedItem as any)?.node?.id, (selectedItem as any)?.connector?.id]);

  // Real-time position/size/rotation update during drag: poll selectedItem.node and update properties
  useEffect(() => {
    if (!selectedItem || selectedItem.type !== 'node') return;

    // Update properties immediately when node reference changes (captures drag/resize/rotate)
    const selectedNode = selectedItem.node;
    const { nodeProps, isGradient, hasAnnotations } = buildNodeProperties(selectedNode);
    setProperties(nodeProps);
    setShowGradient(isGradient || false);
    setHasAnnotation(hasAnnotations);
  }, [selectedItem?.type === 'node' ? (selectedItem as any)?.node?.offsetX : null, selectedItem?.type === 'node' ? (selectedItem as any)?.node?.offsetY : null, selectedItem?.type === 'node' ? (selectedItem as any)?.node?.width : null, selectedItem?.type === 'node' ? (selectedItem as any)?.node?.height : null, selectedItem?.type === 'node' ? (selectedItem as any)?.node?.rotateAngle : null]);

  useEffect(() => {
    if (!properties) return;
  }, [properties?.id, properties?.fillColor, properties?.strokeColor, properties?.fontColor]);

  // Imperatively seed input values ONLY once when dialog first opens (prevent clearing on re-renders)
  useLayoutEffect(() => {
    if (!isLinkDialogOpen) {
      // Reset flag when dialog closes so it seeds again next time
      hasSeededInputsRef.current = false;
      return;
    }

    // Only seed inputs once per dialog open
    if (hasSeededInputsRef.current) return;

    if (!selectedItem || selectedItem.type !== 'node') return;
    const node: any = selectedItem.node;
    const annotation = Array.isArray(node?.annotations) && node.annotations.length ? node.annotations[0] : null;
    if (hyperlinkUrlInputRef.current) hyperlinkUrlInputRef.current.value = annotation?.hyperlink?.link ?? '';
    if (hyperlinkTextInputRef.current) hyperlinkTextInputRef.current.value = annotation?.hyperlink?.content ?? annotation?.content ?? '';

    // Mark that we've seeded so we don't overwrite user input
    hasSeededInputsRef.current = true;
  }, [isLinkDialogOpen]);

  // Open dialog ONLY when button is clicked
  const onOpenInsertLink = useCallback(() => {
    if (!selectedItem || selectedItem.type !== 'node') return;
    try {
      // Seed inputs from the current selected node to avoid showing stale values
      const node: any = (selectedItem as any).node;
      const annotation = Array.isArray(node?.annotations) && node.annotations.length ? node.annotations[0] : null;
      if (hyperlinkUrlInputRef.current) hyperlinkUrlInputRef.current.value = annotation?.hyperlink?.link ?? '';
      if (hyperlinkTextInputRef.current) hyperlinkTextInputRef.current.value = annotation?.hyperlink?.content ?? annotation?.content ?? '';
      // mark seeded so useLayoutEffect doesn't overwrite
      hasSeededInputsRef.current = true;

      // Prefer imperative show; if it throws, fallback to state toggle in catch below
      insertDialogRef.current?.show();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('onOpenInsertLink error:', err);
      // fallback to state toggle when imperative show fails
      setIsLinkDialogOpen(true);
    }
  }, [selectedItem]);

  // Use refs to avoid re-creating memoized buttons
  const onApplyLink = useCallback(() => {
    try {
      if (!selectedItem || selectedItem.type !== 'node') {
        insertDialogRef.current?.hide?.();
        hasSeededInputsRef.current = false;
        setIsLinkDialogOpen(false);
        return;
      }

      const diagram = getDiagramById('diagram');
      if (!diagram) {
        insertDialogRef.current?.hide?.();
        hasSeededInputsRef.current = false;
        setIsLinkDialogOpen(false);
        return;
      }

      const node: any = selectedItem.node;
      const url = hyperlinkUrlInputRef.current?.value ?? '';
      const text = hyperlinkTextInputRef.current?.value ?? '';

      if (Array.isArray(node.annotations) && node.annotations.length > 0) {
        if (!node.annotations[0].hyperlink) node.annotations[0].hyperlink = {};
        node.annotations[0].hyperlink.link = url;
        node.annotations[0].hyperlink.content = text;
      } else {
        const annotation = { content: text, hyperlink: { link: url, content: text } };
        (diagram as any).addLabels(node, [annotation]);
      }

      (diagram as any).dataBind?.();

      // Hide dialog and reset flags
      insertDialogRef.current?.hide?.();
      hasSeededInputsRef.current = false;
      setIsLinkDialogOpen(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('onApplyLink error:', err);
      insertDialogRef.current?.hide?.();
      hasSeededInputsRef.current = false;
      setIsLinkDialogOpen(false);
    }
  }, [selectedItem]);

  const onCancelLink = useCallback(() => {
    try {
      insertDialogRef.current?.hide?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('onCancelLink error:', err);
    }
    hasSeededInputsRef.current = false;
    setIsLinkDialogOpen(false);
  }, []);

  const handlePropertyUpdate = (key: keyof NodeProperties, value: any) => {
    if (properties) {
      const updatedProps = { ...properties, [key]: value };
      setProperties(updatedProps);
      onPropertyChange({ [key]: value });
    }
  };

  const fontFamilies = [
    { text: 'Arial', value: 'Arial' },
    { text: 'Verdana', value: 'Verdana' },
    { text: 'Times New Roman', value: 'Times New Roman' },
    { text: 'Courier New', value: 'Courier New' },
    { text: 'Georgia', value: 'Georgia' },
    { text: 'Comic Sans MS', value: 'Comic Sans MS' }
  ];

  if (!properties) {
    const title = selectedItem ? (selectedItem.type === 'multiple' ? 'Multiple items selected' : selectedItem.type === 'annotation' ? 'Annotation selected' : (selectedItem.type === 'connector' ? 'Connector selected' : 'No selection')) : 'No selection';
    const sub = selectedItem ? (selectedItem.type === 'multiple' ? 'Select a single item to edit its properties' : selectedItem.type === 'annotation' ? 'Edit the annotation text by selecting it or using the text editor' : selectedItem.type === 'connector' ? 'Select a connector to edit stroke and routing' : 'Select an item to edit its properties') : 'Select an item to edit its properties';

    return (
      <div className="db-property-container">
        <div className="db-no-selection">
          <h3 className="db-no-selection-text">{title}</h3>
          <p className="db-no-selection-subtext">{sub}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="pp container db-property-editor-container">
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #e0e0e0',
        minHeight: '30px',
      }}>
        <h3 style={{ fontSize: '14px' }}>Node Properties</h3>
      </div>

      <div className="pp-section">
        {/* --- Dimensions --- */}
        <div className="pp-subheader">Dimensions</div>

        {/* Row 1: X | Y */}
        <div className="pp-grid-2">
          <div className="pp-inline-field">
            <label className="pp-inline-label">X</label>
            <NumericTextBoxComponent
              value={properties.offsetX}
              format="n0"
              step={10}
              showSpinButton={true}
              change={(args) => handlePropertyUpdate('offsetX', args.value)}
              width="100%"
            />
          </div>

          <div className="pp-inline-field">
            <label className="pp-inline-label">Y</label>
            <NumericTextBoxComponent
              value={properties.offsetY}
              format="n0"
              step={10}
              showSpinButton={true}
              change={(args) => handlePropertyUpdate('offsetY', args.value)}
              width="100%"
            />
          </div>
        </div>

        {/* Row 2: W | H */}
        <div className="pp-grid-2" style={{ marginTop: "8px" }}>
          <div className="pp-inline-field">
            <label className="pp-inline-label">W</label>
            <NumericTextBoxComponent
              value={properties.width}
              min={10}
              format="n0"
              step={10}
              showSpinButton={true}
              change={(args) => handlePropertyUpdate('width', args.value)}
              width="100%"
            />
          </div>

          <div className="pp-inline-field">
            <label className="pp-inline-label">H</label>
            <NumericTextBoxComponent
              value={properties.height}
              min={10}
              format="n0"
              step={10}
              showSpinButton={true}
              change={(args) => handlePropertyUpdate('height', args.value)}
              width="100%"
            />
          </div>
        </div>

        {/* Row 3: R | AR */}
        <div className="pp-grid-2" style={{ marginTop: "8px" }}>
          <div className="pp-inline-field">
            <label className="pp-inline-label">R</label>
            <NumericTextBoxComponent
              value={properties.rotateAngle}
              min={0}
              max={360}
              format="n0"
              step={15}
              showSpinButton={true}
              change={(args) => handlePropertyUpdate('rotateAngle', args.value)}
              width="100%"
            />
          </div>

          <div className="pp-inline-button">
            <ButtonComponent
              id="aspectRatioBtn"
             cssClass={(properties as any)?.aspectRatio ? 'e-outline e-active' : 'e-outline'}
              iconCss={(properties as any)?.aspectRatio ? 'e-icons e-lock' : 'e-icons e-unlock'}
              isToggle={true}
              onClick={() => handlePropertyUpdate('aspectRatio', !((properties as any)?.aspectRatio))}
            />
          </div>
        </div>

        <div className="db-prop-separator" />

        {/* Insert */}
        <div className="pp-subheader">Insert</div>
        <div className="pp-row pp-insertlink">
          <ButtonComponent
            id="insertHyperlink"
            cssClass="e-outline"
            iconCss="e-icons e-link"
            content="Insert Link"
            onClick={onOpenInsertLink}
            disabled={selectedItem?.type !== 'node'}
            style={{ textTransform: 'none', color: '#0b66ff', borderColor: '#0b66ff', borderRadius: '4px' }}
          />
        </div>

        <div className="db-prop-separator" />

        {/* Background Type */}
        <div className="pp-subheader">Background Type</div>
        <div className="pp-grid pp-grid-2">
          {/* Type (Solid | Gradient) */}
          <div className="pp-field">
            <DropDownListComponent
              dataSource={[
                { text: 'Solid', value: 'Solid' },
                { text: 'Gradient', value: 'Gradient' }
              ]}
              fields={{ text: 'text', value: 'value' }}
              value={showGradient ? 'Gradient' : 'Solid'}
              change={(args: any) => {
                const isGrad = args.value === 'Gradient';
                setShowGradient(isGrad);
                // When switching to solid, clear gradient and apply solid fill
                if (!isGrad) {
                  onPropertyChange({ isGradient: false, fillColor: properties.fillColor });
                  setProperties({ ...properties, isGradient: false });
                } else {
                  // When switching to gradient, set isGradient: true and gradientColor
                  handlePropertyUpdate('isGradient', isGrad);
                }
              }}
              width="100%"
            />
          </div>

          {/* Stop 1 Color / Solid Color */}
          <div className="pp-field" style={{ paddingLeft: '10px' }}>
            <ColorPickerComponent
              key={`fill-${properties.id}-${properties.fillColor}`}
              value={properties.fillColor || '#ffffff'}
              change={(args) => handlePropertyUpdate('fillColor', args.currentValue.hex)}
              mode="Palette"
              showButtons={false}
            />
          </div>
        </div>


        {/* Gradient Direction (only when gradient) */}
        {showGradient ? (<div className="pp-subheader">Gradient Style</div>) : null}
        <div className="pp-grid pp-grid-2">
          <div className="pp-field">
            {showGradient ? (
              <DropDownListComponent
                dataSource={[
                  { text: 'Bottom to Top', value: 'BottomToTop' },
                  { text: 'Top to Bottom', value: 'TopToBottom' },
                  { text: 'Right to Left', value: 'RightToLeft' },
                  { text: 'Left to Right', value: 'LeftToRight' }
                ]}
                fields={{ text: 'text', value: 'value' }}
                value={properties.gradientDirection}
                change={(args) => handlePropertyUpdate('gradientDirection', args.value)}
                width="100%"
              />
            ) : null}
          </div>

          {/* Stop 2 Color (only when gradient) */}
          <div className="pp-field" style={{ paddingLeft: '10px' }}>
            {showGradient ? (
              <ColorPickerComponent
                value={properties.gradientColor}
                change={(args) => handlePropertyUpdate('gradientColor', args.currentValue.hex)}
                mode="Palette"
                showButtons={false}
              />
            ) : null}
          </div>
        </div>

        {/* Border Type */}
        <div className="pp-subheader">Border Type</div>
        <div className="pp-grid pp-grid-2">
          <div className="pp-field">
            <DropDownListComponent
              dataSource={strokeStyles}
              fields={{ text: 'text', value: 'value' }}
              value={properties.borderDashArray}
              change={(args) => handlePropertyUpdate('borderDashArray', args.value)}
              itemTemplate={lineItemTemplate}
              valueTemplate={lineValueTemplate}
              width="100%"
              popupWidth={"160px"}
            />
          </div>

          <div className="pp-field" style={{ paddingLeft: '10px' }}>
            <ColorPickerComponent
              key={`stroke-${properties.id}-${properties.strokeColor}`}
              value={properties.strokeColor || '#000000ff'}
              change={(args) => handlePropertyUpdate('strokeColor', args.currentValue.hex)}
              mode="Palette"
              showButtons={false}
            />
          </div>

          {/* Spacer to keep 3-column structure visually identical to reference */}
          <div className="pp-field" />
        </div>

        {/* Thickness */}
        <div className="pp-subheader">Thickness</div>
        <div className="pp-grid pp-grid-2">
          <div className="pp-field">
            <NumericTextBoxComponent
              value={properties.strokeWidth}
              format="n2"
              min={0}
              max={20}
              step={1}
              showSpinButton={true}
              change={(args) => handlePropertyUpdate('strokeWidth', args.value)}
              width="100%"
            />
          </div>
        </div>

        {/* Opacity (shape) */}
        <div className="pp-row pp-slider-row">
          <div className="pp-label">Opacity</div>
          <SliderComponent
            value={(properties.opacity || 1) * 100}
            min={0}
            max={100}
            step={10}
            type="MinRange"
            showButtons={false}
            tooltip={{ isVisible: true }}
            change={(args) => handlePropertyUpdate('opacity', (args.value || 100) / 100)}
            width="100%"
          />
          <span className="db-opacity-text">{Math.round((properties.opacity || 1) * 100)}</span>
        </div>

        {/* Text (only when annotation exists) */}
        {hasAnnotation && (
          <>
            <div className="db-prop-separator" />
            <div className="pp-subheader">Text</div>

            {/* Row: Font family | Font size */}
            <div className="pp-grid pp-grid-2">
              <div className="pp-field">
                <DropDownListComponent
                  dataSource={fontFamilies}
                  fields={{ text: 'text', value: 'value' }}
                  value={properties.fontFamily || 'Arial'}
                  change={(args) => handlePropertyUpdate('fontFamily', args.value)}
                  width="100%"
                />
              </div>
              <div className="pp-field">
                <NumericTextBoxComponent
                  value={properties.fontSize}
                  format="n2"
                  min={8}
                  max={72}
                  step={2}
                  showSpinButton={true}
                  change={(args) => handlePropertyUpdate('fontSize', args.value)}
                  width="100%"
                />
              </div>
            </div>

            {/* Row: Alignment dropdown | Color */}
            <div className="pp-grid pp-grid-2" style={{ marginTop: '6px' }}>
              <div className="pp-field">
                <DropDownListComponent
                  dataSource={['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'Center', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight']}
                  value={properties.textAlign || 'Center'}
                  change={(args) => textPropertyChange('textAlign', args.value)}
                  width="100%"
                />
              </div>
              <div className="pp-field">
                <ColorPickerComponent
                  key={`fontColor-${properties.id}-${properties.fontColor}`}
                  value={normalizeColorForPicker(properties.fontColor || '#000000')}
                  change={(args) => handlePropertyUpdate('fontColor', args.currentValue.hex)}
                  mode="Palette"
                  showButtons={false}
                />
              </div>
            </div>

            {/* Row: Bold / Italic / Underline + paragraph alignment toolbar */}
            <div className="pp-row pp-toolbar">
              <div className="pp-btn-group">
                <ButtonComponent
                  cssClass={properties.bold ? 'e-flat e-active' : 'e-flat'}
                  content="B"
                  onClick={() => handlePropertyUpdate('bold', !properties.bold)}
                  style={{ fontWeight: 'bold', minWidth: '32px' }}
                />
                <ButtonComponent
                  cssClass={properties.italic ? 'e-flat e-active' : 'e-flat'}
                  content="I"
                  onClick={() => handlePropertyUpdate('italic', !properties.italic)}
                  style={{ fontStyle: 'italic', minWidth: '32px' }}
                />
                <ButtonComponent
                  cssClass={properties.underline ? 'e-flat e-active' : 'e-flat'}
                  content="U"
                  onClick={() => handlePropertyUpdate('underline', !properties.underline)}
                  style={{ textDecoration: 'underline', minWidth: '32px' }}
                />
              </div>

              {/* Presentational paragraph alignment group (no new behavior) */}
              <div className="pp-btn-group" style={{ paddingLeft: "50px" }}>
                <ButtonComponent
                  cssClass="e-flat"
                  iconCss="e-icons e-align-left"
                  onClick={(event) => toolbarTextSubAlignChange('textposition', 'left')}
                />
                <ButtonComponent
                  cssClass="e-flat"
                  iconCss="e-icons e-align-center"
                  onClick={(event) => toolbarTextSubAlignChange('textposition', 'center')}
                />
                <ButtonComponent
                  cssClass="e-flat"
                  iconCss="e-icons e-align-right"
                  onClick={(event) => toolbarTextSubAlignChange('textposition', 'right')}
                />
              </div>
            </div>

            {/* Text opacity */}
            <div className="pp-row pp-slider-row" style={{ paddingBottom: '15px' }}>
              <div className="pp-label">Opacity</div>
              <SliderComponent
                value={(properties.textOpacity || 1) * 100}
                min={0}
                max={100}
                step={10}
                type="MinRange"
                showButtons={false}
                tooltip={{ isVisible: true }}
                change={(args) => handlePropertyUpdate('textOpacity', (args.value || 100) / 100)}
                width="100%"
              />
              <span className="db-opacity-text">{Math.round((properties.textOpacity || 1) * 100)}</span>

            </div>
          </>
        )}
      </div>

      {/* Insert Link Dialog (unchanged) */}
      <DialogComponent
        id="hyperlinkDialog"
        ref={insertDialogRef}
        header="Insert Link"
        isModal={true}
        target="body"
        animationSettings={dialogAnimation}
        buttons={hyperlinkButtons}
        showCloseIcon={true}
        width="400px"
        visible={isLinkDialogOpen}
      >
        <div
          id="hyperlinkDialogContent"
        >
          <div className="row">Enter URL</div>
          <div className="row db-dialog-child-prop-row">
            <input
              id="hyperlink"
              type="text"
              ref={hyperlinkUrlInputRef}
              defaultValue=""
            />
          </div>

          <div className="row db-dialog-prop-row" style={{ marginTop: 8 }}>
            <div className="row">Link Text (Optional)</div>
            <div className="row db-dialog-child-prop-row">
              <input
                id="hyperlinkText"
                type="text"
                ref={hyperlinkTextInputRef}
                defaultValue=""
              />
            </div>
          </div>
        </div>
      </DialogComponent>
    </div>
  );

};