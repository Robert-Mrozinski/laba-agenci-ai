# Warsztat 1: Pętla ReAct — agent który planuje i działa autonomicznie

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_REACT_LOOP.md i zbuduj agenta ReAct który autonomicznie rozwiązuje złożone zadania"*

## Cel
Agent sam planuje co zrobić, wykonuje kroki, sprawdza wyniki i decyduje czy potrzebuje więcej danych. Bez Twojej pomocy — autonomicznie.

## Kontekst
Do tej pory agent odpowiadał na pytania i używał narzędzi. Ale TO TY decydowałeś co zapytać. Teraz budujemy agenta który dostaje **cel** (nie pytanie) i SAM go realizuje:

1. **🧠 Myśli** (Thought) — "Co muszę zrobić? Jakich danych potrzebuję?"
2. **⚡ Działa** (Action) — wywołuje narzędzie
3. **👁️ Obserwuje** (Observation) — "Co dostałem? Czy to wystarczy?"
4. **🔁 Powtarza** — aż cel będzie osiągnięty

To jest wzorzec **ReAct** (Reason + Act) — tak działają agenty jak Devin, AutoGPT, Claude Artifacts.

## Co budujemy

### 1. Nowy endpoint: `app/api/react/route.ts`

```
Stwórz nowy endpoint API. Konfiguracja:

Model: gemini-2.5-flash z useSearchGrounding: true
maxSteps: 8 (pozwala na wiele iteracji narzędzi)

Wszystkie narzędzia z Lekcji 3:
- calculator, currentDateTime
- getWeather, getExchangeRate
- getHolidays, searchWikipedia
- readWebPage, saveNote, getNotes

System prompt:
"Jesteś autonomicznym agentem. Gdy dostajesz ZADANIE (nie pytanie), 
MUSISZ je zrealizować krok po kroku.

## TWÓJ PROCES:

Dla KAŻDEGO kroku wypisz:

### 🧠 Myślę...
Co muszę teraz zrobić? Jakie informacje mi brakuje?
Które narzędzie użyć?

Potem UŻYJ narzędzia.

Po otrzymaniu wyniku:

### 👁️ Obserwuję...
Co dostałem? Czy to wystarczy do odpowiedzi? 
Jeśli nie — jaki następny krok?

Powtarzaj aż będziesz mieć WSZYSTKO co potrzebne.

Na koniec:

### ✅ Wynik końcowy
Podaj pełną, konkretną odpowiedź opartą na zebranych danych.
Cytuj źródła (API, Wikipedia, Google).

## ZASADY:
- ZAWSZE pokazuj tok myślenia — użytkownik widzi cały proces
- NIE zgaduj — jeśli potrzebujesz danych, UŻYJ narzędzia
- Maksymalnie 5 głównych kroków
- Jeśli narzędzie zwróci błąd — spróbuj inaczej lub poinformuj
- ŁĄCZ dane z wielu narzędzi w spójną odpowiedź"
```

### 2. Nowa strona: `app/react/page.tsx`

```
- Nagłówek: "🔄 Agent ReAct — Autonomiczne rozumowanie"
- Podtytuł: "Opisz cel → agent sam planuje i realizuje"
- Placeholder: "Opisz co chcesz osiągnąć..."
- Endpoint: /api/react

Klikalne scenariusze (złożone, wielokrokowe):
- "Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca 
   w Wikipedii, i powiedz czy są jakieś święta w ten weekend"
- "Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach, 
   i zapisz wszystkie kursy w notatkach"
- "Porównaj pogodę w Warszawie, Berlinie i Paryżu. 
   Który z tych miast ma dziś najlepszą pogodę?"
- "Ile dni do następnego święta w Polsce? Jaka będzie wtedy pogoda?"
```

### 3. Wizualizacja kroków ReAct

```
Odpowiedź agenta zawiera sekcje markdown. Renderuj je wyraźnie:

- 🧠 Myślę → tło ciemnoniebieskie (#1a1a3a), border niebieski
- ⚡ Narzędzie → karty narzędzi (jak w W4 z L3 — timeline)
- 👁️ Obserwuję → tło ciemnopomarańczowe (#2a1a0a), border pomarańczowy
- ✅ Wynik → tło ciemnozielone (#0a2a0a), border zielony

Między krokami dodaj delikatną linię separującą.
Progress bar na górze: "Krok 2 z 5"
```

### 4. Link w nawigacji

Dodaj "🔄 ReAct" do nawigacji.

## Oczekiwany rezultat
- Agent dostaje CEL i SAM decyduje jakie narzędzia wywołać
- Widoczny tok rozumowania: 🧠 → ⚡ → 👁️ → powtórz → ✅
- Prawdziwe dane w każdym kroku
- Kolorowe sekcje ułatwiają śledzenie procesu

## Test

1. "Sprawdź pogodę w Warszawie i Krakowie, porównaj, i powiedz gdzie lepiej jechać na weekend" →
   - 🧠 Muszę sprawdzić pogodę w obu miastach
   - ⚡ getWeather("Warszawa") → 24°C, słonecznie
   - ⚡ getWeather("Kraków") → 21°C, zachmurzenie
   - 👁️ Warszawa cieplej i ładniej
   - ✅ Rekomendacja: Warszawa (24°C vs 21°C)

2. "Mam 10000 PLN. Przelicz na euro, dolary i franki. Zapisz wyniki." →
   - 🧠 Potrzebuję 3 kursów walut
   - ⚡ getExchangeRate("EUR"), getExchangeRate("USD"), getExchangeRate("CHF")
   - 🧠 Teraz przeliczam
   - ⚡ 3x calculator
   - ⚡ saveNote(wyniki)
   - ✅ Wyniki z przeliczeniami + zapisane w notatkach

3. "Czym jest ReAct w AI? Znajdź definicję i sprawdź najnowsze zastosowania" →
   - ⚡ searchWikipedia("ReAct AI")
   - ⚡ Google Search "ReAct AI agent 2026"
   - ✅ Definicja + najnowsze trendy

## Dlaczego to jest ważne
ReAct to serce nowoczesnych agentów. Różnica między chatbotem a agentem: chatbot odpowiada na pytania, agent **realizuje cele**. "Zaplanuj mi podróż" to nie pytanie — to zadanie. Agent ReAct sam decyduje co zrobić.
