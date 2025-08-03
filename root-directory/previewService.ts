

import type { FileSystemTree, FileSystemNode, PreviewEnvironment } from '../types';

const findFile = (path: string, tree: FileSystemTree): { content: string, path: string } | null => {
    const parts = path.split('/').filter(Boolean);
    let current: FileSystemNode | FileSystemTree = tree;
    for (const part of parts) {
        if (current.type === 'folder' && current.children[part]) {
            current = current.children[part];
        } else {
            return null;
        }
    }
    if (current.type === 'file') {
        return { content: current.content, path: path };
    }
    return null;
};

const findFileRecursive = (tree: FileSystemTree, fileName: string): { content: string, path: string } | null => {
    let result = null;
    const search = (node: FileSystemNode | FileSystemTree, currentPath: string) => {
        if (result) return; // Stop if found
        if ('children' in node) {
            for (const [name, child] of Object.entries(node.children)) {
                const newPath = currentPath ? `${currentPath}/${name}` : name;
                if (name === fileName && child.type === 'file') {
                    result = { content: child.content, path: newPath };
                    return;
                }
                search(child, newPath);
            }
        }
    };
    search(tree, '');
    return result;
}

export const detectEnvironment = (fileSystem: FileSystemTree): PreviewEnvironment => {
    if (findFileRecursive(fileSystem, 'pom.xml') || findFileRecursive(fileSystem, 'Main.java') || findFileRecursive(fileSystem, 'Application.java')) return 'java';
    if (findFileRecursive(fileSystem, 'main.go') || findFileRecursive(fileSystem, 'go.mod')) return 'go';
    if (findFileRecursive(fileSystem, 'main.py') || findFileRecursive(fileSystem, 'app.py') || findFileRecursive(fileSystem, 'requirements.txt')) return 'python';
    if (findFileRecursive(fileSystem, 'server.js') || findFileRecursive(fileSystem, 'app.js') || findFileRecursive(fileSystem, 'package.json')) return 'nodejs';
    if (findFileRecursive(fileSystem, 'App.vue')) return 'vue_cdn';
    if (findFileRecursive(fileSystem, 'App.svelte')) return 'svelte_cdn';
    if (findFileRecursive(fileSystem, 'index.html')) return 'html_css_js';
    if (findFileRecursive(fileSystem, 'App.tsx')) return 'react_babel';
    return 'react_babel'; // Default
};

const escapeScript = (script: string) => script.replace(/<\/script>/g, '<\\/script>');

const generateBaseHtml = (headContent = '', bodyContent = '') => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code&display=swap" rel="stylesheet" />
        <style> 
            body { background-color: #ffffff; color: #111827; padding: 0; margin: 0; } 
            #root:empty::before, #app:empty::before { 
                content: 'Loading Preview...'; 
                position: absolute; 
                top: 50%; left: 50%; 
                transform: translate(-50%, -50%); 
                color: #9ca3af;
                font-family: sans-serif;
            }
        </style>
        ${headContent}
    </head>
    <body>
        ${bodyContent}
    </body>
    </html>
