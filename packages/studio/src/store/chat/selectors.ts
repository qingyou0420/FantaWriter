import type { ChatState } from "./types";

const EMPTY_MESSAGES: readonly [] = [];

export const chatSelectors = {
  activeSession: (s: ChatState) => (s.activeSessionId ? s.sessions[s.activeSessionId] ?? null : null),
  activeMessages: (s: ChatState) =>
    (s.activeSessionId ? s.sessions[s.activeSessionId]?.messages : undefined) ?? EMPTY_MESSAGES,
  isActiveSessionStreaming: (s: ChatState) => Boolean(s.activeSessionId && s.sessions[s.activeSessionId]?.isStreaming),
  // 聊天轮本身是否在流式中；后台任务运行期间为 false（此时仍可继续发消息）。
  isActiveSessionChatStreaming: (s: ChatState) =>
    Boolean(s.activeSessionId && s.sessions[s.activeSessionId]?.isChatStreaming),
  // 上一条失败的聊天轮发送记录；存在且非聊天流式中时 UI 显示"重试"按钮。
  activeSessionLastFailedSend: (s: ChatState) =>
    (s.activeSessionId ? s.sessions[s.activeSessionId]?.lastFailedSend : undefined) ?? null,
  isEmpty: (s: ChatState) =>
    ((s.activeSessionId ? s.sessions[s.activeSessionId]?.messages.length : 0) ?? 0) === 0
    && !Boolean(s.activeSessionId && s.sessions[s.activeSessionId]?.isStreaming),
};
