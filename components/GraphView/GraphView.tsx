'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAllFiles } from '@/lib/storage';
import { parseBKNNetwork, parseBKNFile } from '@/lib/bkn-parser';
import { useBKNStore } from '@/lib/store';
import type { Entity, Relation, Action, LogicProperty } from '@/types/bkn';
import { FileText, GitBranch, Zap, Network, BarChart3, FunctionSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { getMockDataSource, getMockLogicPropertyData } from '@/lib/mock-data-sources';

// Dagre layout helper
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 180;
  const nodeHeight = 80;
  
  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: 100,  // Horizontal spacing between nodes
    ranksep: 120,  // Vertical spacing between layers
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface GraphViewProps {
  onNodeClick?: (nodeId: string, type: 'entity' | 'action') => void;
}

export function GraphView({ onNodeClick }: GraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<{ id: string; type: 'entity' | 'action'; data: Entity | Action } | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<{ id: string; data: Relation } | null>(null);
  const { network } = useBKNStore();
  const [files, setFiles] = useState<Record<string, string>>({});

  // Refresh files periodically to update graph
  useEffect(() => {
    const interval = setInterval(() => {
      const currentFiles = getAllFiles();
      if (JSON.stringify(currentFiles) !== JSON.stringify(files)) {
        setFiles(currentFiles);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [files]);

  // Use network from store or parse from files
  const networkData = useMemo(() => {
    if (network) return network;
    const currentFiles = getAllFiles();
    try {
      const bknFiles = Object.entries(currentFiles).map(([path, content]) =>
        parseBKNFile(content, path)
      );
      return parseBKNNetwork(bknFiles);
    } catch (e) {
      console.error('Failed to parse network:', e);
      return { id: '', name: '', entities: [], relations: [], actions: [], files: [] };
    }
  }, [network]);

  // Build graph nodes and edges with dagre auto-layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create entity nodes
    networkData.entities.forEach((entity) => {
      nodes.push({
        id: `entity-${entity.id}`,
        type: 'default',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: (
            <div className="flex items-center gap-2 p-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="font-semibold text-foreground">{entity.name}</div>
                <div className="text-xs text-foreground/70">{entity.id}</div>
              </div>
            </div>
          ),
          entity,
          type: 'entity',
        },
        style: {
          background: 'hsl(var(--card))',
          border: '2px solid hsl(142 76% 36%)',
          borderRadius: '12px',
          padding: 0,
          minWidth: 160,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          color: 'hsl(var(--card-foreground))',
        },
      });
    });

    // Create action nodes
    networkData.actions.forEach((action) => {
      const actionNodeId = `action-${action.id}`;

      nodes.push({
        id: actionNodeId,
        type: 'default',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: (
            <div className="flex items-center gap-2 p-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <div>
                <div className="font-semibold text-sm text-foreground">{action.name}</div>
                <div className="text-xs text-foreground/70">{action.id}</div>
              </div>
            </div>
          ),
          action,
          type: 'action',
        },
        style: {
          background: 'hsl(var(--card))',
          border: '2px dashed hsl(38 92% 50%)',
          borderRadius: '12px',
          padding: 0,
          minWidth: 140,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          color: 'hsl(var(--card-foreground))',
        },
      });

      // Connect action to entity with animated dashed line
      edges.push({
        id: `edge-${action.entityId}-${action.id}`,
        source: `entity-${action.entityId}`,
        target: actionNodeId,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'hsl(38 92% 50%)',
        },
        style: { 
          stroke: 'hsl(38 92% 50%)', 
          strokeWidth: 2,
          strokeDasharray: '5 5',
        },
        label: action.actionType,
        labelStyle: { fill: 'hsl(var(--foreground))', fontWeight: 500, fontSize: 11 },
        labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9 },
      });
    });

    // Create relation edges
    networkData.relations.forEach((relation) => {
      const sourceExists = networkData.entities.some(e => e.id === relation.source);
      const targetExists = networkData.entities.some(e => e.id === relation.target);

      if (sourceExists && targetExists) {
        edges.push({
          id: `relation-${relation.id}`,
          source: `entity-${relation.source}`,
          target: `entity-${relation.target}`,
          type: 'smoothstep',
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'hsl(142 76% 36%)',
          },
          style: { stroke: 'hsl(142 76% 36%)', strokeWidth: 2 },
          label: relation.name,
          labelStyle: { fill: 'hsl(var(--foreground))', fontWeight: 500, fontSize: 11 },
          labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9 },
          data: { relation },
        });
      }
    });

    // Apply dagre auto-layout (TB = top to bottom)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB');

    return { nodes: layoutedNodes, edges: layoutedEdges };
  }, [networkData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when network changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data;
      if (nodeData.type === 'entity') {
        setSelectedNode({ id: node.id, type: 'entity', data: nodeData.entity });
        onNodeClick?.(nodeData.entity.id, 'entity');
      } else if (nodeData.type === 'action') {
        setSelectedNode({ id: node.id, type: 'action', data: nodeData.action });
        onNodeClick?.(nodeData.action.id, 'action');
      }
    },
    [onNodeClick]
  );

  const onEdgeClickHandler = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.relation) {
        setSelectedRelation({ id: edge.id, data: edge.data.relation });
      }
    },
    []
  );

  return (
    <div className="flex flex-col h-full border-l bg-card">
      <div className="p-2 border-b">
        <h2 className="text-sm font-semibold">网络图</h2>
        {networkData.entities.length === 0 && networkData.relations.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">暂无数据</p>
        )}
      </div>
      <div className="flex-1 relative">
        {networkData.entities.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无网络数据</p>
              <p className="text-xs mt-2">创建实体和关系后，网络图将自动更新</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClickHandler}
            onEdgeClick={onEdgeClickHandler}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.3, minZoom: 0.5, maxZoom: 1.5 }}
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'smoothstep',
            }}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                if (node.data?.type === 'entity') return 'hsl(142 76% 36%)';
                if (node.data?.type === 'action') return 'hsl(38 92% 50%)';
                return '#ccc';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        )}
      </div>

      {/* Node Detail Dialog */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNode?.type === 'entity' ? (
                <FileText className="h-5 w-5 text-green-500" />
              ) : (
                <Zap className="h-5 w-5 text-orange-500" />
              )}
              {selectedNode?.data.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedNode && selectedNode.type === 'entity' ? (
              <EntityDetails entity={selectedNode.data as Entity} />
            ) : selectedNode ? (
              <ActionDetails action={selectedNode.data as Action} />
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Relation Detail Dialog */}
      <Dialog open={!!selectedRelation} onOpenChange={() => setSelectedRelation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-500" />
              {selectedRelation?.data.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedRelation && <RelationDetails relation={selectedRelation.data} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntityDetails({ entity }: { entity: Entity }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">基本信息</h3>
        <div className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">ID:</span> {entity.id}</div>
          {entity.network && <div><span className="text-muted-foreground">网络:</span> {entity.network}</div>}
          {entity.namespace && <div><span className="text-muted-foreground">命名空间:</span> {entity.namespace}</div>}
          {entity.primaryKey && <div><span className="text-muted-foreground">主键:</span> {entity.primaryKey}</div>}
          {entity.displayKey && <div><span className="text-muted-foreground">显示属性:</span> {entity.displayKey}</div>}
        </div>
      </div>

      {entity.dataSource && (
        <div>
          <h3 className="font-semibold mb-2">数据来源</h3>
          <div className="text-sm">
            <div><span className="text-muted-foreground">类型:</span> {entity.dataSource.type}</div>
            <div><span className="text-muted-foreground">ID:</span> {entity.dataSource.id}</div>
          </div>
        </div>
      )}

      {entity.properties && entity.properties.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">属性覆盖</h3>
          <div className="text-sm space-y-2">
            {entity.properties.map((prop, idx) => (
              <div key={idx} className="border-l-2 pl-3 py-1">
                <div className="font-medium">{prop.name}</div>
                {prop.displayName && (
                  <div className="text-muted-foreground text-xs">显示名: {prop.displayName}</div>
                )}
                {prop.type && (
                  <div className="text-muted-foreground text-xs">类型: {prop.type}</div>
                )}
                {prop.indexConfig && (
                  <div className="text-muted-foreground text-xs">索引配置: {prop.indexConfig}</div>
                )}
                {prop.description && (
                  <div className="text-muted-foreground text-xs mt-1">{prop.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {entity.logicProperties && entity.logicProperties.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">逻辑属性</h3>
          <div className="text-sm space-y-3">
            {entity.logicProperties.map((prop, idx) => (
              <LogicPropertyCard
                key={idx}
                property={prop}
                entityId={entity.id}
              />
            ))}
          </div>
        </div>
      )}

      {entity.description && (
        <div>
          <h3 className="font-semibold mb-2">描述</h3>
          <p className="text-sm text-muted-foreground">{entity.description}</p>
        </div>
      )}
    </div>
  );
}

function ActionDetails({ action }: { action: Action }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">基本信息</h3>
        <div className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">ID:</span> {action.id}</div>
          <div><span className="text-muted-foreground">绑定实体:</span> {action.entityId}</div>
          <div><span className="text-muted-foreground">行动类型:</span> {action.actionType}</div>
          {action.network && <div><span className="text-muted-foreground">网络:</span> {action.network}</div>}
          {action.enabled !== undefined && (
            <div><span className="text-muted-foreground">启用:</span> {action.enabled ? '是' : '否'}</div>
          )}
          {action.risk_level && (
            <div><span className="text-muted-foreground">风险等级:</span> {action.risk_level}</div>
          )}
        </div>
      </div>

      {action.condition && (
        <div>
          <h3 className="font-semibold mb-2">触发条件</h3>
          <div className="text-sm">
            <div><span className="text-muted-foreground">字段:</span> {action.condition.field}</div>
            <div><span className="text-muted-foreground">操作:</span> {action.condition.operation}</div>
            {action.condition.value && (
              <div><span className="text-muted-foreground">值:</span> {JSON.stringify(action.condition.value)}</div>
            )}
          </div>
        </div>
      )}

      {action.toolConfig && (
        <div>
          <h3 className="font-semibold mb-2">工具配置</h3>
          <div className="text-sm">
            <div><span className="text-muted-foreground">工具箱ID:</span> {action.toolConfig.boxId}</div>
            <div><span className="text-muted-foreground">工具ID:</span> {action.toolConfig.toolId}</div>
          </div>
        </div>
      )}

      {action.mcpConfig && (
        <div>
          <h3 className="font-semibold mb-2">MCP 配置</h3>
          <div className="text-sm">
            <div><span className="text-muted-foreground">MCP ID:</span> {action.mcpConfig.mcpId}</div>
            <div><span className="text-muted-foreground">工具名称:</span> {action.mcpConfig.toolName}</div>
          </div>
        </div>
      )}

      {action.description && (
        <div>
          <h3 className="font-semibold mb-2">描述</h3>
          <p className="text-sm text-muted-foreground">{action.description}</p>
        </div>
      )}
    </div>
  );
}

function RelationDetails({ relation }: { relation: Relation }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">基本信息</h3>
        <div className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">ID:</span> {relation.id}</div>
          <div><span className="text-muted-foreground">起点:</span> {relation.source}</div>
          <div><span className="text-muted-foreground">终点:</span> {relation.target}</div>
          <div><span className="text-muted-foreground">类型:</span> {relation.type}</div>
        </div>
      </div>

      {relation.mappingRules && relation.mappingRules.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">映射规则</h3>
          <div className="text-sm space-y-1">
            {relation.mappingRules.map((rule, idx) => (
              <div key={idx}>
                {rule.sourceProperty} → {rule.targetProperty}
              </div>
            ))}
          </div>
        </div>
      )}

      {relation.description && (
        <div>
          <h3 className="font-semibold mb-2">描述</h3>
          <p className="text-sm text-muted-foreground">{relation.description}</p>
        </div>
      )}
    </div>
  );
}

function DataSourcePreview({ dataSourceId }: { dataSourceId: string }) {
  const mockData = getMockDataSource(dataSourceId);
  
  if (!mockData) {
    return null;
  }

  const columns = mockData.sampleData && mockData.sampleData.length > 0 
    ? Object.keys(mockData.sampleData[0])
    : [];

  return (
    <div className="mt-3 space-y-3">
      {mockData.columns && mockData.columns.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted-foreground">字段属性</h4>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">属性名</th>
                  <th className="text-left p-2 font-medium">类型</th>
                  <th className="text-left p-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {mockData.columns.map((column, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-medium">{column.name}</td>
                    <td className="p-2 text-muted-foreground">{column.type}</td>
                    <td className="p-2 text-muted-foreground">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {mockData.sampleData && mockData.sampleData.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted-foreground">示例数据</h4>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  {columns.map((col) => (
                    <th key={col} className="text-left p-2 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockData.sampleData.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    {columns.map((col) => (
                      <td key={col} className="p-2 text-muted-foreground">
                        {String(row[col] || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LogicPropertyCard({ property, entityId }: { property: LogicProperty; entityId: string }) {
  const [expanded, setExpanded] = useState(false);
  const mockData = getMockLogicPropertyData(entityId, property.name);
  const isMetric = property.type === 'metric';
  const Icon = isMetric ? BarChart3 : FunctionSquare;

  return (
    <div
      className={`border rounded-lg p-3 ${
        isMetric
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'bg-purple-500/10 border-purple-500/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
            isMetric ? 'text-blue-500' : 'text-purple-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{property.name}</div>
          <div className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">类型:</span> {property.type}
            {property.source && (
              <>
                {' | '}
                <span className="font-medium">来源:</span> {property.source}
              </>
            )}
            {property.sourceType && ` (${property.sourceType})`}
          </div>
          {property.description && (
            <div className="text-xs text-muted-foreground mt-1">{property.description}</div>
          )}
          {property.parameters && property.parameters.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">参数:</div>
              {property.parameters.map((param, pIdx) => (
                <div key={pIdx} className="text-xs text-muted-foreground ml-2">
                  • {param.name} ({param.source})
                  {param.binding && <span> → {param.binding}</span>}
                  {param.description && <span>: {param.description}</span>}
                </div>
              ))}
            </div>
          )}
          {mockData && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>查看示例数据</span>
              </button>
              {expanded && (
                <div className="mt-2 p-2 bg-muted/50 rounded border text-xs">
                  <pre className="text-muted-foreground overflow-x-auto">
                    {JSON.stringify(mockData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
