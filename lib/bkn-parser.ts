import matter from 'gray-matter';
import { marked } from 'marked';
import yaml from 'js-yaml';
import type {
  BKNFile,
  BKNNetwork,
  Entity,
  Relation,
  Action,
  DataProperty,
  Property,
  LogicProperty,
  Parameter,
  MappingRule,
  Condition,
  ToolConfig,
  MCPConfig,
  Schedule,
  Affect,
  BKNFrontmatter,
} from '@/types/bkn';

/**
 * Parse a single BKN file
 */
export function parseBKNFile(content: string, path: string): BKNFile {
  const parsed = matter(content);
  const frontmatter = parsed.data as BKNFrontmatter;

  return {
    path,
    frontmatter: {
      type: frontmatter.type || 'fragment',
      id: frontmatter.id || '',
      name: frontmatter.name || '',
      version: frontmatter.version,
      network: frontmatter.network,
      namespace: frontmatter.namespace,
      owner: frontmatter.owner,
      tags: frontmatter.tags,
      description: frontmatter.description,
      includes: frontmatter.includes,
      action_type: frontmatter.action_type,
      enabled: frontmatter.enabled,
      risk_level: frontmatter.risk_level,
      requires_approval: frontmatter.requires_approval,
      targets: frontmatter.targets,
    },
    content: parsed.content,
    rawContent: content,
  };
}

/**
 * Parse all Entities from a network-type BKN file
 */
function parseAllEntities(file: BKNFile): Entity[] {
  const entities: Entity[] = [];
  
  // Find all Entity sections: ## Entity: {id}
  // Match from "## Entity: {id}" to next "##" or end of file
  const entityPattern = /##\s+Entity:\s+(\w+)([\s\S]*?)(?=\n##\s+(?:Entity|Relation|Action|#\s+[^#])|$)/g;
  let match;
  
  while ((match = entityPattern.exec(file.content)) !== null) {
    const entityId = match[1];
    const entityContent = match[2].trim();
    
    // Create a temporary file-like object for this entity section
    const entityFile: BKNFile = {
      ...file,
      content: entityContent,
      frontmatter: {
        ...file.frontmatter,
        id: entityId,
        type: 'entity',
      },
    };
    
    const entity = parseEntityFromContent(entityFile, entityId);
    if (entity) {
      entities.push(entity);
    }
  }
  
  return entities;
}

/**
 * Parse Entity from content (internal helper)
 */
