'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronDown,
  FileText,
  Network,
  GitBranch,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAllFiles, saveFile, deleteFile, renameFile, getTreeState, updateTreeState } from '@/lib/storage';
import { useBKNStore } from '@/lib/store';
import { parseBKNFile } from '@/lib/bkn-parser';
import type { BKNFileType } from '@/types/bkn';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  fileType?: BKNFileType;
}

interface FileTreeProps {
  onFileSelect?: (path: string) => void;
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{ type: 'file' | 'folder'; parent: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const { refreshFiles, setOpenFile } = useBKNStore();

  useEffect(() => {
    // Load files from storage
    const storedFiles = getAllFiles();
    setFiles(storedFiles);
    
    // Load expanded state
    const treeState = getTreeState();
    setExpanded(treeState);
  }, []);

  // Refresh files when store updates
  useEffect(() => {
    const handleRefresh = () => {
      const storedFiles = getAllFiles();
      setFiles(storedFiles);
    };
    
    // Refresh on mount and when store changes
    handleRefresh();
    const interval = setInterval(handleRefresh, 1000);
    return () => clearInterval(interval);
  }, []);

  // Build file tree structure
  const fileTree = useMemo(() => {
    const tree: FileNode[] = [];
    const pathMap = new Map<string, FileNode>();

    // Sort files by path
    const sortedPaths = Object.keys(files).sort();

    for (const path of sortedPaths) {
      const parts = path.split('/');
      let currentPath = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!pathMap.has(currentPath)) {
          const isFile = i === parts.length - 1;
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
          };

          if (isFile) {
            // Try to parse file to get type
            try {
              const parsed = parseBKNFile(files[path], path);
              node.fileType = parsed.frontmatter.type;
            } catch (e) {
              // Ignore parse errors
            }
          }

          pathMap.set(currentPath, node);

          if (parentPath) {
            const parent = pathMap.get(parentPath);
            if (parent) {
              if (!parent.children) {
                parent.children = [];
              }
              parent.children.push(node);
            }
          } else {
            tree.push(node);
          }
        }
      }
    }

    return tree;
  }, [files]);

  const handleFileClick = (path: string) => {
    setOpenFile(path);
    onFileSelect?.(path);
    refreshFiles();
  };

  const handleToggleExpand = (path: string) => {
    const newExpanded = { ...expanded, [path]: !expanded[path] };
    setExpanded(newExpanded);
    updateTreeState(path, newExpanded[path]);
  };

  const handleRename = (oldPath: string, newName: string) => {
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    
    if (newPath !== oldPath && !files[newPath]) {
      renameFile(oldPath, newPath);
      setFiles({ ...getAllFiles() });
      setEditingPath(null);
    }
  };

  const handleDelete = (path: string) => {
    deleteFile(path);
    setFiles({ ...getAllFiles() });
    refreshFiles();
    setDeleteDialog(null);
  };

  const handleCreate = (type: 'file' | 'folder', parent: string, name: string) => {
    const newPath = parent ? `${parent}/${name}` : name;
    
    if (type === 'file') {
      if (!name.endsWith('.bkn')) {
        name = `${name}.bkn`;
      }
      const finalPath = parent ? `${parent}/${name}` : name;
      
      // Create empty BKN file with basic structure
      const content = `---
type: entity
id: ${name.replace('.bkn', '')}
name: ${name.replace('.bkn', '')}
---

# ${name.replace('.bkn', '')}

描述...

## Entity: ${name.replace('.bkn', '')}

**${name.replace('.bkn', '')}** - 描述

### 数据来源

| 类型 | ID |
|------|-----|
| data_view | view_id |

> **主键**: \`id\` | **显示属性**: \`name\`
`;
      saveFile(finalPath, content);
    } else {
      // Create folder (just a placeholder, folders are virtual)
      // Folders are created automatically when files are added
    }
    
    setFiles({ ...getAllFiles() });
    refreshFiles();
    setNewItemDialog(null);
    setNewItemName('');
  };

  const getFileIcon = (fileType?: BKNFileType) => {
    switch (fileType) {
      case 'network':
        return <Network className="h-4 w-4 text-blue-500" />;
      case 'entity':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'relation':
        return <GitBranch className="h-4 w-4 text-purple-500" />;
      case 'action':
        return <Zap className="h-4 w-4 text-orange-500" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expanded[node.path] ?? false;
    const isEditing = editingPath === node.path;
    const indent = level * 20;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                className="flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer rounded transition-colors duration-200"
                style={{ paddingLeft: `${indent + 8}px` }}
                onClick={() => handleToggleExpand(node.path)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500" />
                )}
                <span className="text-sm">{node.name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setNewItemDialog({ type: 'file', parent: node.path })}>
                <Plus className="h-4 w-4 mr-2" />
                新建文件
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setNewItemDialog({ type: 'folder', parent: node.path })}>
                <Plus className="h-4 w-4 mr-2" />
                新建文件夹
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => {
                setEditingPath(node.path);
                setEditValue(node.name);
              }}>
                <Edit2 className="h-4 w-4 mr-2" />
                重命名
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <ContextMenu key={node.path}>
          <ContextMenuTrigger>
            <div
              className={`flex items-center gap-2 px-2 py-1 hover:bg-accent cursor-pointer rounded transition-colors duration-200 ${
                editingPath === node.path ? 'bg-accent' : ''
              }`}
              style={{ paddingLeft: `${indent + 8}px` }}
              onClick={() => handleFileClick(node.path)}
            >
              {getFileIcon(node.fileType)}
              {isEditing ? (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => {
                    if (editValue && editValue !== node.name) {
                      handleRename(node.path, editValue);
                    } else {
                      setEditingPath(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editValue && editValue !== node.name) {
                        handleRename(node.path, editValue);
                      } else {
                        setEditingPath(null);
                      }
                    } else if (e.key === 'Escape') {
                      setEditingPath(null);
                    }
                  }}
                  className="h-6 text-sm"
                  autoFocus
                />
              ) : (
                <span className="text-sm">{node.name}</span>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => {
              setEditingPath(node.path);
              setEditValue(node.name);
            }}>
              <Edit2 className="h-4 w-4 mr-2" />
              重命名
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => setDeleteDialog(node.path)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-2 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">文件</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setNewItemDialog({ type: 'file', parent: '' })}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {fileTree.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              暂无文件
              <br />
              <Button
                size="sm"
                variant="link"
                className="mt-2"
                onClick={() => setNewItemDialog({ type: 'file', parent: '' })}
              >
                创建第一个文件
              </Button>
            </div>
          ) : (
            fileTree.map(node => renderNode(node))
          )}
        </div>
      </ScrollArea>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除 &quot;{deleteDialog}&quot; 吗？此操作无法撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteDialog && handleDelete(deleteDialog)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Item Dialog */}
      <Dialog open={!!newItemDialog} onOpenChange={() => setNewItemDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              新建{newItemDialog?.type === 'file' ? '文件' : '文件夹'}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={newItemDialog?.type === 'file' ? '文件名.bkn' : '文件夹名'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItemName) {
                newItemDialog && handleCreate(newItemDialog.type, newItemDialog.parent, newItemName);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewItemDialog(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (newItemDialog && newItemName) {
                  handleCreate(newItemDialog.type, newItemDialog.parent, newItemName);
                }
              }}
              disabled={!newItemName}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
