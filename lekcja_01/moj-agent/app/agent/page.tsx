'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useSearchParams } from 'next/navigation';
import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  AttachedImage,
  imageFromClipboard,
  imageFromDrop,
  readImageFile,
} from '../components/imageAttachment';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';

const tools = [
  ['🧮', 'Kalkulator'],
  ['🕐', 'Data i czas'],
  ['🌐', 'Google Search'],
  ['📄', 'Czytanie stron'],
  ['⚖️', 'BOE / AEAT / DGT'],
  ['🇪🇺', 'EUR-Lex / VIES'],
  ['🏠', 'Catastro'],
  ['🏛️', 'CENDOJ / regiony'],
  ['🎨', 'Generowanie obrazów'],
  ['👁️', 'Analiza obrazów'],
];

const scenarios = [
  'Sprawdź aktualne przepisy o kosztach zakupu nieruchomości w Comunidad Valenciana i podaj źródła',
  'Zweryfikuj numer VAT ESB12345678 w VIES i wyjaśnij co oznacza wynik',
  'Znajdź urzędowe źródła o ITP, AJD i IVA przy zakupie nieruchomości w Hiszpanii',
  'Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo',
  'Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone',
  'Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto',
  'Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym',
  "Wyszukaj w Google 'best coffee shops Kraków' i streszcz wyniki",
];

type ToolPart = {
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  toolCallId?: string;
  type: string;
};

type StoredMessage = {
  content: string;
  created_at: string;
  id: string;
  role: 'user' | 'assistant';
};

type UserProfile = {
  id: string;
  name: string | null;
  preferences: Record<string, string> | null;
};

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function splitCitation(text: string) {
  const lines = text.split('\n');
  const citationIndex = lines.findIndex((line) => /^📎\s*Źródł[ao]:/.test(line.trim()));

  if (citationIndex < 0) {
    return { body: text, citation: '' };
  }

  return {
    body: lines.slice(0, citationIndex).join('\n').trim(),
    citation: lines.slice(citationIndex).join(' ').trim(),
  };
}

function getToolName(type: string) {
  return type.replace(/^tool-/, '');
}

function toolEmoji(toolName: string) {
  const emoji: Record<string, string> = {
    calculator: '🧮',
    currentDateTime: '🕐',
    google_search: '🌐',
    readWebPage: '📄',
    generateImage: '🎨',
    getOfficialApiDirectory: '🗂️',
    searchOfficialLegalSources: '⚖️',
    getBOEDailySummary: '📜',
    checkVIESVatNumber: '🇪🇺',
    getCatastroByAddress: '🏠',
  };

  return emoji[toolName] ?? '🔧';
}

function formatValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 160)}...` : value;
  }

  const json = JSON.stringify(value);
  return json.length > 160 ? `${json.slice(0, 160)}...` : json;
}

function toolParts(parts: ToolPart[]) {
  return parts.filter((part) => part.type.startsWith('tool-'));
}

function generatedImages(parts: ToolPart[]) {
  return toolParts(parts)
    .filter((part) => part.type === 'tool-generateImage')
    .map((part) => part.output)
    .filter(
      (output): output is { image: string; prompt?: string; text?: string } =>
        typeof output === 'object' &&
        output !== null &&
        'image' in output &&
        typeof (output as { image?: unknown }).image === 'string',
    );
}

function conversationTitle(text: string) {
  const normalizedText = text.trim().replace(/\s+/g, ' ');

  if (!normalizedText) {
    return 'Nowa rozmowa';
  }

  return normalizedText.length > 50
    ? `${normalizedText.slice(0, 47)}...`
    : normalizedText;
}

function storedMessageToUiMessage(message: StoredMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  };
}

function readSavedName(parts: ToolPart[]) {
  const saveNamePart = toolParts(parts)
    .filter((part) => part.type === 'tool-saveUserName')
    .find(
      (part) =>
        part.state === 'output-available' &&
        typeof part.output === 'object' &&
        part.output !== null &&
        'saved' in part.output &&
        (part.output as { saved?: unknown }).saved === true &&
        'name' in part.output &&
        typeof (part.output as { name?: unknown }).name === 'string',
    );

  return saveNamePart
    ? ((saveNamePart.output as { name: string }).name.trim() || null)
    : null;
}

function AgentContent() {
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get('conversationId');
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(
    null,
  );
  const [imageError, setImageError] = useState('');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedMessageIdsRef = useRef<Set<string>>(new Set());
  const conversationIdRef = useRef<string | null>(null);
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat();
  const isLoading = status === 'submitted' || status === 'streaming';
  const isInitializing = historyLoading || profileLoading;
  const userName = userProfile?.name?.trim() || '';
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 240)
    : null;

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserProfile() {
      if (!supabase) {
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      const storedUserId = window.localStorage.getItem('user_id');
      const currentUserId = storedUserId || crypto.randomUUID();

      if (!storedUserId) {
        window.localStorage.setItem('user_id', currentUserId);
      }

      const { data: existingProfile, error: selectError } = await supabase
        .from('user_profiles')
        .select('id, name, preferences')
        .eq('id', currentUserId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (selectError) {
        setHistoryError(selectError.message);
        setUserId(currentUserId);
        setProfileLoading(false);
        return;
      }

      if (existingProfile) {
        setUserId(currentUserId);
        setUserProfile(existingProfile as UserProfile);
        setProfileLoading(false);
        return;
      }

      const { data: createdProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: currentUserId,
          name: null,
          preferences: {},
        })
        .select('id, name, preferences')
        .single();

      if (cancelled) {
        return;
      }

      if (insertError) {
        setHistoryError(insertError.message);
        setUserId(currentUserId);
        setProfileLoading(false);
        return;
      }

      setUserId(currentUserId);
      setUserProfile(createdProfile as UserProfile);
      setProfileLoading(false);
    }

    void loadUserProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestConversation() {
      if (!supabase) {
        setHistoryLoading(false);

        if (!isSupabaseConfigured) {
          setHistoryError(
            'Brakuje NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local.',
          );
        }

        return;
      }

      setHistoryLoading(true);
      setHistoryError('');

      const conversationQuery = supabase.from('conversations').select('id');
      const { data: conversation, error: conversationError } =
        requestedConversationId
          ? await conversationQuery
              .eq('id', requestedConversationId)
              .maybeSingle()
          : await conversationQuery
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();

      if (cancelled) {
        return;
      }

      if (conversationError) {
        setHistoryError(conversationError.message);
        setHistoryLoading(false);
        return;
      }

      if (!conversation) {
        setHistoryLoading(false);
        return;
      }

      const { data: storedMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (cancelled) {
        return;
      }

      if (messagesError) {
        setHistoryError(messagesError.message);
        setHistoryLoading(false);
        return;
      }

      const uiMessages = (storedMessages ?? [])
        .filter(
          (message): message is StoredMessage =>
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string',
        )
        .map(storedMessageToUiMessage);

      savedMessageIdsRef.current = new Set(
        uiMessages.map((message) => message.id),
      );
      setConversationId(conversation.id);
      setMessages(uiMessages);
      setHistoryLoading(false);
    }

    void loadLatestConversation();

    return () => {
      cancelled = true;
    };
  }, [requestedConversationId, setMessages]);

  useEffect(() => {
    const savedName = messages
      .map((message) => readSavedName(message.parts as ToolPart[]))
      .find((name): name is string => Boolean(name));

    if (!savedName || userProfile?.name === savedName) {
      return;
    }

    setUserProfile((currentProfile) =>
      currentProfile
        ? {
            ...currentProfile,
            name: savedName,
          }
        : currentProfile,
    );
  }, [messages, userProfile?.name]);

  useEffect(() => {
    if (!startedAt || isLoading) {
      return;
    }

    const lastAssistant = messages.findLast(
      (message) => message.role === 'assistant',
    );

    if (lastAssistant && !durations[lastAssistant.id]) {
      setDurations((currentDurations) => ({
        ...currentDurations,
        [lastAssistant.id]: (Date.now() - startedAt) / 1000,
      }));
      setStartedAt(null);
    }
  }, [durations, isLoading, messages, startedAt]);

  useEffect(() => {
    if (!supabase || !conversationId || historyLoading) {
      return;
    }

    const messagesToSave = messages.filter((message) => {
      if (savedMessageIdsRef.current.has(message.id)) {
        return false;
      }

      if (message.role !== 'user' && message.role !== 'assistant') {
        return false;
      }

      const text = messageText(message.parts);

      if (!text.trim()) {
        return false;
      }

      return message.role === 'user' || !isLoading;
    });

    if (messagesToSave.length === 0) {
      return;
    }

    messagesToSave.forEach((message) =>
      savedMessageIdsRef.current.add(message.id),
    );

    async function saveMessages() {
      const now = new Date().toISOString();
      const rows = messagesToSave.map((message) => ({
        conversation_id: conversationId,
        role: message.role,
        content: messageText(message.parts),
      }));

      const { error: insertError } = await supabase!
        .from('messages')
        .insert(rows);

      if (insertError) {
        messagesToSave.forEach((message) =>
          savedMessageIdsRef.current.delete(message.id),
        );
        setHistoryError(insertError.message);
        return;
      }

      const { error: updateError } = await supabase!
        .from('conversations')
        .update({ updated_at: now })
        .eq('id', conversationId);

      if (updateError) {
        setHistoryError(updateError.message);
      }
    }

    void saveMessages();
  }, [conversationId, historyLoading, isLoading, messages]);

  async function createConversation(title = 'Nowa rozmowa') {
    if (!supabase) {
      setHistoryError(
        'Nie skonfigurowano Supabase. Dodaj NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local.',
      );
      return null;
    }

    const now = new Date().toISOString();
    const { data, error: createError } = await supabase
      .from('conversations')
      .insert({ title, updated_at: now })
      .select('id')
      .single();

    if (createError) {
      setHistoryError(createError.message);
      return null;
    }

    setConversationId(data.id);
    setHistoryError('');
    return data.id as string;
  }

  async function ensureConversation(text: string) {
    if (conversationIdRef.current) {
      if (messages.length === 0 && supabase) {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            title: conversationTitle(text),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conversationIdRef.current);

        if (updateError) {
          setHistoryError(updateError.message);
        }
      }

      return conversationIdRef.current;
    }

    return createConversation(conversationTitle(text));
  }

  async function attachImage(file?: File | null) {
    if (!file) {
      return;
    }

    try {
      const image = await readImageFile(file);
      setAttachedImage(image);
      setImageError('');
    } catch (attachmentError) {
      setImageError(
        attachmentError instanceof Error
          ? attachmentError.message
          : 'Nie udało się wczytać obrazu.',
      );
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const file = imageFromClipboard(event.clipboardData.items);

    if (file) {
      event.preventDefault();
      void attachImage(file);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void attachImage(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingImage(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget === event.target) {
      setIsDraggingImage(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    void attachImage(imageFromDrop(event.dataTransfer.files));
  }

  async function send(text: string) {
    const trimmedText = text.trim();

    if ((!trimmedText && !attachedImage) || isLoading || isInitializing) {
      return;
    }

    const image = attachedImage?.dataUrl;
    setInput('');
    setAttachedImage(null);
    setStartedAt(Date.now());
    clearError();
    await ensureConversation(trimmedText);
    await sendMessage(
      { text: trimmedText || 'Opisz ten obraz i zaproponuj następne kroki.' },
      { body: { image, mode: 'agent', model: 'flash', userId } },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function downloadImage(image: string) {
    const link = document.createElement('a');
    link.href = image;
    link.download = 'ai-generated.png';
    link.click();
  }

  async function handleNewConversation() {
    clearError();
    setInput('');
    setAttachedImage(null);
    setDurations({});
    savedMessageIdsRef.current = new Set();
    setMessages([]);
    await createConversation('Nowa rozmowa');
  }

  return (
    <main
      className="chat-shell agent-shell"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingImage ? <div className="drop-overlay">Upuść obraz</div> : null}
      <section className="chat-panel agent-panel" aria-label="Agent Pełna moc">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            🤖
          </div>
          <div>
            <h1>🤖 Agent AI - Pełna moc</h1>
            <p className="agent-description">
              {tools.length} narzędzi • autonomiczne decyzje
            </p>
            <p className="profile-greeting">
              {profileLoading
                ? 'Sprawdzam, czy już się znamy...'
                : userName
                  ? `Cześć, ${userName}! Miło Cię znowu widzieć.`
                  : 'Cześć! Nie znamy się jeszcze. Jak masz na imię?'}
            </p>
            <div className="agent-tools" aria-label="Moje narzędzia">
              {tools.map(([emoji, label]) => (
                <span key={label}>
                  {emoji} {label} <strong>✅ aktywny</strong>
                </span>
              ))}
            </div>
            <div className="example-questions" aria-label="Scenariusze">
              {scenarios.map((scenario) => (
                <button
                  disabled={isLoading || isInitializing}
                  key={scenario}
                  onClick={() => send(scenario)}
                  type="button"
                >
                  {scenario}
                </button>
              ))}
            </div>
          </div>
          <button
            className="new-chat-button"
            disabled={isLoading || isInitializing}
            onClick={handleNewConversation}
            type="button"
          >
            + Nowa rozmowa
          </button>
        </header>

        <div className="messages" aria-live="polite">
          {isInitializing ? (
            <div className="empty-state">
              <p>Wczytuję profil i historię rozmowy...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <p>
                {userName
                  ? `Cześć, ${userName}! Wybierz scenariusz albo zleć agentowi zadanie wieloetapowe.`
                  : 'Cześć! Nie znamy się jeszcze. Jak masz na imię?'}
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const messageToolParts = toolParts(message.parts as ToolPart[]);
              const images = generatedImages(message.parts as ToolPart[]);
              const text = messageText(message.parts);
              const { body, citation } = splitCitation(text);

              return (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble">
                    {messageToolParts.length > 0 ? (
                      <div className="tool-timeline">
                        <strong>🤖 Agent wykonuje zadanie...</strong>
                        {messageToolParts.map((part, index) => {
                          const name = getToolName(part.type);
                          return (
                            <div className="tool-step" key={part.toolCallId ?? index}>
                              <span>{index + 1}</span>
                              <div>
                                <b>
                                  {toolEmoji(name)} {name}
                                </b>
                                <small>{formatValue(part.input)}</small>
                                {part.state === 'output-available' ? (
                                  <small>→ {formatValue(part.output)}</small>
                                ) : part.state === 'output-error' ? (
                                  <small>→ {part.errorText}</small>
                                ) : (
                                  <small>→ wykonuję...</small>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {body ||
                      (message.role === 'assistant' ? 'Pracuję...' : '')}

                    {citation ? <div className="source-note">{citation}</div> : null}

                    {images.map((image) => (
                      <div className="chat-generated-image" key={image.image}>
                        <img alt={image.prompt ?? 'Wygenerowany obraz'} src={image.image} />
                        {image.text ? <p>{image.text}</p> : null}
                        <button onClick={() => downloadImage(image.image)} type="button">
                          💾 Pobierz
                        </button>
                      </div>
                    ))}

                    {message.role === 'assistant' ? (
                      <div className="tool-summary">
                        Użyto {messageToolParts.length} narzędzi |{' '}
                        {(durations[message.id] ?? 0).toFixed(1)}s | Model:
                        gemini-3.1-flash-lite
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}

          {isLoading && messages.at(-1)?.role !== 'assistant' ? (
            <article className="message-row assistant">
              <div className="message-bubble thinking">Agent pracuje...</div>
            </article>
          ) : null}

          {error ? (
            <div className="error-message">
              Nie udało się pobrać odpowiedzi.
              {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
            </div>
          ) : null}

          {historyError ? (
            <div className="error-message">
              Historia rozmowy nie została zapisana. Szczegóły: {historyError}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <DiagnosticsPanel
          durations={durations}
          isLoading={isLoading}
          maxSteps={8}
          messages={messages}
        />

        <form className="composer composer-separated" onSubmit={handleSubmit}>
          {attachedImage ? (
            <div className="attachment-preview">
              <img alt={attachedImage.name} src={attachedImage.dataUrl} />
              <span>📎 Screenshot - zadaj pytanie o ten obraz</span>
              <button onClick={() => setAttachedImage(null)} type="button">
                ×
              </button>
            </div>
          ) : null}
          {imageError ? <div className="attachment-error">{imageError}</div> : null}
          <input
            accept="image/*"
            hidden
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label="Dodaj obraz"
            disabled={isLoading || isInitializing}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            📎
          </button>
          <input
            aria-label="Wiadomość"
            disabled={isLoading || isInitializing}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            placeholder="Zleć zadanie agentowi..."
            value={input}
          />
          <button
            disabled={isLoading || isInitializing || (!input.trim() && !attachedImage)}
            type="submit"
          >
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentContent />
    </Suspense>
  );
}
