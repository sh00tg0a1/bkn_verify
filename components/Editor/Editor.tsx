'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Plus, Save, FileText, GitBranch, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getFile, saveFile } from '@/lib/storage';
import { useBKNStore } from '@/lib/store';
import type { editor } from 'monaco-editor';

const ENTITY_TEMPLATE = `## Entity: new_entity

**实体名称** - 描述

### 数据来源

| 类型 | ID |
|------|-----|
| data_view | view_id |

> **主键**: \`id\` | **显示属性**: \`name\`

### 属性覆盖

| 属性名 | 显示名 | 索引配置 | 说明 |
|--------|--------|----------|------|
| property_name | 属性显示名 | keyword | 说明 |

### 逻辑属性

#### metric_name

- **类型**: metric
- **来源**: metric_source (metric-model)
- **说明**: 指标说明

| 参数名 | 来源 | 绑定值 |
|--------|------|--------|
| id | property | id |
| param | input | - |
`;

const RELATION_TEMPLATE = `## Relation: new_relation

**关系名称** - 描述

| 起点 | 终点 | 类型 |
|------|------|------|
| source_entity | target_entity | direct |

### 映射规则

| 起点属性 | 终点属性 |
|----------|----------|
| source_prop | target_prop |

### 业务语义

关系说明...
`;

const ACTION_TEMPLATE = `## Action: new_action

**行动名称** - 描述

| 绑定实体 | 行动类型 |
|----------|----------|
| entity_id | modify |

### 触发条件

\`\`\`yaml
condition:
  object_type_id: entity_id
  field: status
  operation: ==
  value: Failed
\`\`\`

### 工具配置

| 类型 | 工具箱ID | 工具ID |
|------|----------|--------|
| tool | toolbox_id | tool_id |

### 参数绑定

| 参数 | 来源 | 绑定 | 说明 |
|------|------|------|------|
| param1 | property | property_name | 说明 |
| param2 | input | - | 说明 |
| param3 | const | value | 说明 |

### 调度配置

| 类型 | 表达式 |
|------|--------|
| FIX_RATE | 5m |
`;

interface EditorProps {
  onContentChange?: (content: string) => void;
}

export function BKEditor({ onContentChange }: EditorProps) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { openFile, refreshFiles } = useBKNStore();

  useEffect(() => {
    // Load current file from store
    if (openFile) {
      const fileContent = getFile(openFile);
      if (fileContent !== null) {
        setContent(fileContent);
      } else {
        setContent('');
      }
    } else {
      setContent('');
    }
  }, [openFile]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Configure Monaco for Markdown + YAML
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      automaticLayout: true,
    });
  };

  const handleChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    setSaved(false);
    onContentChange?.(newContent);

    // Auto-save after 1 second of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (openFile) {
        saveFile(openFile, newContent);
        setSaved(true);
        refreshFiles();
      }
    }, 1000);
  };

  const insertTemplate = (template: string) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    const model = editor.getModel();
    
    if (!model) return;

    const position = selection
      ? selection.getEndPosition()
      : model.getPositionAt(model.getValueLength());
    
    const text = model.getValue();
    const offset = model.getOffsetAt(position);
    
    // Insert template at cursor position
    const newText = text.slice(0, offset) + '\n\n' + template + '\n\n' + text.slice(offset);
    model.setValue(newText);
    
    // Move cursor to end of inserted template
    const newOffset = offset + template.length + 4;
    const newPosition = model.getPositionAt(newOffset);
    editor.setPosition(newPosition);
    editor.focus();
  };

  const handleSave = () => {
    if (openFile) {
      saveFile(openFile, content);
      setSaved(true);
      refreshFiles();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                插入
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => insertTemplate(ENTITY_TEMPLATE)}>
                <FileText className="h-4 w-4 mr-2" />
                添加实体 (Entity)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertTemplate(RELATION_TEMPLATE)}>
                <GitBranch className="h-4 w-4 mr-2" />
                添加关系 (Relation)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertTemplate(ACTION_TEMPLATE)}>
                <Zap className="h-4 w-4 mr-2" />
                添加行动 (Action)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          {openFile && (
            <span className="text-xs text-muted-foreground">{openFile}</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={saved}
          >
            <Save className="h-4 w-4 mr-2" />
            {saved ? '已保存' : '保存'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {openFile ? (
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={content}
            onChange={handleChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>选择一个文件开始编辑</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
