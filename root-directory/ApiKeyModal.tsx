import React from 'react';
import { QuantumCodeLogo } from './icons/QuantumCodeLogo';

export const ApiKeyModal: React.FC = () => {
    return (
        <div className="modal-overlay">
            <div className="relative flex flex-col bg-[#1E1E1E] border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg text-white p-8 text-center">
                <div className="flex justify-center mb-4">
                    <QuantumCodeLogo className="h-12 w-12 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold mb-3">Gemini API Key Required</h2>
                <p className="text-gray-400">
                    It appears that your application is missing a Gemini API key.
                </p>
                <p className="text-gray-400 mt-2">
                    Please set the <code className="bg-gray-700 text-yellow-400 font-mono px-2 py-1 rounded">API_KEY</code> environment variable to enable AI features.
                </p>
                <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-md text-left text-sm">
                    <p className="font-semibold text-gray-300">Note for Developers:</p>
                    <p className="text-gray-400 mt-1">
                        This application is designed to securely access the API key from server-side environment variables. Do not expose your key on the client side.
                    </p>
                </div>
            </div>
        </div>
    );
};
