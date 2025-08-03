

import React from 'react';
import type { AITask, FileOperation } from '../types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileIcon } from './icons/FileIcon';

const getLanguageFromPath = (path: string) => {
    const extension = path.split('.').pop() || '';
    if (['js', 'jsx'].includes(extension)) return 'jsx';
    if (['ts', 'tsx'].includes(extension)) return 'tsx';
    if (extension === 'css') return 'css';
    if (extension === 'json') return 'json';
    if (extension === 'go') return 'go';
    if (extension === 'py') return 'python';
    if (extension === 'java') return 'java';
    return 'clike';
};

const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
        return <FileIcon className="text-cyan-500 h-4 w-4 shrink-0" />;
    }
    if (fileName.endsWith('.js') || fileName.endsWith('.ts')) {
        return <FileIcon className="text-yellow-400 h-4 w-4 shrink-0" />;
    }
    if (fileName.endsWith('.json') || fileName === 'package.json') {
        return <FileIcon className="text-orange-400 h-4 w-4 shrink-0" />;
    }
    if (fileName.endsWith('.css') || fileName.endsWith('.scss')) {
        return <FileIcon className="text-blue-500 h-4 w-4 shrink-0" />;
    }
    if (fileName.endsWith('.py')) {
        return <FileIcon className="text-blue-500 h-4 w-4 shrink-0" />;
    }
    if (fileName.endsWith('.go')) {
        return <FileIcon className="text-teal-400 h-4 w-4 shrink-0" />;
    }
    if (fileName.endsWith('.java')) {
        return <FileIcon className="text-red-500 h-4 w-4 shrink-0" />;
    }
    return <FileIcon className="text-gray-500 h-4 w-4 shrink-0" />;
};


const DiffView: React.FC<{ operation: FileOperation }> = ({ operation }) => {
    const language = getLanguageFromPath(operation.path);
    const code = operation.content || '';

    return (
        <div className="text-sm font-mono bg-[#282c34] rounded-md overflow-hidden border border-gray-700">
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{ 
                    margin: 0, 
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    backgroundColor: 'transparent'
                }}
                codeTagProps={{ style: { fontFamily: '"Fira Code", monospace' } }}
                showLineNumbers
                lineNumberStyle={{ color: '#6b7280', paddingRight: '1em', userSelect: 'none', minWidth: '3.5em' }}
                wrapLines={true}
                lineProps={() => ({
                    style: { display: 'block', width: '100%', backgroundColor: 'rgba(34, 197, 94, 0.08)', borderLeft: '3px solid #22c55e' }
                })}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
};


export const AICommitPreview: React.FC<{ task: AITask; onApprove: () => void; onReject: () => void; }> = ({ task, onApprove, onReject }) => {
    const { assistantResponse, status } = task;
    const operations = (assistantResponse?.operations || []).filter(op => op && op.path);
    
    if (operations.length === 0) return null;

    const mainOp = operations.find(op => op.operation === 'UPDATE_FILE' || op.operation === 'CREATE_FILE');
    
    const fileStats = operations.map(op => {
        let lineInfo: string | null = null;
        let colorClass = 'text-gray-500';

        if (op.operation === 'CREATE_FILE' || op.operation === 'UPDATE_FILE') {
            lineInfo = `+${op.content?.split('\n').length || 0}`;
            colorClass = 'text-green-500 font-bold';
        } else if (op.operation === 'DELETE_FILE' || op.operation === 'DELETE_FOLDER') {
            lineInfo = `-${op.path.includes('.') ? '1' : '1 folder'}`;
            colorClass = 'text-red-500 font-bold';
        }
        
        return {
            path: op.path,
            newPath: op.newPath,
            lineInfo,
            colorClass,
            isRename: op.operation?.includes('RENAME')
        };
    });

    return (
        <div className="bg-[#fcfcfd] border border-gray-600/50 rounded-lg shadow-sm mt-4 text-gray-800 overflow-hidden">
            {/* Header / Commit Message */}
            <div className="p-4 border-b border-gray-200">
                {mainOp && <p className="font-semibold text-sm mb-2 font-mono text-gray-600">{mainOp.path}</p>}
                <p className="text-gray-700 text-sm leading-relaxed">{assistantResponse?.content}</p>
            </div>

            {/* Main Diff View */}
            {mainOp && (mainOp.operation === 'UPDATE_FILE' || mainOp.operation === 'CREATE_FILE') && mainOp.content && (
                <div className="px-4 py-2 bg-gray-50 max-h-72 overflow-y-auto">
                    <DiffView operation={mainOp} />
                </div>
            )}
            
            {/* File list footer */}
            <div className="p-4 bg-gray-100 border-t border-gray-200">
                <ul className="space-y-1.5">
                    {fileStats.map((stat, index) => (
                         <li key={index} className="flex justify-between items-center text-xs font-mono">
                            <span className="flex items-center gap-2 truncate text-gray-600" title={stat.newPath ? `${stat.path} -> ${stat.newPath}` : stat.path}>
                                {getFileIcon(stat.newPath || stat.path)}
                                {stat.newPath ? (
                                    <>
                                        <span className="line-through">{stat.path}</span>
                                        <span>→</span>
                                        <span>{stat.newPath}</span>
                                    </>
                                ) : (
                                    <span>{stat.path}</span>
                                )}
                            </span>
                             {stat.lineInfo && <span className={stat.colorClass}>{stat.lineInfo}</span>}
                        </li>
                    ))}
                </ul>
            </div>


            {/* Actions */}
            {status === 'pending_confirmation' && (
                <div className="p-3 bg-white border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onReject}
                        className="px-4 py-1.5 text-sm font-semibold rounded-md transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300"
                    >
                        Reject
                    </button>
                    <button
                        onClick={onApprove}
                        className="px-4 py-1.5 text-sm font-semibold rounded-md transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                    >
                        Approve Changes
                    </button>
                </div>
            )}
        </div>
    );
};