import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { Grid } from "./components/Grid";

export class CanvasGrid implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private root: ReactDOM.Root;
    private notifyOutputChanged: () => void;
    private displayedColumns = '';

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.container = container;
        this.root = ReactDOM.createRoot(this.container);
        context.mode.trackContainerResize(true);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        const dataset = context.parameters.sampleDataSet;
        
        const allocatedWidth = parseInt(context.mode.allocatedWidth as unknown as string) || 0;
        const allocatedHeight = parseInt(context.mode.allocatedHeight as unknown as string) || 0;

        const inputColumns = context.parameters.VisibleColumns.raw || '';

        this.root.render(
            React.createElement(Grid, {
                width: allocatedWidth,
                height: allocatedHeight,
                columns: dataset.columns,
                records: dataset.records,
                sortedRecordIds: dataset.sortedRecordIds,
                itemsLoading: dataset.loading,
                displayedColumns: inputColumns,
                setDisplayedColumns: (cols: string) => {
                    this.displayedColumns = cols;
                    this.notifyOutputChanged();
                }
            })
        );
    }

    public getOutputs(): IOutputs {
        return {
            DisplayOutput: this.displayedColumns
        };
    }

    public destroy(): void {
        this.root.unmount();
    }
}
