import React from 'react';
import type { Checkpoint } from '../types';
import { HistoryIcon } from './icons/HistoryIcon';
import { EyeIcon } from './icons/EyeIcon';
import { ReplanIcon } from './icons/ReplanIcon';

interface HistoryPanelProps {
    checkpoints: Checkpoint[];
    onPreview: (checkpoint: Checkpoint) => void;
    onRevert: (checkpointId: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ checkpoints, onPreview, onRevert }) => {
    return (
        <div className="bg-[#1E1E1E] flex flex-col h-full w-full text-white">
            <header className="p-4 border-b border-gray-700 flex items-center gap-3 shrink-0">
                <HistoryIcon className="w-6 h-6 text-blue-400" />
                <h2 className="text-lg font-bold">Checkpoints</h2>
            </header>
            <main className="flex-grow overflow-y-auto">
                {checkpoints.length > 0 ? (
                    <ul className="p-2 space-y-1">
                        {checkpoints.map(checkpoint => (
                            <li key={checkpoint.id} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <p className="font-semibold text-gray-200 truncate" title={checkpoint.name}>{checkpoint.name}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Saved on: {new Date(checkpoint.timestamp).toLocaleString()}
                                </p>
                                <div className="flex items-center justify-end gap-2 mt-3">
                                    <button
                                        onClick={() => onPreview(checkpoint)}
                                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors bg-gray-600 hover:bg-gray-500 text-white"
                                    >
                                        <EyeIcon className="w-4 h-4" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => onRevert(checkpoint.id)}
                                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                                    >
                                        <ReplanIcon className="w-4 h-4" />
                                        Revert
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <p>No checkpoints saved yet.</p>
                        <p className="mt-2 text-sm">Use the Save icon in the header to create a version of your project.</p>
                    </div>
                )}
            </main>
        </div>
    );
};