// BKN Type Definitions

export type BKNFileType = 'network' | 'entity' | 'relation' | 'action' | 'fragment' | 'delete';

export interface BKNFile {
  path: string;
  frontmatter: BKNFrontmatter;
  content: string;
  rawContent: string; // Original file content
}

export interface BKNFrontmatter {
  type: BKNFileType;
  id: string;
  name: string;
  version?: string;
  network?: string;
  namespace?: string;
  owner?: string;
  tags?: string[];
  description?: string;
  includes?: string[];
  // Action-specific fields
  action_type?: 'add' | 'modify' | 'delete';
  enabled?: boolean;
  risk_level?: 'low' | 'medium' | 'high';
  requires_approval?: boolean;
  // Delete-specific fields
  targets?: Array<{
    entity?: string;
    relation?: string;
    action?: string;
  }>;
}

export interface BKNNetwork {
  id: string;
  name: string;
  entities: Entity[];
  relations: Relation[];
  actions: Action[];
  files: BKNFile[];
}

export interface Entity {
  id: string;
  name: string;
  filePath: string;
  network?: string;
  namespace?: string;
  owner?: string;
  tags?: string[];
  description?: string;
  dataSource?: {
    type: string;
    id: string;
    name?: string;
  };
  primaryKey?: string;
  displayKey?: string;
  dataProperties?: DataProperty[];
  properties?: Property[];
  logicProperties?: LogicProperty[];
}

export interface DataProperty {
  name: string;
  displayName?: string;
  type?: string;
  description?: string;
  isPrimaryKey?: boolean;
  isIndexed?: boolean;
}

export interface Property {
  name: string;
  displayName?: string;
  type?: string;
  indexConfig?: string;
  description?: string;
  isPrimaryKey?: boolean;
  isDisplayKey?: boolean;
}

export interface LogicProperty {
  name: string;
  type: 'metric' | 'operator';
  source: string;
  sourceType?: string;
  description?: string;
  parameters?: Parameter[];
}

export interface Parameter {
  name: string;
  source: 'property' | 'input' | 'const';
  binding?: string;
  description?: string;
}

export interface Relation {
  id: string;
  name: string;
  filePath: string;
  network?: string;
  namespace?: string;
  owner?: string;
  description?: string;
  source: string; // entity id
  target: string; // entity id
  type: 'direct' | 'data_view';
  mappingRules?: MappingRule[];
  dataView?: {
    type: string;
    id: string;
  };
  sourceMapping?: MappingRule[];
  targetMapping?: MappingRule[];
}

export interface MappingRule {
  sourceProperty?: string;
  targetProperty?: string;
  viewProperty?: string;
}

export interface Action {
  id: string;
  name: string;
  filePath: string;
  network?: string;
  namespace?: string;
  owner?: string;
  description?: string;
  entityId: string; // 绑定的实体
  actionType: 'add' | 'modify' | 'delete';
  enabled?: boolean;
  risk_level?: 'low' | 'medium' | 'high';
  requires_approval?: boolean;
  condition?: Condition;
  toolConfig?: ToolConfig;
  mcpConfig?: MCPConfig;
  parameters?: Parameter[];
  schedule?: Schedule;
  affect?: Affect[];
  executionSteps?: string[];
  rollbackPlan?: string;
}

export interface Condition {
  field: string;
  operation: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'exist' | 'not_exist' | 'range';
  value?: any;
  object_type_id?: string;
}

export interface ToolConfig {
  type: 'tool';
  boxId?: string;
  toolId: string;
}

export interface MCPConfig {
  type: 'mcp';
  mcpId: string;
  toolName: string;
}

export interface Schedule {
  type: 'FIX_RATE' | 'CRON';
  expression: string;
  description?: string;
}

export interface Affect {
  object: string;
  description: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>; // path -> content
}

// Storage types
export interface StoredData {
  projects: Record<string, Project>; // projectId -> project
  currentProject: string | null; // current project id
  openFile: string | null;
  treeState: Record<string, boolean>; // expanded/collapsed state
}

// Legacy storage format (for migration)
export interface LegacyStoredData {
  files: Record<string, string>;
  openFile: string | null;
  treeState: Record<string, boolean>;
}

// Graph visualization types
export interface GraphNode {
  id: string;
  type: 'entity' | 'action';
  label: string;
  data: Entity | Action;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'relation' | 'action-binding';
  label?: string;
  data?: Relation | Action;
}
