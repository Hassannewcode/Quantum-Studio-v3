
import React, { useState, useEffect } from 'react';
import { LoaderIcon } from './icons/LoaderIcon';

// Interfaces
interface Extension {
    id: string;
    name: string;
    publisher: string;
    description: string;
    installs: string;
    icon: string;
}

interface DetailedExtension extends Extension {
    homepage?: string;
    repository?: string;
    bugs?: string;
    averageRating?: number;
    reviewCount?: number;
}

interface ExtensionsPanelProps {
    onExtensionChange: () => void;
}

// Helper to format large numbers
const formatInstalls = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${Math.round(count / 1000)}K`;
    return String(count);
};


// Child Components
const ExtensionItem: React.FC<{
    extension: Extension;
    onStatusChange: () => void;
    onClick: () => void;
}> = ({ extension, onStatusChange, onClick }) => {
    const storageKey = `ext_${extension.id}`;
    const [isInstalled, setIsInstalled] = useState(() => localStorage.getItem(storageKey) === 'true');
    const [isChanging, setIsChanging] = useState(false);
    
    const handleInstall = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsChanging(true);
        setTimeout(() => {
            localStorage.setItem(storageKey, 'true');
            setIsInstalled(true);
            setIsChanging(false);
            onStatusChange();
        }, 500);
    };

    const handleUninstall = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsChanging(true);
        setTimeout(() => {
            localStorage.removeItem(storageKey);
            setIsInstalled(false);
            setIsChanging(false);
            onStatusChange();
        }, 500);
    }

    const description = extension.description.length > 80 
        ? extension.description.substring(0, 80) + '...' 
        : extension.description;

    return (
        <div 
            className="p-4 border-b border-gray-700 flex items-center gap-4 hover:bg-gray-800 transition-colors cursor-pointer"
            onClick={onClick}
        >
            <div className="w-12 h-12 rounded-md object-contain shrink-0 bg-gray-600 flex items-center justify-center p-1">
                <img 
                    src={extension.icon} 
                    alt={`${extension.name} icon`} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if(parent) {
                             const placeholder = document.createElement('div');
                             placeholder.className = "w-full h-full bg-gray-500 rounded-md flex items-center justify-center text-xl font-bold shrink-0";
                             placeholder.innerText = extension.name.charAt(0).toUpperCase();
                             parent.appendChild(placeholder);
                        }
                    }}
                />
            </div>
            <div className="flex-grow min-w-0">
                <h3 className="font-bold text-gray-100 truncate" title={extension.name}>{extension.name}</h3>
                <p className="text-sm text-gray-400" title={extension.description}>{description}</p>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-4">
                    <span className="truncate">{extension.publisher}</span>
                    <span>{extension.installs} Installs</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isInstalled ? (
                    <button 
                        onClick={handleUninstall}
                        disabled={isChanging}
                        className="px-4 py-1.5 text-sm font-semibold rounded-md transition-colors w-28 text-center shrink-0 disabled:opacity-50 disabled:cursor-wait bg-gray-600 hover:bg-red-700 text-white"
                    >
                        {isChanging ? <LoaderIcon className="mx-auto h-5 w-5" /> : 'Uninstall'}
                    </button>
                ) : (
                    <button 
                        onClick={handleInstall}
                        disabled={isChanging}
                        className="px-4 py-1.5 text-sm font-semibold rounded-md transition-colors w-28 text-center shrink-0 disabled:opacity-50 disabled:cursor-wait bg-blue-600 hover:bg-blue-500 text-white"
                    >
                        {isChanging ? <LoaderIcon className="mx-auto h-5 w-5" /> : 'Install'}
                    </button>
                )}
            </div>
        </div>
    );
};

const ExtensionDetailModal: React.FC<{ extension: Extension, onClose: () => void }> = ({ extension, onClose }) => {
    const [detailedExtension, setDetailedExtension] = useState<DetailedExtension | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetail = async () => {
            const [namespace, name] = extension.id.split('.');
            if (!namespace || !name) {
                setError("Invalid extension ID format.");
                setLoading(false);
                return;
            }

            try {
                const url = `https://open-vsx.org/api/${namespace}/${name}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch extension details: ${response.status}`);
                const data = await response.json();

                setDetailedExtension({
                    id: extension.id,
                    name: data.displayName || data.name,
                    publisher: data.namespace,
                    description: data.description || 'No description available.',
                    installs: formatInstalls(data.downloadCount || 0),
                    icon: data.files.icon || extension.icon,
                    homepage: data.homepage,
                    repository: data.repository,
                    bugs: data.bugs,
                    averageRating: data.averageRating,
                    reviewCount: data.reviewCount,
                });
            } catch (e: any) {
                setError(e.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [extension]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-[#1E1E1E] text-gray-200 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">{extension.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                {loading ? (
                    <div className="flex justify-center items-center h-full p-10"><LoaderIcon className="h-8 w-8" /></div>
                ) : error ? (
                    <div className="text-red-400 p-8 text-center"><p>Error loading details: {error}</p></div>
                ) : detailedExtension ? (
                    <main className="p-6 overflow-y-auto flex-grow">
                        <div className="flex items-center gap-4 mb-4">
                             <img src={detailedExtension.icon} alt={`${detailedExtension.name} icon`} className="w-16 h-16 rounded-lg object-contain shrink-0 bg-gray-600 p-1" />
                            <div>
                                <h3 className="text-2xl font-bold">{detailedExtension.name}</h3>
                                <p className="text-gray-400 mt-1">by {detailedExtension.publisher}</p>
                                <div className="text-sm text-gray-500 mt-2 flex items-center gap-4">
                                     <span>Installs: {detailedExtension.installs}</span>
                                     {detailedExtension.averageRating !== undefined && (
                                         <span className="flex items-center gap-1">
                                             <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                             {detailedExtension.averageRating.toFixed(1)} ({detailedExtension.reviewCount} reviews)
                                         </span>
                                     )}
                                </div>
                            </div>
                        </div>
                        <p className="mt-4 text-gray-300 whitespace-pre-wrap">{detailedExtension.description}</p>
                        <div className="mt-6 space-y-2 text-sm text-gray-400">
                            {detailedExtension.homepage && <p><span className="font-semibold text-gray-300">Homepage:</span> <a href={detailedExtension.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{detailedExtension.homepage}</a></p>}
                            {detailedExtension.repository && <p><span className="font-semibold text-gray-300">Repository:</span> <a href={detailedExtension.repository} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{detailedExtension.repository}</a></p>}
                            {detailedExtension.bugs && <p><span className="font-semibold text-gray-300">Bugs:</span> <a href={detailedExtension.bugs} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{detailedExtension.bugs}</a></p>}
                        </div>
                    </main>
                ) : null}
            </div>
        </div>
    );
};


