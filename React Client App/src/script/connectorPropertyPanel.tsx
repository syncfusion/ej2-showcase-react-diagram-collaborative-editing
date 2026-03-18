/**
 * ConnectorPropertyPanel Component
 * Context-sensitive property editor for selected diagram connectors
 * 
 * Features:
 * - Connector-level properties: type, stroke, thickness, bridging, opacity, decorators
 * - Annotation properties (conditionally shown only if annotations exist)
 * - Real-time two-way data binding with diagram
 */

import { useState, useEffect } from 'react';
import { NumericTextBoxComponent, SliderComponent, ColorPickerComponent } from '@syncfusion/ej2-react-inputs';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { ButtonComponent, CheckBoxComponent } from '@syncfusion/ej2-react-buttons';
import type { ConnectorProperties, SelectedConnectorItem } from './diagramTypes';
import React from 'react';
import { AnnotationAlignment, Diagram } from '@syncfusion/ej2-react-diagrams';

// Normalize a couple of common CSS color names to hex for the ColorPicker display
const normalizeColorForPicker = (c?: string, fallback = '#000000') => {
  if (!c) return fallback;
  const v = String(c).toLowerCase().trim();
  if (v === 'black') return '#000000';
  if (v === 'blue') return '#0000ff';
  return c;
};

interface ConnectorPropertyPanelProps {
  selectedConnector: SelectedConnectorItem;
  onPropertyChange: (properties: Partial<ConnectorProperties>) => void;
}

