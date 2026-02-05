'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Database } from 'lucide-react';
import { mockDataSources } from '@/lib/mock-data-sources';
import type { MockDataSource } from '@/lib/mock-data-sources';

export function DataSourcePanel() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const dataSources = Object.values(mockDataSources);

  return (
    <div className="border-t flex flex-col h-64">
      <div className="p-2 border-b bg-muted/30">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4" />
          数据来源
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {dataSources.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            暂无数据来源
          </div>
        ) : (
          <div className="p-1">
            {dataSources.map((dataSource) => (
              <DataSourceItem
                key={dataSource.id}
                dataSource={dataSource}
                expanded={expanded[dataSource.id] || false}
                onToggle={() => toggleExpand(dataSource.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DataSourceItem({
  dataSource,
  expanded,
  onToggle,
}: {
  dataSource: MockDataSource;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-accent cursor-pointer rounded transition-colors duration-200 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground truncate">
          {dataSource.name}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 mb-2 space-y-2">
          {dataSource.description && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {dataSource.description}
            </div>
          )}
          {dataSource.columns && dataSource.columns.length > 0 && (
            <div className="px-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                字段列表:
              </div>
              <div className="space-y-1">
                {dataSource.columns.map((column, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-foreground/80 pl-2 border-l-2 border-muted"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{column.name}</span>
                      <span className="text-muted-foreground">({column.type})</span>
                    </div>
                    {column.description && (
                      <div className="text-muted-foreground mt-0.5 ml-1">
                        {column.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
