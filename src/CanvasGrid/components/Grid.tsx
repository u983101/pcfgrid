import * as React from 'react';
import { initializeIcons } from '@fluentui/react/lib/Icons';
import {
    DetailsList,
    IColumn,
    ConstrainMode,
    DetailsListLayoutMode,
    IDetailsHeaderProps,
    CheckboxVisibility
} from '@fluentui/react/lib/DetailsList';
import { Stack, IStackTokens } from '@fluentui/react/lib/Stack';
import { IRenderFunction } from '@fluentui/react/lib/Utilities';
import { Checkbox, IconButton, Panel } from '@fluentui/react';

initializeIcons(undefined, { disableWarnings: true });

export interface GridProps {
    width?: number;
    height?: number;
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    records: Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord>;
    sortedRecordIds: string[];
    itemsLoading: boolean;
    displayedColumns: string;
    setDisplayedColumns: (cols: string) => void;
}

const onRenderDetailsHeader: IRenderFunction<IDetailsHeaderProps> = (props, defaultRender) => {
    return defaultRender ? defaultRender(props) : null;
};

const onRenderItemColumn = (
    item?: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord,
    index?: number,
    column?: IColumn,
) => {
    if (column && column.fieldName && item) {
        return <>{item.getFormattedValue(column.fieldName)}</>;
    }
    return <></>;
};

function parseColumnString(colString: string): Set<string> {
    const result = new Set<string>();
    colString.split(',').forEach(col => {
        const trimmed = col.trim();
        if (trimmed) result.add(trimmed);
    });
    return result;
}

export const Grid = React.memo((props: GridProps) => {
    const {
        records,
        sortedRecordIds,
        columns,
        width,
        height,
        itemsLoading,
        displayedColumns,
        setDisplayedColumns,
    } = props;

    // Build initial visible columns from the input prop or default to all non-hidden columns
    const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() => {
        if (displayedColumns && displayedColumns.trim()) {
            return parseColumnString(displayedColumns);
        }
        return new Set(columns.filter(c => !c.isHidden).map(c => c.name));
    });

    // Sort state: which column and direction
    const [sortState, setSortState] = React.useState<{ name: string | null; descending: boolean }>({
        name: null,
        descending: false,
    });

    const [isPanelOpen, setIsPanelOpen] = React.useState(false);
    const prevDisplayedColumns = React.useRef(displayedColumns);

    // Sync when the input prop changes externally
    if (displayedColumns !== prevDisplayedColumns.current) {
        prevDisplayedColumns.current = displayedColumns;
        if (displayedColumns && displayedColumns.trim()) {
            const parsed = parseColumnString(displayedColumns);
            if (parsed.size > 0) {
                setVisibleColumns(parsed);
            }
        }
    }

    // Notify parent when visibleColumns changes
    const prevVisibleRef = React.useRef(visibleColumns);
    React.useEffect(() => {
        if (prevVisibleRef.current !== visibleColumns) {
            prevVisibleRef.current = visibleColumns;
            const colsArray = Array.from(visibleColumns).sort();
            setDisplayedColumns(colsArray.join(', '));
        }
    });

    const items = React.useMemo(() => {
        const rawItems = sortedRecordIds.map((id) => records[id]);
        if (!sortState.name) {
            return rawItems;
        }
        const sorted = rawItems.slice().sort((a, b) => {
            const va = (a?.getFormattedValue(sortState.name!) || '').toLowerCase();
            const vb = (b?.getFormattedValue(sortState.name!) || '').toLowerCase();
            if (va < vb) return sortState.descending ? 1 : -1;
            if (va > vb) return sortState.descending ? -1 : 1;
            return 0;
        });
        return sorted;
    }, [records, sortedRecordIds, sortState]);

    const handleColumnClick = React.useCallback((event: React.MouseEvent<HTMLElement>, column: IColumn) => {
        if (!column.key) return;
        setSortState(prev => ({
            name: column.key,
            descending: prev.name === column.key ? !prev.descending : false,
        }));
    }, []);

    const gridColumns = React.useMemo(() => {
        return columns
            .filter((col) => !col.isHidden && visibleColumns.has(col.name))
            .map((col) => {
                const headerWidth = col.displayName.length * 8 + 24;
                const dataWidth = col.visualSizeFactor > 0 ? col.visualSizeFactor : 150;
                const isSorted = sortState.name === col.name;
                return {
                    key: col.name,
                    name: col.displayName,
                    fieldName: col.name,
                    width: Math.max(headerWidth, dataWidth),
                    minWidth: Math.max(50, headerWidth),
                    isResizable: true,
                    isSorted,
                    isSortedDescending: isSorted ? sortState.descending : false,
                    onColumnClick: handleColumnClick,
                    data: col,
                } as IColumn;
            });
    }, [columns, visibleColumns, sortState, handleColumnClick]);

    const toggleColumn = (columnName: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(columnName)) {
                next.delete(columnName);
            } else {
                next.add(columnName);
            }
            return next;
        });
    };

    const containerStyle: React.CSSProperties = {
        height: height,
        width: width,
        display: 'flex',
        flexDirection: 'column'
    };

    const stackTokens: IStackTokens = { childrenGap: 8 };

    return (
        <Stack verticalFill grow style={containerStyle}>
            <Stack 
                horizontal 
                tokens={stackTokens} 
                style={{ 
                    padding: '8px', 
                    borderBottom: '1px solid #edebe9', 
                    backgroundColor: '#faf9f8',
                    alignItems: 'center',
                    minHeight: '32px',
                    gap: '12px'
                }}
            >
                <IconButton 
                    iconProps={{ iconName: 'Filter' }} 
                    title="Toggle Columns" 
                    onClick={() => setIsPanelOpen(true)} 
                    style={{ marginRight: '8px' }}
                />
                
                <Panel 
                    isOpen={isPanelOpen} 
                    onDismiss={() => setIsPanelOpen(false)} 
                    headerText="Visible Columns"
                >
                    <Stack tokens={{ childrenGap: 5 }} style={{ padding: '8px' }}>
                        {columns.map(col => (
                            <Checkbox 
                                key={col.name} 
                                label={col.displayName} 
                                checked={visibleColumns.has(col.name)} 
                                onChange={(ev, checked) => toggleColumn(col.name)}
                            />
                        ))}
                    </Stack>
                </Panel>
            </Stack>
            <Stack.Item grow className="show-selection-checkbox" style={{ position: 'relative', backgroundColor: 'white' }}>
                <DetailsList
                    columns={gridColumns}
                    onRenderItemColumn={onRenderItemColumn}
                    onRenderDetailsHeader={onRenderDetailsHeader}
                    items={items}
                    layoutMode={DetailsListLayoutMode.fixedColumns}
                    constrainMode={ConstrainMode.unconstrained}
                    setKey="set"
                    checkboxVisibility={CheckboxVisibility.always}
                />
                {itemsLoading && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>Loading...</div>}
            </Stack.Item>
        </Stack>
    );
});

Grid.displayName = 'Grid';
