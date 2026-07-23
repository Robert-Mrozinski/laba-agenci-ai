'use client';

type ToolPart = {
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  toolCallId?: string;
  type: string;
};

type Message = {
  id: string;
  parts: unknown[];
  role: string;
};

function getToolName(type: string) {
  return type.replace(/^tool-/, '');
}

function formatValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }

  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 120)}...` : json;
}

function isErrorOutput(part: ToolPart) {
  if (part.state === 'output-error' || part.errorText) {
    return true;
  }

  if (typeof part.output === 'string') {
    return /\bbłąd\b|\berror\b|timeout|nie udało/i.test(part.output);
  }

  if (typeof part.output === 'object' && part.output !== null) {
    return 'error' in part.output;
  }

  return false;
}

function toolParts(message?: Message) {
  return ((message?.parts ?? []) as ToolPart[]).filter((part) =>
    part.type?.startsWith('tool-'),
  );
}

export function DiagnosticsPanel({
  durations,
  isLoading,
  maxSteps,
  messages,
}: {
  durations?: Record<string, number>;
  isLoading: boolean;
  maxSteps: number;
  messages: Message[];
}) {
  const lastAssistant = messages.findLast((message) => message.role === 'assistant');
  const parts = toolParts(lastAssistant);
  const toolCallCount = new Set(
    parts.map((part, index) => part.toolCallId ?? `${part.type}-${index}`),
  ).size;
  const stepCount = Math.min(maxSteps, Math.max(toolCallCount, isLoading ? 1 : 0));
  const progress = maxSteps > 0 ? (stepCount / maxSteps) * 100 : 0;
  const tone =
    stepCount >= maxSteps ? 'danger' : stepCount >= maxSteps - 1 ? 'warning' : 'ok';
  const counts = parts.reduce<Record<string, Set<string>>>((currentCounts, part, index) => {
    const name = getToolName(part.type);
    currentCounts[name] ??= new Set<string>();
    currentCounts[name].add(part.toolCallId ?? `${part.type}-${index}`);
    return currentCounts;
  }, {});
  const errors = parts.filter(isErrorOutput);
  const duration =
    lastAssistant && durations?.[lastAssistant.id]
      ? durations[lastAssistant.id]
      : undefined;
  const status = isLoading
    ? 'W trakcie...'
    : stepCount >= maxSteps
      ? '⚠️ Limit kroków'
      : lastAssistant
        ? '✅ Zadanie ukończone'
        : 'Gotowy';

  return (
    <section className="diagnostics-panel" aria-label="Diagnostyka">
      <h2>🛡️ Diagnostyka</h2>
      <div className="diagnostics-row">
        <span>Kroki</span>
        <div className={`diagnostics-progress ${tone}`}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <strong>
          {stepCount}/{maxSteps}
        </strong>
      </div>
      <p>
        <strong>Narzędzia:</strong>{' '}
        {Object.keys(counts).length > 0
          ? Object.entries(counts)
              .map(([name, calls]) => `${name}(${calls.size})`)
              .join(', ')
          : 'brak'}
      </p>
      <p>
        <strong>Błędy:</strong> {errors.length}
      </p>
      <p>
        <strong>Czas:</strong>{' '}
        {duration != null ? `${duration.toFixed(1)}s` : isLoading ? 'mierzę...' : '0.0s'}
      </p>
      <p>
        <strong>Status:</strong> {status}
      </p>
      {errors.length > 0 ? (
        <div className="diagnostics-alerts">
          {errors.map((part, index) => (
            <div className="diagnostics-alert" key={part.toolCallId ?? index}>
              🔴 {getToolName(part.type)}({formatValue(part.input)}) —{' '}
              {part.errorText || formatValue(part.output)}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
