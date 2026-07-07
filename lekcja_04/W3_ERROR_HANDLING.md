# Warsztat 3: Obsługa błędów i limity — bezpieczny agent

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_ERROR_HANDLING.md i dodaj obsługę błędów i panel bezpieczeństwa do mojego agenta"*

## Cel
Agent musi być bezpieczny — nie może działać w nieskończoność, musi radzić sobie z błędami API, i musi informować użytkownika co poszło nie tak.

## Kontekst
Prawdziwe API czasem nie odpowiadają. Internet bywa wolny. Serwer pogodowy może leżeć. Agent musi na to reagować — nie zawieszać się, nie zapętlać, nie generować kosztów API w nieskończoność.

## Co budujemy

### 1. Timeout i retry w narzędziach

```
Zmodyfikuj WSZYSTKIE narzędzia które robią fetch() do zewnętrznych API:

1. Dodaj timeout 5 sekund do każdego fetch:
   const controller = new AbortController()
   const timeout = setTimeout(() => controller.abort(), 5000)
   const response = await fetch(url, { signal: controller.signal })
   clearTimeout(timeout)

2. Obsłuż błędy gracefully:
   try {
     // fetch...
   } catch (error) {
     if (error.name === 'AbortError') {
       return { error: "Timeout — serwer nie odpowiedział w 5 sekund. 
                Spróbuj ponownie." }
     }
     return { error: `Błąd połączenia: ${error.message}` }
   }

3. Sprawdź status HTTP:
   if (!response.ok) {
     return { error: `API zwróciło błąd ${response.status}. 
              Sprawdź parametry.` }
   }

Dotyczy: getWeather, getExchangeRate, getHolidays, 
searchWikipedia, readWebPage
```

### 2. Walidacja parametrów

```
Dodaj walidację do narzędzi:

getWeather:
  - Jeśli city jest pusty → "Podaj nazwę miasta"
  - Jeśli geocoding nie znajdzie miasta → "Nie znalazłem miasta [X]. 
    Sprawdź pisownię."

getExchangeRate:
  - Jeśli currency nie jest 3-literowa → "Podaj 3-literowy kod waluty 
    (np. EUR, USD)"
  - Jeśli NBP nie zna waluty → "Waluta [X] nie jest w tabeli NBP. 
    Popularne: EUR, USD, GBP, CHF"

getHolidays:
  - Jeśli country nie jest 2-literowy → "Podaj 2-literowy kod kraju 
    (np. PL, DE, US)"
  - Jeśli API nie zna kraju → "Nie znalazłem świąt dla kraju [X]. 
    Popularne: PL, DE, US, GB, FR"

calculator:
  - Jeśli wyrażenie zawiera import, require, eval, process → 
    "Wyrażenie zawiera niedozwolone znaki"
  - Jeśli obliczenie się nie uda → "Nie mogę obliczyć: [wyrażenie]"
```

### 3. Panel bezpieczeństwa w interfejsie

W `app/react/page.tsx` (i /travel, /agent):

```
Dodaj pod czatem panel "Diagnostyka":

┌─────────────────────────────────────────┐
│ 🛡️ Diagnostyka                         │
│                                         │
│ Kroki: ████████░░ 4/5                   │
│ Narzędzia: getWeather(2), calculator(1) │
│ Błędy: 0                               │
│ Czas: 3.2s                              │
│                                         │
│ ✅ Status: Zadanie ukończone            │
└─────────────────────────────────────────┘

Implementacja:
- Licznik kroków: progress bar, kolor zmienia się:
  1-3 → zielony, 4 → żółty, 5 → czerwony
- Lista narzędzi z liczbą wywołań
- Licznik błędów (jeśli toolInvocation.result zawiera "error")
- Timer od wysłania do zakończenia
- Status: "W trakcie..." / "Ukończone" / "⚠️ Limit kroków"

Jeśli narzędzie zwróciło błąd → pokaż alert:
  🔴 getWeather("Qwerty") — Nie znalazłem miasta Qwerty
```

### 4. System prompt z instrukcjami bezpieczeństwa

```
Dodaj do KAŻDEGO system prompta (chat, react, travel):

"## OBSŁUGA BŁĘDÓW:
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- Przykład: jeśli pogoda nie działa → 'Nie udało się sprawdzić pogody 
  w X. Mogę poszukać w Google lub spróbować innego miasta.'
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami 
  dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost 
  czego brakuje"
```

## Oczekiwany rezultat
- Narzędzia nie crashują przy błędnych danych — zwracają czytelne komunikaty
- Agent reaguje na błędy — próbuje inaczej lub informuje
- Panel diagnostyczny pokazuje ile kroków, ile błędów, ile czasu
- Timeout 5s chroni przed zawieszeniem na wolnym API

## Test

1. "Jaka pogoda w Qwerty?" → ładny błąd "Nie znalazłem miasta Qwerty"
2. "Ile kosztuje XYZ?" → "Waluta XYZ nie jest w tabeli NBP"
3. "Święta w ZZ na 2026?" → "Nie znalazłem świąt dla kraju ZZ"
4. "Oblicz import('os')" → "Wyrażenie zawiera niedozwolone znaki"
5. "Planuję podróż do Qwerty" → agent: "Nie znalazłem miasta Qwerty. Może chodziło Ci o...? Podaj pełną nazwę."
6. Normalny test: "Pogoda Warszawa + kurs euro" → działa bez błędów, panel pokazuje 2 kroki, 0 błędów

## Dlaczego to jest ważne
W produkcji API BĘDĄ padać. Internet BĘDZIE wolny. Użytkownik BĘDZIE wpisywać bzdury. Agent bez error handling to agent który crashuje przy pierwszym problemie. Z error handling — to agent który mówi "nie udało się, ale mogę spróbować inaczej". Profesjonalizm.
