

import React, { useMemo, useState, useEffect, useRef, forwardRef } from 'react';
import pako from 'pako';
import * as previewService from '../services/previewService';
import { ConsoleMessage } from './ConsoleMessage';
import { AutoFixPrompt } from './AutoFixPrompt';
import type { LogMessage, SelectedElement, FileSystemTree, PreviewEnvironment, Workspace, ContextMenuItem } from '../types';
import { EnvironmentSwitcher } from './EnvironmentSwitcher';
import { EyeIcon } from './icons/EyeIcon';
import { TerminalIcon } from './icons/TerminalIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { FullscreenIcon } from './icons/FullscreenIcon';
import { ExitFullscreenIcon } from './icons/ExitFullscreenIcon';
import { SelectToolIcon } from './icons/SelectToolIcon';
import { CameraIcon } from './icons/CameraIcon';
import { OpenInNewIcon } from './icons/OpenInNewIcon';
import { ShareIcon } from './icons/ShareIcon';

interface WebsitePreviewProps {
    activeWorkspace: Workspace;
    fixableError: LogMessage | null;
    onConsoleLog: (log: LogMessage) => void;
    onAutoFix: (log: LogMessage) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    activeTab: 'preview' | 'console';
    onTabChange: (tab: 'preview' | 'console') => void;
    onElementSelected: (info: SelectedElement) => void;
    onScreenshot: () => void;
    environment: PreviewEnvironment;
    onEnvironmentChange: (env: PreviewEnvironment) => void;
    setContextMenu: (menu: { x: number, y: number, items: ContextMenuItem[] } | null) => void;
}

