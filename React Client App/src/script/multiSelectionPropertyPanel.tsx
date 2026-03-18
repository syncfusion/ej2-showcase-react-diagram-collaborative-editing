/**
 * MultiSelectionPropertyPanel Component
 * Property editor for multiple selected nodes and/or connectors
 * Shows only common properties applicable to all selected items
 * 
 * Features:
 * - Fill color (nodes only)
 * - Stroke color (both nodes and connectors)
 * - Stroke width/thickness
 * - Opacity
 */

import { useState, useEffect } from 'react';
import { NumericTextBoxComponent, SliderComponent, ColorPickerComponent } from '@syncfusion/ej2-react-inputs';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { strokeStyles, lineItemTemplate, lineValueTemplate } from './connectorPropertyPanel';
import type { NodeModel, ConnectorModel } from '@syncfusion/ej2-react-diagrams';
import React from 'react';

// Font families list (used by the Font dropdown)
const fontFamilies = [
    { text: 'Arial', value: 'Arial' },
    { text: 'Times New Roman', value: 'Times New Roman' },
    { text: 'Courier New', value: 'Courier New' },
    { text: 'Verdana', value: 'Verdana' },
    { text: 'Georgia', value: 'Georgia' }
];

// Normalize a couple of common CSS color names to hex for the ColorPicker display
const normalizeColorForPicker = (c?: string, fallback = '#000000') => {
    if (!c) return fallback;
    const v = String(c).toLowerCase().trim();
    if (v === 'black') return '#000000';
    if (v === 'blue') return '#0000ff';
    return c;
};

interface MultiSelectionPropertyPanelProps {
    selectedNodes: NodeModel[];
    selectedConnectors: ConnectorModel[];
    onPropertyChange: (properties: any) => void;
}

interface CommonProperties {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeDashArray?: string;
    opacity?: number;
    // Text properties
    fontSize?: number;
    fontFamily?: string;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    textOpacity?: number;
    // Flags
    hasNodes: boolean;
    hasConnectors: boolean;
    hasAnnotations: boolean;
    totalCount: number;
}

