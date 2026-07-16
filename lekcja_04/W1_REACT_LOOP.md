# Warsztat 1: Nowe narzędzia API + Agent ReAct

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_REACT_LOOP.md i dodaj nowe narzędzia API, a potem zbuduj agenta ReAct"*

## Cel
Dodać agentowi **8 nowych narzędzi** opartych o prawdziwe, darmowe API — a potem zbudować agenta ReAct który SAM planuje, działa i sprawdza wyniki.

## Kontekst
Po Lekcji 3 Twój agent ma: Google Search (grounding), czytanie stron WWW (`readWebPage`), generowanie obrazów (`generateImage`) i analizę screenshotów. Ale te narzędzia działają pojedynczo — TY decydujesz co zapytać.

Teraz dodamy narzędzia do pobierania **prawdziwych danych** (pogoda, waluty, święta, Wikipedia, kalkulator, czas, notatki) i zbudujemy agenta ReAct — który dostaje **cel** i SAM decyduje co zrobić:

1. **🧠 Myśli** (Thought) — "Co muszę zrobić? Jakich danych potrzebuję?"
2. **⚡ Działa** (Action) — wywołuje narzędzie
3. **👁️ Obserwuje** (Observation) — "Co dostałem? Czy to wystarczy?"
4. **🔁 Powtarza** — aż cel będzie osiągnięty

To jest wzorzec **ReAct** (Reason + Act) — tak działają agenty jak Devin, AutoGPT, Claude Code.

## Co budujemy

### Część A: 8 nowych narzędzi (tools)

Dodaj nowe narzędzia (np. w osobnym pliku `lib/tools.ts` lub bezpośrednio w endpoincie API):

```
=== NARZĘDZIE 1: calculator ===
Opis: "Oblicza wyrażenia matematyczne. Używaj do dokładnych obliczeń."
Parametry: expression (string), np. "15 * 247" lub "5000 / 4.28"
Implementacja: użyj Function("return " + expression)()
  z filtrem bezpieczeństwa (odrzuć: import, require, eval, process, fetch)
Zwróć: { expression, result }

=== NARZĘDZIE 2: currentDateTime ===
Opis: "Zwraca aktualną datę i czas"
Parametry: brak
Implementacja: new Date().toLocaleString('pl-PL', { ... })
Zwróć: { dateTime, dayOfWeek, timestamp }

=== NARZĘDZIE 3: getWeather ===
Opis: "Sprawdza aktualną pogodę w podanym mieście"
Parametry: city (string)

API (darmowe, bez klucza):
1. Geocoding: https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=pl
   → pobierz latitude, longitude, name z results[0]
2. Pogoda: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
   → pobierz current.temperature_2m, wind_speed_10m, relative_humidity_2m
3. Zwróć: { city, temperature, humidity, windSpeed, description }

Jeśli geocoding nie znajdzie miasta → zwróć { error: "Nie znalazłem miasta X" }

=== NARZĘDZIE 4: getExchangeRate ===
Opis: "Sprawdza kurs waluty do PLN z NBP"
Parametry: currency (string, np. "EUR", "USD")

API (darmowe, bez klucza):
https://api.nbp.pl/api/exchangerates/rates/a/{currency}/?format=json
→ pobierz rates[0].mid (kurs średni), rates[0].effectiveDate

Zwróć: { currency, rate, date, source: "NBP" }
Jeśli 404 → { error: "Waluta X nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF" }

=== NARZĘDZIE 5: getHolidays ===
Opis: "Sprawdza święta państwowe w danym kraju na dany rok"
Parametry: countryCode (string, np. "PL"), year (number)

API (darmowe, bez klucza):
https://date.nager.at/api/v3/publicholidays/{year}/{countryCode}
→ tablica obiektów { date, localName, name }

Zwróć: listę świąt (max 15)
Jeśli błąd → { error: "Nie znalazłem świąt dla kraju X" }

=== NARZĘDZIE 6: searchWikipedia ===
Opis: "Wyszukuje artykuł w Wikipedii i zwraca streszczenie"
Parametry: query (string)

API (darmowe, bez klucza):
https://pl.wikipedia.org/api/rest_v1/page/summary/{encodeURIComponent(query)}
→ pobierz extract (streszczenie), title, thumbnail

Zwróć: { title, summary (max 1000 znaków), url }
Jeśli 404 → szukaj przez:
https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json

=== NARZĘDZIE 7: saveNote ===
Opis: "Zapisuje notatkę w pamięci agenta"
Parametry: title (string), content (string)
Implementacja: zapisz w zmiennej globalnej (Map lub tablica)
Zwróć: { saved: true, title }

=== NARZĘDZIE 8: getNotes ===
Opis: "Pobiera wszystkie zapisane notatki"
Parametry: brak
Implementacja: zwróć zapisane notatki z Map/tablicy
Zwróć: tablica [{ title, content, createdAt }]
```