function getDiagramById(elementId: string): Diagram | null {
  const hostElement = document.getElementById(elementId) as any;
  return (hostElement?.ej2_instances?.[0] ?? null) as Diagram | null;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function updateHorizontalVerticalAlign(annotation: any) {
  if (!annotation.horizontalAlignment) {
    annotation.horizontalAlignment = 'Center';
  }
  if (!annotation.verticalAlignment) {
    annotation.verticalAlignment = 'Center';
  }
}

function getOffsetForPosition(position: string) {
  switch (position.toLowerCase()) {
    case 'topleft':
      return { x: 0, y: 0 };
    case 'topcenter':
      return { x: 0.5, y: 0 };
    case 'topright':
      return { x: 1, y: 0 };
    case 'middleleft':
      return { x: 0, y: 0.5 };
    case 'middleright':
      return { x: 1, y: 0.5 };
    case 'bottomleft':
      return { x: 0, y: 1 };
    case 'bottomcenter':
      return { x: 0.5, y: 1 };
    case 'bottomright':
      return { x: 1, y: 1 };
    case 'center':
    default:
      return { x: 0.5, y: 0.5 };
  }
}

const handleToolbarTextSubAlignChange = (propertyName: string, propertyValue: string) => {
  textPropertyChange(propertyName, propertyValue);
};

export function textPropertyChange(propertyName: string, propertyValue: string) {
  const diagramInstance = getDiagramById('diagram');

  const selectedObjects = [
    ...(diagramInstance?.selectedItems.nodes || []),
    ...(diagramInstance?.selectedItems.connectors || [])
  ];

  if (selectedObjects.length === 0) {
    return;
  }

  const propertyKeyLower = propertyName.toLowerCase();

  for (const diagramObject of selectedObjects) {
    const annotations = diagramObject.annotations || [];

    annotations.forEach((annotation: any) => {
      // Text position (offset / alignment)
      if (propertyKeyLower === 'textposition') {
        if (annotation.offset) {
          annotation.offset = getOffsetForPosition(propertyValue);
        }
        if (annotation.alignment) {
          annotation.alignment = propertyValue as AnnotationAlignment;
        }
      }

      if (propertyKeyLower === 'textalign') {
        annotation.alignment = propertyValue as AnnotationAlignment;
      }

      // Horizontal alignment
      if (propertyKeyLower === 'left' || propertyKeyLower === 'center' || propertyKeyLower === 'right') {
        annotation.horizontalAlignment = capitalize(propertyName);
        updateHorizontalVerticalAlign(annotation);
      }

      // Vertical alignment
      else if (propertyKeyLower === 'top' || propertyKeyLower === 'middle' || propertyKeyLower === 'bottom') {
        annotation.verticalAlignment = propertyValue === 'middle' ? 'Center' : capitalize(propertyValue);
        updateHorizontalVerticalAlign(annotation);
      }
    });
  }

  diagramInstance?.dataBind();
}

export const strokeStyles = [
  { text: 'None', value: 'None', className: 'ddl-svg-style ddl_linestyle_none' },
  { text: '1,2', value: '1,2', className: 'ddl-svg-style ddl_linestyle_one_two' },
  { text: '3,3', value: '3,3', className: 'ddl-svg-style ddl_linestyle_three_three' },
  { text: '5,3', value: '5,3', className: 'ddl-svg-style ddl_linestyle_five_three' },
  { text: '4,4,1', value: '4,4,1', className: 'ddl-svg-style ddl_linestyle_four_four_one' }
];
export const lineItemTemplate = (data: any) => {
  return (
    <div
      className="db-ddl-template-style"
    >
      <span
        className={data.className}
      />
    </div>
  );
};

export const lineValueTemplate = (data: any) => {
  // Render inline to match DropDownList value alignment
  return (
    <span
      className="db-ddl-template-style db-ddl-value-inline"
    >
      <span
        className={data.className}
      />
    </span>
  );
};
export const ConnectorPropertyPanel = ({ selectedConnector, onPropertyChange }: ConnectorPropertyPanelProps) => {
  const [properties, setProperties] = useState<ConnectorProperties | null>(null);
  const [sourceDecoratorType, setSourceDecoratorType] = useState<string>('None');
  const [targetDecoratorType, setTargetDecoratorType] = useState<string>('Arrow');
  const [hasAnnotation, setHasAnnotation] = useState<boolean>(false);

  useEffect(() => {
    // Check if selected item is a connector
    if (!selectedConnector || selectedConnector.type !== 'connector') {
      setProperties(null);
      setHasAnnotation(false);
      return;
    }

    const connector = selectedConnector.connector as any;

    // Determine decorator types from decorator shape
    const sourceDecType = connector.sourceDecorator?.shape || 'None';
    const targetDecType = connector.targetDecorator?.shape || 'None';

    setSourceDecoratorType(sourceDecType);
    setTargetDecoratorType(targetDecType);

    // Check if connector has annotations
    const hasAnnotations = connector.annotations && connector.annotations.length > 0;
    setHasAnnotation(hasAnnotations);

    // Build connector properties from the connector object
    const connectorProps: ConnectorProperties = {
      id: connector.id || '',
      connectorType: connector.type || 'Straight',
      strokeColor: connector.style?.strokeColor || '#424242',
      strokeWidth: connector.style?.strokeWidth || 2,
      strokeDashArray: connector.style?.strokeDashArray || 'None',
      startArrowSize: connector.sourceDecorator?.width || 0,
      endArrowSize: connector.targetDecorator?.width || 10,
      bridging: connector.bridgeSpace !== undefined ? connector.bridgeSpace > 0 : false,
      opacity: connector.style?.opacity !== undefined ? connector.style.opacity : 1,
      text: connector.annotations?.[0]?.content || '',
      fontSize: connector.annotations?.[0]?.style?.fontSize || 12,
      fontFamily: connector.annotations?.[0]?.style?.fontFamily || 'Arial',
      fontColor: connector.annotations?.[0]?.style?.color || '#000000',
      textAlign: connector.annotations?.[0]?.style?.textAlign || 'Center',
      bold: connector.annotations?.[0]?.style?.bold || false,
      italic: connector.annotations?.[0]?.style?.italic || false,
      underline: connector.annotations?.[0]?.style?.textDecoration === 'Underline',
      textOpacity: connector.annotations?.[0]?.style?.opacity !== undefined
        ? connector.annotations[0].style.opacity
        : 1,
      sourceID: '',
      targetID: '',
      type: ''
    };

    setProperties(connectorProps);
  }, [selectedConnector]);

  const handlePropertyUpdate = (key: keyof ConnectorProperties, value: any) => {
    if (properties) {
      const updatedProps = { ...properties, [key]: value };
      setProperties(updatedProps);
      onPropertyChange({ [key]: value });
    }
  };
  const connectorTypes = [
    { text: 'Straight', value: 'Straight' },
    { text: 'Orthogonal', value: 'Orthogonal' },
    { text: 'Bezier', value: 'Bezier' },
  ];
  // Handle source/target decorator type changes
  const handleDecoratorTypeChange = (position: 'source' | 'target', type: string) => {
    if (position === 'source') {
      setSourceDecoratorType(type);
      onPropertyChange({
        sourceDecorator: type as 'None' | 'Arrow' | 'Circle' | 'Diamond' | 'OpenArrow' | 'Square' | 'DoubleArrow',
        startArrowSize: type === 'None' ? 0 : (properties?.startArrowSize || 10)
      });
    } else {
      setTargetDecoratorType(type);
      onPropertyChange({
        targetDecorator: type as 'None' | 'Arrow' | 'Circle' | 'Diamond' | 'OpenArrow' | 'Square' | 'DoubleArrow',
        endArrowSize: type === 'None' ? 0 : (properties?.endArrowSize || 10)
      });
    }
  };

  // Decorator shape options (matching your screenshot)
  const decoratorTypes = [
    { text: 'None', value: 'None' },
    { text: 'Arrow', value: 'Arrow' },
    { text: 'Circle', value: 'Circle' },
    { text: 'Diamond', value: 'Diamond' },
    { text: 'OpenArrow', value: 'OpenArrow' },
    { text: 'Square', value: 'Square' },
    { text: 'DoubleArrow', value: 'DoubleArrow' }
  ];

  const fontFamilies = [
    { text: 'Arial', value: 'Arial' },
    { text: 'Times New Roman', value: 'Times New Roman' },
    { text: 'Courier New', value: 'Courier New' },
    { text: 'Verdana', value: 'Verdana' },
    { text: 'Georgia', value: 'Georgia' }
  ];

  const annotationAlignmentOptions = [
    { text: 'Before', value: 'Before' },
    { text: 'Center', value: 'Center' },
    { text: 'After', value: 'After' }
  ];

  if (!properties) {
    return (
      <div className="db-connector-panel-container">
        <div className="db-no-selection">
          <h3 className="db-no-selection-text">No connector selected</h3>
          <p className="db-no-selection-subtext">Select a connector to edit its properties</p>
        </div>
      </div>
    );
  }

  return (
    <div id="connector-property-panel-container" className="db-connector-panel-container">
      <div className="db-connector-content">
        {/* ==================== CONNECTOR-LEVEL PROPERTIES ==================== */}
      <div className="db-connector-header">
        <h3 className="db-connector-header-title">Connector Properties</h3>
      </div>
        {/* Connector Type and Stroke Color - Side by Side */}
        <div className="db-prop-group">
          <div className="db-two-column-row">
            <div className="db-col">
              <label className="db-prop-label">Connector Type</label>
              <DropDownListComponent
                dataSource={connectorTypes}
                fields={{ text: 'text', value: 'value' }}
                value={properties.connectorType || 'Straight'}
                change={(changeEvent) => handlePropertyUpdate('connectorType', changeEvent.value)}
                width="100%"
              />
            </div>
            <div className="db-col-sm">
              <label className="db-prop-label">Stroke Color</label>
              <ColorPickerComponent
                value={normalizeColorForPicker(properties.strokeColor || '#424242')}
                change={(colorChangeEvent) => handlePropertyUpdate('strokeColor', colorChangeEvent.currentValue.hex)}
                mode="Palette"
                showButtons={false}
              />
            </div>
          </div>
        </div>

        {/* Stroke Style and Thickness - Side by Side */}
        <div className="db-prop-group">
          <div className="db-two-column-row">
            <div className="db-col">
              <label className="db-prop-label">Stroke Style</label>
              <DropDownListComponent
                dataSource={strokeStyles}
                fields={{ text: 'text', value: 'value' }}
                value={properties.strokeDashArray || 'None'}
                change={(changeEvent) => handlePropertyUpdate('strokeDashArray', changeEvent.value)}
                width="100%"
                itemTemplate={lineItemTemplate}
                valueTemplate={lineValueTemplate}
              />
            </div>
            <div className="db-col-sm">
              <label className="db-prop-label">Thickness</label>
              <NumericTextBoxComponent
                value={properties.strokeWidth || 2}
                format="n2"
                min={1}
                max={20}
                step={0.5}
                showSpinButton={true}
                change={(numberChangeEvent) => handlePropertyUpdate('strokeWidth', numberChangeEvent.value)}
                width="100%"
              />
            </div>
          </div>
        </div>

        {/* Start Arrow and Size - Side by Side */}
        <div className="db-prop-group">
          <div className="db-two-column-row">
            <div className="db-col">
              <label className="db-prop-label">Start Arrow</label>
              <DropDownListComponent
                dataSource={decoratorTypes}
                fields={{ text: 'text', value: 'value' }}
                value={sourceDecoratorType || 'None'}
                change={(changeEvent) => handleDecoratorTypeChange('source', changeEvent.value)}
                width="100%"
              />
            </div>
            <div className="db-col">
              <label className="db-prop-label">Size</label>
              <NumericTextBoxComponent
                value={properties.startArrowSize || 0}
                format="n2"
                min={0}
                max={30}
                step={1}
                showSpinButton={true}
                change={(numberChangeEvent) => handlePropertyUpdate('startArrowSize', numberChangeEvent.value)}
                width="100%"
                enabled={sourceDecoratorType !== 'None'}
              />
            </div>
          </div>
        </div>

        {/* End Arrow and Size - Side by Side */}
        <div className="db-prop-group">
          <div className="db-two-column-row">
            <div className="db-col">
              <label className="db-prop-label">End Arrow</label>
              <DropDownListComponent
                dataSource={decoratorTypes}
                fields={{ text: 'text', value: 'value' }}
                value={targetDecoratorType || 'Arrow'}
                change={(changeEvent) => handleDecoratorTypeChange('target', changeEvent.value)}
                width="100%"
              />
            </div>
            <div className="db-col">
              <label className="db-prop-label">Size</label>
              <NumericTextBoxComponent
                value={properties.endArrowSize || 10}
                format="n2"
                min={0}
                max={30}
                step={1}
                showSpinButton={true}
                change={(numberChangeEvent) => handlePropertyUpdate('endArrowSize', numberChangeEvent.value)}
                width="100%"
                enabled={targetDecoratorType !== 'None'}
              />
            </div>
          </div>
        </div>

        {/* Bridging */}
        <div className="db-prop-group">
          <CheckBoxComponent
            label="Bridging"
            checked={properties.bridging || false}
            change={(checkboxChangeEvent) => handlePropertyUpdate('bridging', checkboxChangeEvent.checked)}
          />
        </div>

        {/* Opacity */}
        <div className="db-prop-group">
          <label className="db-prop-label">Opacity</label>
          <div className="db-slider-container">
            <SliderComponent
              value={(properties.opacity || 1) * 100}
              min={0}
              max={100}
              step={5}
              type="MinRange"
              showButtons={false}
              tooltip={{ isVisible: false }}
              change={(sliderChangeEvent) => handlePropertyUpdate('opacity', (sliderChangeEvent.value || 100) / 100)}
              width="100%"
            />
            <span className="db-opacity-value">{Math.round((properties.opacity || 1) * 100)}</span>
          </div>
        </div>

        {/* ==================== ANNOTATION PROPERTIES (CONDITIONAL) ==================== */}
        {hasAnnotation && (
          <>
            <div className="db-section-divider">
              <span className="db-section-title">Text</span>
            </div>

            {/* Font Family, Size, and Color - Side by Side */}
            <div className="db-prop-group">
              <div className="db-two-column-row">
                <div className="db-col">
                  <label className="db-prop-label">Font</label>
                  <DropDownListComponent
                    dataSource={fontFamilies}
                    fields={{ text: 'text', value: 'value' }}
                    value={properties.fontFamily || 'Arial'}
                    change={(changeEvent) => handlePropertyUpdate('fontFamily', changeEvent.value)}
                    width="100%"
                  />
                </div>
                <div className="db-col-sm">
                  <label className="db-prop-label">Size</label>
                  <NumericTextBoxComponent
                    value={properties.fontSize || 12}
                    format="n0"
                    min={8}
                    max={72}
                    step={2}
                    showSpinButton={true}
                    change={(numberChangeEvent) => handlePropertyUpdate('fontSize', numberChangeEvent.value)}
                    width="100%"
                  />
                </div>
              </div>
            </div>

            {/* Annotation Alignment (Before / Center / After) */}
            <div className="db-prop-group">
              <div className="db-two-column-row">
                <div className="db-col">
                  <label className="db-prop-label">Alignment</label>
                  <DropDownListComponent
                    dataSource={annotationAlignmentOptions}
                    fields={{ text: 'text', value: 'value' }}
                    value={(selectedConnector.connector as any)?.annotations?.[0]?.alignment || 'Before'}
                    change={(changeEvent) => {
                      try {
                        // Use existing helper to update annotation alignment on selected items
                        textPropertyChange('textalign', changeEvent.value as string);
                      } catch (err) {
                        // eslint-disable-next-line no-console
                        console.error('Failed to change annotation alignment via textPropertyChange:', err);
                      }
                    }}
                    width="100%"
                  />
                </div>
                <div className="db-col-sm">
                  <label className="db-prop-label">Font Color</label>
                  <ColorPickerComponent
                    value={normalizeColorForPicker(properties.fontColor || '#000000')}
                    change={(colorChangeEvent) => handlePropertyUpdate('fontColor', colorChangeEvent.currentValue.hex)}
                    mode="Palette"
                    showButtons={false}
                  />
                </div>
              </div>
            </div>

            {/* Bold, Italic, Underline */}
            <div className="db-format-buttons">

              <div className="pp-btn-group db-pp-btn-group">
                <ButtonComponent
                  cssClass={`${properties.bold ? 'e-flat e-active' : 'e-flat'} db-format-btn db-format-btn-bold`}
                  content="B"
                  onClick={() => handlePropertyUpdate('bold', !properties.bold)}
                />
                <ButtonComponent
                  cssClass={`${properties.italic ? 'e-flat e-active' : 'e-flat'} db-format-btn db-format-btn-italic`}
                  content="I"
                  onClick={() => handlePropertyUpdate('italic', !properties.italic)}
                />
                <ButtonComponent
                  cssClass={`${properties.underline ? 'e-flat e-active' : 'e-flat'} db-format-btn db-format-btn-underline`}
                  content="U"
                  onClick={() => handlePropertyUpdate('underline', !properties.underline)}
                />
              </div>

              <div className="pp-btn-group db-align-btns">
                <ButtonComponent cssClass="e-flat" iconCss="e-icons e-align-left" onClick={() => handleToolbarTextSubAlignChange("left", "left")} />
                <ButtonComponent cssClass="e-flat" iconCss="e-icons e-align-center" onClick={() => handleToolbarTextSubAlignChange("center", "center")} />
                <ButtonComponent cssClass="e-flat" iconCss="e-icons e-align-right" onClick={() => handleToolbarTextSubAlignChange("right", "right")} />
              </div>
            </div>

            {/* Text Opacity */}
            <div className="db-prop-group">
              <label className="db-prop-label">Text Opacity</label>
              <div className="db-slider-container">
                <SliderComponent
                  value={(properties.textOpacity || 1) * 100}
                  min={0}
                  max={100}
                  step={5}
                  type="MinRange"
                  showButtons={false}
                  tooltip={{ isVisible: false }}
                  change={(sliderChangeEvent) => handlePropertyUpdate('textOpacity', (sliderChangeEvent.value || 100) / 100)}
                  width="100%"
                />
                <span className="db-opacity-value">{Math.round((properties.textOpacity || 1) * 100)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};