export const MultiSelectionPropertyPanel = ({
    selectedNodes,
    selectedConnectors,
    onPropertyChange
}: MultiSelectionPropertyPanelProps) => {
    const [properties, setProperties] = useState<CommonProperties | null>(null);

    useEffect(() => {
        const nodes = selectedNodes || [];
        const connectors = selectedConnectors || [];
        const totalCount = nodes.length + connectors.length;

        if (totalCount === 0) {
            setProperties(null);
            return;
        }

        // Extract common properties from selected items
        const hasNodes = nodes.length > 0;
        const hasConnectors = connectors.length > 0;

        // Get average/first values for common properties
        let fillColor = '#ffffff';
        let strokeColor = '#000000';
        let strokeWidth = 1;
        let strokeDashArray = '';
        let opacity = 1;
        let fontSize = 12;
        let fontFamily = 'Arial';
        let fontColor = '#000000';
        let bold = false;
        let italic = false;
        let underline = false;
        let textOpacity = 1;
        let hasAnnotations = false;

        // Get properties from first node if any nodes selected
        if (hasNodes && nodes[0]) {
            const firstNode = nodes[0] as any;
            fillColor = firstNode.style?.fill || '#ffffff';
            strokeColor = firstNode.style?.strokeColor || '#000000';
            strokeWidth = firstNode.style?.strokeWidth || 1;
            strokeDashArray = firstNode.style?.strokeDashArray || 'None';
            opacity = firstNode.style?.opacity !== undefined ? firstNode.style.opacity : 1;

            // Text properties from annotations
            if (firstNode.annotations && firstNode.annotations.length > 0) {
                hasAnnotations = true;
                const annotation = firstNode.annotations[0] as any;
                fontSize = annotation.style?.fontSize || 12;
                fontFamily = annotation.style?.fontFamily || 'Arial';
                fontColor = annotation.style?.color || '#000000';
                bold = annotation.style?.bold || false;
                italic = annotation.style?.italic || false;
                underline = annotation.style?.textDecoration === 'Underline' || false;
                textOpacity = annotation.style?.opacity !== undefined ? annotation.style.opacity : 1;
            }
        }
        // If only connectors, get stroke properties from first connector
        else if (hasConnectors && connectors[0]) {
            const firstConnector = connectors[0] as any;
            strokeColor = firstConnector.style?.strokeColor || '#000000';
            strokeWidth = firstConnector.style?.strokeWidth || 1;
            strokeDashArray = firstConnector.style?.strokeDashArray || '';
            opacity = firstConnector.style?.opacity !== undefined ? firstConnector.style.opacity : 1;

            // Text properties from connector annotations
            if (firstConnector.annotations && firstConnector.annotations.length > 0) {
                hasAnnotations = true;
                const annotation = firstConnector.annotations[0] as any;
                fontSize = annotation.style?.fontSize || 12;
                fontFamily = annotation.style?.fontFamily || 'Arial';
                fontColor = annotation.style?.color || '#000000';
                bold = annotation.style?.bold || false;
                italic = annotation.style?.italic || false;
                underline = annotation.style?.textDecoration === 'Underline' || false;
                textOpacity = annotation.style?.opacity !== undefined ? annotation.style.opacity : 1;
            }
        }

        setProperties({
            fillColor,
            strokeColor,
            strokeWidth,
            strokeDashArray,
            opacity,
            fontSize,
            fontFamily,
            fontColor,
            bold,
            italic,
            underline,
            textOpacity,
            hasNodes,
            hasConnectors,
            hasAnnotations,
            totalCount
        });
    }, [selectedNodes, selectedConnectors]);

    const handlePropertyUpdate = (key: keyof CommonProperties, value: any) => {
        if (properties) {
            const updatedProps = { ...properties, [key]: value };
            setProperties(updatedProps);
            // If the border type (strokeDashArray) changed, emit both node and connector keys
            if (key === 'strokeDashArray') {
                onPropertyChange({ borderDashArray: value, strokeDashArray: value });
            } else {
                onPropertyChange({ [key]: value });
            }
        }
    };

    if (!properties) {
        return (
            <div className="db-connector-panel-container">
                <div className="db-no-selection">
                    <h3 className="db-no-selection-text">No items selected</h3>
                    <p className="db-no-selection-subtext">Select items to edit properties</p>
                </div>
            </div>
        );
    }

    return (
        <div id="multi-selection-property-panel-container" className="db-connector-panel-container">

            {/* Border Type + Stroke Color (same row) */}
            <div className="db-prop-group">
                <div className="db-two-column-row">
                    <div className="db-col">
                        <label className="db-prop-label">Border Type</label>
                        <DropDownListComponent
                            dataSource={strokeStyles}
                            fields={{ text: 'text', value: 'value' }}
                            value={properties.strokeDashArray || ''}
                            change={(changeEvent) => handlePropertyUpdate('strokeDashArray', changeEvent.value)}
                            width="100%"
                            itemTemplate={lineItemTemplate}
                            valueTemplate={lineValueTemplate}
                        />
                    </div>
                    <div className="db-col-sm">
                        <label className="db-prop-label">Stroke Color</label>
                            <ColorPickerComponent
                                value={normalizeColorForPicker(properties.strokeColor || '#000000')}
                                change={(colorChangeEvent) => handlePropertyUpdate('strokeColor', colorChangeEvent.currentValue.hex)}
                                mode="Palette"
                                showButtons={false}
                            />
                    </div>
                </div>
            </div>

            {/* Fill Color - Only for nodes */}
            {properties.hasNodes && (
                <div className="db-prop-group">
                    <label className="db-prop-label">Fill Color</label>
                    <ColorPickerComponent
                        value={normalizeColorForPicker(properties.fillColor || '#ffffff')}
                        change={(colorChangeEvent) => handlePropertyUpdate('fillColor', colorChangeEvent.currentValue.hex)}
                        mode="Palette"
                        showButtons={false}
                    />
                </div>
            )}


            {/* Stroke Width */}
            <div className="db-prop-group">
                <label className="db-prop-label">Stroke Width</label>
                <div className="db-slider-container">
                    <SliderComponent
                        value={properties.strokeWidth || 1}
                        min={0}
                        max={10}
                        step={0.5}
                        type="MinRange"
                        showButtons={false}
                        tooltip={{ isVisible: true, showOn: 'Hover' }}
                        change={(numberChangeEvent) => handlePropertyUpdate('strokeWidth', numberChangeEvent.value)}
                        width="100%"
                    />
                    <span className="db-value-display">{properties.strokeWidth?.toFixed(1) || '1.0'}</span>
                </div>
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
                        tooltip={{ isVisible: true, showOn: 'Hover' }}
                        change={(sliderChangeEvent) => handlePropertyUpdate('opacity', (sliderChangeEvent.value || 100) / 100)}
                        width="100%"
                    />
                    <span className="db-value-display">{Math.round((properties.opacity || 1) * 100)}%</span>
                </div>
            </div>

            {/* ==================== TEXT PROPERTIES (CONDITIONAL) ==================== */}
            {properties.hasAnnotations && (
                <>
                    <div className="db-section-divider">
                        <span className="db-section-title">Text</span>
                    </div>

                    {/* Font Family and Size */}
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

                    {/* Font Color */}
                    <div className="db-prop-group">
                        <label className="db-prop-label">Font Color</label>
                        <ColorPickerComponent
                            value={normalizeColorForPicker(properties.fontColor || '#000000')}
                            change={(colorChangeEvent) => handlePropertyUpdate('fontColor', colorChangeEvent.currentValue.hex)}
                            mode="Palette"
                            showButtons={false}
                        />
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
                                tooltip={{ isVisible: true, showOn: 'Hover' }}
                                change={(sliderChangeEvent) => handlePropertyUpdate('textOpacity', (sliderChangeEvent.value || 100) / 100)}
                                width="100%"
                            />
                            <span className="db-value-display">{Math.round((properties.textOpacity || 1) * 100)}%</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};