/**
 * Choose which model an existing book/chat session should call.
 *
 * Studio's selected default (inkos.json llm.defaultModel + llm.service) is the
 * source of truth for the next turn. Sessions must not stay pinned to the
 * model they were created with just because a stale client still sends it.
 * An explicit per-session override is the only pin.
 */

export type AgentModelBindingSource = "session-override" | "studio-default" | "request";

export interface AgentModelBindingInput {
  readonly sessionModelOverride?: string | null;
  readonly sessionServiceOverride?: string | null;
  readonly requestModel?: string | null;
  readonly requestService?: string | null;
  readonly defaultModel?: string | null;
  readonly defaultService?: string | null;
}

export interface AgentModelBinding {
  readonly model?: string;
  readonly service?: string;
  readonly source: AgentModelBindingSource;
  readonly reboundFromRequest: boolean;
}

function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requestDiffers(
  requestModel: string | undefined,
  nextModel: string | undefined,
  requestService: string | undefined,
  nextService: string | undefined,
): boolean {
  return Boolean(
    (requestModel && nextModel && requestModel !== nextModel)
    || (requestService && nextService && requestService !== nextService),
  );
}

export function resolveAgentModelBinding(input: AgentModelBindingInput): AgentModelBinding {
  const sessionModel = trimToUndefined(input.sessionModelOverride);
  const sessionService = trimToUndefined(input.sessionServiceOverride);
  const requestModel = trimToUndefined(input.requestModel);
  const requestService = trimToUndefined(input.requestService);
  const defaultModel = trimToUndefined(input.defaultModel);
  const defaultService = trimToUndefined(input.defaultService);

  if (sessionModel) {
    return {
      model: sessionModel,
      service: sessionService ?? requestService ?? defaultService,
      source: "session-override",
      reboundFromRequest: requestDiffers(requestModel, sessionModel, requestService, sessionService),
    };
  }

  if (defaultModel && defaultService) {
    return {
      model: defaultModel,
      service: defaultService,
      source: "studio-default",
      reboundFromRequest: requestDiffers(requestModel, defaultModel, requestService, defaultService),
    };
  }

  if (defaultModel) {
    return {
      model: defaultModel,
      service: defaultService ?? requestService,
      source: "studio-default",
      reboundFromRequest: requestDiffers(requestModel, defaultModel, requestService, defaultService),
    };
  }

  return {
    model: requestModel,
    service: requestService ?? defaultService,
    source: "request",
    reboundFromRequest: false,
  };
}

export function formatAgentModelReboundNotice(
  binding: AgentModelBinding,
  language: "zh" | "en" = "zh",
): string | undefined {
  if (!binding.reboundFromRequest || !binding.model) return undefined;
  return language === "en"
    ? `This session now uses ${binding.model}${binding.service ? ` (${binding.service})` : ""}. The previous picker value was not pinned.`
    : `本会话已改用 ${binding.model}${binding.service ? `（${binding.service}）` : ""}。未锁定旧模型。`;
}
