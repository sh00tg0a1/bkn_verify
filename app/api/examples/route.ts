import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';

interface Project {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>;
}

/**
 * Recursively read all .bkn files from a directory
 */
function readBKNFiles(dir: string, basePath: string = ''): Record<string, string> {
  const files: Record<string, string> = {};
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      const relativePath = basePath ? `${basePath}/${entry}` : entry;
      
      if (stat.isDirectory()) {
        // Recursively read subdirectory
        Object.assign(files, readBKNFiles(fullPath, relativePath));
      } else if (entry.endsWith('.bkn')) {
        // Read .bkn file
        try {
          const content = readFileSync(fullPath, 'utf-8');
          files[relativePath] = content;
        } catch (e) {
          console.error(`Failed to read ${fullPath}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`Failed to read directory ${dir}:`, e);
  }
  
  return files;
}

export async function GET() {
  try {
    const examplesDir = join(process.cwd(), 'docs', 'ontology', 'bkn_docs', 'examples');
    const projects: Project[] = [];
    
    // Project 1: k8s-topology (single file)
    const topologyFile = join(examplesDir, 'k8s-topology.bkn');
    if (existsSync(topologyFile)) {
      projects.push({
        id: 'k8s-topology',
        name: 'K8s Topology',
        description: '单文件示例 - 完整的 K8s 拓扑定义',
        files: {
          'k8s-topology.bkn': readFileSync(topologyFile, 'utf-8'),
        },
      });
    }
    
    // Project 2: k8s-modular (directory)
    const modularDir = join(examplesDir, 'k8s-modular');
    if (existsSync(modularDir)) {
      projects.push({
        id: 'k8s-modular',
        name: 'K8s Modular',
        description: '模块化示例 - 分离的实体、关系、行动定义',
        files: readBKNFiles(modularDir),
      });
    }
    
    // Project 3: k8s-network (directory)
    const networkDir = join(examplesDir, 'k8s-network');
    if (existsSync(networkDir)) {
      projects.push({
        id: 'k8s-network',
        name: 'K8s Network',
        description: '网络示例 - 单文件分区定义',
        files: readBKNFiles(networkDir),
      });
    }
    
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error loading examples:', error);
    return NextResponse.json({ error: 'Failed to load examples' }, { status: 500 });
  }
}