`;

const generateReactBabelSrcDoc = (fileSystem: FileSystemTree): string => {
    const appFile = findFile('src/App.tsx', fileSystem);
    const code = appFile ? appFile.content : '// src/App.tsx not found';

    const renderScript = `
        try {
            ${code}
            const rootEl = document.getElementById('root');
            if (typeof App === 'undefined') throw new ReferenceError("Component 'App' is not defined in src/App.tsx.");
            const root = ReactDOM.createRoot(rootEl);
            root.render(React.createElement(App));
        } catch (err) {
            window.parent.postMessage({ type: 'console', level: 'error', message: \`Render Error: \${err.message}\${err.stack ? '\\n' + err.stack : ''}\` }, '*');
        }
    `;

    const head = `
        <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    `;
    const body = `
        <div id="root"></div>
        <script type="text/babel" data-presets="react,typescript">${escapeScript(renderScript)}</script>
    `;
    return generateBaseHtml(head, body);
};

const generateHtmlCssJsSrcDoc = (fileSystem: FileSystemTree): string => {
    const htmlFile = findFileRecursive(fileSystem, 'index.html');
    const cssFile = findFileRecursive(fileSystem, 'style.css');
    const jsFile = findFileRecursive(fileSystem, 'script.js');

    let content = htmlFile ? htmlFile.content : '<div id="root">index.html not found</div>';
    
    if (cssFile) {
        content = content.replace('</head>', `<style>${cssFile.content}</style></head>`);
    }
    if (jsFile) {
        content = content.replace('</body>', `<script type="module">${jsFile.content}</script></body>`);
    }

    return content;
};

const generateVueCdnSrcDoc = (fileSystem: FileSystemTree): string => {
    const vueFile = findFileRecursive(fileSystem, 'App.vue');
    if (!vueFile) return generateBaseHtml('', '<h2>App.vue not found</h2>');

    const templateMatch = vueFile.content.match(/<template>([\s\S]*?)<\/template>/);
    const scriptMatch = vueFile.content.match(/<script>([\s\S]*?)<\/script>/);
    const styleMatch = vueFile.content.match(/<style>([\s\S]*?)<\/style>/);

    const template = templateMatch ? templateMatch[1] : '<div>Template not found</div>';
    const scriptContent = scriptMatch ? scriptMatch[1].replace(/export default\s*{/, '{') : '{}';
    const style = styleMatch ? styleMatch[1] : '';

    const renderScript = `
        const App = ${scriptContent}
        App.template = \`${template.replace(/`/g, '\\`')}\`;
        Vue.createApp(App).mount('#app');
    `;
    
    const head = `
        <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
        <style>${style}</style>
    `;
    const body = `
        <div id="app"></div>
        <script>${escapeScript(renderScript)}</script>
    `;

    return generateBaseHtml(head, body);
};

const generateSvelteCdnSrcDoc = (fileSystem: FileSystemTree): string => {
    const svelteFile = findFileRecursive(fileSystem, 'App.svelte');
    if (!svelteFile) return generateBaseHtml('', '<h2>App.svelte not found</h2>');
    
    const head = `
        <script src="https://unpkg.com/svelte@3/compiler.js"></script>
        <script>
            window.addEventListener('load', () => {
                const svelteCode = \`${svelteFile.content.replace(/`/g, '\\`')}\`;
                try {
                    const { js } = svelte.compile(svelteCode, {
                        filename: 'App.svelte',
                        format: 'esm',
                        generate: 'dom'
                    });
                    
                    const scriptEl = document.createElement('script');
                    scriptEl.setAttribute('type', 'module');
                    scriptEl.innerHTML = js.code.replace('export default Component', 'new Component({ target: document.getElementById("app") });');
                    document.body.appendChild(scriptEl);

                } catch(e) {
                     window.parent.postMessage({ type: 'console', level: 'error', message: \`Svelte Compile Error: \${e.message}\` }, '*');
                }
            });
        </script>
    `;
     const body = `<div id="app"></div>`;
     return generateBaseHtml(head, body);
};

