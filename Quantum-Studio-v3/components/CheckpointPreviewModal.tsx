import React, { useState } from 'react';
import type { Checkpoint, FileSystemNode } from '../types';
import { XCircleIcon } from './icons/XCircleIcon';
import { ReplanIcon } from './icons/ReplanIcon';
import { FolderIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';

// Read-only file tree node component
const CheckpointFileNode: React.FC<{
    name: string;
    node: FileSystemNode;
    path: string;
    onFilePreview: (path: string, content: string) => void;
}> = ({ name, node, path, onFilePreview }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (node.type === 'folder') {
        return (
            <div>
                <button
                    className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-700 cursor-pointer text-left"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <FolderIcon isOpen={isOpen} className="h-5 w-5 text-yellow-500 shrink-0" />
                    <span className="font-medium text-gray-200 truncate">{name}</span>
                </button>
                {isOpen && (
                    <div className="pl-4 border-l border-gray-700 ml-2.5">
                        {Object.entries(node.children)
                            .sort(([aName, aNode], [bName, bNode]) => {
                                if (aNode.type !== bNode.type) return aNode.type === 'folder' ? -1 : 1;
                                return aName.localeCompare(bName);
                            })
                            .map(([childName, childNode]) => (
                                <CheckpointFileNode
                                    key={childName}
                                    name={childName}
                                    node={childNode}
                                    path={`${path}/${childName}`}
                                    onFilePreview={onFilePreview}
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    // It's a file
    return (
        <button
            className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-700 text-left"
            onClick={() => onFilePreview(path, node.content)}
        >
            <FileIcon className="text-gray-400 h-4 w-4 shrink-0" />
            <span className="truncate text-gray-300">{name}</span>
        </button>
    );
};


interface CheckpointPreviewModalProps {
    checkpoint: Checkpoint;
    onClose: () => void;
    onRevert: (checkpointId: string) => void;
    onFilePreview: (path: string, content: string) => void;
}

export const CheckpointPreviewModal: React.FC<CheckpointPreviewModalProps> = ({ checkpoint, onClose, onRevert, onFilePreview }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="relative flex flex-col bg-[#1E1E1E] border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl h-full max-h-[85vh] text-white"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-gray-200">{checkpoint.name}</h3>
                        <p className="text-sm text-gray-400">Previewing checkpoint from {new Date(checkpoint.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close preview">
                        <XCircleIcon className="h-7 w-7 text-gray-500 hover:text-white" />
                    </button>
                </header>
                <main className="overflow-auto flex-grow p-4">
                    <p className="text-sm text-gray-400 mb-2">Click a file to view its content.</p>
                    <div className="space-y-0.5">
                        {Object.entries(checkpoint.fileSystem.children)
                            .sort(([aName, aNode], [bName, bNode]) => {
                                if (aNode.type !== bNode.type) return aNode.type === 'folder' ? -1 : 1;
                                return aName.localeCompare(bName);
                            })
                            .map(([name, node]) => (
                                <CheckpointFileNode
                                    key={name}
                                    name={name}
                                    node={node}
                                    path={name}
                                    onFilePreview={onFilePreview}
                                />
                            ))}
                    </div>
                </main>
                <footer className="p-4 border-t border-gray-700 flex justify-end gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-gray-600 hover:bg-gray-500 text-white"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onRevert(checkpoint.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                    >
                        <ReplanIcon className="w-5 h-5" />
                        Revert to this Checkpoint
                    </button>
                </footer>
            </div>
        </div>
    );
};