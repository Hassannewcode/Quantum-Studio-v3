export type OverlayPanelId = 'workspaces' | 'files' | 'extensions' | 'history';
export type ActivePanelId = OverlayPanelId | 'ai';
export type PreviewEnvironment = 'auto' | 'react_babel' | 'html_css_js' | 'vue_cdn' | 'svelte_cdn' | 'nodejs' | 'python' | 'go' | 'java';

export interface Feature {
  title: string;
  description: string;
}

export interface StyleGuideline {
  category: 'Color' | 'Layout' | 'Typography' | 'Iconography' | 'Animation';
  details: string;
  colors?: string[];
}

export interface AppBlueprint {
  appName: string;
  features: Feature[];
  styleGuidelines: StyleGuideline[];
}

export interface AITask {
  id: string;
  userPrompt: string;
  status: 'running' | 'completed' | 'error' | 'pending_confirmation' | 'pending_blueprint_approval';
  assistantResponse?: {
    content: string;
    operations?: FileOperation[];
    blueprint?: AppBlueprint;
    groundingChunks?: { web: { uri: string, title: string } }[];
  };
  error?: string;
  timestamp: Date;
  type?: 'user' | 'autopilot';
  featureTitle?: string;
}

export type FileOperationType = 'CREATE_FILE' | 'UPDATE_FILE' | 'DELETE_FILE' | 'CREATE_FOLDER' | 'DELETE_FOLDER' | 'RENAME_FILE' | 'RENAME_FOLDER';

export interface FileOperation {
  operation: FileOperationType;
  path: string;
  content?: string;
  newPath?: string;
  description?: string;
}

export interface FileNode {
  type: 'file';
  content: string;
}

export interface FolderNode {
  type: 'folder';
  children: { [key: string]: FileNode | FolderNode };
}

export type FileSystemTree = FolderNode;

export type FileSystemNode = FileNode | FolderNode;

export interface LogMessage {
  level: 'log' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
}

export interface Checkpoint {
  id: string;
  timestamp: string;
  fileSystem: FileSystemTree;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  fileSystem: FileSystemTree;
  tasks: AITask[];
  createdAt: string;
  activeBlueprint?: AppBlueprint | null;
  completedFeatures?: string[];
  checkpoints: Checkpoint[];
}

export interface WorkspaceUiState {
    activeOverlay: OverlayPanelId | null;
    activeEditorPath: string | null;
    isPreviewFullscreen: boolean;
    aiPrompt: string;
    previewTab: 'preview' | 'console';
    isAutoPilotOn: boolean;
    isWebSearchEnabled?: boolean;
    previewEnvironment: PreviewEnvironment;
    aiMode: 'quality' | 'fast' | 'game_creator';
    gameCreatorMode?: {
        type: '2d' | '3d' | null;
        styles: string[];
    };
}

export interface SelectedElement {
    selector: string;
    text: string;
}

export interface AttachmentContext {
    type: 'image' | 'text';
    name: string;
    data: string; // base64 for image, content for text
}

export interface ContextMenuItem {
  label?: string;
  action?: () => void;
  type?: 'separator';
}
