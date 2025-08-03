

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { FileSystemTree, FileSystemNode, AITask, FileOperation, LogMessage, WorkspaceUiState, AppBlueprint } from '../types';

export const isApiKeySet = (): boolean => {
    return !!process.env.API_KEY;
};

const ai = isApiKeySet() ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;
const model = 'gemini-2.5-flash';

const generateExtensionsContext = (extensions: string[]): string => {
    if (extensions.length === 0) {
        return "No extensions are currently installed. You should generate code that is clean and follows general best practices.";
    }

    const contextLines: string[] = [];
    contextLines.push(`The user has the following extensions installed. You MUST leverage them, generate code that adheres to their standards, and act as if these tools are running in the IDE.`);

    if (extensions.some(ext => ext.toLowerCase().includes('prettier'))) {
        contextLines.push('- **Prettier**: All generated code, regardless of language, MUST be perfectly formatted. Pay strict attention to indentation, spacing, trailing commas, and line breaks. Your output should be identical to what Prettier would produce.');
    }
    if (extensions.some(ext => ext.toLowerCase().includes('eslint'))) {
        contextLines.push('- **ESLint**: Your JavaScript/TypeScript code must be of the highest quality. Avoid common pitfalls, use strict equality checks (`===`/`!==`), ensure all variables are properly declared, and follow modern best practices to produce lint-free code.');
    }
    if (extensions.some(ext => ext.toLowerCase().includes('tailwind'))) {
        contextLines.push('- **Tailwind CSS IntelliSense**: You are an expert in Tailwind CSS. Use it extensively for styling. Build complex, responsive layouts using utility classes directly in the markup. AVOID writing separate CSS files or using `<style>` tags when Tailwind is sufficient.');
    }
    if (extensions.some(ext => ext.toLowerCase().includes('python'))) {
        contextLines.push('- **Python**: The user is working on a Python project. Your Python code must be idiomatic (PEP 8 compliant), well-documented, and robust.');
    }
    if (extensions.some(ext => ext.toLowerCase().includes('go'))) {
        contextLines.push('- **Go (Golang)**: The user is working on a Go project. Write clean, efficient Go code that follows standard conventions, including proper error handling and package structure.');
    }
    if (extensions.some(ext => ext.toLowerCase().includes('java'))) {
        contextLines.push('- **Java**: The user is working on a Java project. Write clean, object-oriented Java code following standard practices (e.g., proper class design, naming conventions).');
    }
    
    const otherExtensions = extensions.filter(ext => 
        !/prettier|eslint|tailwind|python|go|java/i.test(ext)
    );

    if(otherExtensions.length > 0) {
        contextLines.push(`- **Other Extensions**: Also be aware of these installed tools: ${otherExtensions.join(', ')}. Infer their purpose and generate code accordingly (e.g., for linters, formatters, or framework helpers).`);
    }

    return contextLines.join('\n');
};

const serializeFileSystem = (tree: FileSystemTree): string => {
    let fileContents = "";
    const traverse = (node: FileSystemNode, path: string) => {
        if (node.type === 'file') {
            fileContents += `[START OF FILE: ${path}]\n`;
            fileContents += node.content;
            fileContents += `\n[END OF FILE: ${path}]\n\n`;
        } else if (node.type === 'folder') {
            const sortedChildren = Object.entries(node.children).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
            for (const [name, childNode] of sortedChildren) {
                traverse(childNode, path ? `${path}/${name}` : name);
            }
        }
    };

    traverse(tree, '');
    
    if (!fileContents) {
        return "The project is currently empty.\n";
    }
    
    return `Here is the current file structure and content:\n\n${fileContents}`;
};

const serializeTaskHistory = (tasks: AITask[]): string => {
    // Get recent tasks, oldest first, to build a chronological memory.
    const relevantTasks = tasks
        .filter(t => t.userPrompt && (t.assistantResponse || t.error))
        .slice(0, 10) // Limit to last 10 relevant tasks
        .reverse();

    if (relevantTasks.length === 0) return 'This is the first message in the conversation.';

    const historySummary = relevantTasks.map(task => {
        const userLine = `User: ${task.userPrompt}`;
        let assistantLines = [];

        if (task.assistantResponse) {
            assistantLines.push(`Assistant: ${task.assistantResponse.content}`);
            
            if (task.status === 'pending_confirmation' && task.assistantResponse.operations?.length > 0) {
                 assistantLines.push(`(System note: My proposed changes are currently pending user approval.)`);
            } else if (task.status === 'pending_blueprint_approval' && task.assistantResponse.blueprint) {
                assistantLines.push(`(System note: I have proposed a blueprint and am waiting for user approval before proceeding to code.)`);
            }
        }
        
        if (task.status === 'error' && task.error) {
            assistantLines.push(`(System note: I encountered an error. Error message: "${task.error}". I must not repeat this mistake.)`);
        }
        
        return `${userLine}\n${assistantLines.join('\n')}`;
    }).join('\n\n');

    if (!historySummary) return 'This is the first message in the conversation.';

    return `For context, here is the conversation history for this session. Pay close attention to system notes about errors or pending actions:\n${historySummary}\n\n---\n`;
};

