import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { XCircleIcon } from './icons/XCircleIcon';
import { CopyIcon } from './icons/CopyIcon';

interface CodePreviewModalProps {
    path: string;
    content: string;
    onClose: () => void;
}

const getLanguageFromPath = (path: string) => {
    const extension = path.split('.').pop() || '';
    if (['js', 'jsx'].includes(extension)) return 'jsx';
    if (['ts', 'tsx'].includes(extension)) return 'tsx';
    if (extension === 'css') return 'css';
    if (extension === 'json') return 'json';
    return 'clike';
};

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({ path, content, onClose }) => {
    const [copied, setCopied] = useState(false);
    const language = getLanguageFromPath(path);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div 
                className="relative flex flex-col bg-[#1E1E1E] border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl h-full max-h-[85vh] text-white"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
                    <h3 className="font-mono text-lg text-gray-300">{path}</h3>
                    <div className="flex items-center gap-4">
                         <button onClick={handleCopy} className="text-sm flex items-center gap-1.5 text-gray-400 hover:text-white">
                            <CopyIcon className="h-5 w-5" />
                            {copied ? 'Copied!' : 'Copy Code'}
                        </button>
                        <button onClick={onClose} aria-label="Close code preview">
                            <XCircleIcon className="h-7 w-7 text-gray-500 hover:text-white" />
                        </button>
                    </div>
                </header>
                <main className="overflow-auto flex-grow bg-gray-900/50">
                     <SyntaxHighlighter
                        language={language}
                        style={vscDarkPlus}
                        customStyle={{ 
                            margin: 0, 
                            padding: '1rem',
                            height: '100%',
                            backgroundColor: 'transparent',
                            fontSize: '0.875rem'
                        }}
                        codeTagProps={{
                            style: {
                                fontFamily: '"Fira Code", monospace',
                            }
                        }}
                    >
                        {content}
                    </SyntaxHighlighter>
                </main>
            </div>
        </div>
    );
};