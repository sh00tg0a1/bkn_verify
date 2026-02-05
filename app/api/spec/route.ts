import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const specPath = join(process.cwd(), 'docs', 'ontology', 'bkn_docs', 'SPECIFICATION.md');
    
    if (!existsSync(specPath)) {
      return NextResponse.json({ error: 'Specification file not found' }, { status: 404 });
    }
    
    const content = readFileSync(specPath, 'utf-8');
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error loading specification:', error);
    return NextResponse.json({ error: 'Failed to load specification' }, { status: 500 });
  }
}