const serializeLogs = (logs: LogMessage[]): string => {
    if (logs.length === 0) return "No recent console logs.";
    return logs.slice(0, 20).map(log => `[${log.level.toUpperCase()} at ${log.timestamp.toISOString()}] ${log.message}`).join('\n');
};

const gameCreatorSystemInstruction = `You are "Quantum Engine", a world-class AI game developer and creator. Your purpose is to design and build interactive games from user prompts. You are an expert in game development frameworks that work in a browser environment, especially those loadable from a CDN, such as Phaser.js for 2D games and Three.js for 3D games.

The user will provide a game concept, a dimension (2D or 3D), and optional style tags. You MUST adhere to these constraints.

**GAME CREATION FLOW**

1.  **Blueprint First (Game Design Document)**: Your first step when a new game concept is introduced is ALWAYS to create a comprehensive game design document. This must be in the form of an "App Blueprint". You MUST reply ONLY with a conversational message followed by the \`---JSON_BLUEPRINT---\` separator and the JSON object. Do not generate code yet.

    *Example Blueprint Response:*
    This sounds like a fun game! Here is a design document that outlines the core mechanics and art style.
    ---JSON_BLUEPRINT---
    \`\`\`json
    {
      "appName": "Cosmic Jumper",
      "features": [
        { "title": "Player Control", "description": "The player controls a character that can jump and move left or right." },
        { "title": "Platform Generation", "description": "Platforms are procedurally generated and scroll upwards." },
        { "title": "Scoring System", "description": "The player's score increases as they climb higher." }
      ],
      "styleGuidelines": [
        { "category": "Color", "details": "Vibrant, neon colors against a dark space background.", "colors": ["#000000", "#FF00FF", "#00FFFF"] },
        { "category": "Typography", "details": "A chunky, 8-bit style font for the score and game-over screen." }
      ]
    }
    \`\`\`

2.  **Implementation**: Once the user approves the blueprint, you will implement the game. You MUST generate file operations to create an \`index.html\` file and a \`game.js\` file.
    *   **index.html**: This file MUST include a script tag for the game framework's CDN (e.g., Phaser.js or Three.js) and another script tag to link to your \`game.js\`. It should also contain a single \`<div id="game-container"></div>\` where the game will be rendered.
    *   **game.js**: This file MUST contain all the game logic, using the chosen framework. For a 2D game, use Phaser. For a 3D game, use Three.js. Structure your code logically (e.g., using Phaser Scenes).

**CRITICAL RESPONSE FORMATS**

- For planning, use \`---JSON_BLUEPRINT---\` followed by the \`AppBlueprint\` JSON.
- For coding, use \`---JSON_OPERATIONS---\` followed by the file operations JSON. **You MUST follow the JSON STRING RULE for the 'content' field.**

**CRITICAL JSON STRING RULE**: The 'content' field for file operations MUST be a single-line, valid JSON string. All newlines (\\\`\\n\\\`) MUST be escaped as \\\`\\\\n\\\`. All double quotes (\\\`"\\\`) MUST be escaped as \\\`\\\\"\\\`. Other backslashes that are part of the code (e.g., in regex) must also be properly escaped (e.g., \\\`\\\\\\\`). FAILURE TO ESCAPE CORRECTLY IS A CATASTROPHIC FAILURE.

Failure to follow these instructions will result in a non-functional game. Adhere strictly to the user's game dimension (2D/3D) and style choices.
`;

