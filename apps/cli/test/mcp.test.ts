import { describe, expect, test } from 'bun:test';
import { McpManager, type McpClient } from '@openoffice/core';

function createMockClient(tools: Array<{ name: string; description: string }> = []): McpClient {
  return {
    name: '',
    listTools: async () => tools.map((t) => ({ ...t, inputSchema: {} })),
    listPrompts: async () => [],
    listResources: async () => [],
    readResource: async () => '',
    callTool: async (name: string, args: Record<string, unknown>) => ({
      result: `called ${name}`,
      args,
    }),
    close: async () => {},
  };
}

describe('McpManager', () => {
  test('connects to server', async () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    await manager.connect('test', {
      type: 'local',
      command: ['npx', 'server'],
    });
    expect(manager.status().test?.status).toBe('connected');
  });

  test('lists tools from all connected servers', async () => {
    const manager = new McpManager({
      connect: async () =>
        createMockClient([
          { name: 'send', description: 'Send message' },
          { name: 'read', description: 'Read message' },
        ]),
    });
    await manager.connect('gmail', {
      type: 'local',
      command: ['npx', 'gmail'],
    });
    await manager.connect('slack', {
      type: 'local',
      command: ['npx', 'slack'],
    });

    const tools = await manager.listAllTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => `${t.clientName}_${t.name}`).sort()).toEqual([
      'gmail_read',
      'gmail_send',
      'slack_read',
      'slack_send',
    ]);
  });

  test('generates namespaced tool names', () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    expect(manager.toolName('gmail', 'send_email')).toBe('gmail_send_email');
  });

  test('aggregates prompts across connected clients, client-namespaced', async () => {
    const manager = new McpManager({
      connect: async (config) => {
        if (config.command?.[0] === 'gmail') {
          return {
            ...createMockClient(),
            listPrompts: async () => [{ name: 'draft', description: 'Draft an email' }],
          };
        }
        return {
          ...createMockClient(),
          listPrompts: async () => [{ name: 'summarize' }],
        };
      },
    });
    await manager.connect('gmail', { type: 'local', command: ['gmail'] });
    await manager.connect('slack', { type: 'local', command: ['slack'] });

    const prompts = await manager.listAllPrompts();
    expect(prompts).toEqual([
      { name: 'draft', description: 'Draft an email', clientName: 'gmail' },
      { name: 'summarize', clientName: 'slack' },
    ]);
  });

  test('a failing client is dropped with error status while others aggregate', async () => {
    const manager = new McpManager({
      connect: async (config) => {
        if (config.command?.[0] === 'broken') {
          return {
            ...createMockClient(),
            listTools: async () => {
              throw new Error('list failed');
            },
          };
        }
        return createMockClient([{ name: 'ok', description: '' }]);
      },
    });
    await manager.connect('broken', { type: 'local', command: ['broken'] });
    await manager.connect('good', { type: 'local', command: ['good'] });

    const tools = await manager.listAllTools();
    expect(tools.map((t) => t.name)).toEqual(['ok']);
    expect(manager.status().broken?.status).toBe('error');
    expect(manager.status().broken?.error).toBe('list failed');
    expect(manager.status().good?.status).toBe('connected');
  });

  test('calls tool on correct client', async () => {
    let calledClient = '';
    let calledTool = '';
    const manager = new McpManager({
      connect: async () =>
        ({
          name: '',
          listTools: async () => [],
          listPrompts: async () => [],
          listResources: async () => [],
          readResource: async () => '',
          callTool: async (name: string) => {
            calledClient = 'gmail';
            calledTool = name;
            return { sent: true };
          },
          close: async () => {},
        }) as McpClient,
    });
    await manager.connect('gmail', { type: 'local', command: [] });

    const result = await manager.callTool('gmail', 'send', {
      to: 'test@test.com',
    });
    expect(result.success).toBe(true);
    expect(calledClient).toBe('gmail');
    expect(calledTool).toBe('send');
  });

  test('returns error for unknown client', async () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    const result = await manager.callTool('nonexistent', 'tool', {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('MCP_NOT_CONNECTED');
  });

  test('disconnects all clients but keeps declarations', async () => {
    let closed = false;
    const manager = new McpManager({
      connect: async () =>
        ({
          name: '',
          listTools: async () => [],
          listPrompts: async () => [],
          listResources: async () => [],
          readResource: async () => '',
          callTool: async () => ({}),
          close: async () => {
            closed = true;
          },
        }) as McpClient,
    });
    await manager.connect('test', { type: 'local', command: [] });
    await manager.disconnectAll();
    expect(closed).toBe(true);
    expect(manager.status().test?.status).toBe('disconnected');
  });

  test('a server with enabled:false boots as disabled', async () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    manager.declare('off', {
      type: 'local',
      command: ['npx', 'x'],
      enabled: false,
    });
    expect(manager.status().off).toEqual({ status: 'disabled' });
  });

  test('disable disconnects and flips intent', async () => {
    let closed = false;
    const manager = new McpManager({
      connect: async () =>
        ({
          name: '',
          listTools: async () => [],
          listPrompts: async () => [],
          listResources: async () => [],
          readResource: async () => '',
          callTool: async () => ({}),
          close: async () => {
            closed = true;
          },
        }) as McpClient,
    });
    await manager.connect('test', { type: 'local', command: [] });
    const info = await manager.disable('test');
    expect(closed).toBe(true);
    expect(info.status).toBe('disabled');
    expect(manager.status().test?.status).toBe('disabled');
  });

  test('enable reconnects a disabled server', async () => {
    let connects = 0;
    const manager = new McpManager({
      connect: async () => {
        connects++;
        return createMockClient();
      },
    });
    manager.declare('test', { type: 'local', command: ['npx', 'x'] });
    await manager.disable('test');
    expect(manager.status().test?.status).toBe('disabled');
    const info = await manager.enable('test');
    expect(connects).toBe(1);
    expect(info.status).toBe('connected');
  });

  test('enable on an already-connected server is a no-op', async () => {
    let connects = 0;
    const manager = new McpManager({
      connect: async () => {
        connects++;
        return createMockClient();
      },
    });
    await manager.connect('test', { type: 'local', command: [] });
    const info = await manager.enable('test');
    expect(connects).toBe(1);
    expect(info.status).toBe('connected');
  });

  test('connect failure records error status and rethrows', async () => {
    const manager = new McpManager({
      connect: async () => {
        throw new Error('server is down');
      },
    });
    await expect(manager.connect('test', { type: 'local', command: [] })).rejects.toThrow(
      'server is down',
    );
    expect(manager.status().test).toEqual({
      status: 'error',
      error: 'server is down',
    });
  });

  test('enable on a failing server returns error status without throwing', async () => {
    const manager = new McpManager({
      connect: async () => {
        throw new Error('server is down');
      },
    });
    manager.declare('test', { type: 'local', command: [] });
    const info = await manager.enable('test');
    expect(info.status).toBe('error');
    expect(info.error).toBe('server is down');
    expect(manager.status().test?.status).toBe('error');
  });

  test('disconnect keeps the declaration as disconnected', async () => {
    let closed = false;
    const manager = new McpManager({
      connect: async () =>
        ({
          name: '',
          listTools: async () => [],
          listPrompts: async () => [],
          listResources: async () => [],
          readResource: async () => '',
          callTool: async () => ({}),
          close: async () => {
            closed = true;
          },
        }) as McpClient,
    });
    await manager.connect('test', { type: 'local', command: [] });
    await manager.disconnect('test');
    expect(closed).toBe(true);
    expect(manager.status().test?.status).toBe('disconnected');
  });

  test('status lists dogfood-declared servers with a note', () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    manager.declare('officecli', { type: 'local', command: [] }, 'provided natively');
    expect(manager.status().officecli?.status).toBe('disconnected');
    expect(manager.status().officecli?.note).toBe('provided natively');
  });
});
