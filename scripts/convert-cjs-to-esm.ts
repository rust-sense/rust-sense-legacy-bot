import fs from 'node:fs';
import path from 'node:path';

const srcDir = 'src';

function convertFile(filePath: string): void {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Convert require() to import for npm packages and project files
    // Pattern: const X = require('...')
    const requireRegex = /const\s+(\{[^}]+\}|\w+)\s+=\s+require\(['"]([^'"]+)['"]\);?/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const varName = match[1].trim();
        const modulePath = match[2];
        
        let importPath = modulePath;
        
        // Add .js extension to relative imports
        if (importPath.startsWith('.')) {
            if (!importPath.endsWith('.js')) {
                importPath = importPath + '.js';
            }
        }
        
        let importStatement;
        if (varName.startsWith('{')) {
            // Named import: const { a, b } = require('...')
            importStatement = `import ${varName} from '${importPath}';`;
        } else {
            // Default import: const X = require('...')
            importStatement = `import ${varName} from '${importPath}';`;
        }
        
        content = content.replace(fullMatch, importStatement);
        modified = true;
    }

    // Convert module.exports = { ... } to named exports
    // This is a simplified conversion - handles common patterns
    if (content.includes('module.exports = {')) {
        const exportObjRegex = /module\.exports\s*=\s*\{([\s\S]*?)\n\};?/;
        const objMatch = content.match(exportObjRegex);
        if (objMatch) {
            const exportsBlock = objMatch[1];
            let exportStatements = '';
            
            // Extract function exports
            const funcRegex = /(\w+):\s*(async\s+)?function\s*\(([^)]*)\)\s*\{/g;
            let funcMatch;
            while ((funcMatch = funcRegex.exec(exportsBlock)) !== null) {
                const funcName = funcMatch[1];
                const isAsync = funcMatch[2] || '';
                const params = funcMatch[3];
                exportStatements += `export ${isAsync}function ${funcName}(${params});\n`;
            }
            
            if (exportStatements) {
                content = content.replace(exportObjRegex, exportStatements.trim());
                modified = true;
            }
        }
    }

    // Convert module.exports = async (...) => to export async function
    const arrowExportRegex = /module\.exports\s*=\s*(async\s+)?\(([^)]*)\)\s*=>\s*\{/;
    const arrowMatch = content.match(arrowExportRegex);
    if (arrowMatch) {
        const isAsync = arrowMatch[1] || '';
        const params = arrowMatch[2];
        content = content.replace(arrowExportRegex, `export ${isAsync}function handler(${params}) {`);
        modified = true;
    }

    // Replace module.exports references
    content = content.replace(/module\.exports\./g, '');
    
    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`Converted: ${filePath}`);
    }
}

function walkDir(dir: string): void {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (file.endsWith('.ts')) {
            convertFile(filePath);
        }
    }
}

walkDir(srcDir);
console.log('Done!');