### Część B: Nowy endpoint ReAct

```
Stwórz nowy endpoint: app/api/react/route.ts

Model: gemini-3.1-flash-lite z useSearchGrounding sterowanym zmienną ENABLE_SEARCH_GROUNDING (domyślnie wyłączony — patrz L03 W1)
maxSteps: 8 (pozwala na wiele iteracji narzędzi)

Podłącz WSZYSTKIE narzędzia — z L3 + nowe 8:
Istniejące z L3:
- readWebPage (czytanie stron WWW)
Nowe (dodane właśnie):
- calculator, currentDateTime
- getWeather, getExchangeRate, getHolidays
- searchWikipedia, saveNote, getNotes

UWAGA: generateImage z L3 też możesz podłączyć,
ale nie jest wymagane w tym warsztacie.

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

### Część C: Nowa strona /react

```
Stwórz stronę app/react/page.tsx:

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

### Część D: Wizualizacja kroków ReAct

```
Odpowiedź agenta zawiera sekcje markdown. Renderuj je wyraźnie:

- 🧠 Myślę → tło ciemnoniebieskie (#1a1a3a), border niebieski
- ⚡ Narzędzie → karty narzędzi (jak timeline w L3 W4)
- 👁️ Obserwuję → tło ciemnopomarańczowe (#2a1a0a), border pomarańczowy
- ✅ Wynik → tło ciemnozielone (#0a2a0a), border zielony

Między krokami dodaj delikatną linię separującą.
Progress bar na górze: "Krok 2 z 5"
```

### Część E: Link w nawigacji

Dodaj "🔄 ReAct" do nawigacji.

## Oczekiwany rezultat
- 8 nowych narzędzi — agent przeszedł od 2 (readWebPage, generateImage) do 10
- Agent dostaje CEL i SAM decyduje jakie narzędzia wywołać
- Widoczny tok rozumowania: 🧠 → ⚡ → 👁️ → powtórz → ✅
- Prawdziwe dane z API — student weryfikuje pogodę na telefonie
- Kolorowe sekcje ułatwiają śledzenie procesu

## Test

1. "Jaka pogoda w Warszawie?" → getWeather → prawdziwa temperatura (sprawdź na telefonie!)
2. "Ile kosztuje euro?" → getExchangeRate("EUR") → prawdziwy kurs z NBP
3. "Jakie święta są w Polsce w 2026?" → getHolidays("PL", 2026) → lista
4. "Ile to 15% z 2499?" → calculator → 374.85
5. "Jaki jest dzisiaj dzień tygodnia?" → currentDateTime → odpowiedź
6. "Czym jest sztuczna inteligencja?" → searchWikipedia → streszczenie
7. "Sprawdź pogodę w Warszawie i Krakowie, porównaj, i powiedz gdzie lepiej jechać" →
   - 🧠 Muszę sprawdzić pogodę w obu miastach
   - ⚡ getWeather("Warszawa") → 24°C
   - ⚡ getWeather("Kraków") → 21°C
   - 👁️ Warszawa cieplej
   - ✅ Rekomendacja: Warszawa
8. "Mam 10000 PLN. Przelicz na euro, dolary i franki. Zapisz wyniki." →
   - ⚡ 3x getExchangeRate + 3x calculator + saveNote
   - ✅ Przeliczenia + zapisane w notatkach

## Dlaczego to jest ważne
ReAct to serce nowoczesnych agentów. Różnica między chatbotem a agentem: chatbot odpowiada na pytania, agent **realizuje cele**. "Zaplanuj mi podróż" to nie pytanie — to zadanie. Agent ReAct sam decyduje co zrobić. A prawdziwe dane z API sprawiają że wynik jest weryfikowalny.
