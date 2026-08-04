import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dailyTokenLimit = Number(process.env.DAILY_TOKEN_LIMIT ?? 10000);

type ApiUsageRow = {
  created_at: string;
  endpoint: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  user_id: string;
};

type MessageLogRow = {
  blocked: boolean;
  created_at: string;
  endpoint: string;
  id: string;
  message: string;
  reason: string;
  user_id: string;
};

type UserSummary = {
  email: string;
  percentOfLimit: number;
  tokensThisWeek: number;
  tokensToday: number;
  userId: string;
};

function startOfUtcDay() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function tokenTotal(row: ApiUsageRow) {
  return (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
}

function shortMessage(message: string) {
  const normalized = message.trim().replace(/\s+/g, ' ');
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
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
    return { error: 'Brak dostępu do panelu bezpieczeństwa.', user: null };
  }

  return { error: null, user };
}

async function userEmailMap(
  adminClient: ReturnType<typeof createClient<any>>,
  userIds: string[],
) {
  const entries = await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
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

  const [usageResult, blockedResult, recentUsageResult] = await Promise.all([
    adminClient
      .from('api_usage')
      .select('user_id, created_at, tokens_input, tokens_output, model, endpoint')
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: false }),
    adminClient
      .from('message_logs')
      .select('id, user_id, created_at, endpoint, message, reason, blocked')
      .eq('blocked', true)
      .order('created_at', { ascending: false })
      .limit(25),
    adminClient
      .from('api_usage')
      .select('user_id, created_at, tokens_input, tokens_output, model, endpoint')
      .gte('created_at', isoMinutesAgo(10)),
  ]);

  if (usageResult.error) {
    return Response.json({ error: usageResult.error.message }, { status: 500 });
  }

  if (blockedResult.error) {
    return Response.json({ error: blockedResult.error.message }, { status: 500 });
  }

  if (recentUsageResult.error) {
    return Response.json(
      { error: recentUsageResult.error.message },
      { status: 500 },
    );
  }

  const usageRows = (usageResult.data ?? []) as ApiUsageRow[];
  const blockedRows = (blockedResult.data ?? []) as MessageLogRow[];
  const recentUsageRows = (recentUsageResult.data ?? []) as ApiUsageRow[];
  const todayStartIso = todayStart.toISOString();
  const summaries = new Map<string, UserSummary>();

  for (const row of usageRows) {
    const current =
      summaries.get(row.user_id) ??
      ({
        email: row.user_id,
        percentOfLimit: 0,
        tokensThisWeek: 0,
        tokensToday: 0,
        userId: row.user_id,
      } satisfies UserSummary);

    const tokens = tokenTotal(row);
    current.tokensThisWeek += tokens;

    if (row.created_at >= todayStartIso) {
      current.tokensToday += tokens;
    }

    summaries.set(row.user_id, current);
  }

  const recentCalls = new Map<string, number>();
  for (const row of recentUsageRows) {
    recentCalls.set(row.user_id, (recentCalls.get(row.user_id) ?? 0) + 1);
  }

  const allUserIds = [
    ...summaries.keys(),
    ...blockedRows.map((row) => row.user_id),
    ...recentCalls.keys(),
  ];
  const emails = await userEmailMap(adminClient, allUserIds);

  const topUsers = [...summaries.values()]
    .map((summary) => ({
      ...summary,
      email: emails.get(summary.userId) ?? summary.userId,
      percentOfLimit: Math.round((summary.tokensToday / dailyTokenLimit) * 100),
    }))
    .sort((a, b) => b.tokensThisWeek - a.tokensThisWeek)
    .slice(0, 5);

  const blockedMessages = blockedRows.map((row) => ({
    ...row,
    email: emails.get(row.user_id) ?? row.user_id,
    message: shortMessage(row.message),
  }));

  const alerts = [
    ...topUsers
      .filter((user) => user.percentOfLimit >= 80)
      .map((user) => ({
        createdAt: new Date().toISOString(),
        level: user.percentOfLimit >= 100 ? 'critical' : 'warning',
        message: `${user.email} osiągnął ${user.percentOfLimit}% dziennego limitu tokenów.`,
        type: 'limit',
      })),
    ...[...recentCalls.entries()]
      .filter(([, count]) => count > 20)
      .map(([userId, count]) => ({
        createdAt: new Date().toISOString(),
        level: 'critical',
        message: `${emails.get(userId) ?? userId} wykonał ${count} wywołań w 10 minut.`,
        type: 'burst',
      })),
    ...blockedMessages.slice(0, 5).map((message) => ({
      createdAt: message.created_at,
      level: 'warning',
      message: `${message.email}: wiadomość zablokowana przez filtr.`,
      type: 'blocked-message',
    })),
  ];

  const totalToday = [...summaries.values()].reduce(
    (sum, user) => sum + user.tokensToday,
    0,
  );
  const totalWeek = [...summaries.values()].reduce(
    (sum, user) => sum + user.tokensThisWeek,
    0,
  );
  const userCount = summaries.size;

  return Response.json({
    alerts,
    blockedMessages,
    generatedAt: new Date().toISOString(),
    stats: {
      averageTokensPerUser: userCount ? Math.round(totalWeek / userCount) : 0,
      blockedMessages: blockedRows.length,
      totalTokensThisWeek: totalWeek,
      totalTokensToday: totalToday,
      userCount,
    },
    topUsers,
  });
}
