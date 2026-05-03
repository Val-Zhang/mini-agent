export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolExecutionEvent {
  kind: string;
  payload: unknown;
}

export interface ToolExecutionContext {
  emit(event: ToolExecutionEvent): void;
}

export interface ToolDefinition<TInput extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  schema?: ToolSchema;
  execute(input: TInput, context?: ToolExecutionContext): Promise<string> | string;
}
