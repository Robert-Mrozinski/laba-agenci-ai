# Warsztat 0: Optymalizacja kosztów API

> 📋 **Skopiuj i wklej do swojego AI coding assistanta:**
> *"Przeczytaj plik W0_KLUCZ_API.md i wprowadź WSZYSTKIE opisane zmiany w moim projekcie."*

## Cel

Przełączyć agenta na najtańsze modele i wyłączyć płatne funkcje.

## Zmiany do wprowadzenia

### 1. Domyślny model: `gemini-3.1-flash-lite` (najtańszy)

Zamień WSZYSTKIE wystąpienia modeli w CAŁYM projekcie:

```
ZAMIEŃ (KAŻDE z poniższych):
  google('gemini-3.5-flash')
  google('gemini-2.5-flash')  
  google('gemini-3.5-flash', { ... })
  google('gemini-2.5-flash', { ... })
  google('gemini-3-flash')

NA:
  google('gemini-3.1-flash-lite')

BEZ ŻADNYCH OPCJI — sam model, nic więcej.
```

Przejdź KAŻDY plik w `app/api/` i zamień.

### 2. Search Grounding — domyślnie WYŁĄCZONY (płatne!)

Search Grounding to najdroższa funkcja — $14 za 1000 wyszukiwań. Zamień hardcoded `useSearchGrounding: true` na **przełącznik przez zmienną środowiskową** — domyślnie wyłączony.

```
ZNAJDŹ WSZĘDZIE:
  google('gemini-2.5-flash', { useSearchGrounding: true })
  lub
  google('gemini-3.5-flash', { useSearchGrounding: true })
  lub jakikolwiek model z { useSearchGrounding: true }

ZAMIEŃ NA:
  google('gemini-3.1-flash-lite', {
    useSearchGrounding: process.env.ENABLE_SEARCH_GROUNDING === 'true'
  })
```

Dodatkowo, w KAŻDYM pliku route.ts gdzie jest useSearchGrounding, DODAJ na górze pliku (po importach):

```typescript
if (process.env.ENABLE_SEARCH_GROUNDING === 'true') {
  console.warn(
    '⚠️ UWAGA: Search Grounding jest WŁĄCZONY. ' +
    'To jest najdroższa funkcja API ($14/1000 zapytań). ' +
    'Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, ' +
    'bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.'
  );
}
```

W pliku `.env.local` NIE dodawaj `ENABLE_SEARCH_GROUNDING` — domyślnie jest wyłączony. Student który chce przetestować wyszukiwanie, musi sam dodać linijkę:
```
ENABLE_SEARCH_GROUNDING=true
```
I zobaczy ostrzeżenie w konsoli serwera.

Agent nadal ma narzędzie `readWebPage` — to jest darmowe i wystarczające na co dzień.

### 3. Model obrazów: `gemini-3.1-flash-lite-image` (bezpłatny)

Jeśli projekt ma generowanie obrazów, upewnij się że model to:
```
gemini-3.1-flash-lite-image
```
NIE żaden droższy (nie `pro`, nie `flash` bez `lite`).

### 4. Model embeddingów: `text-embedding-004` (bezpłatny)

Jeśli projekt ma embeddingi, upewnij się że model to:
```
text-embedding-004
```

### 5. Ochrona przed pętlami

W KAŻDYM wywołaniu `streamText()` lub `generateText()` dodaj:
```
maxSteps: 3
```

W komponencie czatu: upewnij się że przycisk "Wyślij" jest zablokowany gdy `isLoading === true`. Usuń wszelkie `useEffect` które automatycznie wywołują `handleSubmit` lub `append`.

## Weryfikacja

Po zmianach uruchom te komendy w terminalu:

```bash
grep -r "useSearchGrounding: true" app/
# OCZEKIWANE: brak wyników (hardcoded true nie powinno istnieć)

grep -r "ENABLE_SEARCH_GROUNDING" app/api/
# OCZEKIWANE: wynik w plikach które miały grounding (teraz przez env var)

grep -r "gemini-3.5-flash\|gemini-2.5-flash\|gemini-2.5-pro\|gemini-3.5-pro" app/
# OCZEKIWANE: brak wyników

grep -r "maxSteps" app/api/
# OCZEKIWANE: wynik w każdym route.ts
```

Jeśli którykolwiek check nie przechodzi — napraw.

## Podsumowanie zmian

| Co | Przed | Po |
|----|-------|----|
| Model czatu | gemini-3.5-flash / gemini-2.5-flash | **gemini-3.1-flash-lite** (bezpłatny) |
| Search Grounding | WŁĄCZONE na stałe | **Przełącznik** (env var, domyślnie WYŁĄCZONY + warning) |
| Model obrazów | gemini-3.1-flash-lite-image | **gemini-3.1-flash-lite-image** (bezpłatny) |
| Embeddingi | text-embedding-004 | **text-embedding-004** (bezpłatny) |
| Ochrona pętli | brak | **maxSteps: 3** |