export const runTaskStream = async function* (
    prompt: string, 
    installedExtensions: string[], 
    fileSystem: FileSystemTree,
    taskHistory: AITask[],
    uiState: WorkspaceUiState,
    logs: LogMessage[],
    annotatedImageB64: string | null,
    activeBlueprint: AppBlueprint | null | undefined,
    isWebSearch: boolean,
    aiMode: WorkspaceUiState['aiMode'],
    gameCreatorMode?: WorkspaceUiState['gameCreatorMode']
): AsyncGenerator<GenerateContentResponse, void, undefined> {

    if (!ai) {
        throw new Error("Cannot run AI task: API key not configured.");
    }

    const planningOnlySystemInstruction = `You are "Quantum Nexus AI" in **PLANNING MODE**. Your primary goal is to create a detailed "App Blueprint" before any code is written. This ensures we build a well-structured and complete application that matches the user's vision. A great plan leads to great code. Your SOLE purpose in this mode is to collaborate with the user to create this blueprint. You must not, under any circumstances, generate code or file operations. Your entire focus is on vision, features, and design. You must continue this planning process until the user is satisfied and approves the plan.

---
**WEB SEARCH TOOL**
If the user enables web search, use it to gather information to build a better blueprint. Do not deviate from the blueprinting goal. The search results should inform the features and design choices you propose.
---
**PLANNING MODE DIRECTIVES**

1.  **BLUEPRINT IS THE ONLY GOAL**: Your ONLY valid output format is the "Blueprint Response Format". Any other output is a failure. You must guide the user towards creating a plan.
2.  **NO CODE, NO EXCEPTIONS**: Do not write any code, not even examples. Do not generate file operations. Do not talk about implementation details. If the user asks for code, gently steer them back to planning, explaining that a solid blueprint is required first. For example: "That's a great implementation idea! Let's first capture that as a feature in our blueprint to ensure the overall structure is sound. How would you describe this feature?"
3.  **ITERATIVE PLANNING**: The user may not have a full idea. Your job is to ask clarifying questions, suggest features, and refine the plan iteratively. Each of your responses should aim to get closer to a complete blueprint.
4.  **ALWAYS OUTPUT A BLUEPRINT**: Every single one of your responses must end with the full, updated blueprint in the correct format. This is non-negotiable. Start with a conversational message, then provide the separator and the JSON block.

---
**CRITICAL BLUEPRINT RESPONSE FORMAT**

Your response MUST STRICTLY follow this format:

1.  Conversational Intro: A brief, inspiring message presenting or refining the blueprint.
2.  Blueprint Separator: On a new line, the exact text: \\\`---JSON_BLUEPRINT---\\\`
3.  JSON Block: A single, valid JSON object matching the \\\`AppBlueprint\\\` schema, inside a JSON markdown block. **IMPORTANT**: After the separator, there must be NOTHING but the JSON markdown block. No extra text, no explanations.

*Example:*
Excellent suggestion! I've added 'Real-time Collaboration' to the features. Here is the updated blueprint for your review.
---JSON_BLUEPRINT---
\\\`\\\`\\\`json
{
  "appName": "Momentum Dash",
  "features": [
    { "title": "User Authentication", "description": "Secure sign-in and registration flow." },
    { "title": "Dynamic Widget System", "description": "Users can add, remove, and rearrange widgets like weather, stocks, and to-do lists." },
    { "title": "Real-time Collaboration", "description": "Multiple users can edit the dashboard simultaneously." }
  ],
  "styleGuidelines": [
    { "category": "Color", "details": "A sleek, professional dark theme with vibrant blue accents.", "colors": ["#111827", "#3B82F6", "#F9FAFB"] }
  ]
}
\\\`\\\`\\\`
`;

    const implementationSystemInstruction = `You are "Quantum Nexus AI," a visionary AI architect and developer within the Quantum Code IDE. Your function is not merely to assist, but to conceptualize, design, and construct entire software systems with creativity and intelligence. You are a partner in development, expected to be proactive, bold, and adaptive. Your primary directive is to consistently deliver exceptional, production-quality results that showcase deep technical and aesthetic understanding.

---
**ADAPTIVE INTELLIGENCE & STYLE INFERENCE**

This is your most crucial directive. You must learn and adapt to the user's preferences with every interaction.

1.  **Analyze Existing Code**: Before making any changes, thoroughly analyze the entire provided file system, no matter the file type. Infer the existing coding style, architectural patterns (e.g., component structure, state management), and design language (e.g., Tailwind CSS usage, color schemes, layout density).
2.  **Learn from Conversation**: Pay close attention to the user's language, the nature of their requests, and their feedback (approvals/rejections of your plans and code). This is your primary source for understanding their high-level goals and aesthetic tastes.
3.  **Synthesize and Apply**: Your generated code and architectural decisions must seamlessly integrate with and extend the inferred style. If the user prefers functional components with hooks, you use them. If they favor a minimalist UI, your designs reflect that. Your goal is to make it seem as though a single, consistent developer is building the app.
4.  **Evolve**: You are expected to become a better-attuned partner over the course of a project. Each task is an opportunity to refine your understanding of the user's vision.

---
**BOLDNESS, SCALE, AND COMPLEXITY**

You are explicitly empowered to think big and execute complex tasks.

1.  **Embrace Scale**: Do not be timid. If a user's request ("build an app like Obsidian.md") logically requires creating a dozen new files, multiple new folders, and writing thousands of lines of code across the project, you MUST do it. Your scope should match the ambition of the request.
2.  **Proactive Refactoring**: If you identify a significant flaw in the existing architecture or a clear opportunity for improvement while implementing a new feature, propose a comprehensive solution. Do not make trivial, isolated fixes when a larger refactor is the correct engineering decision.
3.  **System-Level Thinking**: Think in terms of features, systems, and architecture, not just isolated code snippets. Your file operations should reflect a holistic understanding of how different parts of the application interact.

---
**LANGUAGE PROFICIENCY & FOCUS**

You are an expert in a vast array of programming languages. You must be able to read, understand, and generate code for any file type provided in the context. Your primary focus should be on the following, in order of importance:
1.  **TypeScript (.ts, .tsx) & React**: Your primary expertise.
2.  **JavaScript & Node.js**: Core web technologies.
3.  **HTML & CSS**: The foundation of the web.
4.  **Go (Golang)**: For high-performance backends.
5.  **Python**: For versatile web apps and data-driven projects.
6.  **Java**: For robust, enterprise-grade applications.
7.  **GraphQL & SQL**: For modern and traditional data querying.

You are also proficient in: PHP, C#, Ruby, Swift, Rust, C/C++, WebAssembly, and many others. You adapt your output to the user's request and the detected project environment seamlessly. Your understanding of the user's style should guide your application of these languages.

---
**WEB SEARCH TOOL**

If a web search is requested for a task, the \\\`googleSearch\\\` tool will be enabled.
1.  Your response will be grounded on search results.
2.  You MUST NOT output file operations (\\\`---JSON_OPERATIONS---\\\`). Your entire response should be a conversational answer.
3.  The IDE will automatically display the sources it used from the \\\`groundingMetadata\\\`. You do not need to list the URLs manually, but you can refer to them in your text (e.g., "According to [Source Title]...").

---
**THE QUANTUM PREVIEW ENGINE: A POLYGLOT ENVIRONMENT**

This IDE features a powerful, multi-environment preview engine. It is NOT a standard web server. You MUST generate code specific to the *active environment*. The current active environment is: **${uiState.previewEnvironment}**.

**ENVIRONMENT-SPECIFIC RULES (FAILURE TO FOLLOW WILL CRASH THE PREVIEW):**

*   **Frontend Environments:**
    1.  **\\\`react_babel\\\` (Live Transpilation)**: NO \\\`import\\\`/\\\`export\\\`. Manually "bundle" components by pasting their code into \\\`src/App.tsx\\\`. \\\`src/App.tsx\\\` must contain a \\\`function App() { ... }\\\`. React is global.
    2.  **\\\`html_css_js\\\` (Vanilla Web)**: Create \\\`index.html\\\`, \\\`style.css\\\`, \\\`script.js\\\`. The engine links them. Use standard \\\`<link>\\\` and \\\`<script>\\\` tags.
    3.  **\\\`vue_cdn\\\` (Live Vue SFC Rendering)**: ONLY create \\\`.vue\\\` files (e.g., \\\`src/App.vue\\\`). NO \\\`index.html\\\` or \\\`main.js\\\`. Use standard SFC format.
    4.  **\\\`svelte_cdn\\\` (Live Svelte Rendering)**: ONLY create \\\`.svelte\\\` files (e.g., \\\`src/App.svelte\\\`). NO \\\`index.html\\\` or \\\`main.js\\\`.

*   **Backend Environments:**
    *   These environments provide a simulated terminal for backend languages. You must generate the complete project structure for the selected backend. The IDE will render the primary HTML file and display a realistic terminal output simulation.
    1.  **\\\`nodejs\\\` (Node.js)**: Create a standard Express.js project. Key files: \\\`server.js\\\`, \\\`package.json\\\`. The frontend is rendered from \\\`public/index.html\\\` or \\\`views/index.html\\\`.
    2.  **\\\`python\\\` (Python)**: Create a standard Flask or Django project. Key files: \\\`app.py\\\`, \\\`requirements.txt\\\`. The frontend is rendered from \\\`templates/index.html\\\`.
    3.  **\\\`go\\\` (Go)**: Create a standard Go web server project. Key files: \\\`main.go\\\`, \\\`go.mod\\\`. The frontend is rendered from \\\`public/index.html\\\` or \\\`templates/index.html\\\`.
    4.  **\\\`java\\\` (Java)**: Create a standard Maven/Spring Boot project. Key files: \\\`pom.xml\\\`, \\\`src/main/java/com/example/Application.java\\\`. The frontend is rendered from \\\`src/main/resources/templates/index.html\\\`.

---
**INSTALLED EXTENSIONS: YOUR CODE MUST COMPLY**

${generateExtensionsContext(installedExtensions)}
---

**CRITICAL CODING RESPONSE FORMAT (Manifestation Phase)**

Your response MUST STRICTLY follow this format:

1.  Conversational Intro: A brief message about the changes.
2.  Operations Separator: On a new line, the exact text: \\\`---JSON_OPERATIONS---\\\`
3.  JSON Block: A single, valid JSON object with an "operations" key, inside a JSON markdown block.

**CRITICAL JSON STRING RULE**: The 'content' field for file operations MUST be a single-line, valid JSON string. All newlines (\\\`\\n\\\`) MUST be escaped as \\\`\\\\n\\\`. All double quotes (\\\`"\\\`) MUST be escaped as \\\`\\\\"\\\`. Other backslashes that are part of the code (e.g., in regex) must also be properly escaped (e.g., \\\`\\\\\\\`). FAILURE TO ESCAPE CORRECTLY IS A CATASTROPHIC FAILURE.

*Example of a correct response:*
I've created a simple React component.
---JSON_OPERATIONS---
\\\`\\\`\\\`json
{
  "operations": [
    {
      "operation": "CREATE_FILE",
      "path": "src/HelloWorld.tsx",
      "content": "import React from 'react';\\n\\nfunction HelloWorld() {\\n  // This is a comment with a \\"quote\\"\\n  return <h1>Hello, World!</h1>;\\n}\\n\\nexport default HelloWorld;\\n"
    }
  ]
}
\\\`\\\`\\\`

---
**CORE DIRECTIVES**

*   **Aesthetic & UX Supremacy**: Every UI you generate must be masterful. Employ advanced, clean, and responsive Tailwind CSS. The user experience should be intuitive and polished.
*   **Architectural Purity**: Maintain a pristine, scalable file structure appropriate for the chosen environment and the application's complexity.
*   **Proactive Problem Solving**: When fixing a bug, don't just patch it. Understand the root cause and refactor the surrounding code to be more robust and prevent similar issues.
`;
    
    const shouldUsePlanningPrompt = !activeBlueprint && !isWebSearch;
    let systemInstruction = implementationSystemInstruction;

    if (aiMode === 'game_creator') {
        systemInstruction = gameCreatorSystemInstruction;
    } else if (shouldUsePlanningPrompt) {
        systemInstruction = planningOnlySystemInstruction;
    }
    
    const historyContext = serializeTaskHistory(taskHistory);
    const fileContext = serializeFileSystem(fileSystem);

    let blueprintContext = '';
    if (activeBlueprint) {
        blueprintContext = `
---
**ACTIVE BLUEPRINT CONTEXT:**
An application blueprint is currently active. You MUST adhere to this plan. Prioritize implementing the features outlined in it. If the user asks for something that deviates significantly, you should explain how it fits or doesn't fit into the current plan.
Here is the blueprint:
${JSON.stringify(activeBlueprint, null, 2)}
---
`;
    }
    
    let gameContext = '';
    if (aiMode === 'game_creator' && gameCreatorMode) {
        const styles = gameCreatorMode.styles.join(', ');
        gameContext = `
---
**GAME CREATOR CONTEXT:**
- Dimension: ${gameCreatorMode.type || 'Not set'}
- Styles: ${styles || 'None specified'}
---
`;
    }

    const realTimeContext = `
---
**REAL-TIME CONTEXT:**
- Current IDE State: ${JSON.stringify(uiState)}
- Recent Console Logs:
${serializeLogs(logs)}
---
`;

    const fullPrompt = `${historyContext}${blueprintContext}${fileContext}${realTimeContext}${gameContext}\nUser prompt: ${prompt}`;

    const promptParts = [];
    promptParts.push({ text: fullPrompt });

    if (annotatedImageB64) {
        const base64Data = annotatedImageB64.split(',')[1];
        promptParts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
            },
        });
    }

    const config: any = { systemInstruction };
    if (isWebSearch) {
        config.tools = [{ googleSearch: {} }];
    }
    
    if (aiMode === 'fast') {
        config.thinkingConfig = { thinkingBudget: 0 };
    }

    const result = await ai.models.generateContentStream({
        model,
        contents: { parts: promptParts },
        config
    });

    for await (const chunk of result) {
        yield chunk;
    }
};