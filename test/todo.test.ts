import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { createTodoTool } from '../src/tools/todo/todoTool.js';

describe('TodoWrite Tool', () => {
  const testRoot = join(process.cwd(), '.test-workspace-todo');
  let tool: ReturnType<typeof createTodoTool>;

  beforeEach(async () => {
    await mkdir(testRoot, { recursive: true });
    tool = createTodoTool({ workspaceRoot: testRoot });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('should add a new todo item', async () => {
    const result = await tool.execute({ action: 'add', description: 'Implement feature X' });
    assert.match(result, /Added todo: \[todo-\d+-\w+\] Implement feature X/);
  });

  it('should list empty todos', async () => {
    const result = await tool.execute({ action: 'list' });
    assert.strictEqual(result, 'No todos yet.');
  });

  it('should list todos with status icons', async () => {
    await tool.execute({ action: 'add', description: 'Task 1' });
    await tool.execute({ action: 'add', description: 'Task 2' });

    const result = await tool.execute({ action: 'list' });
    assert.match(result, /○ \[todo-\d+-\w+\] Task 1/);
    assert.match(result, /○ \[todo-\d+-\w+\] Task 2/);
    assert.match(result, /Summary: 2 pending, 0 in progress, 0 completed/);
  });

  it('should update todo status to in_progress', async () => {
    const addResult = await tool.execute({ action: 'add', description: 'Task 1' });
    const idMatch = addResult.match(/\[([^\]]+)\]/);
    assert.ok(idMatch, 'Should extract todo ID');
    const id = idMatch[1];

    const updateResult = await tool.execute({ action: 'update', id, status: 'in_progress' });
    assert.match(updateResult, /Updated todo: \[.+\] Task 1 \(in_progress\)/);

    const listResult = await tool.execute({ action: 'list' });
    assert.match(listResult, /→ \[.+\] Task 1 \[FOCUS\]/);
    assert.match(listResult, /Summary: 0 pending, 1 in progress, 0 completed/);
  });

  it('should enforce single in_progress constraint', async () => {
    const result1 = await tool.execute({ action: 'add', description: 'Task 1' });
    const id1 = result1.match(/\[([^\]]+)\]/)![1];

    const result2 = await tool.execute({ action: 'add', description: 'Task 2' });
    const id2 = result2.match(/\[([^\]]+)\]/)![1];

    await tool.execute({ action: 'update', id: id1, status: 'in_progress' });

    const updateResult = await tool.execute({ action: 'update', id: id2, status: 'in_progress' });
    assert.match(updateResult, /Error: Cannot set .+ to in_progress: .+ is already in progress/);
  });

  it('should complete a todo item', async () => {
    const addResult = await tool.execute({ action: 'add', description: 'Task 1' });
    const id = addResult.match(/\[([^\]]+)\]/)![1];

    const completeResult = await tool.execute({ action: 'complete', id });
    assert.match(completeResult, /Completed todo: \[.+\] Task 1/);

    const listResult = await tool.execute({ action: 'list' });
    assert.match(listResult, /✓ \[.+\] Task 1/);
    assert.match(listResult, /Summary: 0 pending, 0 in progress, 1 completed/);
  });

  it('should update todo description', async () => {
    const addResult = await tool.execute({ action: 'add', description: 'Old description' });
    const id = addResult.match(/\[([^\]]+)\]/)![1];

    const updateResult = await tool.execute({
      action: 'update',
      id,
      description: 'New description'
    });
    assert.match(updateResult, /Updated todo: \[.+\] New description/);
  });

  it('should persist todos across tool instances', async () => {
    const addResult = await tool.execute({ action: 'add', description: 'Persistent task' });
    const id = addResult.match(/\[([^\]]+)\]/)![1];

    // Create new tool instance
    const newTool = createTodoTool({ workspaceRoot: testRoot });
    const listResult = await newTool.execute({ action: 'list' });

    assert.match(listResult, /○ \[.+\] Persistent task/);
  });

  it('should return error for missing required fields', async () => {
    const result1 = await tool.execute({ action: 'add' } as any);
    assert.match(result1, /Error: description is required for add action/);

    const result2 = await tool.execute({ action: 'update' } as any);
    assert.match(result2, /Error: id is required for update action/);

    const result3 = await tool.execute({ action: 'complete' } as any);
    assert.match(result3, /Error: id is required for complete action/);
  });

  it('should return error for non-existent todo', async () => {
    const result = await tool.execute({ action: 'update', id: 'non-existent', status: 'completed' });
    assert.match(result, /Error: Todo item not found: non-existent/);
  });
});
