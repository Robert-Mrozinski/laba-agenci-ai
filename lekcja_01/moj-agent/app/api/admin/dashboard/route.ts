import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputTokenPricePerMillion = Number(
  process.env.INPUT_TOKEN_PRICE_PER_MILLION ?? 0.15,
);
const outputTokenPricePerMillion = Number(
  process.env.OUTPUT_TOKEN_PRICE_PER_MILLION ?? 0.6,
);

type ApiUsageRow = {
  created_at: string;
  endpoint: string;
  tokens_input: number;
  tokens_output: number;
  user_id: string;
};

type ConversationRow = {
  created_at: string;
  id: string;
  title: string | null;
  updated_at: string;
  user_id: string;
};

type MessageRow = {
  conversation_id: string;
};

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastSevenDays() {
  const today = startOfUtcDay();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (6 - index));
    return dayKey(date);
  });
}

function tokenTotal(row: ApiUsageRow) {
  return (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
}

function costUsd(rows: ApiUsageRow[]) {
  const inputTokens = rows.reduce((sum, row) => sum + (row.tokens_input ?? 0), 0);
  const outputTokens = rows.reduce((sum, row) => sum + (row.tokens_output ?? 0), 0);

  return (
    (inputTokens / 1_000_000) * inputTokenPricePerMillion +
    (outputTokens / 1_000_000) * outputTokenPricePerMillion
  );
}

async function authorizeAdmin(req: Request) {
  const authorization = req.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!supabase || !token) {
    return { error: 'Musisz się zalogować.', user: null };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Sesja wygasła. Zaloguj się ponownie.', user: null };
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    adminEmails.length > 0 &&
    !adminEmails.includes((user.email ?? '').toLowerCase())
  ) {
    return { error: 'Brak dostępu do dashboardu użycia.', user: null };
  }

  return { error: null, user };
}

async function userEmailMap(
  adminClient: ReturnType<typeof createClient<any>>,
  userIds: string[],
) {
  const entries = await Promise.all(
    [...new Set(userIds)].filter(Boolean).map(async (userId) => {
      const { data, error } = await adminClient.auth.admin.getUserById(userId);
      return [userId, error ? userId : data.user?.email ?? userId] as const;
    }),
  );

  return new Map(entries);
}

export async function GET(req: Request) {
  const authorization = await authorizeAdmin(req);

  if (authorization.error) {
    return Response.json({ error: authorization.error }, { status: 401 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: 'Brakuje SUPABASE_SERVICE_ROLE_KEY w zmiennych środowiskowych.' },
      { status: 500 },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const todayStart = startOfUtcDay();
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const days = lastSevenDays();

  const [
    conversationCountResult,
    conversationUsersResult,
    weekConversationsResult,
    recentConversationsResult,
    weekUsageResult,
    todayUsageResult,
  ] = await Promise.all([
    adminClient
      .from('conversations')
      .select('id', { count: 'exact', head: true }),
    adminClient.from('conversations').select('user_id').limit(10000),
    adminClient
      .from('conversations')
      .select('id, created_at')
      .gte('created_at', weekStart.toISOString()),
    adminClient
      .from('conversations')
      .select('id, title, user_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10),
    adminClient
      .from('api_usage')
      .select('user_id, created_at, tokens_input, tokens_output, endpoint')
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: true }),
    adminClient
      .from('api_usage')
      .select('user_id, created_at, tokens_input, tokens_output, endpoint')
      .gte('created_at', todayStart.toISOString()),
  ]);

  const results = [
    conversationCountResult,
    conversationUsersResult,
    weekConversationsResult,
    recentConversationsResult,
    weekUsageResult,
    todayUsageResult,
  ];
  const firstError = results.find((result) => result.error)?.error;

  if (firstError) {
    return Response.json({ error: firstError.message }, { status: 500 });
  }

  const recentConversations =
    (recentConversationsResult.data ?? []) as ConversationRow[];
  const recentConversationIds = recentConversations.map((row) => row.id);
  const { data: recentMessages, error: messagesError } =
    recentConversationIds.length > 0
      ? await adminClient
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', recentConversationIds)
      : { data: [], error: null };

  if (messagesError) {
    return Response.json({ error: messagesError.message }, { status: 500 });
  }

  const weekUsageRows = (weekUsageResult.data ?? []) as ApiUsageRow[];
  const todayUsageRows = (todayUsageResult.data ?? []) as ApiUsageRow[];
  const weekConversationRows =
    (weekConversationsResult.data ?? []) as Pick<ConversationRow, 'created_at' | 'id'>[];
  const conversationUserRows =
    (conversationUsersResult.data ?? []) as Pick<ConversationRow, 'user_id'>[];
  const messageRows = (recentMessages ?? []) as MessageRow[];
  const messageCounts = new Map<string, number>();

  for (const message of messageRows) {
    messageCounts.set(
      message.conversation_id,
      (messageCounts.get(message.conversation_id) ?? 0) + 1,
    );
  }

  const emails = await userEmailMap(
    adminClient,
    recentConversations.map((row) => row.user_id),
  );
  const users = new Set(conversationUserRows.map((row) => row.user_id).filter(Boolean));
  const todayTokens = todayUsageRows.reduce((sum, row) => sum + tokenTotal(row), 0);
  const tokensByDay = new Map(days.map((day) => [day, 0]));
  const conversationsByDay = new Map(days.map((day) => [day, 0]));
  const tokensByEndpoint = new Map<string, number>();

  for (const row of weekUsageRows) {
    const key = dayKey(new Date(row.created_at));
    tokensByDay.set(key, (tokensByDay.get(key) ?? 0) + tokenTotal(row));
    tokensByEndpoint.set(
      row.endpoint,
      (tokensByEndpoint.get(row.endpoint) ?? 0) + tokenTotal(row),
    );
  }

  for (const conversation of weekConversationRows) {
    const key = dayKey(new Date(conversation.created_at));
    conversationsByDay.set(key, (conversationsByDay.get(key) ?? 0) + 1);
  }

  return Response.json({
    charts: {
      conversationsByDay: days.map((day) => ({
        day,
        value: conversationsByDay.get(day) ?? 0,
      })),
      tokensByDay: days.map((day) => ({
        day,
        value: tokensByDay.get(day) ?? 0,
      })),
      tokensByEndpoint: [...tokensByEndpoint.entries()]
        .map(([endpoint, value]) => ({ endpoint, value }))
        .sort((a, b) => b.value - a.value),
    },
    generatedAt: new Date().toISOString(),
    pricing: {
      inputTokenPricePerMillion,
      outputTokenPricePerMillion,
    },
    recentConversations: recentConversations.map((conversation) => ({
      createdAt: conversation.created_at,
      email: emails.get(conversation.user_id) ?? conversation.user_id,
      id: conversation.id,
      messageCount: messageCounts.get(conversation.id) ?? 0,
      title: conversation.title ?? 'Nowa rozmowa',
      updatedAt: conversation.updated_at,
    })),
    stats: {
      conversations: conversationCountResult.count ?? 0,
      costTodayUsd: costUsd(todayUsageRows),
      tokensToday: todayTokens,
      users: users.size,
    },
  });
}
