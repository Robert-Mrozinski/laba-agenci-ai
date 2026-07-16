# Warsztat 2: Strona do wrzucania wiedzy — /upload

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_UPLOAD.md i zbuduj stronę /upload gdzie wklejam tekst, a apka dzieli go na fragmenty i zapisuje z wektorami w Supabase."*

## Cel
Strona `/upload` — wklejasz tekst (cennik, FAQ, regulamin) → apka dzieli go na fragmenty (chunki), generuje embeddingi przez API Gemini, i zapisuje wszystko w tabeli `documents` w Supabase.

## Kontekst
W Warsztacie 1 przygotowaliśmy tabelę `documents` z kolumną `embedding vector(768)` i funkcję `match_documents`. Teraz budujemy interfejs do wrzucania wiedzy.

Agent potrzebuje dokumentów żeby odpowiadać z faktów. Ty wklejasz cennik → apka przetwarza → agent zna cennik.

## Co budujemy

### 1. API endpoint do generowania embeddingów

```
Stwórz endpoint: app/api/embed/route.ts

Działanie:
1. Przyjmij POST z JSON: { text: string }
2. Wywołaj Google Generative AI Embedding API:
   - Model: "text-embedding-004" z @ai-sdk/google lub bezpośrednio przez fetch:
     POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
     z kluczem API z .env (GOOGLE_GENERATIVE_AI_API_KEY)
   - Body: { model: "models/text-embedding-004", content: { parts: [{ text: "..." }] } }
3. Zwróć wektor (tablica 768 liczb)

Alternatywnie: użyj @google/generative-ai SDK:
import { GoogleGenerativeAI } from "@google/generative-ai"
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
const model = genAI.getGenerativeModel({ model: "text-embedding-004" })
const result = await model.embedContent(text)
return result.embedding.values  // float[768]
```

### 2. Logika chunkowania (dzielenia tekstu)

```
Stwórz funkcję lib/chunking.ts:

splitIntoChunks(text: string, chunkSize: number = 500, overlap: number = 50): string[]

Algorytm:
1. Podziel tekst na zdania (po . ! ? + nowa linia)
2. Łącz zdania w fragmenty ~500 znaków
3. Każdy fragment ma overlap ~50 znaków z poprzednim (żeby nie tracić kontekstu)
4. Zwróć tablicę stringów (chunków)

Przykład:
Input: "Pakiet Basic kosztuje 99 zł. Pakiet Premium to 299 zł. Pakiet VIP kosztuje 599 zł i zawiera..."
Output: ["Pakiet Basic kosztuje 99 zł. Pakiet Premium to 299 zł.", "Pakiet Premium to 299 zł. Pakiet VIP kosztuje 599 zł i zawiera..."]

Prosty algorytm — nie trzeba ML. AI assistant napisze go łatwo.
```

### 3. API endpoint do ingestii dokumentu

```
Stwórz endpoint: app/api/upload-knowledge/route.ts

Przyjmij POST z JSON: { title: string, content: string }

Działanie:
1. Podziel content na chunki (splitIntoChunks)
2. Dla KAŻDEGO chunka:
   a. Wygeneruj embedding (wywołaj endpoint /api/embed lub bezpośrednio API)
   b. Zapisz w Supabase tabeli documents:
      - title: tytuł dokumentu
      - content: treść chunka
      - embedding: wektor [768 floatów]
      - metadata: { source: title, chunk_index: i, total_chunks: N }
3. Zwróć: { success: true, chunks_saved: N }

Przetwarzaj chunki sekwencyjnie (nie równolegle) żeby nie przekroczyć rate limit API.
Pokaż progress: "Przetwarzam fragment 3 z 12..."
```

### 4. Strona /upload

```
Stwórz stronę app/upload/page.tsx:

Nagłówek: "📚 Baza wiedzy"
Podtytuł: "Wklej tekst — agent będzie z niego korzystał"

Elementy:
1. Pole "Tytuł dokumentu" (input text)
   - Placeholder: "Np. Cennik 2026, FAQ, Regulamin firmy"

2. Pole "Treść dokumentu" (textarea, duże)
   - Placeholder: "Wklej tutaj treść dokumentu..."
   - Min. wysokość: 300px

3. Przycisk "📤 Zapisz w bazie wiedzy"
   - Po kliknięciu: wyślij do /api/upload-knowledge
   - Pokaż progress bar: "Przetwarzam fragment X z Y..."
   - Po zakończeniu: "✅ Zapisano 12 fragmentów!"

4. Lista zapisanych dokumentów (poniżej formularza):
   - Pobierz unikalne tytuły z tabeli documents
   - Dla każdego: tytuł, ile fragmentów, data dodania
   - Przycisk "🗑️ Usuń" (DELETE FROM documents WHERE title = ...)

Przykładowe dokumenty do wklejenia (jako podpowiedzi):
- Cennik: "Pakiet Basic: 99 zł/mies. Pakiet Premium: 299 zł/mies..."
- FAQ: "Q: Jak mogę anulować subskrypcję? A: Wyślij email na..."
- Regulamin: "§1. Postanowienia ogólne. 1.1 Niniejszy regulamin..."
```

### 5. Link w nawigacji

```
Dodaj "📚 Baza wiedzy" do nawigacji.
```

## Oczekiwany rezultat
- Strona /upload z formularzem (tytuł + treść)
- Wklejam tekst → apka dzieli na fragmenty → generuje embeddingi → zapisuje w Supabase
- Progress bar podczas przetwarzania
- Lista zapisanych dokumentów z możliwością usunięcia
- W Supabase Dashboard → tabela `documents` → widzę fragmenty z wektorami

## Test

1. Wklej ten cennik:
```
CENNIK USŁUG 2026

Pakiet Basic: 99 zł/miesiąc
- 5 użytkowników
- 10 GB miejsca
- Wsparcie email

Pakiet Premium: 299 zł/miesiąc
- 25 użytkowników
- 100 GB miejsca
- Wsparcie email + telefon
- Priorytetowa obsługa

Pakiet VIP: 599 zł/miesiąc
- Nielimitowani użytkownicy
- 1 TB miejsca
- Wsparcie 24/7
- Dedykowany opiekun
- Szkolenie wdrożeniowe

Wszystkie pakiety z 14-dniowym okresem próbnym.
Faktura VAT wystawiana automatycznie.
Rezygnacja możliwa w dowolnym momencie.
```

2. Kliknij "Zapisz w bazie wiedzy" → powinno zapisać ~3-5 fragmentów
3. Idź do Supabase Dashboard → Table Editor → `documents` → widzisz fragmenty z wektorami!
4. Wklej drugi dokument (FAQ) → pojawia się na liście obok cennika

## Dlaczego to jest ważne
To jest **ingestia** — pierwsza połowa RAG. Dokumenty firmy trafiają do bazy wektorowej, gotowe do wyszukiwania. W następnym warsztacie agent nauczy się szukać w tej bazie. Efekt: pytasz "ile kosztuje Premium?" → agent odpowiada "299 zł" — z TWOJEGO cennika, nie wymyślonego.
