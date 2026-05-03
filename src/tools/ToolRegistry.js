export class ToolRegistry {
  constructor(tools = []) {
    this.tools = new Map();

    for (const tool of tools) {
      this.register(tool);
    }
  }

  register(tool) {
    if (!tool?.name) {
      throw new Error('Tool must have a name');
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool must have an execute function: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  list() {
    return [...this.tools.values()];
  }
}
