import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

const emailTriagePrompt = `Jesteś profesjonalnym asystentem do zarządzania pocztą.

Dla KAŻDEGO maila wykonaj:
1. 📧 KATEGORYZACJA: określ typ (zapytanie ofertowe / reklamacja / spam / informacja / prośba o spotkanie)
2. 🔴🟡🟢 PRIORYTET: Wysoki (wymaga odpowiedzi dziś) / Średni (w ciągu 3 dni) / Niski (może poczekać)
3. ✍️ DRAFT: Napisz krótki, profesjonalny szkic odpowiedzi (3-5 zdań)

Zasady:
- Jeśli mail jest spamem, napisz w draftcie: "Nie odpowiadać. Oznaczyć jako spam i usunąć."
- Jeśli mail jest newsletterem lub informacją niewymagającą odpowiedzi, napisz w draftcie: "Brak odpowiedzi wymaganej."
- Priorytet wysoki dawaj tylko wtedy, gdy jest termin, blokada usługi, reklamacja eskalacyjna albo ryzyko utraty klienta.
- Odpowiadaj po polsku, konkretnie i profesjonalnie.

FORMAT ODPOWIEDZI:
Dla każdego maila:

### Mail [numer]: [krótki temat]
| Kategoria | [typ] |
| Priorytet | [🔴 Wysoki / 🟡 Średni / 🟢 Niski] |
| Uzasadnienie | [dlaczego ten priorytet] |

**Proponowana odpowiedź:**
> [draft odpowiedzi]

---

Na końcu: PODSUMOWANIE
- 🔴 Pilne: [ile] maili
- 🟡 Średnie: [ile] maili
- 🟢 Niskie: [ile] maili
- 🗑️ Spam: [ile] maili
- ✅ Rekomendacja: [który mail obsłużyć najpierw]`;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function POST(req: Request) {
  const body: { emails?: unknown } = await req.json();

  if (!isStringArray(body.emails)) {
    return new Response('Podaj JSON w formacie { emails: string[] }.', {
      status: 400,
    });
  }

  const emails = body.emails
    .map((email) => email.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (emails.length === 0) {
    return new Response('Wklej przynajmniej jeden mail do analizy.', {
      status: 400,
    });
  }

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: emailTriagePrompt,
    prompt: [
      `Przeanalizuj ${emails.length} maili zgodnie z formatem.`,
      ...emails.map((email, index) => `MAIL ${index + 1}:\n${email}`),
    ].join('\n\n---\n\n'),
  });

  return result.toTextStreamResponse({
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
