



import React, { useRef, useEffect, useMemo, useState } from 'react';
import type { AITask, SelectedElement, AttachmentContext, AppBlueprint, WorkspaceUiState, ContextMenuItem } from '../types';
import { AITaskItem } from './AITaskItem';
import { LoaderIcon } from './icons/LoaderIcon';
import { UploadIcon } from './icons/UploadIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { Switch } from './Switch';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ReplanIcon } from './icons/ReplanIcon';
import { BoltIcon } from './icons/BoltIcon';
import { JoystickIcon } from './icons/JoystickIcon';
import { EllipsisHorizontalIcon } from './icons/EllipsisHorizontalIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { AIAssistantIcon } from './icons/AIAssistantIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface AIPanelProps {
    tasks: AITask[];
    onSendMessage: (prompt: string) => void;
    isLoading: boolean;
    prompt: string;
    onPromptChange: (prompt: string) => void;
    onApproveTask: (taskId: string) => void;
    onRejectTask: (taskId: string) => void;
    onApproveBlueprint: (taskId: string) => void;
    onReplan: () => void;
    isAutoPilotOn: boolean;
    onToggleAutoPilot: () => void;
    isWebSearchEnabled: boolean;
    onToggleWebSearch: () => void;
    elementContext: SelectedElement | null;
    attachmentContext: AttachmentContext | null;
    onClearContext: () => void;
    onFileUploadForContext: (file: File) => void;
    activeBlueprint?: AppBlueprint | null;
    completedFeatures?: string[];
    aiMode: WorkspaceUiState['aiMode'];
    onAiModeChange: (mode: WorkspaceUiState['aiMode']) => void;
    gameCreatorMode?: WorkspaceUiState['gameCreatorMode'];
    onGameCreatorModeChange: (change: Partial<NonNullable<WorkspaceUiState['gameCreatorMode']>>) => void;
    setContextMenu: (menu: { x: number, y: number, items: ContextMenuItem[] } | null) => void;
    onDeleteTask: (taskId: string) => void;
    onRetryTask: (task: AITask) => void;
}

const ContextChip: React.FC<{ context: SelectedElement | AttachmentContext; onClear: () => void }> = ({ context, onClear }) => {
    const isAttachment = 'type' in context;
    const displayName = isAttachment ? context.name : 'Selected Element';

    return (
        <div className="flex items-center gap-2 bg-gray-700/80 rounded-full px-3 py-1 text-sm text-gray-200 animate-slide-in-left">
            <UploadIcon className="w-4 h-4 text-blue-400" />
            <span className="truncate max-w-[200px]">{displayName}</span>
            <button onClick={onClear} className="text-gray-400 hover:text-white"><XCircleIcon className="w-4 h-4"/></button>
        </div>
    );
};

