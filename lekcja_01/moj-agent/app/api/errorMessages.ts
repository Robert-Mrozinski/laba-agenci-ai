export function formatAiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('spending cap') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('resource_exhausted')
  ) {
    return [
      'Limit Google Gemini dla tego projektu zostal wyczerpany.',
      'Wejdz do Google AI Studio, zwieksz miesieczny limit wydatkow albo podmien klucz API na projekt z aktywnym limitem.',
      'Po zmianie klucza uruchom aplikacje ponownie.',
    ].join(' ');
  }

  return error instanceof Error ? error.message : fallback;
}
