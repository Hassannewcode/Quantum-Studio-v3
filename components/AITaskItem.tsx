
import React, { useState } from 'react';
import type { AITask, ContextMenuItem } from '../types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { LoaderIcon } from './icons/LoaderIcon';
import { CopyIcon } from './icons/CopyIcon';
import { AICommitPreview } from './AICommitPreview';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { AIAssistantIcon } from './icons/AIAssistantIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon';
import { UserIcon } from './icons/UserIcon';
import { AppBlueprintDisplay } from './AppBlueprintDisplay';
import { LinkIcon } from './icons/LinkIcon';


const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-[#2a2d33] rounded-md my-2 text-white border border-gray-700/50">
            <div className="flex justify-between items-center px-4 py-1.5 bg-gray-900/50 rounded-t-md">
                <span className="text-xs font-semibold text-gray-400 uppercase">{language || 'code'}</span>
                <button onClick={handleCopy} className="text-xs flex items-center gap-1.5 text-gray-400 hover:text-white">
                    <CopyIcon className="h-4 w-4" />
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{ 
                    margin: 0, 
                    padding: '1rem',
                    backgroundColor: 'transparent',
                    fontSize: '0.875rem'
                }}
                codeTagProps={{
                    style: {
                        fontFamily: '"Fira Code", monospace',
                    }
                }}
            >
                {code.trim()}
            </SyntaxHighlighter>
        </div>
    );
};

const AssistantMessageContent: React.FC<{ content: string; isStreaming: boolean; }> = ({ content, isStreaming }) => {
    const parts = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

    return (
        <div className="whitespace-pre-wrap break-words font-sans leading-relaxed text-gray-300">
            {parts.map((part, index) => {
                const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
                if (match) {
                    const language = match[1] || '';
                    const code = match[2] || '';
                    return <CodeBlock key={index} language={language} code={code} />;
                }
                return <span key={index}>{part}</span>;
            })}
            {isStreaming && content.length > 0 && <span className="typing-cursor"></span>}
        </div>
    );
};

const TaskHeaderIcon: React.FC<{ type: AITask['type'] }> = ({ type }) => {
    if (type === 'autopilot') {
        return (
            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-600/50 flex items-center justify-center" title="Auto-Pilot Task">
                <BrainCircuitIcon className="w-5 h-5 text-indigo-300" />
            </div>
        );
    }
    return (
         <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center" title="User Task">
            <UserIcon className="w-5 h-5 text-gray-300" />
        </div>
    );
}

const StatusIcon: React.FC<{ status: AITask['status'] }> = ({ status }) => {
    switch (status) {
        case 'running':
            return <LoaderIcon className="h-5 w-5 animate-spin text-blue-400" />;
        case 'completed':
            return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
        case 'error':
            return <XCircleIcon className="h-5 w-5 text-red-400" />;
        case 'pending_confirmation':
        case 'pending_blueprint_approval':
            return <QuestionMarkCircleIcon className="h-5 w-5 text-yellow-400" />;
        default:
            return null;
    }
};

interface AITaskItemProps {
    task: AITask;
    onApprove: (taskId: string) => void;
    onReject: (taskId: string) => void;
    onApproveBlueprint: (taskId: string) => void;
    setContextMenu: (menu: { x: number, y: number, items: ContextMenuItem[] } | null) => void;
    onDeleteTask: (taskId: string) => void;
    onRetryTask: (task: AITask) => void;
}

export const AITaskItem: React.FC<AITaskItemProps> = ({ task, onApprove, onReject, onApproveBlueprint, setContextMenu, onDeleteTask, onRetryTask }) => {
    const [isOpen, setIsOpen] = useState(true);
    const time = task.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const hasOperations = task.assistantResponse?.operations && task.assistantResponse.operations.length > 0;
    const hasGrounding = task.assistantResponse?.groundingChunks && task.assistantResponse.groundingChunks.length > 0;
    const isBlueprintApproval = task.status === 'pending_blueprint_approval' && task.assistantResponse?.blueprint;

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const items: ContextMenuItem[] = [
            { label: 'Copy User Prompt', action: () => navigator.clipboard.writeText(task.userPrompt) },
        ];
        if (task.assistantResponse?.content) {
            items.push({ label: 'Copy Response Text', action: () => navigator.clipboard.writeText(task.assistantResponse!.content) });
        }
        items.push(
            { type: 'separator' },
            { label: 'Retry Task', action: () => onRetryTask(task) },
            { label: 'Delete Task', action: () => onDeleteTask(task.id) }
        );
        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    return (
        <div onContextMenu={handleContextMenu} className="bg-gray-800/50 border border-gray-700 rounded-lg transition-all duration-300">
            <header 
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-700/50"
                onClick={() => setIsOpen(!isOpen)}
            >
                <TaskHeaderIcon type={task.type} />
                <div className="flex-grow min-w-0">
                     <p className="font-medium text-gray-200 truncate" title={task.userPrompt}>
                        {task.userPrompt}
                    </p>
                    {task.type === 'autopilot' && <span className="text-xs text-indigo-400 font-semibold">AUTO-PILOT</span>}
                </div>
                <StatusIcon status={task.status} />
                <span className="text-xs text-gray-500 shrink-0">{time}</span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </header>
            
            {isOpen && (
                <div className="p-4 border-t border-gray-700/80">
                    <div className="flex flex-col gap-4">
                        {task.assistantResponse && (
                             <div className="flex items-start gap-3">
                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center">
                                    <AIAssistantIcon className="w-5 h-5 text-gray-300" />
                                </div>
                                <div className="flex-grow pt-1 w-full min-w-0">
                                    {hasOperations && !isBlueprintApproval ? (
                                        <AICommitPreview
                                            task={task}
                                            onApprove={() => onApprove(task.id)}
                                            onReject={() => onReject(task.id)}
                                        />
                                    ) : (
                                        <>
                                            <AssistantMessageContent
                                                content={task.assistantResponse.content}
                                                isStreaming={task.status === 'running'}
                                            />
                                            {isBlueprintApproval && (
                                                <div className="mt-4">
                                                    <AppBlueprintDisplay 
                                                        blueprint={task.assistantResponse.blueprint!} 
                                                        onApprove={() => onApproveBlueprint(task.id)}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                     {hasGrounding && (
                                        <div className="mt-4 pt-3 border-t border-gray-700">
                                            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-2">
                                                <LinkIcon className="w-4 h-4" />
                                                Sources
                                            </h4>
                                            <ul className="space-y-1.5 text-xs">
                                                {task.assistantResponse!.groundingChunks!.map(chunk => (
                                                    <li key={chunk.web.uri}>
                                                        <a 
                                                            href={chunk.web.uri} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 hover:underline truncate block"
                                                            title={chunk.web.uri}
                                                        >
                                                            {chunk.web.title || chunk.web.uri}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {task.status === 'error' && (
                            <div className="bg-red-900/40 border border-red-500/50 p-3 rounded-md">
                                <p className="font-semibold text-red-400">An error occurred</p>
                                <p className="text-sm text-red-300 mt-1 font-mono">{task.error}</p>
                            </div>
                        )}
                        
                        {task.status === 'running' && !task.assistantResponse && (
                            <div className="text-center text-gray-400 py-4">
                                Waiting for AI response...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
