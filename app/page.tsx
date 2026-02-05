'use client';

import { useEffect, useState } from 'react';
import { FileTree } from '@/components/FileTree/FileTree';
import { BKEditor } from '@/components/Editor/Editor';
import { GraphView } from '@/components/GraphView/GraphView';
import { ProjectSelector } from '@/components/ProjectSelector/ProjectSelector';
import { DataSourcePanel } from '@/components/DataSourcePanel/DataSourcePanel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, RotateCcw, Moon, Sun, BookOpen } from 'lucide-react';
import { useBKNStore } from '@/lib/store';
import { initializeStorage, resetStorage } from '@/lib/storage';
import { useTheme } from 'next-themes';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { refreshFiles, setOpenFile, network } = useBKNStore();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [specOpen, setSpecOpen] = useState(false);
  const [specContent, setSpecContent] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    // Initialize storage with examples
    initializeStorage().then(() => {
      refreshFiles();
      setLoading(false);
    });
  }, [refreshFiles]);

  const handleFileSelect = (path: string) => {
    setOpenFile(path);
  };

  const handleDownload = () => {
    if (!network || !network.id) {
      alert('没有可下载的数据');
      return;
    }

    // Prepare JSON data (exclude files array for cleaner output)
    const jsonData = {
      id: network.id,
      name: network.name,
      entities: network.entities,
      relations: network.relations,
      actions: network.actions,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${network.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = async () => {
    if (confirm('确定要重置所有数据吗？此操作无法撤销。')) {
      resetStorage();
      await initializeStorage();
      refreshFiles();
    }
  };

  const handleOpenSpec = async () => {
    if (!specContent) {
      try {
        const response = await fetch('/api/spec');
        if (response.ok) {
          const data = await response.json();
          setSpecContent(data.content);
        }
      } catch (e) {
        console.error('Failed to load specification:', e);
      }
    }
    setSpecOpen(true);
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">BKN Editor</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenSpec}>
            <BookOpen className="h-4 w-4 mr-2" />
            规范
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            下载
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main Content - Three Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Project Selector + File Tree + Data Source Panel */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r">
          <ProjectSelector />
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <FileTree onFileSelect={handleFileSelect} />
            </div>
            <DataSourcePanel />
          </div>
        </div>

        {/* Editor - Center */}
        <div className="flex-1 min-w-0">
          <BKEditor />
        </div>

        {/* Graph View - Right */}
        <div className="w-[500px] flex-shrink-0">
          <GraphView />
        </div>
      </div>

      {/* Specification Dialog */}
      <Dialog open={specOpen} onOpenChange={setSpecOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              BKN 语言规范
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
              <MarkdownContent content={specContent} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple Markdown renderer component
function MarkdownContent({ content }: { content: string }) {
  if (!content) {
    return <p className="text-muted-foreground">加载中...</p>;
  }

  // Convert markdown to HTML-like structure
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLanguage = '';
  let inTable = false;
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
            <code>{codeContent}</code>
          </pre>
        );
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLanguage = line.slice(3);
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    // Tables
    if (line.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!cells.every(c => c.match(/^[-:]+$/))) {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      // End of table
      elements.push(
        <table key={i} className="w-full text-sm border-collapse my-2">
          <thead>
            <tr>
              {tableRows[0]?.map((cell, j) => (
                <th key={j} className="border px-2 py-1 bg-muted text-left font-medium">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border px-2 py-1">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      tableRows = [];
      inTable = false;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold mt-5 mb-2 border-b pb-1">{line.slice(3)}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>);
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(5)}</h4>);
      continue;
    }

    // Quote blocks
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-primary pl-3 my-2 text-muted-foreground italic">
          {formatInlineText(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="my-4" />);
      continue;
    }

    // List items
    if (line.match(/^- /)) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          {formatInlineText(line.slice(2))}
        </li>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} className="my-1">{formatInlineText(line)}</p>);
  }

  // Handle trailing table
  if (inTable && tableRows.length > 0) {
    elements.push(
      <table key="final-table" className="w-full text-sm border-collapse my-2">
        <thead>
          <tr>
            {tableRows[0]?.map((cell, j) => (
              <th key={j} className="border px-2 py-1 bg-muted text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.slice(1).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <>{elements}</>;
}

// Format inline text (bold, code, links)
function formatInlineText(text: string): React.ReactNode {
  // Replace inline code
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs">{part.slice(1, -1)}</code>;
    }
    // Handle bold
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith('**') && bp.endsWith('**')) {
        return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
      }
      return bp;
    });
  });
}
