/**
 * Moonshot / Kimi sampling constraints.
 *
 * Official K3 / K2.5 / K2.6 / K2.7-code cards lock temperature (and, for K3,
 * top_p / n / penalties). Sending any other temperature returns HTTP 400:
 * `invalid temperature: only 1 is allowed for this model`.
 *
 * Users often add Moonshot as a custom OpenAI-compatible service (empty
 * models[]), so bank lookup can miss the card. Match by model id and/or
 * api.moonshot.cn / api.moonshot.ai host.
 */

const MOONSHOT_LOCKED_TEMPERATURE = 1;

const FIXED_TEMP_LEAF =
  /^(kimi-k3(?:[-_.].*)?|kimi-k2\.5(?:[-_.].*)?|kimi-k2\.6(?:[-_.].*)?|kimi-k2\.7.*)$/i;

const K3_LEAF = /^kimi-k3(?:[-_.].*)?$/i;

const MOONSHOT_HOSTS = new Set(["api.moonshot.cn", "api.moonshot.ai"]);

export function moonshotModelLeafId(model: string): string {
  const trimmed = model.trim().toLowerCase();
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export function isMoonshotApiHost(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return MOONSHOT_HOSTS.has(host) || host.endsWith(".moonshot.cn") || host.endsWith(".moonshot.ai");
  } catch {
    return /(?:^|[/.])api\.moonshot\.(?:cn|ai)(?:[:/?]|$)/i.test(baseUrl);
  }
}

export function isMoonshotFixedTemperatureModel(model: string): boolean {
  return FIXED_TEMP_LEAF.test(moonshotModelLeafId(model));
}

export function isKimiK3Model(model: string): boolean {
  return K3_LEAF.test(moonshotModelLeafId(model));
}

/**
 * Server-enforced temperature for current Moonshot Kimi cards.
 * Independent of service id so `custom` + `kimi-k3` still locks to 1.
 */
export function resolveMoonshotLockedTemperature(
  model: string,
  baseUrl?: string,
): number | undefined {
  if (isMoonshotFixedTemperatureModel(model)) return MOONSHOT_LOCKED_TEMPERATURE;
  if (isMoonshotApiHost(baseUrl) && /^kimi-k(?:3|2\.[567])\b/i.test(moonshotModelLeafId(model))) {
    return MOONSHOT_LOCKED_TEMPERATURE;
  }
  return undefined;
}

const OMITTED_K3_SAMPLING_KEYS = [
  "temperature",
  "top_p",
  "n",
  "presence_penalty",
  "frequency_penalty",
  "thinking",
] as const;

/**
 * K3 docs recommend omitting fixed sampling fields rather than sending
 * wrong values. K2.x `thinking` is also rejected — K3 uses top-level
 * `reasoning_effort` instead.
 */
export function applyKimiK3RequestConstraints(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  if (!isKimiK3Model(model)) return body;
  for (const key of OMITTED_K3_SAMPLING_KEYS) {
    delete body[key];
  }
  return body;
}
