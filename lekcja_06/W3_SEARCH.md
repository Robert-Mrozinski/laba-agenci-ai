# Warsztat 3: Agent szuka w bazie wiedzy — narzędzie searchKnowledge

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_SEARCH.md i dodaj narzędzie searchKnowledge. Gdy ktoś pyta o cennik, ofertę lub regulamin, agent wyszukuje odpowiedź w Supabase zamiast zmyślać."*

## Cel
Dodać narzędzie `searchKnowledge` do agenta. Gdy użytkownik pyta o coś z dokumentów firmy (cennik, FAQ, regulamin) — agent wyszukuje odpowiedź w bazie wektorowej Supabase zamiast halucynować.

## Kontekst
W Warsztacie 1 włączyliśmy pgvector i stworzyliśmy tabelę `documents` z funkcją `match_documents`. W Warsztacie 2 zbudowaliśmy stronę `/upload` do wrzucania dokumentów. Teraz agent musi UMIEĆ szukać w tej bazie.

## Co budujemy

### 1. Narzędzie searchKnowledge

```
Dodaj nowe narzędzie (tool) do agenta — searchKnowledge:

Opis: "Wyszukuje informacje w bazie wiedzy firmy (cenniki, FAQ, regulaminy, oferty).
Używaj ZAWSZE gdy użytkownik pyta o:
- ceny, pakiety, koszty
- procedury, regulaminy, warunki
- FAQ, pytania o firmę/usługi
- cokolwiek co może być w dokumentach firmowych"

Parametry:
  query: string — pytanie użytkownika (np. "ile kosztuje pakiet premium")

Implementacja:
1. Wygeneruj embedding pytania (ten sam model text-embedding-004 co w /upload)
2. Wywołaj funkcję Supabase RPC 'match_documents':
   const { data } = await supabase.rpc('match_documents', {
     query_embedding: embedding,
     match_threshold: 0.5,
     match_count: 5
   })
3. Zwróć znalezione fragmenty:
   {
     results: [
       { title: "Cennik 2026", content: "Pakiet Premium: 299 zł...", similarity: 0.89 },
       { title: "FAQ", content: "Rezygnacja możliwa w dowolnym...", similarity: 0.72 }
     ],
     total_found: 2
   }

Jeśli nic nie znaleziono (total_found = 0):
   { results: [], total_found: 0, message: "Nie znaleziono informacji w bazie wiedzy." }
```

### 2. Zmodyfikuj system prompt agenta

```
Dodaj do system promptu:

"Masz dostęp do bazy wiedzy firmy przez narzędzie searchKnowledge.

ZASADY KORZYSTANIA Z BAZY WIEDZY:
1. Gdy użytkownik pyta o ceny, pakiety, oferty, regulamin, FAQ — ZAWSZE użyj searchKnowledge
2. Odpowiadaj TYLKO na podstawie znalezionych fragmentów — nie wymyślaj
3. Jeśli baza wiedzy nie zawiera odpowiedzi — powiedz wprost:
   'Nie mam tej informacji w bazie wiedzy. Skontaktuj się z [firma].'
4. NIE halucynuj — lepiej powiedzieć 'nie wiem' niż zmyślić cenę

PRIORYTET NARZĘDZI:
- Pytania o firmę/cennik/FAQ → searchKnowledge (NAJPIERW)
- Pytania ogólne → Google Search lub inne narzędzia
- Obliczenia → calculator"
```

### 3. Podłącz narzędzie do endpointu czatu

```
Dodaj searchKnowledge do listy tools w głównym endpoincie czatu
(app/api/chat/route.ts lub app/api/react/route.ts).

Narzędzie powinno działać RAZEM z istniejącymi narzędziami
(getWeather, getExchangeRate, calculator itd.).

Agent sam zdecyduje czy użyć searchKnowledge czy innego narzędzia
na podstawie pytania użytkownika.
```

## Oczekiwany rezultat
- Agent ma nowe narzędzie `searchKnowledge`
- Pytania o cennik → agent szuka w Supabase → odpowiada z dokumentu
- Pytania ogólne → agent używa Google Search lub innych narzędzi (jak dotychczas)
- Agent NIE halucynuje na tematy firmowe — odpowiada z bazy lub mówi "nie wiem"

## Test

**Przed testem:** Upewnij się że wrzuciłeś cennik w Warsztacie 2!

1. "Ile kosztuje pakiet Premium?" →
   - Agent wywołuje searchKnowledge("pakiet Premium cena")
   - Znajduje: "Pakiet Premium: 299 zł/miesiąc"
   - Odpowiada: **"Pakiet Premium kosztuje 299 zł/miesiąc"** ✅

2. "Co zawiera pakiet VIP?" →
   - Agent wywołuje searchKnowledge("pakiet VIP zawartość")
   - Odpowiada z TWOJEGO cennika: nielimitowani użytkownicy, 1 TB, wsparcie 24/7

3. "Czy mogę zrezygnować?" →
   - Agent wywołuje searchKnowledge("rezygnacja anulowanie")
   - Odpowiada: "Rezygnacja możliwa w dowolnym momencie" (z regulaminu)

4. "Jaka pogoda w Warszawie?" →
   - Agent NIE wywołuje searchKnowledge (to nie pytanie o firmę)
   - Używa getWeather("Warszawa") → pogoda (jak w L04)

5. "Ile kosztuje samochód Tesla?" →
   - Agent próbuje searchKnowledge → nic nie znajduje
   - Odpowiada: **"Nie mam tej informacji w bazie wiedzy."** ✅ (nie zmyśla!)

## Dlaczego to jest ważne
To jest **retrieval** — druga połowa RAG. Agent nie zgaduje — szuka w Twojej bazie wiedzy. To jest dokładnie to, co robią chatboty firm: chatbot banku zna regulaminy, chatbot sklepu zna cennik. Twój agent właśnie nauczył się tego samego — odpowiada z FAKTÓW, nie z wyobraźni.
