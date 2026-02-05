'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Copy, Check, Loader2, FileText, Database, Eye, EyeOff } from 'lucide-react';
import { useBKNStore } from '@/lib/store';
import { getAllFiles, getFile } from '@/lib/storage';
import { mockDataSources } from '@/lib/mock-data-sources';

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (content: string) => void;
}

export function AIGenerateDialog({
  open,
  onOpenChange,
  onApply,
}: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResolvedPrompt, setShowResolvedPrompt] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const { openFile } = useBKNStore();
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick prompt templates
  const quickPrompts = [
    { label: '新建实体', prompt: '帮我创建一个新的实体类，包含数据来源、主键、显示属性等完整定义' },
    { label: '新建关系', prompt: '帮我创建一个新的关系，连接两个已存在的实体' },
    { label: '新建行动', prompt: '帮我创建一个新的行动，包含触发条件、工具配置和参数绑定' },
  ];

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt);
  };

  const buildDataSourcesSummary = (): string => {
    return Object.values(mockDataSources)
      .map((ds) => {
        const columns = ds.columns.map((col) => `  - ${col.name} (${col.type}): ${col.description}`).join('\n');
        return `### ${ds.name} (ID: ${ds.id})\n${ds.description}\n\n字段:\n${columns}`;
      })
      .join('\n\n');
  };

  // Get available mentions (files and data sources)
  const availableMentions = useMemo(() => {
    const files = Object.keys(getAllFiles());
    const dataSources = Object.keys(mockDataSources);
    
    const fileMentions = files.map(path => ({
      type: 'file' as const,
      name: path,
      displayName: path,
      icon: FileText,
    }));
    
    const dataSourceMentions = dataSources.map(id => ({
      type: 'datasource' as const,
      name: id,
      displayName: mockDataSources[id].name,
      icon: Database,
    }));
    
    return [...fileMentions, ...dataSourceMentions];
  }, []);

  // Filter mentions based on query
  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return availableMentions;
    const query = mentionQuery.toLowerCase();
    return availableMentions.filter(m => 
      m.displayName.toLowerCase().includes(query) || 
      m.name.toLowerCase().includes(query)
    );
  }, [mentionQuery, availableMentions]);

  // Handle textarea input and detect @ mentions
  const handlePromptChange = (value: string) => {
    setPrompt(value);
    
    // Detect @ mention
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space or newline after @ (meaning mention ended)
      if (!textAfterAt.match(/[\s\n]/)) {
        setMentionQuery(textAfterAt);
        // Calculate position for dropdown (simplified - show below textarea)
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }
        setSelectedMentionIndex(0);
        return;
      }
    }
    
    // Hide mention menu if @ is not active
    setMentionQuery('');
    setMentionPosition(null);
  };

  // Insert mention into prompt
  const insertMention = (mention: typeof availableMentions[0]) => {
    if (!textareaRef.current) return;
    
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = prompt.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const newPrompt = 
        prompt.substring(0, lastAtIndex) + 
        `@${mention.name}` + 
        prompt.substring(cursorPos);
      
      setPrompt(newPrompt);
      setMentionQuery('');
      setMentionPosition(null);
      
      // Set cursor position after inserted mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = lastAtIndex + mention.name.length + 1;
          textareaRef.current.setSelectionRange(newPos, newPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // Handle keyboard navigation in mention menu
  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!mentionPosition) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < filteredMentions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev > 0 ? prev - 1 : filteredMentions.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredMentions[selectedMentionIndex]) {
        insertMention(filteredMentions[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setMentionQuery('');
      setMentionPosition(null);
    }
  };

  const generateMockContent = (userPrompt: string): string => {
    // Resolve @ mentions first
    const resolvedPrompt = resolveMentions(userPrompt);
    
    // 简单的模拟生成逻辑，根据提示词返回示例内容
    const lowerPrompt = resolvedPrompt.toLowerCase();
    
    if (lowerPrompt.includes('实体') || lowerPrompt.includes('entity')) {
      return `---
type: entity
id: new_entity
name: 新实体
network: k8s-topology
---

## Entity: new_entity

**新实体** - 这是一个由AI生成的实体示例

### 数据来源

| 类型 | ID |
|------|-----|
| data_view | d2mio43q6gt6p380dis0 |

> **主键**: \`id\` | **显示属性**: \`name\`

### 数据属性

| 属性名 | 显示名 | 类型 | 说明 | 主键 | 索引 |
|--------|--------|------|------|:----:|:----:|
| id | ID | int64 | 主键ID | YES | YES |
| name | 名称 | VARCHAR | 实体名称 | | YES |
| status | 状态 | VARCHAR | 实体状态 | | YES |

### 逻辑属性

#### entity_metrics

- **类型**: metric
- **来源**: entity_metric (metric-model)
- **说明**: 实体监控指标

| 参数名 | 来源 | 绑定值 |
|--------|------|--------|
| id | property | id |
| name | property | name |`;
    } else if (lowerPrompt.includes('关系') || lowerPrompt.includes('relation')) {
      return `---
type: relation
id: new_relation
name: 新关系
network: k8s-topology
---

## Relation: new_relation

**新关系** - 这是一个由AI生成的关系示例

| 起点 | 终点 | 类型 |
|------|------|------|
| pod | node | direct |

### 映射规则

| 起点属性 | 终点属性 |
|----------|----------|
| pod_node_name | node_name |

### 业务语义

这是一个示例关系定义，用于连接两个实体。`;
    } else if (lowerPrompt.includes('行动') || lowerPrompt.includes('action')) {
      return `---
type: action
id: new_action
name: 新行动
network: k8s-topology
action_type: modify
---

## Action: new_action

**新行动** - 这是一个由AI生成的行动示例

| 绑定实体 | 行动类型 |
|----------|----------|
| pod | modify |

### 触发条件

\`\`\`yaml
condition:
  object_type_id: pod
  field: status
  operation: ==
  value: Failed
\`\`\`

### 工具配置

| 类型 | 工具箱ID | 工具ID |
|------|----------|--------|
| tool | k8s_toolbox | example_tool |

### 参数绑定

| 参数 | 来源 | 绑定 | 说明 |
|------|------|------|------|
| id | property | id | 实体ID |
| name | property | name | 实体名称 |`;
    }
    
    // 默认返回实体模板
    return `---
type: entity
id: generated_entity
name: 生成的实体
network: k8s-topology
---

## Entity: generated_entity

**生成的实体** - AI生成的示例实体

### 数据来源

| 类型 | ID |
|------|-----|
| data_view | d2mio43q6gt6p380dis0 |

> **主键**: \`id\` | **显示属性**: \`name\``;
  };

  // Resolve @ mentions in prompt to actual content
  const resolveMentions = (promptText: string): string => {
    let resolvedPrompt = promptText;
    const allFiles = getAllFiles();
    
    // Replace @file mentions
    const fileMentions = promptText.match(/@([^\s@]+)/g) || [];
    for (const mention of fileMentions) {
      const fileName = mention.substring(1); // Remove @
      if (allFiles[fileName]) {
        resolvedPrompt = resolvedPrompt.replace(
          mention,
          `\n\n[文件: ${fileName}]\n\`\`\`markdown\n${allFiles[fileName]}\n\`\`\`\n\n`
        );
      } else if (mockDataSources[fileName]) {
        const ds = mockDataSources[fileName];
        const columns = ds.columns.map(col => 
          `  - ${col.name} (${col.type}): ${col.description}`
        ).join('\n');
        resolvedPrompt = resolvedPrompt.replace(
          mention,
          `\n\n[数据来源: ${ds.name}]\n${ds.description}\n\n字段:\n${columns}\n\n`
        );
      }
    }
    
    return resolvedPrompt;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');
    setMentionQuery('');
    setMentionPosition(null);
    
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const allFiles = getAllFiles();
      const currentFileContent = openFile ? getFile(openFile) : undefined;
      const dataSourcesSummary = buildDataSourcesSummary();
      
      // Resolve @ mentions in prompt
      const resolvedPrompt = resolveMentions(prompt);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: resolvedPrompt,
          context: {
            dataSourcesSummary,
            existingFiles: allFiles,
            currentFile: currentFileContent,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        // If API fails, use mock mode
        let errorMessage = 'Failed to generate content';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        // Use mock mode for API key errors or 500 errors
        if (errorMessage.includes('OPENAI_API_KEY') || response.status === 500 || response.status === 401) {
          // Simulate streaming for mock content
          const mockContent = generateMockContent(prompt);
          const words = mockContent.split('');
          let currentContent = '';
          
          for (let i = 0; i < words.length; i++) {
            currentContent += words[i];
            setGeneratedContent(currentContent);
            // Simulate typing delay (reduced for faster demo)
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          setIsGenerating(false);
          return;
        }
        throw new Error(errorMessage);
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let content = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        content += chunk;
        setGeneratedContent(content);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Error generating content:', error);
      
      // Try mock mode on any error (network error, API error, etc.)
      try {
        const mockContent = generateMockContent(prompt);
        const words = mockContent.split('');
        let currentContent = '';
        
        for (let i = 0; i < words.length; i++) {
          currentContent += words[i];
          setGeneratedContent(currentContent);
          // Simulate typing delay (reduced for faster demo)
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (mockError) {
        setGeneratedContent(`错误: ${error.message || '生成失败，请检查 OPENAI_API_KEY 配置'}\n\n提示：当前使用模拟模式，配置 OPENAI_API_KEY 后可使用真实AI生成。`);
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
      return;
    }
    
    setIsGenerating(false);
    abortControllerRef.current = null;
  };

  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = () => {
    if (generatedContent && !generatedContent.startsWith('错误:')) {
      onApply(generatedContent);
      onOpenChange(false);
      // Reset state
      setPrompt('');
      setGeneratedContent('');
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setPrompt('');
      setGeneratedContent('');
      setIsGenerating(false);
      setMentionQuery('');
      setMentionPosition(null);
    }
  }, [open]);

  // Close mention menu when clicking outside
  useEffect(() => {
    if (!mentionPosition) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.mention-dropdown')) {
          setMentionQuery('');
          setMentionPosition(null);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mentionPosition]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 生成 BKN 内容
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Prompt Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">生成提示</label>
              {prompt && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowResolvedPrompt(!showResolvedPrompt)}
                  className="h-7 text-xs"
                  aria-label={showResolvedPrompt ? '隐藏解析后的提示词' : '查看解析后的提示词'}
                >
                  {showResolvedPrompt ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      隐藏提示词
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      查看提示词
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {quickPrompts.map((qp, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  disabled={isGenerating}
                  className="text-xs"
                >
                  {qp.label}
                </Button>
              ))}
            </div>
            {showResolvedPrompt && prompt && (
              <div className="mb-2 p-3 bg-muted/50 border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">解析后的提示词（实际发送给AI）</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const resolved = resolveMentions(prompt);
                      await navigator.clipboard.writeText(resolved);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="h-6 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="max-h-48">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
                    {resolveMentions(prompt)}
                  </pre>
                </ScrollArea>
              </div>
            )}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="例如：帮我定义一个 Deployment 实体类，包含数据来源、主键和显示属性... 使用 @文件名 或 @数据资源名 引用项目内容"
                className="w-full min-h-[100px] p-3 border rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if (mentionPosition) {
                    handleMentionKeyDown(e);
                    return;
                  }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                onSelect={(e) => {
                  // Update cursor position when selection changes
                  const target = e.target as HTMLTextAreaElement;
                  handlePromptChange(target.value);
                }}
              />
              {/* Mention autocomplete dropdown */}
              {mentionPosition && filteredMentions.length > 0 && (
                <div
                  className="mention-dropdown fixed z-50 w-64 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg mt-1"
                  style={{
                    top: `${mentionPosition.top}px`,
                    left: `${mentionPosition.left}px`,
                  }}
                >
                  {filteredMentions.map((mention, index) => {
                    const Icon = mention.icon;
                    return (
                      <button
                        key={`${mention.type}-${mention.name}`}
                        type="button"
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent ${
                          index === selectedMentionIndex ? 'bg-accent' : ''
                        }`}
                        onClick={() => insertMention(mention)}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {mention.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {mention.type === 'file' ? mention.name : `数据来源: ${mention.name}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              按 Ctrl+Enter 或 Cmd+Enter 生成 | 输入 @ 可引用文件和数据资源
            </p>
          </div>

          {/* Generated Content Output */}
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">生成结果</label>
              {generatedContent && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-7"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </>
                  )}
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 border rounded-md bg-muted/50">
              <div className="p-4">
                {isGenerating && !generatedContent && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">AI 正在生成中...</span>
                  </div>
                )}
                {generatedContent ? (
                  <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground">
                    {generatedContent}
                  </pre>
                ) : !isGenerating ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    生成的内容将显示在这里
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                生成
              </>
            )}
          </Button>
          <Button
            onClick={handleApply}
            disabled={!generatedContent || generatedContent.startsWith('错误:') || isGenerating}
          >
            应用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
