export interface HookTemplate {
  id: number;
  template: string;
}

export interface GeneratedHook {
  id: number;
  originalTemplateId: number;
  text: string;
}

export interface FormData {
  niche: string;
  topic: string;
  audience: string; // Added to help context
}