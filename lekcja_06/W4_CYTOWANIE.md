# Warsztat 4: Agent cytuje źródła — i mówi "nie wiem"

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_CYTOWANIE.md i zrób żeby agent podawał z którego dokumentu pochodzi odpowiedź. Gdy nie ma danych w bazie — mówi wprost że nie wie."*

## Cel
Agent cytuje źródła swoich odpowiedzi (z jakiego dokumentu, kiedy dodanego). Gdy baza wiedzy nie zawiera odpowiedzi — agent odmawia odpowiedzi zamiast halucynować.

## Kontekst
W Warsztacie 3 agent zaczął szukać w bazie wiedzy. Ale nie mówi SKĄD wie. A gdy nie znajduje odpowiedzi — może nadal zmyślać. Teraz to naprawiamy.

## Co budujemy

### 1. Cytowanie źródeł w odpowiedzi

```
Zmodyfikuj system prompt agenta — dodaj instrukcje cytowania:

"CYTOWANIE ŹRÓDEŁ:
Gdy odpowiadasz na podstawie bazy wiedzy, ZAWSZE podaj źródło:

Format: Na końcu odpowiedzi dodaj:
📎 Źródło: [tytuł dokumentu]

Przykład:
'Pakiet Premium kosztuje 299 zł/miesiąc i zawiera 25 użytkowników,
100 GB miejsca oraz wsparcie email i telefoniczne.

📎 Źródło: Cennik 2026'

Jeśli odpowiedź łączy dane z wielu dokumentów, cytuj wszystkie:
📎 Źródła: Cennik 2026, FAQ"
```

### 2. Rozszerzenie wyniku searchKnowledge

```
Zmodyfikuj narzędzie searchKnowledge żeby zwracało więcej danych:

{
  results: [
    {
      title: "Cennik 2026",
      content: "Pakiet Premium: 299 zł...",
      similarity: 0.89,
      metadata: { source: "Cennik 2026", chunk_index: 2, total_chunks: 5 },
      added_at: "2026-07-13"
    }
  ],
  total_found: 1,
  source_documents: ["Cennik 2026"]  // unikalne tytuły
}

Agent dostaje informację O ŹRÓDLE — wie co cytować.
```

### 3. Odmowa odpowiedzi gdy brak danych

```
Zmodyfikuj system prompt:

"ODMOWA ODPOWIEDZI:
Gdy searchKnowledge zwróci 0 wyników LUB similarity < 0.5:
1. NIE próbuj odpowiadać z ogólnej wiedzy
2. Powiedz wprost:
   'Nie mam informacji na ten temat w mojej bazie wiedzy.
   Skontaktuj się z [nazwa firmy] bezpośrednio.'
3. Opcjonalnie zaproponuj pytanie które MOŻESZ odpowiedzieć:
   'Mogę za to odpowiedzieć na pytania o cennik, pakiety i warunki usługi.'

WYJĄTEK: Pytania OGÓLNE (pogoda, kurs walut, Wikipedia) — odpowiadaj normalnie
używając innych narzędzi. Odmowa dotyczy TYLKO tematów firmowych."
```

### 4. Wizualne wyróżnienie źródeł w UI

```
W interfejsie czatu, gdy odpowiedź agenta zawiera "📎 Źródło:" lub "📎 Źródła:":
- Wyświetl jako osobny element pod odpowiedzią
- Styl: mniejszy tekst, szary kolor, ikona dokumentu
- Opcjonalnie: klikalne — link do strony /upload z podświetlonym dokumentem

Przykład renderowania:
┌─────────────────────────────────────┐
│ Pakiet Premium kosztuje 299 zł/mies│
│ i zawiera 25 użytkowników...       │
│                                     │
│ 📎 Źródło: Cennik 2026             │
└─────────────────────────────────────┘
```

### 5. Strona /knowledge — podgląd bazy wiedzy

```
Rozszerz stronę /upload (lub stwórz /knowledge):

Sekcja "Twoja baza wiedzy":
- Lista dokumentów z liczbą fragmentów
- Po kliknięciu na dokument → podgląd fragmentów
- Status: "12 fragmentów z 3 dokumentów"
- Wyszukiwarka: "Szukaj w bazie wiedzy..." → testuje search BEZ agenta
  (wpisz pytanie → pokaż najlepiej pasujące fragmenty z similarity score)

To pozwala zweryfikować czy RAG działa PRZED rozmową z agentem.
```

## Oczekiwany rezultat
- Agent cytuje źródło: "📎 Źródło: Cennik 2026"
- Gdy nie ma danych → odmawia: "Nie mam informacji na ten temat w bazie wiedzy."
- Źródła wyróżnione wizualnie w UI
- Strona /knowledge z podglądem bazy i wyszukiwarką

## Test

1. "Ile kosztuje Premium?" →
   - Odpowiedź: "299 zł/miesiąc" + **"📎 Źródło: Cennik 2026"** ✅

2. "Jakie są warunki rezygnacji?" →
   - Odpowiedź z FAQ/regulaminu + **cytowanie źródła** ✅

3. "Ile kosztuje Netflix?" →
   - Agent szuka w bazie → 0 wyników
   - **"Nie mam informacji o cenach Netflix w mojej bazie wiedzy."** ✅
   - NIE wymyśla ceny!

4. "Jaka pogoda w Krakowie?" →
   - Agent NIE odmawia (to nie temat firmowy)
   - Używa getWeather → prawdziwa pogoda ✅

5. Na stronie /knowledge:
   - Wpisuję "VIP" w wyszukiwarkę → widzę fragment cennika z similarity 0.92 ✅

## Dlaczego to jest ważne
Cytowanie źródeł to **zaufanie**. Gdy agent mówi "Pakiet VIP kosztuje 599 zł" — skąd wiesz że nie zmyślił? Źródło: "Cennik 2026" — teraz wiesz. A odmowa odpowiedzi to **uczciwość** — lepiej powiedzieć "nie wiem" niż podać zmyśloną cenę. To różni profesjonalnego agenta od zabawki.