function parseEntityFromContent(file: BKNFile, entityId: string): Entity | null {
  // Extract name from content: **Name** - description
  const nameMatch = file.content.match(/\*\*([^*]+)\*\*\s*-\s*([^\n]+)/);
  const entityName = nameMatch ? nameMatch[1].trim() : entityId;

  const entity: Entity = {
    id: entityId,
    name: entityName,
    filePath: file.path,
    network: file.frontmatter.network,
    namespace: file.frontmatter.namespace,
    owner: file.frontmatter.owner,
    tags: file.frontmatter.tags,
  };

  // Parse description (first paragraph after title)
  const descMatch = file.content.match(/\*\*[^*]+\*\*\s*-\s*([^\n]+)/);
  if (descMatch) {
    entity.description = descMatch[1].trim();
  }

  // Parse data source table
  const dataSourceMatch = file.content.match(/###\s+数据来源\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (dataSourceMatch) {
    const table = parseTable(dataSourceMatch[1]);
    if (table.length > 0 && table[0]['类型']) {
      entity.dataSource = {
        type: table[0]['类型'] || table[0]['类型'] || '',
        id: table[0]['ID'] || table[0]['id'] || '',
        name: table[0]['名称'] || table[0]['name'],
      };
    }
  }

  // Parse primary key and display key from quote block
  const quoteMatch = file.content.match(/>\s*\*\*主键\*\*:\s*`([^`]+)`\s*\|\s*\*\*显示属性\*\*:\s*`([^`]+)`/);
  if (quoteMatch) {
    entity.primaryKey = quoteMatch[1];
    entity.displayKey = quoteMatch[2];
  } else {
    // Try alternative format
    const altMatch = file.content.match(/>\s*\*\*显示属性\*\*:\s*`([^`]+)`/);
    if (altMatch) {
      entity.displayKey = altMatch[1];
    }
  }

  // Parse data properties table
  const dataPropsMatch = file.content.match(/###\s+数据属性\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (dataPropsMatch) {
    const table = parseTable(dataPropsMatch[1]);
    entity.dataProperties = table.map((row) => ({
      name: row['属性名'] || row['property_name'] || '',
      displayName: row['显示名'] || row['display_name'],
      type: row['类型'] || row['type'],
      description: row['说明'] || row['description'],
      isPrimaryKey: row['主键'] === 'YES' || row['主键'] === '是' || row['isPrimaryKey'] === 'YES',
      isIndexed: row['索引'] === 'YES' || row['索引'] === '是' || row['isIndexed'] === 'YES',
    }));
  }

  // Parse properties override table
  const propsMatch = file.content.match(/###\s+属性覆盖\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (propsMatch) {
    const table = parseTable(propsMatch[1]);
    entity.properties = table.map((row) => ({
      name: row['属性名'] || row['property_name'] || '',
      displayName: row['显示名'] || row['display_name'],
      type: row['类型'] || row['type'],
      indexConfig: row['索引配置'] || row['index_config'],
      description: row['说明'] || row['description'],
    }));
  }

  // Parse logic properties
  const logicPropsMatch = file.content.match(/###\s+逻辑属性\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (logicPropsMatch) {
    const logicProps: LogicProperty[] = [];
    const sections = logicPropsMatch[1].split(/\n####\s+/);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const nameMatch = section.match(/^(\w+)/);
      if (!nameMatch) continue;

      const prop: LogicProperty = {
        name: nameMatch[1],
        type: 'metric',
        source: '',
      };

      // Extract type
      const typeMatch = section.match(/-?\s*\*\*类型\*\*:\s*(\w+)/);
      if (typeMatch) {
        prop.type = typeMatch[1] as 'metric' | 'operator';
      }

      // Extract source
      const sourceMatch = section.match(/-?\s*\*\*来源\*\*:\s*([^(]+)/);
      if (sourceMatch) {
        prop.source = sourceMatch[1].trim();
        const sourceTypeMatch = section.match(/\(([^)]+)\)/);
        if (sourceTypeMatch) {
          prop.sourceType = sourceTypeMatch[1];
        }
      }

      // Extract description
      const descMatch = section.match(/-?\s*\*\*说明\*\*:\s*(.+)/);
      if (descMatch) {
        prop.description = descMatch[1].trim();
      }

      // Parse parameters table
      const paramTable = parseTable(section);
      if (paramTable.length > 0 && paramTable[0]['参数名']) {
        prop.parameters = paramTable.map((row) => ({
          name: row['参数名'] || row['parameter_name'] || '',
          source: (row['来源'] || row['source'] || 'input') as 'property' | 'input' | 'const',
          binding: row['绑定值'] || row['binding'] || row['绑定'] || undefined,
          description: row['说明'] || row['description'],
        }));
      }

      logicProps.push(prop);
    }

    if (logicProps.length > 0) {
      entity.logicProperties = logicProps;
    }
  }

  return entity;
}

/**
 * Parse Entity from BKN file (single entity file format)
 */
function parseEntity(file: BKNFile): Entity | null {
  if (file.frontmatter.type !== 'entity' && file.frontmatter.type !== 'network' && file.frontmatter.type !== 'fragment') {
    return null;
  }

  const entityId = file.frontmatter.id;
  if (!entityId) {
    // Try to extract from content: ## Entity: {id}
    const match = file.content.match(/^##\s+Entity:\s+(\w+)/m);
    if (!match) return null;
    return parseEntityFromContent(file, match[1]);
  }

  // For single entity files, parse directly from frontmatter + content
  const entity: Entity = {
    id: entityId,
    name: file.frontmatter.name || entityId,
    filePath: file.path,
    network: file.frontmatter.network,
    namespace: file.frontmatter.namespace,
    owner: file.frontmatter.owner,
    tags: file.frontmatter.tags,
    description: file.frontmatter.description,
  };

  // Parse data source table
  const dataSourceMatch = file.content.match(/##\s+数据来源\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (dataSourceMatch) {
    const table = parseTable(dataSourceMatch[1]);
    if (table.length > 0 && table[0]['类型']) {
      entity.dataSource = {
        type: table[0]['类型'] || '',
        id: table[0]['ID'] || table[0]['id'] || '',
        name: table[0]['名称'] || table[0]['name'],
      };
    }
  }

  // Parse primary key and display key from quote block
  const quoteMatch = file.content.match(/>\s*\*\*主键\*\*:\s*`([^`]+)`\s*\|\s*\*\*显示属性\*\*:\s*`([^`]+)`/);
  if (quoteMatch) {
    entity.primaryKey = quoteMatch[1];
    entity.displayKey = quoteMatch[2];
  }

  // Parse data properties table
  const dataPropsMatch = file.content.match(/##\s+数据属性\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (dataPropsMatch) {
    const table = parseTable(dataPropsMatch[1]);
    entity.dataProperties = table.map((row) => ({
      name: row['属性名'] || row['property_name'] || '',
      displayName: row['显示名'] || row['display_name'],
      type: row['类型'] || row['type'],
      description: row['说明'] || row['description'],
      isPrimaryKey: row['主键'] === 'YES' || row['主键'] === '是' || row['isPrimaryKey'] === 'YES',
      isIndexed: row['索引'] === 'YES' || row['索引'] === '是' || row['isIndexed'] === 'YES',
    }));
  }

  // Parse properties override table
  const propsMatch = file.content.match(/##\s+属性覆盖\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (propsMatch) {
    const table = parseTable(propsMatch[1]);
    entity.properties = table.map((row) => ({
      name: row['属性名'] || row['property_name'] || '',
      displayName: row['显示名'] || row['display_name'],
      type: row['类型'] || row['type'],
      indexConfig: row['索引配置'] || row['index_config'],
      description: row['说明'] || row['description'],
    }));
  }

  // Parse logic properties
  const logicPropsMatch = file.content.match(/##\s+逻辑属性\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (logicPropsMatch) {
    const logicProps: LogicProperty[] = [];
    const sections = logicPropsMatch[1].split(/\n###\s+/);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const nameMatch = section.match(/^(\w+)/);
      if (!nameMatch) continue;

      const prop: LogicProperty = {
        name: nameMatch[1],
        type: 'metric',
        source: '',
      };

      const typeMatch = section.match(/-?\s*\*\*类型\*\*:\s*(\w+)/);
      if (typeMatch) prop.type = typeMatch[1] as 'metric' | 'operator';

      const sourceMatch = section.match(/-?\s*\*\*来源\*\*:\s*([^(]+)/);
      if (sourceMatch) {
        prop.source = sourceMatch[1].trim();
        const sourceTypeMatch = section.match(/\(([^)]+)\)/);
        if (sourceTypeMatch) prop.sourceType = sourceTypeMatch[1];
      }

      const descMatch = section.match(/-?\s*\*\*说明\*\*:\s*(.+)/);
      if (descMatch) prop.description = descMatch[1].trim();

      const paramTable = parseTable(section);
      if (paramTable.length > 0 && paramTable[0]['参数名']) {
        prop.parameters = paramTable.map((row) => ({
          name: row['参数名'] || row['parameter_name'] || '',
          source: (row['来源'] || row['source'] || 'input') as 'property' | 'input' | 'const',
          binding: row['绑定值'] || row['binding'] || row['绑定'] || undefined,
          description: row['说明'] || row['description'],
        }));
      }

      logicProps.push(prop);
    }

    if (logicProps.length > 0) entity.logicProperties = logicProps;
  }

  return entity;
}

/**
 * Parse all Relations from a network-type BKN file
 */
function parseAllRelations(file: BKNFile): Relation[] {
  const relations: Relation[] = [];
  
  // Find all Relation sections: ## Relation: {id}
  const relationPattern = /##\s+Relation:\s+(\w+)([\s\S]*?)(?=\n##\s+(?:Entity|Relation|Action|#\s+[^#])|$)/g;
  let match;
  
  while ((match = relationPattern.exec(file.content)) !== null) {
    const relationId = match[1];
    const relationContent = match[2].trim();
    
    // Create a temporary file-like object for this relation section
    const relationFile: BKNFile = {
      ...file,
      content: relationContent,
      frontmatter: {
        ...file.frontmatter,
        id: relationId,
        type: 'relation',
      },
    };
    
    const relation = parseRelationFromContent(relationFile, relationId);
    if (relation) {
      relations.push(relation);
    }
  }
  
  return relations;
}

/**
 * Parse Relation from content (internal helper)
 */
function parseRelationFromContent(file: BKNFile, relationId: string): Relation | null {
  // Extract name from content: **Name** - description
  const nameMatch = file.content.match(/\*\*([^*]+)\*\*\s*-\s*([^\n]+)/);
  const relationName = nameMatch ? nameMatch[1].trim() : relationId;

  const relation: Relation = {
    id: relationId,
    name: relationName,
    filePath: file.path,
    network: file.frontmatter.network,
    namespace: file.frontmatter.namespace,
    owner: file.frontmatter.owner,
    source: '',
    target: '',
    type: 'direct',
  };

  // Parse description
  const descMatch = file.content.match(/\*\*[^*]+\*\*\s*-\s*([^\n]+)/);
  if (descMatch) {
    relation.description = descMatch[1].trim();
  }

  // Parse relation definition table (起点/终点/类型)
  // Look for table with 起点/终点/类型 headers
  // Match table from header to next section (### or ## or blank line)
  const relDefMatch = file.content.match(/\|\s*起点\s*\|\s*终点\s*\|\s*类型\s*\|[\s\S]*?(?=\n###|\n##|\n\n|$)/);
  
  if (relDefMatch) {
    const table = parseTable(relDefMatch[0]);
    if (table.length > 0) {
      relation.source = table[0]['起点'] || table[0]['source'] || '';
      relation.target = table[0]['终点'] || table[0]['target'] || '';
      relation.type = (table[0]['类型'] || table[0]['type'] || 'direct') as 'direct' | 'data_view';
    }
  }

  // Parse mapping rules
  const mappingMatch = file.content.match(/###\s+映射规则\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (mappingMatch) {
    const table = parseTable(mappingMatch[1]);
    relation.mappingRules = table.map((row) => ({
      sourceProperty: row['起点属性'] || row['source_property'] || row['起点属性 (Pod)'] || row['起点属性 (Service)'] || undefined,
      targetProperty: row['终点属性'] || row['target_property'] || row['终点属性 (Node)'] || row['终点属性 (Pod)'] || undefined,
      viewProperty: row['视图属性'] || row['view_property'] || undefined,
    }));
  }

  // Parse data view mapping (for data_view type)
  if (relation.type === 'data_view') {
    const viewMatch = file.content.match(/###\s+映射视图\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
    if (viewMatch) {
      const table = parseTable(viewMatch[1]);
      if (table.length > 0) {
        relation.dataView = {
          type: table[0]['类型'] || '',
          id: table[0]['ID'] || table[0]['id'] || '',
        };
      }
    }
  }

  return relation.source && relation.target ? relation : null;
}

/**
 * Parse Relation from BKN file (single relation file format)
 */
function parseRelation(file: BKNFile): Relation | null {
  if (file.frontmatter.type !== 'relation' && file.frontmatter.type !== 'network' && file.frontmatter.type !== 'fragment') {
    return null;
  }

  const relationId = file.frontmatter.id;
  if (!relationId) {
    const match = file.content.match(/^##\s+Relation:\s+(\w+)/m);
    if (!match) return null;
    return parseRelationFromContent(file, match[1]);
  }

  // For single relation files, parse directly from frontmatter + content
  const relation: Relation = {
    id: relationId,
    name: file.frontmatter.name || relationId,
    filePath: file.path,
    network: file.frontmatter.network,
    namespace: file.frontmatter.namespace,
    owner: file.frontmatter.owner,
    source: '',
    target: '',
    type: 'direct',
    description: file.frontmatter.description,
  };

  // Parse relation definition table from "## 关联定义" section
  const relDefMatch = file.content.match(/##\s+关联定义\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (relDefMatch) {
    const table = parseTable(relDefMatch[1]);
    if (table.length > 0) {
      relation.source = table[0]['起点'] || table[0]['source'] || '';
      relation.target = table[0]['终点'] || table[0]['target'] || '';
      relation.type = (table[0]['类型'] || table[0]['type'] || 'direct') as 'direct' | 'data_view';
    }
  }

  // Parse mapping rules from "## 映射规则" section
  const mappingMatch = file.content.match(/##\s+映射规则\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (mappingMatch) {
    const table = parseTable(mappingMatch[1]);
    relation.mappingRules = table.map((row) => {
      // Handle various header formats
      const sourceKey = Object.keys(row).find(k => k.includes('起点'));
      const targetKey = Object.keys(row).find(k => k.includes('终点'));
      return {
        sourceProperty: sourceKey ? row[sourceKey] : undefined,
        targetProperty: targetKey ? row[targetKey] : undefined,
      };
    });
  }

  return relation.source && relation.target ? relation : null;
}

/**
 * Parse all Actions from a network-type BKN file
 */
function parseAllActions(file: BKNFile): Action[] {
  const actions: Action[] = [];
  
  // Find all Action sections: ## Action: {id}
  const actionPattern = /##\s+Action:\s+(\w+)([\s\S]*?)(?=\n##\s+(?:Entity|Relation|Action|#\s+[^#])|$)/g;
  let match;
  
  while ((match = actionPattern.exec(file.content)) !== null) {
    const actionId = match[1];
    const actionContent = match[2].trim();
    
    // Create a temporary file-like object for this action section
    const actionFile: BKNFile = {
      ...file,
      content: actionContent,
      frontmatter: {
        ...file.frontmatter,
        id: actionId,
        type: 'action',
      },
    };
    
    const action = parseActionFromContent(actionFile, actionId);
    if (action) {
      actions.push(action);
    }
  }
  
  return actions;
}

/**
 * Parse Action from content (internal helper)
 */
function parseActionFromContent(file: BKNFile, actionId: string): Action | null {
  // Extract name from content: **Name** - description
  const nameMatch = file.content.match(/\*\*([^*]+)\*\*\s*-\s*([^\n]+)/);
  const actionName = nameMatch ? nameMatch[1].trim() : actionId;

  const action: Action = {
    id: actionId,
    name: actionName,
    filePath: file.path,
    network: file.frontmatter.network,
    namespace: file.frontmatter.namespace,
    owner: file.frontmatter.owner,
    entityId: '',
    actionType: file.frontmatter.action_type || 'modify',
    enabled: file.frontmatter.enabled,
    risk_level: file.frontmatter.risk_level,
    requires_approval: file.frontmatter.requires_approval,
  };

  // Parse description
  const descMatch = file.content.match(/\*\*[^*]+\*\*\s*-\s*([^\n]+)/);
  if (descMatch) {
    action.description = descMatch[1].trim();
  }

  // Parse binding entity table
  // Match table from header to next section (### or ## or blank line)
  const bindingMatch = file.content.match(/\|\s*绑定实体\s*\|\s*行动类型\s*\|[\s\S]*?(?=\n###|\n##|\n\n|$)/);
  if (bindingMatch) {
    const table = parseTable(bindingMatch[0]);
    if (table.length > 0) {
      action.entityId = table[0]['绑定实体'] || table[0]['entity_id'] || '';
      action.actionType = (table[0]['行动类型'] || table[0]['action_type'] || action.actionType) as 'add' | 'modify' | 'delete';
    }
  }

  // Parse condition (YAML block)
  const conditionMatch = file.content.match(/```yaml\s*\n([\s\S]*?)```/);
  if (conditionMatch) {
    try {
      const cond = yaml.load(conditionMatch[1]) as any;
      if (cond.condition) {
        action.condition = cond.condition as Condition;
      }
    } catch (e) {
      // Fallback: parse from markdown
      const condText = conditionMatch[1];
      const fieldMatch = condText.match(/field:\s*(.+)/);
      const opMatch = condText.match(/operation:\s*(.+)/);
      const valueMatch = condText.match(/value:\s*(.+)/);
      if (fieldMatch && opMatch) {
        action.condition = {
          field: fieldMatch[1].trim(),
          operation: opMatch[1].trim() as Condition['operation'],
          value: valueMatch ? valueMatch[1].trim() : undefined,
        };
      }
    }
  }

  // Parse tool config
  const toolMatch = file.content.match(/###\s+工具配置\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (toolMatch) {
    const table = parseTable(toolMatch[1]);
    if (table.length > 0) {
      const type = table[0]['类型'] || table[0]['type'] || '';
      if (type === 'tool') {
        action.toolConfig = {
          type: 'tool',
          boxId: table[0]['工具箱ID'] || table[0]['box_id'],
          toolId: table[0]['工具ID'] || table[0]['tool_id'] || '',
        };
      } else if (type === 'mcp') {
        action.mcpConfig = {
          type: 'mcp',
          mcpId: table[0]['MCP ID'] || table[0]['mcp_id'] || '',
          toolName: table[0]['工具名称'] || table[0]['tool_name'] || '',
        };
      }
    }
  }

  // Parse parameters
  const paramMatch = file.content.match(/###\s+参数绑定\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (paramMatch) {
    const table = parseTable(paramMatch[1]);
    action.parameters = table.map((row) => ({
      name: row['参数'] || row['parameter'] || row['参数名'] || '',
      source: (row['来源'] || row['source'] || 'input') as 'property' | 'input' | 'const',
      binding: row['绑定'] || row['binding'] || row['绑定值'] || undefined,
      description: row['说明'] || row['description'],
    }));
  }

  // Parse schedule
  const scheduleMatch = file.content.match(/###\s+调度配置\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (scheduleMatch) {
    const table = parseTable(scheduleMatch[1]);
    if (table.length > 0) {
      action.schedule = {
        type: (table[0]['类型'] || table[0]['type'] || 'FIX_RATE') as 'FIX_RATE' | 'CRON',
        expression: table[0]['表达式'] || table[0]['expression'] || '',
        description: table[0]['说明'] || table[0]['description'],
      };
    }
  }

  // Parse affect
  const affectMatch = file.content.match(/###\s+影响范围\s*\n\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (affectMatch) {
    const table = parseTable(affectMatch[1]);
    action.affect = table.map((row) => ({
      object: row['影响对象'] || row['object'] || '',
      description: row['影响描述'] || row['description'] || '',
    }));
  }

  return action.entityId ? action : null;
}

/**
 * Parse Action from BKN file (single action file format)
 */
function parseAction(file: BKNFile): Action | null {
  if (file.frontmatter.type !== 'action' && file.frontmatter.type !== 'network' && file.frontmatter.type !== 'fragment') {
    return null;
  }

  const actionId = file.frontmatter.id;
  if (!actionId) {
    const match = file.content.match(/^##\s+Action:\s+(\w+)/m);
    if (!match) return null;
    return parseActionFromContent(file, match[1]);
  }

  // For single action files, parse directly from frontmatter + content
  const action: Action = {
    id: actionId,
    name: file.frontmatter.name || actionId,
    filePath: file.path,
    network: file.frontmatter.network,
    namespace: file.frontmatter.namespace,
    owner: file.frontmatter.owner,
    entityId: '',
    actionType: file.frontmatter.action_type || 'modify',
    enabled: file.frontmatter.enabled,
    risk_level: file.frontmatter.risk_level,
    requires_approval: file.frontmatter.requires_approval,
    description: file.frontmatter.description,
  };

  // Parse binding entity table from "## 绑定实体" section
  const bindingMatch = file.content.match(/##\s+绑定实体\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (bindingMatch) {
    const table = parseTable(bindingMatch[1]);
    if (table.length > 0) {
      action.entityId = table[0]['绑定实体'] || table[0]['entity_id'] || '';
      action.actionType = (table[0]['行动类型'] || table[0]['action_type'] || action.actionType) as 'add' | 'modify' | 'delete';
    }
  }

  // Parse condition (YAML block)
  const conditionMatch = file.content.match(/```yaml\s*\n([\s\S]*?)```/);
  if (conditionMatch) {
    try {
      const cond = yaml.load(conditionMatch[1]) as any;
      if (cond.condition) {
        action.condition = cond.condition as Condition;
      }
    } catch (e) {
      const condText = conditionMatch[1];
      const fieldMatch = condText.match(/field:\s*(.+)/);
      const opMatch = condText.match(/operation:\s*(.+)/);
      const valueMatch = condText.match(/value:\s*(.+)/);
      if (fieldMatch && opMatch) {
        action.condition = {
          field: fieldMatch[1].trim(),
          operation: opMatch[1].trim() as Condition['operation'],
          value: valueMatch ? valueMatch[1].trim() : undefined,
        };
      }
    }
  }

  // Parse tool config from "## 工具配置" section
  const toolMatch = file.content.match(/##\s+工具配置\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (toolMatch) {
    const table = parseTable(toolMatch[1]);
    if (table.length > 0) {
      const type = table[0]['类型'] || table[0]['type'] || '';
      if (type === 'tool') {
        action.toolConfig = {
          type: 'tool',
          boxId: table[0]['工具箱ID'] || table[0]['box_id'],
          toolId: table[0]['工具ID'] || table[0]['tool_id'] || '',
        };
      } else if (type === 'mcp') {
        action.mcpConfig = {
          type: 'mcp',
          mcpId: table[0]['MCP ID'] || table[0]['mcp_id'] || '',
          toolName: table[0]['工具名称'] || table[0]['tool_name'] || '',
        };
      }
    }
  }

  // Parse parameters from "## 参数绑定" section
  const paramMatch = file.content.match(/##\s+参数绑定\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (paramMatch) {
    const table = parseTable(paramMatch[1]);
    action.parameters = table.map((row) => ({
      name: row['参数'] || row['parameter'] || row['参数名'] || '',
      source: (row['来源'] || row['source'] || 'input') as 'property' | 'input' | 'const',
      binding: row['绑定'] || row['binding'] || row['绑定值'] || undefined,
      description: row['说明'] || row['description'],
    }));
  }

  // Parse schedule from "## 调度配置" section
  const scheduleMatch = file.content.match(/##\s+调度配置\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (scheduleMatch) {
    const table = parseTable(scheduleMatch[1]);
    if (table.length > 0) {
      action.schedule = {
        type: (table[0]['类型'] || table[0]['type'] || 'FIX_RATE') as 'FIX_RATE' | 'CRON',
        expression: table[0]['表达式'] || table[0]['expression'] || '',
        description: table[0]['说明'] || table[0]['description'],
      };
    }
  }

  // Parse affect from "## 影响范围" section
  const affectMatch = file.content.match(/##\s+影响范围\s*\n+([\s\S]*?)(?=\n##|$)/);
  if (affectMatch) {
    const table = parseTable(affectMatch[1]);
    action.affect = table.map((row) => ({
      object: row['影响对象'] || row['object'] || '',
      description: row['影响描述'] || row['description'] || '',
    }));
  }

  return action.entityId ? action : null;
}

/**
 * Parse markdown table into array of objects
 */
function parseTable(tableText: string): Record<string, string>[] {
  // Split by lines and filter empty lines
  const lines = tableText.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Find header line (must contain |)
  const headerIndex = lines.findIndex(line => line.includes('|') && !line.match(/^\s*\|[-:|\s]+\|\s*$/));
  if (headerIndex === -1) return [];
  
  // Parse header
  const headerLine = lines[headerIndex];
  const headerParts = headerLine.split('|');
  const headers: string[] = [];
  
  for (let i = 0; i < headerParts.length; i++) {
    const h = headerParts[i].trim();
    if (h && !h.match(/^[-:]+$/)) {
      headers.push(h);
    }
  }
  
  if (headers.length === 0) return [];
  
  // Find separator line (contains only -, |, :, and spaces)
  let separatorIndex = lines.findIndex((line, idx) => 
    idx > headerIndex && line.match(/^\s*\|[-:|\s]+\|\s*$/)
  );
  
  // If no separator found, assume it's right after header
  if (separatorIndex === -1) {
    separatorIndex = headerIndex + 1;
  }
  
  // Parse data rows (after separator)
  const rows: Record<string, string>[] = [];
  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    
    const parts = line.split('|');
    const values: string[] = [];
    
    // Extract values (skip first and last empty parts)
    for (let j = 1; j < parts.length - 1 && values.length < headers.length; j++) {
      values.push(parts[j].trim());
    }
    
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse multiple BKN files into a network structure
 */
export function parseBKNNetwork(files: BKNFile[]): BKNNetwork {
  const network: BKNNetwork = {
    id: '',
    name: '',
    entities: [],
    relations: [],
    actions: [],
    files: [],
  };

  // Find network file
  const networkFile = files.find(f => f.frontmatter.type === 'network');
  if (networkFile) {
    network.id = networkFile.frontmatter.id;
    network.name = networkFile.frontmatter.name || networkFile.frontmatter.id;
  }

  // Parse all files
  for (const file of files) {
    network.files.push(file);
    const fileType = file.frontmatter.type;

    // For network-type or fragment-type files, parse all entities, relations, and actions
    if (fileType === 'network' || fileType === 'fragment') {
      const entities = parseAllEntities(file);
      const relations = parseAllRelations(file);
      const actions = parseAllActions(file);
      network.entities.push(...entities);
      network.relations.push(...relations);
      network.actions.push(...actions);
    } else {
      // For single-type files, parse one of each type
      // Parse entities
      if (fileType === 'entity') {
        const entity = parseEntity(file);
        if (entity) {
          network.entities.push(entity);
        }
      }

      // Parse relations
      if (fileType === 'relation') {
        const relation = parseRelation(file);
        if (relation) {
          network.relations.push(relation);
        }
      }

      // Parse actions
      if (fileType === 'action') {
        const action = parseAction(file);
        if (action) {
          network.actions.push(action);
        }
      }
    }
  }

  // If no network file, infer network ID from first file
  if (!network.id && files.length > 0) {
    network.id = files[0].frontmatter.network || 'default-network';
    network.name = network.id;
  }

  return network;
}
