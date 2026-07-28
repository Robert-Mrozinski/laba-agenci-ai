import { google } from '@ai-sdk/google';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { supabase } from '../../../lib/supabase';
import { formatAiError } from '../errorMessages';

type WebhookType = 'alert' | 'feedback' | 'order';

type WebhookBody = {
  data?: unknown;
  type?: string;
};

const supportedTypes: WebhookType[] = ['feedback', 'alert', 'order'];

function createSupabaseForWebhook() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey);
  }

  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWebhookType(type?: string): WebhookType | null {
  const normalized = type?.trim().toLowerCase();

  return supportedTypes.includes(normalized as WebhookType)
    ? (normalized as WebhookType)
    : null;
}

function validateWebhookData(type: WebhookType, data: unknown) {
  if (!isRecord(data)) {
    return 'Pole data musi być obiektem JSON.';
  }

  if (type === 'feedback') {
    const rating = data.rating;

    if (typeof data.customer !== 'string' || !data.customer.trim()) {
      return 'Feedback wymaga data.customer jako tekstu.';
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return 'Feedback wymaga data.rating jako liczby od 1 do 5.';
    }

    if (typeof data.comment !== 'string' || !data.comment.trim()) {
      return 'Feedback wymaga data.comment jako tekstu.';
    }
  }

  if (type === 'alert') {
    if (typeof data.service !== 'string' || !data.service.trim()) {
      return 'Alert wymaga data.service jako tekstu.';
    }

    if (typeof data.status !== 'string' || !data.status.trim()) {
      return 'Alert wymaga data.status jako tekstu.';
    }
  }

  if (type === 'order') {
    if (typeof data.product !== 'string' || !data.product.trim()) {
      return 'Order wymaga data.product jako tekstu.';
    }

    if (typeof data.customer !== 'string' || !data.customer.trim()) {
      return 'Order wymaga data.customer jako tekstu.';
    }

    if (typeof data.amount !== 'number' || data.amount <= 0) {
      return 'Order wymaga data.amount jako dodatniej liczby.';
    }
  }

  return null;
}

function systemPromptForType(type: WebhookType) {
  if (type === 'feedback') {
    return [
      'Jesteś agentem obsługi klienta.',
      'Przeanalizuj feedback klienta po polsku.',
      'Zwróć krótko: sentiment, priorytet, ryzyko, sugerowaną odpowiedź dla klienta i następny krok dla zespołu.',
      'Nie wymyślaj danych, których nie ma w JSON.',
    ].join(' ');
  }

  if (type === 'alert') {
    return [
      'Jesteś agentem DevOps.',
      'Przeanalizuj alert po polsku.',
      'Zwróć krótko: severity, możliwy wpływ, zalecane działania natychmiastowe i komunikat statusowy dla zespołu.',
      'Nie wymyślaj danych, których nie ma w JSON.',
    ].join(' ');
  }

  return [
    'Jesteś agentem operacyjnym e-commerce.',
    'Przeanalizuj zamówienie po polsku.',
    'Zwróć krótko: potwierdzenie, podsumowanie zamówienia, ryzyko lub brakujące dane i następny krok.',
    'Nie wymyślaj danych, których nie ma w JSON.',
  ].join(' ');
}

function fallbackAnalysis(type: WebhookType, data: unknown) {
  const payload = JSON.stringify(data, null, 2);

  if (type === 'feedback') {
    return `Analiza feedbacku wymaga ponownego przetworzenia przez AI. Dane wejściowe:\n${payload}`;
  }

  if (type === 'alert') {
    return `Analiza alertu wymaga ponownego przetworzenia przez AI. Dane wejściowe:\n${payload}`;
  }

  return `Analiza zamówienia wymaga ponownego przetworzenia przez AI. Dane wejściowe:\n${payload}`;
}

export async function POST(request: Request) {
  let body: WebhookBody;

  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return Response.json({ error: 'Nieprawidłowy JSON.' }, { status: 400 });
  }

  const type = normalizeWebhookType(body.type);

  if (!type) {
    return Response.json(
      {
        error:
          'Nieobsługiwany typ webhooka. Dostępne typy: feedback, alert, order.',
      },
      { status: 400 },
    );
  }

  const validationError = validateWebhookData(type, body.data);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const db = createSupabaseForWebhook();

  if (!db) {
    return Response.json(
      {
        error:
          'Brakuje konfiguracji Supabase. Ustaw NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY albo NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
      { status: 500 },
    );
  }

  let analysis: string;

  try {
    const result = await generateText({
      model: google('gemini-3.1-flash-lite'),
      system: systemPromptForType(type),
      prompt: JSON.stringify(
        {
          received_at: new Date().toISOString(),
          type,
          data: body.data,
        },
        null,
        2,
      ),
    });

    analysis = result.text.trim();
  } catch (error) {
    analysis = [
      fallbackAnalysis(type, body.data),
      '',
      `Błąd AI: ${formatAiError(error, 'Nie udało się przeanalizować webhooka.')}`,
    ].join('\n');
  }

  const { data: inserted, error } = await db
    .from('webhook_events')
    .insert({
      analysis,
      data: body.data,
      type,
    })
    .select('id')
    .single();

  if (error) {
    return Response.json(
      {
        error:
          `${error.message} Uruchom supabase-webhook-events-migration.sql i upewnij się, że tabela pozwala na insert.`,
      },
      { status: 500 },
    );
  }

  return Response.json({
    success: true,
    analysis,
    event_id: inserted.id,
  });
}
