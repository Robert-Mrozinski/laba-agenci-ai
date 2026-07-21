'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

const commands = [
  '/tabela języki programowania 2026',
  '/porownanie ChatGPT vs Claude',
  '/lista 5 kroków do pierwszego agenta AI',
  '/faq sztuczna inteligencja dla początkujących',
  '/email podziękowanie za udaną rekrutację',
];

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function renderInline(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g);

  return chunks.map((chunk, index) => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    }

    return <span key={index}>{chunk}</span>;
  });
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  const output: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.includes('|')) {
      const tableLines: string[] = [];

      while (index < lines.length && lines[index].includes('|')) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      const rows = tableLines
        .filter((row) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(row))
        .map((row) =>
          row
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim()),
        );

      if (rows.length > 0) {
        const [head, ...body] = rows;

        output.push(
          <table className="markdown-table" key={`table-${index}`}>
            <thead>
              <tr>
                {head.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>,
        );
      }

      continue;
    }

    if (line.startsWith('### ')) {
      output.push(<h3 key={index}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      output.push(<h2 key={index}>{renderInline(line.slice(3))}</h2>);
    } else if (/^\d+\.\s+/.test(line)) {
      output.push(
        <p className="markdown-list-item" key={index}>
          {renderInline(line)}
        </p>,
      );
    } else if (line.startsWith('- ')) {
      output.push(
        <p className="markdown-list-item" key={index}>
          {renderInline(`• ${line.slice(2)}`)}
        </p>,
      );
    } else {
      output.push(<p key={index}>{renderInline(line)}</p>);
    }

    index += 1;
  }

  return output;
}

function makeMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    parts: [{ type: 'text', text }],
  } as UIMessage;
}

function localFormattedResponse(command: string) {
  const text = command.trim();
  const lower = text.toLowerCase();

  if (lower.startsWith('/porownanie ')) {
    const topic = text.slice('/porownanie '.length);
    const [left = 'Opcja A', right = 'Opcja B'] = topic.split(/\s+vs\s+/i);

    return `| Aspekt | ${left.trim()} | ${right.trim()} | Werdykt |
|---|---|---|---|
| Cel | Dobre przy pracy kreatywnej i analitycznej | Dobre przy pisaniu, analizie i porządkowaniu treści | Zależy od zadania |
| Szybkość | Zwykle bardzo szybkie odpowiedzi | Zwykle stabilne, rozbudowane odpowiedzi | Remis |
| Styl | Elastyczny i konwersacyjny | Często spokojny i uporządkowany | Remis |
| Analiza | Dobra do szerokich tematów | Dobra do długich kontekstów | Testuj na własnym materiale |
| Zastosowanie | Burze mózgów, kod, szybkie odpowiedzi | Dokumenty, redakcja, analiza | Wybierz wg procesu |
| Koszt | Zależy od planu i modelu | Zależy od planu i modelu | Sprawdź aktualny cennik |
| Podsumowanie | ${left.trim()} jest mocne jako wszechstronny asystent | ${right.trim()} jest mocne jako uporządkowany analityk | Najlepiej porównać na tym samym zadaniu |`;
  }

  if (lower.startsWith('/tabela ')) {
    const topic = text.slice('/tabela '.length);

    return `| Element | Zastosowanie | Zaleta | Uwaga |
|---|---|---|---|
| Pozycja 1 | ${topic} w praktyce | Szybki start | Wymaga dopasowania |
| Pozycja 2 | Analiza wariantów | Ułatwia decyzję | Sprawdź aktualność danych |
| Pozycja 3 | Porównanie opcji | Porządkuje informacje | Nie zastępuje eksperta |
| Pozycja 4 | Plan działania | Daje strukturę | Wymaga kontekstu |
| Pozycja 5 | Podsumowanie | Łatwe do skopiowania | Dopracuj pod odbiorcę |`;
  }

  if (lower.startsWith('/lista ')) {
    const topic = text.slice('/lista '.length);

    return `## ${topic}
1. **Zdefiniuj cel** — Najpierw ustal, jaki efekt chcesz osiągnąć.
2. **Zbierz kontekst** — Dopisz ograniczenia, odbiorców i kryteria sukcesu.
3. **Podziel na kroki** — Rozbij temat na małe, możliwe do wykonania zadania.
4. **Przetestuj wynik** — Sprawdź, czy odpowiedź lub plan działa w praktyce.
5. **Ulepsz iteracyjnie** — Poprawiaj szczegóły po każdym teście.`;
  }

  if (lower.startsWith('/faq ')) {
    const topic = text.slice('/faq '.length);

    return `## FAQ: ${topic}
**Q:** Czym jest ten temat?
**A:** To zagadnienie, które warto wyjaśnić prostym językiem i oprzeć na przykładach.

**Q:** Kiedy warto się tym zainteresować?
**A:** Gdy temat wpływa na decyzję, proces albo pracę zespołu.

**Q:** Jaki jest pierwszy krok?
**A:** Zacznij od określenia celu i zebrania podstawowych informacji.

**Q:** Jak uniknąć błędów?
**A:** Sprawdź źródła, porównaj warianty i nie opieraj decyzji na jednym przykładzie.

**Q:** Co dalej?
**A:** Przygotuj krótką listę działań i przetestuj ją w praktyce.`;
  }

  if (lower.startsWith('/email ')) {
    const topic = text.slice('/email '.length);

    return `## Email: ${topic}
**Temat:** ${topic}

**Od/Do:**  
Od: [Twoje imię]  
Do: [Adresat]

**Treść:**  
Dzień dobry,

chciałbym/chciałabym podziękować za dotychczasową współpracę i nawiązać do tematu: ${topic}. Doceniam poświęcony czas oraz profesjonalne podejście. Będę wdzięczny/wdzięczna za informację zwrotną lub wskazanie kolejnych kroków.

**Podpis:**  
Pozdrawiam,  
[Twoje imię]`;
  }

  return null;
}