const generateBackendSimulationDoc = (
    fileSystem: FileSystemTree,
    htmlPathFinders: ((fs: FileSystemTree) => { content: string, path: string } | null)[],
    logLines: any[]
): string => {
     let htmlFile: { content: string, path: string } | null = null;
    for (const finder of htmlPathFinders) {
        htmlFile = finder(fileSystem);
        if (htmlFile) break;
    }
    const renderedHtml = htmlFile ? htmlFile.content : '<p style=\\"color: #a0aec0;\\">No compatible HTML file found for this backend type.</p>';
    
    const head = `
        <style>
            body { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #111827; }
            
            .terminal-container { 
                display: flex;
                flex-direction: column;
                height: 40%; /* initial height */
                min-height: 30px; /* header height */
                background: #000; 
                overflow: hidden; /* container controls overflow */
                flex-shrink: 0;
            }
            .terminal-header {
                background: #1f2937;
                padding: 0.25rem 0.75rem;
                font-family: sans-serif;
                font-size: 0.8rem;
                color: #9ca3af;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                height: 30px;
                box-sizing: border-box;
            }
            #toggle-terminal-btn {
                background: none;
                border: 1px solid #4b5563;
                color: #9ca3af;
                cursor: pointer;
                width: 20px;
                height: 20px;
                border-radius: 4px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                line-height: 1;
            }
            #toggle-terminal-btn:hover { background: #374151; }
            
            .terminal { 
                flex-grow: 1;
                overflow-y: auto; 
                padding: 1rem; 
                font-family: 'Fira Code', monospace;
                color: #d1d5db;
                background: #000;
            }
            .resizer {
                background: #374151;
                height: 6px;
                cursor: row-resize;
                flex-shrink: 0;
                transition: background-color 0.2s;
            }
            .resizer:hover { background: #4b5563; }

            .terminal-line { display: flex; gap: 1rem; font-size: 0.8rem; white-space: pre; transition: opacity 0.3s ease-out; }
            .time { color: #6b7280; }
            .type-INFO { color: #3b82f6; font-weight: bold; }
            .type-CMD { color: #a78bfa; }
            .type-OK { color: #22c55e; }
            .type-WARN { color: #f59e0b; }
            .type-REQ { color: #9ca3af; }
            .type-BUILD { color: #eab308; }

            .preview-pane { flex-grow: 1; display: flex; flex-direction: column;}
            .preview-header { padding: 0.5rem 1rem; background: #1f2937; color: #9ca3af; font-family: sans-serif; font-size: 0.8rem; border-bottom: 1px solid #374151; flex-shrink: 0; }
            .preview-content { flex-grow: 1; background: white; }
            .preview-content iframe { width: 100%; height: 100%; border: none; }
        </style>
    `;

    const body = `
        <div class="terminal-container" id="terminal-container">
            <div class="terminal-header">
                <span>Terminal & Output</span>
                <button id="toggle-terminal-btn" title="Minimize Terminal">_</button>
            </div>
            <div class="terminal" id="terminal"></div>
        </div>
        <div class="resizer" id="resizer"></div>
        <div class="preview-pane">
            <div class="preview-header">Rendered output from ${htmlFile?.path || 'N/A'}:</div>
            <div class="preview-content">
                <iframe srcdoc="${renderedHtml.replace(/"/g, '&quot;')}"></iframe>
            </div>
        </div>
        <script>
            const terminalContainer = document.getElementById('terminal-container');
            const resizer = document.getElementById('resizer');
            const toggleBtn = document.getElementById('toggle-terminal-btn');
            const terminal = document.getElementById('terminal');

            // --- Resizing Logic ---
            let isResizing = false;
            const handleMouseMove = (e) => {
                if (!isResizing) return;
                const newHeight = e.clientY;
                // Add constraints
                if (newHeight > 50 && newHeight < window.innerHeight - 100) {
                    terminalContainer.style.height = newHeight + 'px';
                }
            };
            const stopResizing = () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', stopResizing);
            };
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isResizing = true;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', stopResizing);
            });

            // --- Toggle Logic ---
            let isMinimized = false;
            let lastHeight = '40%'; // Initialize with default from CSS
            toggleBtn.addEventListener('click', () => {
                isMinimized = !isMinimized;
                if (isMinimized) {
                    // Before minimizing, store the current height if it's set and not already the minimized height.
                    const currentHeight = terminalContainer.style.height;
                    if (currentHeight && currentHeight !== '30px') {
                        lastHeight = currentHeight;
                    }
                    terminalContainer.style.height = '30px'; // Header height
                    resizer.style.display = 'none';
                    toggleBtn.innerHTML = '&#9633;'; // Square symbol for restore
                    toggleBtn.title = 'Restore Terminal';
                } else {
                    terminalContainer.style.height = lastHeight;
                    resizer.style.display = 'block';
                    toggleBtn.innerHTML = '_';
                    toggleBtn.title = 'Minimize Terminal';
                }
            });

            // --- Terminal Log Output ---
            const logs = ${JSON.stringify(logLines)};
            let i = 0;
            function printLog() {
                if (i < logs.length) {
                    const log = logs[i];
                    const line = document.createElement('div');
                    line.className = 'terminal-line';
                    line.style.opacity = 0;
                    line.innerHTML = '<span class="time">' + log.time + '</span>' +
                                     '<span class="type type-' + log.type + '">[' + log.type + ']</span>' +
                                     '<span>' + log.msg + '</span>';
                    terminal.appendChild(line);
                    terminal.scrollTop = terminal.scrollHeight;
                    
                    setTimeout(() => line.style.opacity = 1, 10);
                    
                    i++;
                    const delay = i > 4 ? Math.floor(Math.random() * 200) + 25 : 75;
                    setTimeout(printLog, delay);
                }
            }
            printLog();
        </script>
    `;

    return generateBaseHtml(head, body);
}

const generateNodeSimulationSrcDoc = (fileSystem: FileSystemTree) => {
    const logLines = [
        { time: '14:02:10', type: 'INFO', msg: 'Starting Node.js server...' },
        { time: '14:02:10', type: 'INFO', msg: 'Detected package.json. Running installer.' },
        { time: '14:02:11', type: 'CMD', msg: 'npm install' },
        { time: '14:02:13', type: 'OK', msg: 'Dependencies installed.' },
        { time: '14:02:13', type: 'CMD', msg: 'node server.js' },
        { time: '14:02:14', type: 'INFO', msg: 'Server listening on http://localhost:8080' },
        { time: '14:02:15', type: 'REQ', msg: 'GET / 200' },
    ];
    return generateBackendSimulationDoc(fileSystem, [fs => findFile('public/index.html', fs), fs => findFile('views/index.html', fs)], logLines);
};

