import { google } from '@ai-sdk/google';
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type UIMessage,
} from 'ai';
import { formatAiError } from '../errorMessages';

type AiModel = 'flash' | 'pro';

const models: Record<AiModel, string> = {
  flash: 'gemini-3.1-flash-lite',
  pro: 'gemini-3.1-flash-lite',
};

const thinkingPrompt = `Jesteś analitykiem. Twoim zadaniem jest MYŚLEĆ NA GŁOS.

Gdy dostajesz pytanie, MUSISZ przejść przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 — Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 — Fakty:**
Co wiem na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 — Analiza:**
Jakie są 2-3 możliwe podejścia/odpowiedzi?

**Krok 4 — Ocena:**
Które podejście jest najlepsze? DLACZEGO?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- ZAWSZE pokaż CAŁY proces myślenia — użytkownik widzi jak pracujesz
- Używaj nagłówków markdown do oddzielenia kroków
- Krok "Myślę" powinien być DŁUŻSZY niż finalna odpowiedź`;

export async function POST(req: Request) {
  const {
    messages,
    model = 'flash',
  }: { messages: UIMessage[]; model?: AiModel } = await req.json();
  const selectedModel: AiModel = model in models ? model : 'flash';

  const result = streamText({
    model: google(models[selectedModel]),
    system: thinkingPrompt,
    messages: await convertToModelMessages(messages),
    // maxSteps: 3 (AI SDK v7 equivalent)
    stopWhen: isStepCount(3),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      formatAiError(error, 'Nieznany błąd podczas myślenia.'),
  });
}
