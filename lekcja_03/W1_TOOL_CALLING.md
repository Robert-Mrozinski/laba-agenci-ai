# Warsztat 1: Agent z wyszukiwarką Google — prawdziwe dane z internetu

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_TOOL_CALLING.md i dodaj wyszukiwanie Google oraz czytanie stron do mojego agenta"*

## Cel
Agent przeszukuje prawdziwy internet i czyta prawdziwe strony WWW. Żadnych mocków — prawdziwe wyniki z Google.

## Kontekst
W Lekcji 1 dodaliśmy agentowi kalkulator i zegar. Teraz idziemy dalej — agent sięga po **prawdziwe dane z internetu**. To jest moment gdy agent przestaje być zamkniętą skrzynką i zaczyna widzieć świat.

## Co budujemy

### 1. Włącz Google Search w modelu Gemini

Gemini ma wbudowane wyszukiwanie Google — nie potrzebujesz dodatkowego API. Ten sam klucz z AI Studio.

> ⚠️ **UWAGA O KOSZTACH:** Search Grounding to płatna funkcja ($14/1000 wyszukiwań, 5000/miesiąc darmowych). Dlatego jest **domyślnie wyłączona** i kontrolowana zmienną środowiskową. Żeby ją włączyć, dodaj do `.env.local`: `ENABLE_SEARCH_GROUNDING=true`. Nie zostawiaj jej włączonej na stałe — inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.

```
W pliku app/api/chat/route.ts:

Zmień konfigurację modelu Google — włącz Google Search grounding
przez zmienną środowiskową (domyślnie wyłączone).

W @ai-sdk/google użyj opcji:
  google('gemini-3.1-flash-lite', {
    useSearchGrounding: process.env.ENABLE_SEARCH_GROUNDING === 'true'
  })

Na górze pliku (po importach) dodaj ostrzeżenie:
  if (process.env.ENABLE_SEARCH_GROUNDING === 'true') {
    console.warn('⚠️ Search Grounding WŁĄCZONY — to jest płatna funkcja. Wyłącz po testach.');
  }

Dzięki temu model AUTOMATYCZNIE przeszukuje Google gdy potrzebuje 
aktualnych informacji (jeśli jest włączony w .env.local).
Nie musisz definiować osobnego narzędzia — 
Gemini sam decyduje kiedy szukać.

WAŻNE: To nie jest mock! Agent naprawdę szuka w Google 
i zwraca prawdziwe wyniki z linkami.
```

### 2. Narzędzie: Czytanie stron WWW

Dodaj narzędzie (tool) które pobiera i czyta zawartość dowolnej strony:

```
Nazwa: readWebPage
Opis: "Pobiera i czyta zawartość strony internetowej. 
Używaj gdy użytkownik poda URL lub gdy chcesz przeczytać 
artykuł/stronę znalezioną w wyszukiwarce."
Parametry:
  - url (string, required): pełny adres URL strony

Wykonanie (w Next.js API route, server-side):
  1. Użyj fetch(url) do pobrania HTML strony
  2. Wyciągnij tekst z HTML — usuń tagi <script>, <style>, 
     <nav>, <footer>, a potem użyj regex do usunięcia 
     pozostałych tagów HTML
  3. Ogranicz wynik do 3000 znaków (żeby nie przekroczyć 
     limitu tokenów)
  4. Zwróć wyekstrahowany tekst
  5. Obsłuż błędy: timeout (5 sekund), błąd HTTP, 
     niedostępna strona → zwróć czytelny komunikat błędu
```

### 3. Nowa strona: /search

```
Stwórz stronę app/search/page.tsx:

- Nagłówek: "🌐 Agent z wyszukiwarką"
- Podtytuł: "Przeszukuję prawdziwy internet i czytam strony"
- Endpoint: /api/chat (ten sam, z włączonym grounding)
- Placeholder: "Zapytaj o cokolwiek aktualnego..."
- Klikalne pytania startowe:
  - "Jakie są najnowsze wiadomości o sztucznej inteligencji?"
  - "Ile kosztuje iPhone 16 Pro w Polsce?"
  - "Kto wygrał ostatni mecz reprezentacji Polski?"
  - "Jakie filmy są teraz w kinach?"
- Gdy agent cytuje źródła — pokaż je jako klikalne linki
- Dodaj do nawigacji: "🌐 Szukaj"
```

## Oczekiwany rezultat
- Agent przeszukuje prawdziwy Google — wyniki są aktualne
- Agent czyta prawdziwe strony WWW i streszcza ich treść
- Źródła i linki widoczne w odpowiedzi
- Działa z tym samym kluczem AI Studio — zero dodatkowych kosztów

## Test

1. "Jakie są najnowsze wiadomości o AI?" → prawdziwe wyniki z Google
2. "Przeczytaj tę stronę: https://pl.wikipedia.org/wiki/Sztuczna_inteligencja" → streszczenie artykułu z Wikipedii
3. "Ile kosztuje mass Kurs EUR/PLN?" → aktualny kurs z internetu
4. "Kim jest premier Polski?" → aktualna odpowiedź
5. "Opowiedz mi żart" → agent NIE szuka w Google (nie potrzebuje)

## Dlaczego to jest ważne
Agent bez internetu jest ograniczony do wiedzy z treningu. Agent Z internetem jest aktualny — wie co się dzieje teraz, czyta prawdziwe artykuły, sprawdza prawdziwe ceny. To jest fundamentalna różnica między "zabawką" a "narzędziem".