export default function FormatPage() {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/format' }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat({
      transport,
    });
  const isLoading = status === 'submitted' || status === 'streaming';
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 240)
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    setInput('');
    clearError();

    const localResponse = localFormattedResponse(text);
    if (localResponse) {
      setMessages([
        ...messages,
        makeMessage('user', text),
        makeMessage('assistant', localResponse),
      ]);
      return;
    }

    await sendMessage({ text });
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Formatowanie odpowiedzi">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            📐
          </div>
          <div>
            <h1>Formatowanie</h1>
            <p className="agent-description">
              Agent odpowiada w tabeli, liście, porównaniu — na żądanie.
            </p>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Wybierz komendę poniżej albo wpisz własną instrukcję formatu.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                className={`message-row ${message.role}`}
                key={message.id}
              >
                <div className="message-bubble markdown-content">
                  {messageText(message.parts)
                    ? renderMarkdown(messageText(message.parts))
                    : message.role === 'assistant'
                      ? 'Myślę...'
                      : ''}
                </div>
              </article>
            ))
          )}

          {isLoading && messages.at(-1)?.role !== 'assistant' ? (
            <article className="message-row assistant">
              <div className="message-bubble thinking">Myślę...</div>
            </article>
          ) : null}

          {error ? (
            <div className="error-message">
              Nie udało się pobrać odpowiedzi.
              {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <form className="composer composer-separated" onSubmit={handleSubmit}>
          <input
            aria-label="Komenda formatowania"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wpisz /tabela, /lista, /porownanie, /faq albo /email..."
            value={input}
          />
          <button disabled={isLoading || !input.trim()} type="submit">
            Wyślij
          </button>
        </form>

        <div className="term-buttons" aria-label="Komendy formatowania">
          {commands.map((command) => (
            <button
              disabled={isLoading}
              key={command}
              onClick={() => setInput(command)}
              type="button"
            >
              {command}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
