import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
// CSS theme is loaded in index.html

import { XCircleIcon } from './icons/XCircleIcon';
import type { ContextMenuItem } from '../types';

interface CodeEditorProps {
    path: string;
    content: string;
    onContentChange: (newContent: string) => void;
    onClose: () => void;
    setContextMenu: (menu: { x: number, y: number, items: ContextMenuItem[] } | null) => void;
    onAiTaskRequest: (prompt: string) => void;
}

const getLanguage = (path: string) => {
    const extension = path.split('.').pop() || '';
    if (['js', 'jsx'].includes(extension)) return Prism.languages.jsx;
    if (['ts', 'tsx'].includes(extension)) return Prism.languages.tsx;
    if (extension === 'css') return Prism.languages.css;
    if (extension === 'json') return Prism.languages.json;
    return Prism.languages.clike; // default
};
const getLanguageString = (path: string) => {
    const extension = path.split('.').pop() || '';
    if (['js', 'jsx'].includes(extension)) return 'jsx';
    if (['ts', 'tsx'].includes(extension)) return 'tsx';
    if (extension === 'css') return 'css';
    if (extension === 'json') return 'json';
    return 'clike'; // default
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ path, content, onContentChange, onClose, setContextMenu, onAiTaskRequest }) => {
    const language = getLanguage(path);
    const languageString = getLanguageString(path);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const selection = window.getSelection()?.toString().trim();
        const items: ContextMenuItem[] = [];

        if (selection) {
            items.push(
                { label: 'Explain Selection', action: () => onAiTaskRequest(`Explain this code from ${path}:\n\`\`\`\n${selection}\n\`\`\``) },
                { label: 'Refactor Selection', action: () => onAiTaskRequest(`Refactor this code from ${path}:\n\`\`\`\n${selection}\n\`\`\``) },
                { label: 'Add Comments to Selection', action: () => onAiTaskRequest(`Add comments to this code from ${path}:\n\`\`\`\n${selection}\n\`\`\``) },
                { type: 'separator' }
            );
        }
        
        items.push({ label: 'Explain This File', action: () => onAiTaskRequest(`Explain the purpose and functionality of the file \`${path}\`.`) });
        items.push({ label: 'Suggest Improvements for File', action: () => onAiTaskRequest(`Analyze the file \`${path}\` and suggest improvements.`) });
        
        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };
    
    return (
        <div className="bg-[#1E1E1E] flex flex-col h-full">
            <header className="flex items-center justify-between p-2.5 border-b border-gray-700 bg-[#252526] shrink-0">
                <h3 className="font-mono text-sm text-gray-300 bg-gray-700 px-3 py-1 rounded-md">{path}</h3>
                <button onClick={onClose} aria-label="Close editor">
                    <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-white transition-colors" />
                </button>
            </header>
            <main className="flex-grow overflow-auto editor-container" onContextMenu={handleContextMenu}>
                 <Editor
                    value={content}
                    onValueChange={onContentChange}
                    highlight={(code) => {
                        if (language) {
                           return Prism.highlight(code, language, languageString)
                        }
                        return code;
                    }}
                    textareaClassName="editor-textarea"
                    preClassName="editor-pre"
                />
            </main>
        </div>
    );
};