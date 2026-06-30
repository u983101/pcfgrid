import * as React from 'react';
import { initializeIcons } from '@fluentui/react/lib/Icons';
import {
    DetailsList,
    IColumn,
    ConstrainMode,
    DetailsListLayoutMode,
    IDetailsHeaderProps,
    CheckboxVisibility,
    ColumnActionsMode,
    IGroup,
} from '@fluentui/react/lib/DetailsList';
import { Stack, IStackTokens } from '@fluentui/react/lib/Stack';
import { IRenderFunction } from '@fluentui/react/lib/Utilities';
import {
    Checkbox,
    IconButton,
    Panel,
    TextField,
    ContextualMenu,
    Callout,
    PrimaryButton,
    DefaultButton,
    Text,
    CommandBarButton,
} from '@fluentui/react';

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

function applyTextFilters(
    items: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[],
    filters: Record<string, string>
): ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] {
    const activeFilters: [string, string][] = [];
    for (const k of Object.keys(filters)) {
        const v = filters[k];
        if (v && v.trim().length > 0) {
            activeFilters.push([k, v.toLowerCase()]);
        }
    }
    if (activeFilters.length === 0) {
        return items;
    }
    return items.filter((item) => {
        for (const pair of activeFilters) {
            const cell = (item?.getFormattedValue(pair[0]) || '').toLowerCase();
            if (cell.indexOf(pair[1]) === -1) {
                return false;
            }
        }
        return true;
    });
}

