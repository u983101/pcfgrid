# Power Platform PCF Canvas Dataset Component Development Guide

This document summarizes the architectural patterns and implementation details for building high-quality dataset components for Power Apps Canvas apps, based on Microsoft tutorials and the `jj-readonlysubgrid` reference.

## 1. Architecture Overview

The recommended architecture follows a decoupled pattern:
- **PCF Bridge (`index.ts`)**: Handles the PCF lifecycle (`init`, `updateView`, `destroy`) and interacts with the Power Platform host.
- **Logic Layer (`gridLogic.ts`)**: Pure, framework-agnostic TypeScript functions for computing sorts, filters, groups, and sizing.
- **UI Layer (`Component.tsx`)**: A React functional component using Microsoft Fluent UI for rendering.

## 2. Implementation Details

### A. Project Initialization
- Initialize using: `pac pcf init -n <Name> -ns <Namespace> -t dataset -fw react -npm`
- Essential Dependencies: `react`, `react-dom`, `@fluentui/react`.

### B. Manifest Configuration (`ControlManifest.Input.xml`)
- **Dataset**: Define the `<data-set>` and any required `<property-set>` for binding specific columns.
- **Input Properties**: Provide properties for styling (colors, highlight values) to allow app makers to customize the look.
- **Output Properties**: Define properties (e.g., `FilteredRecordCount`) to communicate state back to the Canvas app.

### C. Logic Layer Patterns
- **Client-Side Filtering**: Implement a case-insensitive "contains" filter using a logical AND across all active filters. Operate on formatted values to match user expectations.
- **Grouping**: 
    - Sort items by the group column using `localeCompare`.
    - Generate group metadata (`startIndex`, `count`) for the UI layer.
- **Sizing**: 
    - Use `context.mode.trackContainerResize(true)`.
    - Compute outer height based on `allocatedHeight` and a calculated natural height (header + rows + footer).

### D. UI Layer Patterns
- **Fluent UI `DetailsList`**: Use for grid rendering.
- **Performance**: 
    - Use path-based imports (e.g., `@fluentui/react/lib/DetailsList`) to reduce bundle size.
    - Wrap the component in `React.memo` and use `useMemo` for expensive computations (like column mapping).
- **Interactions**:
    - **Selection**: Use `setSelectedRecordIds` to sync selection back to the app.
    - **Navigation**: Use `openDatasetItem` to trigger the `OnSelect` event.

### E. Robustness & Best Practices
- **Defensive Data Handling**: Wrap individual record/column reads in try-catch blocks to prevent a single malformed record from blanking the entire grid.
- **Lookup Resolution**: Create a robust walker to extract `id` and `entityName` from various lookup shapes (EntityReference, PartyList, etc.).
- **Localization**: Use `.resx` files for all labels to support multi-language environments.

## 3. Development Workflow
1. **Initialize** project and install dependencies.
2. **Define** manifest properties.
3. **Implement** pure logic functions.
4. **Build** the React UI component.
5. **Wire** everything together in `index.ts`.
6. **Verify** using the PCF test harness with CSV data.