export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({ onExtensionChange }) => {
    const [extensions, setExtensions] = useState<Extension[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalExtensions, setTotalExtensions] = useState<number | null>(null);
    const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        const fetchController = new AbortController();
        const { signal } = fetchController;

        const fetchTimeout = setTimeout(() => {
            const fetchExtensions = async () => {
                try {
                    let url: string;
                    const trimmedSearch = searchTerm.trim();
                    const fetchSize = 50;

                    if (trimmedSearch) {
                        const params = new URLSearchParams({ query: trimmedSearch, size: String(fetchSize) });
                        url = `https://open-vsx.org/api/-/search?${params.toString()}`;
                    } else {
                        const params = new URLSearchParams({ size: String(fetchSize), sortBy: 'downloads', sortOrder: 'desc' });
                        url = `https://open-vsx.org/api/-/query?${params.toString()}`;
                    }

                    const response = await fetch(url, { signal });
                    if (!response.ok) throw new Error(`API returned ${response.status}`);
                    const data = await response.json();
                    
                    const apiExtensions = data.extensions;
                    if (typeof data.total === 'number') setTotalExtensions(data.total);
                    if (!Array.isArray(apiExtensions)) throw new Error("Invalid data format from API.");
                    
                    const seenIds = new Set();
                    const mappedExtensions: Extension[] = apiExtensions.map((ext: any) => ({
                        id: `${ext.namespace}.${ext.name}`,
                        name: ext.displayName || ext.name,
                        publisher: ext.namespace || 'Unknown',
                        description: ext.description || 'No description.',
                        installs: formatInstalls(ext.downloadCount || 0),
                        icon: ext.files?.icon || `https://open-vsx.org/api/${ext.namespace}/${ext.name}/file/icon.png`,
                    })).filter((ext: Extension) => {
                        if (ext.name && ext.publisher && !seenIds.has(ext.id)) {
                            seenIds.add(ext.id);
                            return true;
                        }
                        return false;
                    });

                    if (!signal.aborted) setExtensions(mappedExtensions);

                } catch (e: any) {
                    if (e.name !== 'AbortError' && !signal.aborted) {
                        setError(`Could not load extensions. ${e.message}`);
                    }
                } finally {
                    if (!signal.aborted) setLoading(false);
                }
            };
            fetchExtensions();
        }, 300);

        return () => {
            clearTimeout(fetchTimeout);
            fetchController.abort();
        };
    }, [searchTerm]);

    return (
        <div className="bg-[#1E1E1E] flex flex-col h-full w-full">
            <div className="p-4 border-b border-gray-700 shrink-0">
                <h2 className="text-lg font-bold text-gray-200">Extensions Marketplace</h2>
                 <input
                    type="text"
                    placeholder="Search extensions on Open VSX..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full mt-3 p-2 bg-gray-800 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                />
            </div>
            <div className="flex-grow overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full"><LoaderIcon className="h-8 w-8" /></div>
                ) : error ? (
                    <div className="flex justify-center items-center h-full text-red-400 p-4 text-center"><p>{error}</p></div>
                ) : (
                    <div>
                        {extensions.length > 0 ? (
                           extensions.map((ext) => (
                                <ExtensionItem key={ext.id} extension={ext} onStatusChange={onExtensionChange} onClick={() => setSelectedExtension(ext)} />
                            ))
                        ) : (
                            <div className="text-center p-8 text-gray-400">No extensions found{searchTerm ? ` for "${searchTerm}"` : ''}.</div>
                        )}
                    </div>
                )}
            </div>
            {selectedExtension && <ExtensionDetailModal extension={selectedExtension} onClose={() => setSelectedExtension(null)} />}
        </div>
    );
};