function groupItems(
    items: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[],
    groupByColumn: string | null
): { orderedItems: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[]; groups: IGroup[] | undefined } {
    if (!groupByColumn) {
        return { orderedItems: items, groups: undefined };
    }

    const sorted = items.slice().sort((a, b) => {
        const va = (a?.getFormattedValue(groupByColumn) || '').toLowerCase();
        const vb = (b?.getFormattedValue(groupByColumn) || '').toLowerCase();
        return va.localeCompare(vb);
    });

    const groups: IGroup[] = [];
    let start = 0;
    let currentRaw: string | null = null;

    for (let i = 0; i < sorted.length; i++) {
        const raw = (sorted[i]?.getFormattedValue(groupByColumn) || '').toLowerCase();
        if (currentRaw === null) {
            currentRaw = raw;
            start = 0;
        } else if (raw !== currentRaw) {
            groups.push({
                key: 'g-' + groups.length,
                name: currentRaw || '(empty)',
                startIndex: start,
                count: i - start,
            });
            start = i;
            currentRaw = raw;
        }
    }
    if (currentRaw !== null) {
        groups.push({
            key: 'g-' + groups.length,
            name: currentRaw || '(empty)',
            startIndex: start,
            count: sorted.length - start,
        });
    }

    return { orderedItems: sorted, groups };
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

    const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() => {
        if (displayedColumns && displayedColumns.trim()) {
            return parseColumnString(displayedColumns);
        }
        return new Set(columns.filter(c => !c.isHidden).map(c => c.name));
    });

    const [sortState, setSortState] = React.useState<{ name: string | null; descending: boolean }>({
        name: null,
        descending: false,
    });

    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [groupByColumn, setGroupByColumn] = React.useState<string | null>(null);
    const [isColumnsPanelOpen, setIsColumnsPanelOpen] = React.useState(false);
    const [menuState, setMenuState] = React.useState<{ column: string; target: HTMLElement } | null>(null);
    const [filterCallout, setFilterCallout] = React.useState<{ column: string; target: HTMLElement } | null>(null);

    const prevDisplayedColumns = React.useRef(displayedColumns);
    if (displayedColumns !== prevDisplayedColumns.current) {
        prevDisplayedColumns.current = displayedColumns;
        if (displayedColumns && displayedColumns.trim()) {
            const parsed = parseColumnString(displayedColumns);
            if (parsed.size > 0) {
                setVisibleColumns(parsed);
            }
        }
    }

    const prevVisibleRef = React.useRef(visibleColumns);
    React.useEffect(() => {
        if (prevVisibleRef.current !== visibleColumns) {
            prevVisibleRef.current = visibleColumns;
            const colsArray = Array.from(visibleColumns).sort();
            setDisplayedColumns(colsArray.join(', '));
        }
    });

    const { orderedItems, groups } = React.useMemo(() => {
        const rawItems = sortedRecordIds.map((id) => records[id]);
        const filtered = applyTextFilters(rawItems, filters);
        const sorted = !sortState.name
            ? filtered
            : filtered.slice().sort((a, b) => {
                  const va = (a?.getFormattedValue(sortState.name!) || '').toLowerCase();
                  const vb = (b?.getFormattedValue(sortState.name!) || '').toLowerCase();
                  if (va < vb) return sortState.descending ? 1 : -1;
                  if (va > vb) return sortState.descending ? -1 : 1;
                  return 0;
              });
        return groupItems(sorted, groupByColumn);
    }, [records, sortedRecordIds, sortState, filters, groupByColumn]);

    const handleColumnClick = React.useCallback((ev: React.MouseEvent<HTMLElement>, column: IColumn) => {
        if (!column.key) return;
        setMenuState({ column: column.key, target: ev.currentTarget as HTMLElement });
    }, []);

    const sortByMenu = React.useCallback((columnName: string, descending: boolean) => {
        setSortState({ name: columnName, descending });
        setMenuState(null);
    }, []);

    const buildMenuItems = (columnName: string) => {
        const hasFilter = !!filters[columnName];
        const isSorted = sortState.name === columnName;
        return [
            {
                key: 'asc',
                text: isSorted && !sortState.descending ? 'Sorted A to Z' : 'A to Z',
                iconProps: { iconName: 'SortUp' },
                onClick: () => sortByMenu(columnName, false),
            },
            {
                key: 'desc',
                text: isSorted && sortState.descending ? 'Sorted Z to A' : 'Z to A',
                iconProps: { iconName: 'SortDown' },
                onClick: () => sortByMenu(columnName, true),
            },
            { key: 'divider1', itemType: 1 }, // Divider
            {
                key: 'group',
                text: groupByColumn === columnName ? 'Ungroup' : 'Group by',
                iconProps: { iconName: 'GroupedList' },
                onClick: () => {
                    setGroupByColumn(groupByColumn === columnName ? null : columnName);
                    setMenuState(null);
                },
            },
            { key: 'divider2', itemType: 1 },
            {
                key: 'filter',
                text: hasFilter ? 'Edit filter' : 'Filter by',
                iconProps: { iconName: 'Filter' },
                onClick: () => {
                    const target = menuState ? menuState.target : null;
                    setMenuState(null);
                    if (target) {
                        setFilterCallout({ column: columnName, target });
                    }
                },
            },
            ...(hasFilter
                ? [
                      {
                          key: 'clearFilter',
                          text: 'Clear filter',
                          iconProps: { iconName: 'Clear' },
                          onClick: () => {
                              setFilters(prev => {
                                  const next = { ...prev };
                                  delete next[columnName];
                                  return next;
                              });
                              setMenuState(null);
                          },
                      },
                  ]
                : []),
        ];
    };

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
                    isFiltered: !!filters[col.name],
                    isGrouped: groupByColumn === col.name,
                    columnActionsMode: ColumnActionsMode.hasDropdown,
                    onColumnClick: handleColumnClick,
                    data: col,
                } as IColumn;
            });
    }, [columns, visibleColumns, sortState, filters, handleColumnClick]);

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
        flexDirection: 'column',
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
                    gap: '12px',
                }}
            >
                <IconButton
                    iconProps={{ iconName: 'Filter' }}
                    title="Toggle Columns"
                    onClick={() => setIsColumnsPanelOpen(true)}
                    style={{ marginRight: '8px' }}
                />
                {Object.keys(filters).some(k => filters[k]) && (
                    <CommandBarButton
                        iconProps={{ iconName: 'Clear' }}
                        text="Clear All Filters"
                        onClick={() => setFilters({})}
                        styles={{ root: { height: 32 } }}
                    />
                )}
                <Panel
                    isOpen={isColumnsPanelOpen}
                    onDismiss={() => setIsColumnsPanelOpen(false)}
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
                    items={orderedItems}
                    groups={groups}
                    layoutMode={DetailsListLayoutMode.fixedColumns}
                    constrainMode={ConstrainMode.unconstrained}
                    setKey="set"
                    checkboxVisibility={CheckboxVisibility.always}
                />
                {itemsLoading && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(255,255,255,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >
                        Loading...
                    </div>
                )}
            </Stack.Item>

            {menuState && (
                <ContextualMenu
                    target={menuState.target}
                    items={buildMenuItems(menuState.column)}
                    onDismiss={() => setMenuState(null)}
                    directionalHint={1}
                />
            )}

            {filterCallout && (
                <Callout
                    target={filterCallout.target}
                    onDismiss={() => setFilterCallout(null)}
                    directionalHint={1}
                    setInitialFocus={true}
                    styles={{ root: { padding: 0 } }}
                >
                    <Stack tokens={{ childrenGap: 8 }} styles={{ root: { padding: 12, minWidth: 240 } }}>
                        <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
                            Filter {columns.find(c => c.name === filterCallout.column)?.displayName}
                        </Text>
                        <TextField
                            label="Contains"
                            placeholder="type to filter"
                            value={filters[filterCallout.column] || ''}
                            onChange={(_ev, v) => {
                                const col = filterCallout.column;
                                setFilters(prev => ({ ...prev, [col]: v || '' }));
                            }}
                            styles={{ field: { backgroundColor: '#ffffff' } }}
                        />
                        <Stack horizontal tokens={{ childrenGap: 8 }} horizontalAlign="end">
                            <DefaultButton
                                text="Clear"
                                onClick={() => {
                                    const col = filterCallout.column;
                                    setFilters(prev => {
                                        const next = { ...prev };
                                        delete next[col];
                                        return next;
                                    });
                                    setFilterCallout(null);
                                }}
                            />
                            <PrimaryButton
                                text="Done"
                                onClick={() => setFilterCallout(null)}
                            />
                        </Stack>
                    </Stack>
                </Callout>
            )}
        </Stack>
    );
});

Grid.displayName = 'Grid';
