import React, { useState, useRef, useEffect } from 'react';
import type { PreviewEnvironment } from '../types';
import { ReactLogoIcon } from './icons/ReactLogoIcon';
import { VueLogoIcon } from './icons/VueLogoIcon';
import { SvelteLogoIcon } from './icons/SvelteLogoIcon';
import { Html5LogoIcon } from './icons/Html5LogoIcon';
import { NodeLogoIcon } from './icons/NodeLogoIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PythonLogoIcon } from './icons/PythonLogoIcon';
import { GoLogoIcon } from './icons/GoLogoIcon';
import { JavaLogoIcon } from './icons/JavaLogoIcon';
import { AIAssistantIcon } from './icons/AIAssistantIcon';


interface EnvInfo {
    label: string;
    icon: React.ReactElement;
}

const ENVIRONMENTS: Record<PreviewEnvironment, EnvInfo> = {
    auto: { label: 'Auto', icon: <AIAssistantIcon className="w-5 h-5 text-blue-400" /> },
    react_babel: { label: 'React (Babel)', icon: <ReactLogoIcon className="w-5 h-5" /> },
    html_css_js: { label: 'HTML/CSS/JS', icon: <Html5LogoIcon className="w-5 h-5" /> },
    vue_cdn: { label: 'Vue (CDN)', icon: <VueLogoIcon className="w-5 h-5" /> },
    svelte_cdn: { label: 'Svelte (CDN)', icon: <SvelteLogoIcon className="w-5 h-5" /> },
    nodejs: { label: 'Node.js', icon: <NodeLogoIcon className="w-5 h-5" /> },
    python: { label: 'Python', icon: <PythonLogoIcon className="w-5 h-5" /> },
    go: { label: 'Go', icon: <GoLogoIcon className="w-5 h-5" /> },
    java: { label: 'Java', icon: <JavaLogoIcon className="w-5 h-5" /> },
};

const ENVIRONMENT_ORDER: PreviewEnvironment[] = [
    'auto',
    'react_babel',
    'html_css_js',
    'vue_cdn',
    'svelte_cdn',
    'nodejs',
    'python',
    'go',
    'java',
];

interface EnvironmentSwitcherProps {
    currentEnv: PreviewEnvironment;
    onChange: (env: PreviewEnvironment) => void;
}

export const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({ currentEnv, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { label, icon } = ENVIRONMENTS[currentEnv] || ENVIRONMENTS.auto;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (env: PreviewEnvironment) => {
        onChange(env);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-white"
            >
                {icon}
                <span className="text-xs font-medium">{label}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 bg-[#252526] border border-gray-600 rounded-md shadow-2xl p-1.5 z-50">
                    <ul>
                        {ENVIRONMENT_ORDER.map(envKey => (
                            <li key={envKey}>
                                <button
                                    onClick={() => handleSelect(envKey)}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors ${
                                        currentEnv === envKey
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-200 hover:bg-gray-700'
                                    }`}
                                >
                                    {ENVIRONMENTS[envKey].icon}
                                    {ENVIRONMENTS[envKey].label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};