export const WebsitePreview = forwardRef<HTMLIFrameElement, WebsitePreviewProps>(({ 
    activeWorkspace,
    fixableError, 
    onConsoleLog, 
    onAutoFix, 
    isFullscreen, 
    onToggleFullscreen, 
    activeTab, 
    onTabChange, 
    onElementSelected, 
    onScreenshot,
    environment,
    onEnvironmentChange,
    setContextMenu,
}, ref) => {
    const { fileSystem } = activeWorkspace;
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isSelectorActive, setIsSelectorActive] = useState(false);
    const [shareState, setShareState] = useState<'idle' | 'copying' | 'copied'>('idle');
    const internalRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(internalRef.current);
            } else {
                ref.current = internalRef.current;
            }
        }
    }, [ref]);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        setIsSelectorActive(false);
    };

    const toggleElementSelector = () => {
        const nextState = !isSelectorActive;
        setIsSelectorActive(nextState);
        internalRef.current?.contentWindow?.postMessage({ type: 'toggle-selector', enabled: nextState }, '*');
    };

    const consoleScript = `
        const originalConsole = { ...window.console };
        const serialize = (arg) => {
            if (arg instanceof Error) {
                return \`Error: \${arg.message}\\n\${arg.stack}\`;
            }
            if (typeof arg === 'function') {
                return \`[Function: \${arg.name || 'anonymous'}]\`;
            }
            if (typeof arg === 'undefined') return 'undefined';
            if (arg === null) return 'null';
            if (typeof arg === 'object') {
                try {
                    const seen = new WeakSet();
                    return JSON.stringify(arg, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) return '[Circular]';
                            seen.add(value);
                        }
                        return value;
                    }, 2);
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(arg);
        };

        Object.keys(originalConsole).forEach(level => {
            window.console[level] = (...args) => {
                window.parent.postMessage({
                    type: 'console',
                    level: level,
                    message: args.map(serialize).join(' '),
                }, '*');
                originalConsole[level].apply(window.console, args);
            };
        });

        const showErrorOverlay = (error) => {
            if (document.getElementById('qcode-error-overlay')) return;
            const rootEl = document.getElementById('root') || document.getElementById('app') || document.body;
            rootEl.innerHTML = '';

            const overlay = document.createElement('div');
            overlay.id = 'qcode-error-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:"Fira Code",monospace;';
            
            const container = document.createElement('div');
            container.style.cssText = 'background:#1E1E1E;color:#ef4444;border:1px solid #ef4444;border-radius:8px;padding:1.5rem 2rem;max-width:90%;width:900px;max-height:90vh;overflow-y:auto;';
            
            const title = document.createElement('h3');
            title.style.cssText = 'margin:0 0 1rem;font-size:1.5rem;font-weight:600;color:#f87171;';
            title.textContent = error.message;

            const stack = document.createElement('pre');
            stack.style.cssText = 'font-size:0.9rem;color:#d1d5db;white-space:pre-wrap;word-break:break-word;';
            stack.textContent = error.stack || 'No stack trace available.';

            container.appendChild(title);
            container.appendChild(stack);
            overlay.appendChild(container);
            document.body.appendChild(overlay);
        };

        window.addEventListener('error', (event) => {
             const error = event.error || new Error(event.message);
             showErrorOverlay(error);
             window.parent.postMessage({
                type: 'console',
                level: 'error',
                message: \`Uncaught Error: \${error.message}\${error.stack ? '\\n' + error.stack : ''}\`,
            }, '*');
        });

        window.addEventListener('unhandledrejection', event => {
            const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
            showErrorOverlay(error);
            window.parent.postMessage({
                type: 'console',
                level: 'error',
                message: \`Unhandled Promise Rejection: \${error.message}\`,
            }, '*');
        });
    `;

    const selectorScript = `
        let selectorActive = false;
        let transientHighlightedElement = null;
        let permanentHighlightedElement = null;

        const transientHighlightStyle = '2px solid #3b82f6';
        const permanentHighlightStyle = '3px solid #f59e0b';
        
        const getSelector = (el) => {
            if (!el || !(el instanceof Element)) return '';
            let path = [];
            while (el.nodeType === Node.ELEMENT_NODE) {
                let selector = el.nodeName.toLowerCase();
                if (el.id) {
                    selector += '#' + el.id.trim().replace(/ /g, '\\\\ ');
                    path.unshift(selector);
                    break;
                } else {
                    let sib = el, nth = 1;
                    while (sib = sib.previousElementSibling) {
                        if (sib.nodeName.toLowerCase() === selector) nth++;
                    }
                    if (nth !== 1) selector += ":nth-of-type("+nth+")";
                }
                path.unshift(selector);
                el = el.parentNode;
            }
            return path.join(" > ");
        };
        
        const clearHighlights = () => {
            if (transientHighlightedElement) {
                transientHighlightedElement.style.outline = '';
                transientHighlightedElement = null;
            }
             if (permanentHighlightedElement) {
                permanentHighlightedElement.style.outline = '';
                permanentHighlightedElement = null;
            }
        };

        window.addEventListener('message', (event) => {
            if (event.data.type === 'toggle-selector') {
                selectorActive = event.data.enabled;
                document.body.style.cursor = selectorActive ? 'crosshair' : 'default';
                if (!selectorActive) {
                    clearHighlights();
                }
            }
            if (event.data.type === 'clear-selection') {
                if (permanentHighlightedElement) {
                    permanentHighlightedElement.style.outline = '';
                    permanentHighlightedElement = null;
                }
            }
            if (event.data.type === 'clear-highlights-for-screenshot') {
                clearHighlights();
            }
        });

        document.addEventListener('mouseover', (e) => {
            if (!selectorActive || e.target === permanentHighlightedElement) return;
            if (e.target !== transientHighlightedElement) {
                if (transientHighlightedElement) transientHighlightedElement.style.outline = '';
                transientHighlightedElement = e.target;
                transientHighlightedElement.style.outline = transientHighlightStyle;
                transientHighlightedElement.style.outlineOffset = '-2px';
            }
        }, true);

        document.addEventListener('mouseout', (e) => {
            if (!selectorActive || !transientHighlightedElement) return;
            transientHighlightedElement.style.outline = '';
            transientHighlightedElement = null;
        }, true);

        document.addEventListener('click', (e) => {
            if (!selectorActive) return;
            e.preventDefault();
            e.stopPropagation();

            const target = e.target;
            const selector = getSelector(target);
            const textContent = target.textContent || '';
            
            window.parent.postMessage({ type: 'element-selected', selector: selector, text: textContent.trim() }, '*');
            
            clearHighlights();
            permanentHighlightedElement = target;
            permanentHighlightedElement.style.outline = permanentHighlightStyle;
            permanentHighlightedElement.style.outlineOffset = '-3px';
            
            selectorActive = false;
            document.body.style.cursor = 'default';

        }, true);
    `;
    
    const effectiveEnvironment = useMemo(() => {
        if (environment === 'auto') {
            return previewService.detectEnvironment(fileSystem);
        }
        return environment;
    }, [environment, fileSystem]);

    const srcDoc = useMemo(() => {
        let content = previewService.generateSrcDoc(effectiveEnvironment, fileSystem);
        
        // Inject console and selector scripts
        const fullScript = `<script>${consoleScript}\n${selectorScript}</script>`;
        if (content.includes('</head>')) {
            content = content.replace('</head>', `${fullScript}</head>`);
        } else {
            content += fullScript;
        }

        return content;
    }, [fileSystem, effectiveEnvironment, refreshKey]);

    const handleOpenInNewTab = () => {
        const blob = new Blob([srcDoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    const handleShare = async () => {
        if (!activeWorkspace) return;
        setShareState('copying');
        try {
            const jsonString = JSON.stringify(activeWorkspace);
            const compressed = pako.deflate(jsonString);
            const binaryString = Array.from(compressed).map(byte => String.fromCharCode(byte)).join('');
            const base64String = btoa(binaryString);
            const urlSafeBase64 = encodeURIComponent(base64String);
            
            const url = `${window.location.origin}${window.location.pathname}#data=${urlSafeBase64}`;
            
            await navigator.clipboard.writeText(url);
            setShareState('copied');
        } catch (e) {
            console.error("Failed to create share link", e);
            alert("Could not create share link. The project might be too large.");
            setShareState('idle');
        } finally {
            setTimeout(() => setShareState('idle'), 2000);
        }
    };


    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== internalRef.current?.contentWindow) return;

            if (event.data && event.data.type === 'console') {
                const { level, message } = event.data;
                const validLevels: LogMessage['level'][] = ['log', 'debug', 'info', 'warn', 'error'];
                
                const isLevelValid = (l: any): l is LogMessage['level'] => validLevels.includes(l);
                const logLevel = isLevelValid(level) ? level : 'log';
                
                const newLog = { level: logLevel, message, timestamp: new Date() };
                setLogs(prevLogs => [newLog, ...prevLogs]);
                onConsoleLog(newLog);

                if (logLevel === 'error' && activeTab !== 'console') {
                    onTabChange('console');
                }
            } else if (event.data && event.data.type === 'element-selected') {
                onElementSelected({ selector: event.data.selector, text: event.data.text });
                setIsSelectorActive(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [activeTab, onConsoleLog, onTabChange, onElementSelected]);

    useEffect(() => {
        setLogs([]);
    }, [fileSystem, refreshKey, effectiveEnvironment]);

    const shareButtonText = shareState === 'copied' ? 'Copied!' : 'Share';

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const items: ContextMenuItem[] = [
            { label: 'Refresh Preview', action: handleRefresh },
            { type: 'separator' },
            { label: 'Select Element with AI', action: toggleElementSelector },
            { label: 'Annotate Screenshot', action: onScreenshot },
            { type: 'separator' },
            { label: 'Open in New Tab', action: handleOpenInNewTab },
        ];

        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    return (
        <div className="bg-[#1E1E1E] flex-grow flex flex-col h-full" onContextMenu={handleContextMenu}>
            <div className="p-2 border-b border-gray-700 text-sm text-gray-400 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onTabChange('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${activeTab === 'preview' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        <EyeIcon className="h-4 w-4"/>
                        <span>Live Preview</span>
                    </button>
                     <button
                        onClick={() => onTabChange('console')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${activeTab === 'console' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        <TerminalIcon className="h-4 w-4"/>
                        <span>Console</span>
                        {logs.filter(l => l.level === 'error').length > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                {logs.filter(l => l.level === 'error').length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <EnvironmentSwitcher 
                        currentEnv={environment}
                        onChange={onEnvironmentChange}
                    />
                     <button onClick={handleShare} title="Share project link" disabled={shareState !== 'idle'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-white text-xs font-medium disabled:opacity-70">
                        <ShareIcon className="h-4 w-4" />
                        {shareButtonText}
                    </button>
                     <button onClick={handleOpenInNewTab} title="Open in new tab" className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md">
                        <OpenInNewIcon className="h-5 w-5" />
                    </button>
                    <div className="h-5 w-px bg-gray-600"></div>
                    <button onClick={toggleElementSelector} title="Select Element" className={`p-1.5 rounded-md ${isSelectorActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                        <SelectToolIcon className="h-5 w-5" />
                    </button>
                    <button onClick={onScreenshot} title="Annotate Screenshot" className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md">
                        <CameraIcon className="h-5 w-5" />
                    </button>
                    <button onClick={handleRefresh} title="Refresh Preview" className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md">
                        <RefreshIcon className="h-5 w-5" />
                    </button>
                    <button onClick={onToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"} className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md">
                        {isFullscreen ? <ExitFullscreenIcon className="h-5 w-5" /> : <FullscreenIcon className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            <div className="flex-grow bg-gray-900">
                {activeTab === 'preview' ? (
                    <iframe
                        ref={internalRef}
                        key={`${refreshKey}-${effectiveEnvironment}`}
                        srcDoc={srcDoc}
                        title="Website Preview"
                        className="w-full h-full bg-white"
                        sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                ) : (
                    <div className="console-log">
                        {fixableError && (
                           <AutoFixPrompt error={fixableError} onFix={onAutoFix} />
                        )}
                        {logs.length > 0 ? (
                            logs.map((log, index) => <ConsoleMessage key={index} log={log} />)
                        ) : (
                            <div className="p-4 text-gray-500">Console is empty. Use console.log() in your code to see output here.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});