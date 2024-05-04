export interface TextItem {
  languageId: string;
  text: string;
  type: string;
  textLength: number;
  previewText: string;
  timestamp: string;
  fileName: string;
}

interface FileTree {
  folder: string;
  files: {
    value: string;
    text: string;
    status: boolean;
    id: number;
    nodes: any[];
  }[];
}

export type FileTrees = FileTree[];