const generatePythonSimulationSrcDoc = (fileSystem: FileSystemTree) => {
    const logLines = [
        { time: '14:03:01', type: 'INFO', msg: 'Starting Python server...' },
        { time: '14:03:01', type: 'INFO', msg: 'Found requirements.txt. Creating virtual environment.' },
        { time: '14:03:02', type: 'CMD', msg: 'python -m venv .venv' },
        { time: '14:03:03', type: 'CMD', msg: 'source .venv/bin/activate' },
        { time: '14:03:04', type: 'CMD', msg: 'pip install -r requirements.txt' },
        { time: '14:03:06', type: 'OK', msg: 'Dependencies installed successfully.' },
        { time: '14:03:07', type: 'CMD', msg: 'flask run --host=0.0.0.0' },
        { time: '14:03:08', type: 'INFO', msg: ' * Serving Flask app "app.py"' },
        { time: '14:03:08', type: 'INFO', msg: ' * Running on http://0.0.0.0:5000/' },
        { time: '14:03:10', type: 'REQ', msg: '127.0.0.1 - "GET / HTTP/1.1" 200 -' },
    ];
    return generateBackendSimulationDoc(fileSystem, [fs => findFile('templates/index.html', fs)], logLines);
};

const generateGoSimulationSrcDoc = (fileSystem: FileSystemTree) => {
    const logLines = [
        { time: '14:04:10', type: 'INFO', msg: 'Starting Go server...' },
        { time: '14:04:10', type: 'INFO', msg: 'Found go.mod. Tidying modules.' },
        { time: '14:04:11', type: 'CMD', msg: 'go mod tidy' },
        { time: '14:04:12', type: 'INFO', msg: 'Building binary...' },
        { time: '14:04:13', type: 'CMD', msg: 'go build -o /tmp/main' },
        { time: '14:04:15', type: 'OK', msg: 'Build successful.' },
        { time: '14:04:15', type: 'CMD', msg: '/tmp/main' },
        { time: '14:04:16', type: 'INFO', msg: 'Server starting on port 8080' },
        { time: '14:04:18', type: 'REQ', msg: 'Received request for /' },
    ];
    return generateBackendSimulationDoc(fileSystem, [fs => findFile('public/index.html', fs), fs => findFile('templates/index.html', fs)], logLines);
};

const generateJavaSimulationSrcDoc = (fileSystem: FileSystemTree) => {
    const logLines = [
        { time: '14:05:20', type: 'INFO', msg: 'Starting Java server...' },
        { time: '14:05:20', type: 'INFO', msg: 'Found pom.xml. Running Maven build.' },
        { time: '14:05:21', type: 'CMD', msg: 'mvn clean install' },
        { time: '14:05:22', type: 'BUILD', msg: '[INFO] Scanning for projects...' },
        { time: '14:05:25', type: 'BUILD', msg: '[INFO] Downloading from central: ...' },
        { time: '14:05:28', type: 'BUILD', msg: '[INFO] BUILD SUCCESS' },
        { time: '14:05:29', type: 'CMD', msg: 'java -jar target/app.jar' },
        { time: '14:05:30', type: 'INFO', msg: 'o.s.b.w.e.t.TomcatWebServer : Tomcat started on port(s): 8080 (http)' },
        { time: '14:05:31', type: 'INFO', msg: 'Started Application in 5.123 seconds' },
    ];
    return generateBackendSimulationDoc(fileSystem, [fs => findFile('src/main/resources/templates/index.html', fs)], logLines);
};

export const generateSrcDoc = (environment: PreviewEnvironment, fileSystem: FileSystemTree): string => {
    switch (environment) {
        case 'react_babel':
            return generateReactBabelSrcDoc(fileSystem);
        case 'html_css_js':
            return generateHtmlCssJsSrcDoc(fileSystem);
        case 'vue_cdn':
            return generateVueCdnSrcDoc(fileSystem);
        case 'svelte_cdn':
            return generateSvelteCdnSrcDoc(fileSystem);
        case 'nodejs':
             return generateNodeSimulationSrcDoc(fileSystem);
        case 'python':
             return generatePythonSimulationSrcDoc(fileSystem);
        case 'go':
             return generateGoSimulationSrcDoc(fileSystem);
        case 'java':
             return generateJavaSimulationSrcDoc(fileSystem);
        default:
            return generateBaseHtml('', '<h2>Unsupported Environment</h2>');
    }
};