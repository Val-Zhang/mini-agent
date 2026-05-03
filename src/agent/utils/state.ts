import type { ChatMessage } from '../../types.js';

export interface LoopState {
  messages: ChatMessage[];
  turnCount: number;
  transitionReason: 'user_message' | 'tool_result' | null;
}

export interface LoopStateSnapshot {
  turnCount: number;
  transitionReason: LoopState['transitionReason'];
  messageCount: number;
}

export function snapshotState(state: LoopState): LoopStateSnapshot {
  return {
    turnCount: state.turnCount,
    transitionReason: state.transitionReason,
    messageCount: state.messages.length
  };
}
