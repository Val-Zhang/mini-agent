import type { AgentRunEvent } from '../../../types.js';
import type { SubagentTraceMode } from '../types.js';

const SUBAGENT_HEARTBEAT_RENDER_INTERVAL_MS = 15_000;
const SUBAGENT_MODEL_TURN_RENDER_INTERVAL = 3;

type SubagentProgressEvent = Extract<AgentRunEvent, { type: 'subagent_progress' }>;

export class CompactSubagentTracePolicy {
  private readonly lastSubagentHeartbeatMs = new Map<string, number>();

  shouldRender(event: SubagentProgressEvent, mode: SubagentTraceMode): boolean {
    if (mode === 'verbose') {
      return true;
    }

    if (event.phase === 'heartbeat') {
      return this.shouldRenderHeartbeat(event);
    }

    if (event.phase === 'model_turn_started') {
      return this.shouldRenderModelTurn(event);
    }

    return true;
  }

  private shouldRenderHeartbeat(event: SubagentProgressEvent): boolean {
    const elapsedMs = event.elapsedMs ?? 0;
    const lastElapsedMs = this.lastSubagentHeartbeatMs.get(event.subagent);
    if (lastElapsedMs === undefined || elapsedMs - lastElapsedMs >= SUBAGENT_HEARTBEAT_RENDER_INTERVAL_MS) {
      this.lastSubagentHeartbeatMs.set(event.subagent, elapsedMs);
      return true;
    }

    return false;
  }

  private shouldRenderModelTurn(event: SubagentProgressEvent): boolean {
    const turnCount = event.turnCount ?? 0;
    if (turnCount <= 1) {
      return true;
    }

    return turnCount % SUBAGENT_MODEL_TURN_RENDER_INTERVAL === 0;
  }
}
