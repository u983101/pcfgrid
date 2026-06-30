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
    SelectionMode,
} from '@fluentui/react/lib/DetailsList';
import { Stack, IStackTokens } from '@fluentui/react/lib/Stack';
import { Selection } from '@fluentui/react/lib/Selection';
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
    SearchBox,
} from '@fluentui/react';

initializeIcons(undefined, { disableWarnings: true });

export interface ColumnGroup {
    label: string;
    columns: string[];
}

export interface GridProps {
    width?: number;
    height?: number;
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    records: Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord>;
    sortedRecordIds: string[];
    itemsLoading: boolean;
    displayedColumns: string;
    setDisplayedColumns: (cols: string) => void;
    onAssign?: (selectedIds: string[]) => void;
    onUnassign?: (selectedIds: string[]) => void;
}

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

function parseColumnConfig(json: string): { visibleColumns: string[]; columnGroups: ColumnGroup[] } {
    const columnGroups: ColumnGroup[] = [];
    const visibleColumns: string[] = [];

    if (!json || !json.trim()) {
        return { visibleColumns, columnGroups };
    }

    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            if (parsed.length === 0) return { visibleColumns, columnGroups };

            // Check if it's a groups array or flat names array
            if (typeof parsed[0] === 'object' && parsed[0] !== null && parsed[0].label && parsed[0].columns) {
                // Groups format
                for (const group of parsed) {
                    if (group.label && Array.isArray(group.columns)) {
                        const groupColNames: string[] = [];
                        for (const col of group.columns) {
                            if (typeof col === 'string' && col.trim()) {
                                if (!visibleColumns.includes(col.trim())) {
                                    visibleColumns.push(col.trim());
                                }
                                groupColNames.push(col.trim());
                            }
                        }
                        if (groupColNames.length > 0) {
                            columnGroups.push({ label: group.label, columns: groupColNames });
                        }
                    }
                }
            } else {
                // Flat names array — preserve order
                for (const item of parsed) {
                    if (typeof item === 'string' && item.trim() && !visibleColumns.includes(item.trim())) {
                        visibleColumns.push(item.trim());
                    }
                }
            }
        }
    } catch {
        // Fallback: treat as comma-delimited (backward compatible)
        json.split(',').forEach(col => {
            const trimmed = col.trim();
            if (trimmed && !visibleColumns.includes(trimmed)) {
                visibleColumns.push(trimmed);
            }
        });
    }

    return { visibleColumns, columnGroups };
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
        onAssign,
        onUnassign,
    } = props;

    // Parse the JSON config to get both visible columns and groups
    const columnConfigRef = React.useRef(parseColumnConfig(displayedColumns));

    const [visibleColumns, setVisibleColumns] = React.useState<string[]>(() => {
        const initial = columnConfigRef.current.visibleColumns;
        return initial.length > 0 ? initial : columns.filter(c => !c.isHidden).map(c => c.name);
    });

    const [columnGroups, setColumnGroups] = React.useState<ColumnGroup[]>(columnConfigRef.current.columnGroups);

    const [sortState, setSortState] = React.useState<{ name: string | null; descending: boolean }>({
        name: null,
        descending: false,
    });

    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [globalSearch, setGlobalSearch] = React.useState('');
    const [groupByColumn, setGroupByColumn] = React.useState<string | null>(null);
    const [selectedCount, setSelectedCount] = React.useState(0);

    const selectionRef = React.useRef<Selection>(new Selection({
        selectionMode: SelectionMode.multiple,
        onSelectionChanged: () => {
            const sel = selectionRef.current;
            if (!sel) return;
            setSelectedCount(sel.getSelectedCount());
            const ids: string[] = [];
            for (const item of sel.getSelection()) {
                try {
                    const id = (item as ComponentFramework.PropertyHelper.DataSetApi.EntityRecord).getRecordId();
                    if (id) ids.push(id);
                } catch {
                    // skip items that don't have getRecordId
                }
            }
            selectedIdsRef.current = ids;
        },
    }));
    const selectedIdsRef = React.useRef<string[]>([]);
    const [isColumnsPanelOpen, setIsColumnsPanelOpen] = React.useState(false);
    const [menuState, setMenuState] = React.useState<{ column: string; target: HTMLElement } | null>(null);
    const [filterCallout, setFilterCallout] = React.useState<{ column: string; target: HTMLElement } | null>(null);

    const onRenderDetailsHeader = React.useCallback<IRenderFunction<IDetailsHeaderProps>>(
        (headerProps, defaultRender) => {
            if (!defaultRender) return null;

            if (!columnGroups || columnGroups.length === 0) {
                return defaultRender(headerProps);
            }

            const headerColumns = headerProps?.columns || [];
            const indentWidth = headerProps?.indentWidth || 48;

            let groupOffset = indentWidth;

            const groupCells = columnGroups.map(group => {
                let groupWidth = 0;
                group.columns.forEach(colName => {
                    const match = headerColumns.find(hc => hc.key === colName);
                    if (match) groupWidth += match.currentWidth || match.calculatedWidth || 150;
                });

                const cell = (
                    <div
                        key={group.label}
                        style={{
                            position: 'absolute',
                            left: groupOffset,
                            width: groupWidth,
                            top: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: 11,
                            color: '#323130',
                            borderRight: '1px solid #edebe9',
                            boxSizing: 'border-box',
                            padding: '4px 8px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {group.label}
                    </div>
                );
                groupOffset += groupWidth;
                return cell;
            });

            return (
                <div style={{ backgroundColor: '#f3f2f1', position: 'relative' }}>
                    <div style={{ height: 24, position: 'relative', borderBottom: '1px solid #d2d0ce' }}>
                        {groupCells}
                    </div>
                    <div>
                        {defaultRender(headerProps)}
                    </div>
                </div>
            );
        },
        [columnGroups]
    );

    const prevDisplayedColumns = React.useRef(displayedColumns);
    if (displayedColumns !== prevDisplayedColumns.current) {
        prevDisplayedColumns.current = displayedColumns;
        const { visibleColumns: parsed, columnGroups: parsedGroups } = parseColumnConfig(displayedColumns);
        if (parsed.length > 0) {
            setVisibleColumns(parsed);
        }
        if (parsedGroups.length > 0) {
            setColumnGroups(parsedGroups);
        }
    }

    const prevVisibleRef = React.useRef(visibleColumns);
    const prevGroupsRef = React.useRef(columnGroups);

    // Columns that are in the dataset but not defined in the VisibleColumns input
    const configuredColumns = React.useMemo(() => {
        const configured: string[] = [];
        if (columnGroups.length > 0) {
            columnGroups.forEach(g => g.columns.forEach(c => { if (!configured.includes(c)) configured.push(c); }));
        }
        return configured;
    }, [columnGroups]);
    React.useEffect(() => {
        if (prevVisibleRef.current !== visibleColumns || prevGroupsRef.current !== columnGroups) {
            prevVisibleRef.current = visibleColumns;
            prevGroupsRef.current = columnGroups;
            if (columnGroups.length > 0) {
                const groupsJson = columnGroups.map(g => ({
                    label: g.label,
                    columns: g.columns.filter(c => visibleColumns.includes(c)),
                })).filter(g => g.columns.length > 0);
                setDisplayedColumns(JSON.stringify(groupsJson));
            } else {
                setDisplayedColumns(JSON.stringify(visibleColumns));
            }
        }
    });

    const { orderedItems, groups } = React.useMemo(() => {
        const rawItems = sortedRecordIds.map((id) => records[id]);

        // Global search across all visible columns
        const searchText = globalSearch.toLowerCase().trim();
        const searched = !searchText
            ? rawItems
            : rawItems.filter(item => {
                  for (const col of columns) {
                      if (col.isHidden || !visibleColumns.includes(col.name)) continue;
                      const val = (item?.getFormattedValue(col.name) || '').toLowerCase();
                      if (val.indexOf(searchText) !== -1) return true;
                  }
                  return false;
              });

        const filtered = applyTextFilters(searched, filters);
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
    }, [records, sortedRecordIds, sortState, filters, groupByColumn, globalSearch, columns, visibleColumns]);

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
        const colMap = new Map(columns.filter(c => !c.isHidden).map(c => [c.name, c]));
        const ordered = visibleColumns
            .filter(name => colMap.has(name))
            .map(name => colMap.get(name)!);
        return ordered.map((col) => {
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
            if (prev.includes(columnName)) {
                return prev.filter(c => c !== columnName);
            }
            return [...prev, columnName];
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
                <SearchBox
                    placeholder="Search all fields"
                    value={globalSearch}
                    onChange={(ev, newValue) => setGlobalSearch(newValue || '')}
                    onClear={() => setGlobalSearch('')}
                    styles={{ root: { flex: 1, maxWidth: 300 } }}
                />
                <Panel
                    isOpen={isColumnsPanelOpen}
                    onDismiss={() => setIsColumnsPanelOpen(false)}
                    headerText="Visible Columns"
                >
                    <Stack tokens={{ childrenGap: 5 }} style={{ padding: '8px' }}>
                        {columns
                            .filter(col => !configuredColumns.includes(col.name))
                            .map(col => (
                                <Checkbox
                                    key={col.name}
                                    label={col.displayName}
                                    checked={visibleColumns.includes(col.name)}
                                    onChange={(ev, checked) => toggleColumn(col.name)}
                                />
                            ))}
                        {columns.filter(col => !configuredColumns.includes(col.name)).length === 0 && (
                            <Text variant="small" styles={{ root: { color: '#605e5c', padding: '8px', fontStyle: 'italic' } }}>
                                No additional columns available.
                            </Text>
                        )}
                    </Stack>
                </Panel>
            </Stack>
            <Stack.Item grow className="show-selection-checkbox" style={{ position: 'relative', backgroundColor: 'white', overflow: 'hidden', minHeight: 0 }}>
                <div style={{ height: '100%', overflow: 'auto' }}>
                    <DetailsList
                        columns={gridColumns}
                        onRenderItemColumn={onRenderItemColumn}
                        onRenderDetailsHeader={onRenderDetailsHeader}
                        items={orderedItems}
                        groups={groups}
                        layoutMode={DetailsListLayoutMode.fixedColumns}
                        constrainMode={ConstrainMode.unconstrained}
                        setKey={`set-${orderedItems.length}`}
                        checkboxVisibility={CheckboxVisibility.always}
                        selection={selectionRef.current}
                        selectionMode={SelectionMode.multiple}
                    />
                </div>
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

            <Stack
                horizontal
                verticalAlign="center"
                style={{
                    padding: '4px 12px',
                    borderTop: '1px solid #edebe9',
                    backgroundColor: '#faf9f8',
                    fontSize: 12,
                    color: '#605e5c',
                    flexShrink: 0,
                }}
            >
                <Stack.Item grow>
                    {selectedCount > 0 && (
                        <Stack horizontal tokens={{ childrenGap: 8 }}>
                            <DefaultButton
                                text="Assign"
                                onClick={() => {
                                    if (onAssign) onAssign(selectedIdsRef.current);
                                }}
                                styles={{ root: { height: 28, fontSize: 12 } }}
                            />
                            <DefaultButton
                                text="Unassign"
                                onClick={() => {
                                    if (onUnassign) onUnassign(selectedIdsRef.current);
                                }}
                                styles={{ root: { height: 28, fontSize: 12 } }}
                            />
                        </Stack>
                    )}
                </Stack.Item>
                <Text>{orderedItems.length} of {sortedRecordIds.length} records{selectedCount > 0 ? ` (${selectedCount} selected)` : ''}</Text>
            </Stack>

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