const GameCreatorConfig: React.FC<{
    modeConfig: WorkspaceUiState['gameCreatorMode'];
    onChange: AIPanelProps['onGameCreatorModeChange'];
}> = ({ modeConfig, onChange }) => {
    const [stylesInput, setStylesInput] = useState(modeConfig?.styles?.join(', ') || '');
    const debounceTimeout = useRef<number | null>(null);

    useEffect(() => {
        setStylesInput(modeConfig?.styles?.join(', ') || '');
    }, [modeConfig?.styles]);
    
    const handleStylesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStyles = e.target.value;
        setStylesInput(newStyles);

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = window.setTimeout(() => {
            onChange({ styles: newStyles.split(',').map(s => s.trim()).filter(Boolean) });
        }, 500);
    };

    return (
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 mb-2 animate-slide-in-left">
            <p className="text-sm font-semibold text-gray-200 mb-2">Game Dev Settings</p>
            <div className="space-y-3">
                <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">Dimension</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onChange({ type: '2d' })}
                            className={`px-4 py-1.5 text-sm rounded-md w-full transition-colors ${modeConfig?.type === '2d' ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            2D
                        </button>
                        <button
                             onClick={() => onChange({ type: '3d' })}
                             className={`px-4 py-1.5 text-sm rounded-md w-full transition-colors ${modeConfig?.type === '3d' ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            3D
                        </button>
                    </div>
                </div>
                <div>
                     <label htmlFor="game-styles" className="text-xs font-medium text-gray-400 block mb-1.5">Styles (comma-separated)</label>
                     <input
                        id="game-styles"
                        type="text"
                        value={stylesInput}
                        onChange={handleStylesChange}
                        placeholder="e.g., pixel art, retro, fantasy"
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />
                </div>
            </div>
        </div>
    );
};


export const AIPanel: React.FC<AIPanelProps> = ({
    tasks, onSendMessage, isLoading, prompt, onPromptChange,
    onApproveTask, onRejectTask, onApproveBlueprint, onReplan,
    isAutoPilotOn, onToggleAutoPilot, isWebSearchEnabled, onToggleWebSearch,
    elementContext, attachmentContext, onClearContext, onFileUploadForContext,
    activeBlueprint, completedFeatures,
    aiMode, onAiModeChange, gameCreatorMode, onGameCreatorModeChange,
    setContextMenu, onDeleteTask, onRetryTask
}) => {
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
    const quickActionsRef = useRef<HTMLDivElement>(null);
    const [isAiModeMenuOpen, setIsAiModeMenuOpen] = useState(false);
    const aiModeMenuRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        // Scroll to top when a new task is added
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [tasks.length > 0 ? tasks[0].id : null]); // Depend on the ID of the newest task

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [prompt]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
            setIsQuickActionsOpen(false);
          }
          if (aiModeMenuRef.current && !aiModeMenuRef.current.contains(event.target as Node)) {
            setIsAiModeMenuOpen(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSendMessage = () => {
        if (prompt.trim() && !isLoading) {
            onSendMessage(prompt);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileUploadForContext(e.target.files[0]);
        }
    };

    const handleQuickAction = (actionPrompt: string) => {
        onSendMessage(actionPrompt);
        setIsQuickActionsOpen(false);
    };

    const handleAiModeSelect = (mode: WorkspaceUiState['aiMode']) => {
        onAiModeChange(mode);
        setIsAiModeMenuOpen(false);
    };

    const aiModeOptions: { id: WorkspaceUiState['aiMode'], label: string, icon: React.ReactElement }[] = [
        { id: 'quality', label: 'Quality', icon: <SparklesIcon className="h-4 w-4" /> },
        { id: 'fast', label: 'Fast', icon: <BoltIcon className="h-4 w-4" /> },
        { id: 'game_creator', label: 'Game Dev', icon: <JoystickIcon className="h-4 w-4" /> },
    ];
    const currentMode = aiModeOptions.find(m => m.id === aiMode) || aiModeOptions[0];

    const context = elementContext || attachmentContext;
    const runningUserTask = useMemo(() => tasks.find(t => t.status === 'running' && t.type !== 'autopilot'), [tasks]);

    return (
        <div className="bg-[#1E1E1E] flex flex-col h-full w-full">
            {/* Task List */}
            <div ref={messagesContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4">
                {tasks.length === 0 && (
                    <div className="text-center text-gray-500 pt-16">
                        <AIAssistantIcon className="w-12 h-12 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">AI Assistant</h3>
                        <p className="text-sm">Ask me to build, fix, or explain anything.</p>
                    </div>
                )}
                {tasks.map((task) => (
                    <AITaskItem key={task.id} task={task} onApprove={onApproveTask} onReject={onRejectTask} onApproveBlueprint={onApproveBlueprint} setContextMenu={setContextMenu} onDeleteTask={onDeleteTask} onRetryTask={onRetryTask}/>
                ))}
            </div>

            {/* Blueprint Progress */}
            {activeBlueprint && (
                <div className="p-3 border-y border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-gray-200">{activeBlueprint.appName}</h4>
                        <button onClick={onReplan} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300">
                            <ReplanIcon className="w-3 h-3" /> New Plan
                        </button>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${((completedFeatures?.length || 0) / activeBlueprint.features.length) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 text-right">{completedFeatures?.length || 0} / {activeBlueprint.features.length} features complete</p>
                </div>
            )}
            
            {/* Input Footer */}
            <div className="p-3 border-t border-gray-700 bg-[#252526] shrink-0">
                {aiMode === 'game_creator' && gameCreatorMode && (
                    <GameCreatorConfig modeConfig={gameCreatorMode} onChange={onGameCreatorModeChange} />
                )}
                { !activeBlueprint && aiMode !== 'game_creator' && (
                    <div className="text-center px-2 pb-2 text-xs text-blue-300/80 animate-slide-in-left">
                        <p>✨ <span className="font-semibold">Planning Mode:</span> Describe your app idea to create a blueprint.</p>
                    </div>
                )}
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-2 flex flex-col">
                    {context && (
                        <div className="px-2 pb-2">
                            <ContextChip context={context} onClear={onClearContext} />
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask the AI to build something..."
                            className="flex-grow bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none resize-none text-sm leading-6 max-h-40"
                            rows={1}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!prompt.trim() || isLoading}
                            className="bg-blue-600 text-white rounded-md h-9 px-4 flex items-center justify-center font-semibold hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors self-end"
                        >
                            {isLoading && !runningUserTask ? <LoaderIcon className="w-5 h-5 animate-spin" /> : 'Send'}
                        </button>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                    <div className="flex items-center gap-3">
                         <button onClick={() => fileInputRef.current?.click()} title="Attach file context" className="text-gray-400 hover:text-white p-1.5 rounded-md"><UploadIcon className="w-5 h-5"/></button>
                         <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                         
                         <div className="h-4 w-px bg-gray-600"></div>

                         <div className="flex items-center gap-2" title="Enable Google Search for this query">
                             <Switch isOn={isWebSearchEnabled} onToggle={onToggleWebSearch} id="web-search-toggle" />
                             <SearchIcon className={`w-5 h-5 ${isWebSearchEnabled ? 'text-blue-400' : 'text-gray-500'}`} />
                         </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative" ref={aiModeMenuRef}>
                            <button
                                onClick={() => setIsAiModeMenuOpen(!isAiModeMenuOpen)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                                title={`AI Mode: ${currentMode.label}`}
                            >
                                {currentMode.icon}
                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isAiModeMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isAiModeMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#2a2d33] border border-gray-600 rounded-lg shadow-2xl p-1.5 z-20">
                                    <ul className="space-y-1">
                                        {aiModeOptions.map(option => (
                                             <li key={option.id}>
                                                <button
                                                    onClick={() => handleAiModeSelect(option.id)}
                                                    className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                                                        aiMode === option.id
                                                            ? 'bg-blue-600 text-white'
                                                            : 'text-gray-200 hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {option.icon}
                                                    {option.label}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="h-4 w-px bg-gray-600"></div>
                        
                        <div className="flex items-center gap-2" title="Toggle Auto-Pilot Mode">
                             <BrainCircuitIcon className={`w-5 h-5 ${isAutoPilotOn ? 'text-indigo-400' : 'text-gray-500'}`} />
                             <Switch isOn={isAutoPilotOn} onToggle={onToggleAutoPilot} id="autopilot-toggle" />
                        </div>

                         <div className="h-4 w-px bg-gray-600"></div>

                         <div className="relative" ref={quickActionsRef}>
                            <button
                                onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
                                className="p-1.5 text-gray-400 hover:bg-gray-700 rounded-md transition-colors"
                                title="More AI Actions"
                            >
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                            </button>
                            {isQuickActionsOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#2a2d33] border border-gray-600 rounded-lg shadow-2xl p-1.5 z-20">
                                    <ul className="space-y-1">
                                        <li>
                                            <button
                                                onClick={() => handleQuickAction(`Take the following user prompt and improve it. Make it more detailed, specific, and clear for an AI developer assistant. Add context, examples, or constraints where helpful. Do not execute the prompt, just provide the improved version. Here's the prompt: "${prompt}"`)}
                                                disabled={!prompt.trim()}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-200 rounded-md hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Enhance Current Prompt
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => handleQuickAction("Analyze the current project and suggest a new, innovative feature that would complement the existing functionality. Provide a title and a brief description for the feature.")}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-200 rounded-md hover:bg-blue-600 hover:text-white"
                                            >
                                                Suggest a new feature
                                            </button>
                                        </li>
                                         <li>
                                            <button
                                                onClick={() => handleQuickAction("Analyze the entire codebase and identify the single most impactful refactoring for performance or maintainability. Propose the change and explain why it's important.")}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-200 rounded-md hover:bg-blue-600 hover:text-white"
                                            >
                                                Refactor for performance
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};