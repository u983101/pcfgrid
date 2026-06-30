# Fluent UI React for Power Platform PCF Development

## Overview

Fluent UI React is Microsoft's official open-source React front-end framework designed to build experiences that integrate seamlessly into Microsoft products including Power Apps. It provides robust, accessible components that are highly customizable through CSS-in-JS.

## Installation

```bash
# Install the core package for PCF component development
npm install @fluentui/react

# For additional packages (if needed)
npm install @fluentui/font-icons-mdl2
```

## Essential Patterns for PCF Development

### 1. Initialize Icons

Icons are not bundled by default and must be loaded before use:

```typescript
import { initializeIcons } from '@fluentui/react/lib/Icons';

// Call this at the root of your component
initializeIcons(undefined, { disableWarnings: true });
```

**Best Practice**: Always call `initializeIcons` at the entry point of your control to prevent "icon not registered" errors. The `disableWarnings` flag suppresses non-critical warnings about missing icons.

### 2. DetailsList for Data Grids

The `DetailsList` component is the primary choice for displaying tabular data:

```typescript
import {
    DetailsList,
    IColumn,
    ConstrainMode,
    DetailsListLayoutMode,
    IDetailsHeaderProps
} from '@fluentui/react/lib/DetailsList';
import { Sticky, StickyPositionType } from '@fluentui/react/lib/Sticky';

// Map your data columns to Fluent UI column definitions
const columns: IColumn[] = dataSets.columns.map(col => ({
    key: col.name,
    name: col.displayName,
    fieldName: col.name,
    width: col.visualSizeFactor > 0 ? col.visualSizeFactor : 150,
    minWidth: 50,
    isResizable: true,
    data: col,
}));

// Render the grid with sticky headers
<DetailsList
    columns={columns}
    onRenderItemColumn={onRenderItemColumn}
    onRenderDetailsHeader={onRenderDetailsHeader}
    items={items}
    layoutMode={DetailsListLayoutMode.fixedColumns}
    constrainMode={ConstrainMode.unconstrained}
    setKey="set" // Prevents selection state issues
/>
```

**Layout Modes**:
- `DetailsListLayoutMode.fixedColumns`: All columns have fixed widths (default)
- `DetailsListLayoutMode.flexible`: Columns stretch to fill available space

**Best Practices**:
1. Always specify explicit `width` and `minWidth` for columns to prevent misalignment
2. Use `setKey` to prevent selection state issues when the data changes
3. Wrap headers in `position: sticky` for scrollable grids
4. Avoid nested file type overlays that can obscure icons

### 3. Checkbox Components

For column visibility toggles and similar interactions:

```typescript
import { Checkbox } from '@fluentui/react';

// Controlled checkbox pattern
<Checkbox 
    label={col.displayName} 
    checked={isVisible} 
    onChange={(ev, checked) => {
        // Update state
        setVisibleColumns(checked);
    }}
/>
```

**Pattern Recommendation**: Use the "controlled" pattern where the checked state is managed by your component's state, allowing for external state management and integration with parent components.

### 4. Panel Component

The `Panel` component is ideal for side drawers and column selectors:

```typescript
import { Panel } from '@fluentui/react';

<Panel 
    isOpen={isOpen}
    onDismiss={() => setIsOpen(false)}
    headerText="Column Settings"
>
    <Stack tokens={{ childrenGap: 8 }}>
        {columns.map(col => (
            <Checkbox
                key={col.name}
                label={col.displayName}
                checked={visibleColumns.has(col.name)}
                onChange={(ev, checked) => toggleColumn(col.name, checked)}
            />
        ))}
    </Stack>
</Panel>
```

## Layout Components

### Stack Component

The primary layout component in Fluent UI:

```typescript
import { Stack, IStackTokens } from '@fluentui/react/lib/Stack';

const horizontalStackTokens: IStackTokens = { childrenGap: 8 };

<Stack horizontal tokens={horizontalStackTokens} style={{ padding: '8px' }}>
    <IconButton iconProps={{ iconName: 'Filter' }} />
    <Text variant="medium">Select Columns</Text>
</Stack>
```

**Key Props**:
- `horizontal`: Aligns items in a row
- `verticalFill`: Expands items to fill available height
- `tokens`: Defines spacing and margins

### ScrollablePane

```typescript
import { ScrollablePane, ScrollbarVisibility } from '@fluentui/react/lib/ScrollablePane';

<ScrollablePane scrollbarVisibility={ScrollbarVisibility.auto}>
    <DetailsList ... />
</ScrollablePane>
```

The `ScrollbarVisibility` enum controls scrollbar behavior:
- `auto`: Show scrollbars only when needed
- `visibleAlways`: Always show scrollbars
- `hidden`: Hide scrollbars completely

## Styling and CSS

### CSS-in-JS with Class-Based Approach

For PCF components, use a separate CSS file for complex styling:

```css
/* src/CanvasGrid/css/ReadOnlyGrid.css */
.show-selection-checkbox .ms-Selection-checkButton,
.show-selection-checkbox .ms-Selection-checkButton--hidden {
    visibility: visible !important;
    opacity: 1;
}
```

Then apply the class:

```typescript
<Stack.Item className="show-selection-checkbox" style={{ ... }}>
    ...
</Stack.Item>
```

This approach allows using CSS selectors that cannot be achieved with React's inline styles.

## Common Mistakes and Solutions

### Icon Errors
**Problem**: "filter" icon not registered
**Solution**: Call `initializeIcons` before using any icon components

### Column Misalignment
**Problem**: Headers don't align with data rows
**Solution**: Explicitly set `width` properties from dataset column metadata

### Selection Checkbox Hidden
**Problem**: Selection checkbox only visible on hover
**Solution**: Add CSS rule to force visibility for all rows

### Panel Layout Issues
**Problem**: Panel not displaying checkboxes properly
**Solution**: Ensure Stack tokens are correctly applied within Panel content

## Performance Optimization

### Path-Based Imports
Reduce bundle size by importing specific components:

```typescript
// ❌ Larger bundle
import { DetailsList, Stack } from '@fluentui/react';

// ✅ Smaller bundle
import { DetailsList } from '@fluentui/react/lib/DetailsList';
import { Stack } from '@fluentui/react/lib/Stack';
```

### React Optimization
- Wrap components in `React.memo()` to prevent unnecessary re-renders
- Use `useMemo` for expensive computations like column mappings
- Keep logic separate from rendering where possible

## Best Practices Summary

1. **Always initialize icons** at the component entry point
2. **Use controlled patterns** for form elements (Checkbox, Input)
3. **Specify explicit column widths** to prevent alignment issues
4. **Separate logic and rendering** when possible for testability
5. **Use path-based imports** to reduce bundle size
6. **Include `setKey`** on DetailsList to prevent state issues
7. **Apply CSS classes** for complex styling scenarios
8. **Initialize icons** in your entry point (`index.ts`) rather than in individual components

## PCF Integration Points

### Manifest Configuration
```xml
<resources>
  <code path="index.ts" order="1"/>
  <css path="css/ReadOnlyGrid.css" order="1"/>
</resources>
```

### Entry Point Pattern
```typescript
// In CanvasGrid/index.ts
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class CanvasGrid implements StandardControl<IInputs, IOutputs> {
    private root: ReactDOM.Root;

    public init(context, notifyOutputChanged, state, container) {
        this.root = ReactDOM.createRoot(container);
    }
}
```

## Resources
- Fluent UI React Documentation: https://developer.microsoft.com/en-us/fluentui
- Microsoft Fluent UI: https://github.com/microsoft/fluentui
