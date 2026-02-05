'use client';

import { useBKNStore } from '@/lib/store';
import { FolderOpen, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ProjectSelector() {
  const { projects, currentProjectId, setCurrentProject } = useBKNStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  if (projects.length === 0) {
    return (
      <div className="p-3 border-b bg-muted/30">
        <div className="text-sm text-muted-foreground">暂无项目</div>
      </div>
    );
  }

  return (
    <div className="p-2 border-b bg-muted/30">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-2 px-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary" />
              <div className="text-left min-w-0">
                <div className="font-medium truncate">
                  {currentProject?.name || '选择项目'}
                </div>
                {currentProject?.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {currentProject.description}
                  </div>
                )}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[230px]">
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => setCurrentProject(project.id)}
              className="flex items-start gap-2 py-2"
            >
              <div className="w-4 h-4 flex-shrink-0 mt-0.5">
                {project.id === currentProjectId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{project.name}</div>
                <div className="text-xs text-muted-foreground">
                  {project.description}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.keys(project.files).length} 个文件
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
