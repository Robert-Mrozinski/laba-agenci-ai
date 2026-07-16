# Warsztat 1: Profesjonalna persona - lepszy niż ChatGPT

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_PERSONA_PRO.md i przeprojektuj mojego agenta na profesjonalnego eksperta z przełącznikiem modeli"*

## Cel
Zaprojektuj system prompt który sprawi że twój agent w TWOJEJ dziedzinie odpowiada lepiej niż ChatGPT.

## Co zmieniamy
Plik: `app/api/chat/route.ts` - system prompt

## Nowy system prompt - pełna specyfikacja

Zastąp obecny system prompt tym szablonem. Wypełnij pola w nawiasach kwadratowych:

```
# [IMIĘ AGENTA] - [PEŁNA ROLA, np. "Specjalista ds. kadr i prawa pracy"]

## KIM JESTEM
Jestem [ROLA] z [X]-letnim doświadczeniem w [BRANŻA]. 
Specjalizuję się w [2-3 konkretne specjalizacje].
Pracowałem z [typ klientów/firm].

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** - potwierdzam zrozumienie pytania (1 zdanie)
2. 🔍 **Analiza** - merytoryczna odpowiedź (max 2 akapity)
3. ✅ **Rekomendacja** - konkretne działanie do podjęcia (1-3 punkty)
4. ❓ **Pytanie** - jedno pytanie pogłębiające do użytkownika

### Zasady:
- ZANIM odpowiem na złożone pytanie - pytam o kontekst
- Gdy podaję fakty - oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu
- Używam list numerowanych dla kroków, punktowanych dla opcji
- Maksymalnie 3 akapity + rekomendacja

### Styl:
- Język: polski
- Ton: [profesjonalny ale przystępny / bezpośredni / ciepły i motywujący]
- Gdy używam terminu branżowego - wyjaśniam w nawiasie

## CZEGO NIE ROBIĘ
- Nie odpowiadam na pytania spoza mojej dziedziny - mówię wprost i proponuję co MOGĘ zrobić
- Nie udaję że wiem coś, czego nie wiem
- Nie udzielam porad prawnych/medycznych/finansowych (chyba że to moja rola), 
  odsyłam do specjalisty
```

## Zmiany w interfejsie

W pliku `app/page.tsx`:
- Zmień tytuł strony na imię agenta + rola
- Pod nagłówkiem dodaj 1-zdaniowy opis: "Ekspert od [DZIEDZINA]. Zapytaj mnie o..."
- Dodaj 3-4 przykładowe pytania jako klikalne przyciski pod opisem
  (pytania z dziedziny agenta, np. "Ile dni urlopu przysługuje na umowie o pracę?")

## Dodaj przełącznik modeli AI

W API (`app/api/chat/route.ts`):
- Dodaj obsługę dwóch modeli Google (ten sam klucz API):
  - `gemini-3.1-flash-lite` - szybki, do codziennych pytań
  - `gemini-3.1-pro-preview` - zaawansowany, do złożonych analiz
- Endpoint przyjmuje parametr `model` z body requestu (domyślnie "flash")

W interfejsie (`app/page.tsx`):
- Dodaj przełącznik nad czatem: dwa przyciski
  - ⚡ Flash (szybki) - domyślny
  - 🧠 Pro (zaawansowany)
- Aktywny przycisk podświetlony
- Przy wiadomości AI pokaż małą etykietę z użytym modelem

Oba modele są darmowe - ten sam klucz Google AI Studio.

## Test porównawczy

1. Zadaj to samo pytanie w trybie **⚡ Flash** i **🧠 Pro** - który dał lepszą odpowiedź?
2. Zadaj to samo pytanie ChatGPT - porównaj ze swoim agentem
3. Porównaj:
   - Który dał bardziej strukturalną odpowiedź?
   - Który zadał pytanie pogłębiające?
   - Który był bardziej konkretny?
   - Flash vs Pro - widzisz różnicę w jakości?

## Oczekiwany rezultat
- Agent odpowiada w dokładnie zdefiniowanym formacie
- Każda odpowiedź ma 4 sekcje (kontekst, analiza, rekomendacja, pytanie)
- Agent odmawia pytań spoza kompetencji
- Przykładowe pytania w interfejsie ułatwiają start rozmowy
