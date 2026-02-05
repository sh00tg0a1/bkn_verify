import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Build system prompt with BKN specification summary
function buildSystemPrompt(
  dataSourcesSummary: string,
  existingFiles: Record<string, string>,
  currentFile?: string
): string {
  const existingFilesContext = Object.entries(existingFiles)
    .map(([path, content]) => `\n\n## File: ${path}\n\`\`\`markdown\n${content}\n\`\`\``)
    .join('\n');

  const currentFileContext = currentFile
    ? `\n\n## Current File Being Edited\n\`\`\`markdown\n${currentFile}\n\`\`\``
    : '';

  return `You are a BKN (Business Knowledge Network) expert. Your task is to generate valid BKN Markdown content based on user requests.

## BKN Format Rules

### File Structure
Each BKN file has two parts:
1. YAML Frontmatter (metadata)
2. Markdown Body (content)

### Frontmatter Types
- \`type: entity\` - Single entity definition
- \`type: relation\` - Single relation definition  
- \`type: action\` - Single action definition
- \`type: network\` - Complete network with multiple definitions
- \`type: fragment\` - Mixed fragment with multiple types

### Entity Format
\`\`\`markdown
---
type: entity
id: {entity_id}
name: {实体名称}
network: {network_id}
---

## Entity: {entity_id}

**{显示名称}** - {简短描述}

### 数据来源

| 类型 | ID |
|------|-----|
| data_view | {view_id} |

> **主键**: \`{primary_key}\` | **显示属性**: \`{display_key}\`

### 属性覆盖

| 属性名 | 显示名 | 索引配置 | 说明 |
|--------|--------|----------|------|
| {property} | {显示名} | {索引配置} | {说明} |

### 数据属性

| 属性名 | 显示名 | 类型 | 说明 | 主键 | 索引 |
|--------|--------|------|------|:----:|:----:|
| {name} | {display} | {type} | {desc} | YES/NO | YES/NO |

### 逻辑属性

#### {property_name}

- **类型**: metric | operator
- **来源**: {source_id} ({source_type})
- **说明**: {description}

| 参数名 | 来源 | 绑定值 |
|--------|------|--------|
| {param} | property | {property_name} |
| {param} | input | - |
\`\`\`

### Relation Format
\`\`\`markdown
---
type: relation
id: {relation_id}
name: {关系名称}
network: {network_id}
---

## Relation: {relation_id}

**{显示名称}** - {简短描述}

| 起点 | 终点 | 类型 |
|------|------|------|
| {source_entity} | {target_entity} | direct |

### 映射规则

| 起点属性 | 终点属性 |
|----------|----------|
| {source_prop} | {target_prop} |
\`\`\`

### Action Format
\`\`\`markdown
---
type: action
id: {action_id}
name: {行动名称}
network: {network_id}
action_type: add | modify | delete
---

## Action: {action_id}

**{显示名称}** - {简短描述}

| 绑定实体 | 行动类型 |
|----------|----------|
| {entity_id} | modify |

### 触发条件

\`\`\`yaml
condition:
  object_type_id: {entity_id}
  field: {property_name}
  operation: == | != | > | < | >= | <= | in | not_in
  value: {value}
\`\`\`

### 工具配置

| 类型 | 工具箱ID | 工具ID |
|------|----------|--------|
| tool | {box_id} | {tool_id} |

### 参数绑定

| 参数 | 来源 | 绑定 | 说明 |
|------|------|------|------|
| {param} | property | {property_name} | {说明} |
| {param} | input | - | {说明} |
| {param} | const | {value} | {说明} |
\`\`\`

## Available Data Sources

${dataSourcesSummary}

## Existing Project Files

${existingFilesContext}${currentFileContext}

## Important Rules

1. Output ONLY the BKN Markdown content (including YAML frontmatter)
2. Do NOT include code fences (\`\`\`markdown) around the output
3. Use valid entity/relation IDs that exist in the project when referencing them
4. Follow the exact table formats shown above
5. Use Chinese for display names and descriptions unless specified otherwise
6. Ensure all required fields are present
7. Use consistent naming conventions (lowercase with underscores for IDs)`;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { prompt, context } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(
      context.dataSourcesSummary || '',
      context.existingFiles || {},
      context.currentFile
    );

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: 0.7,
    });

    // Create a ReadableStream for streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error generating BKN content:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate content' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
