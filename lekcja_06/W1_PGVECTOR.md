# Warsztat 1: Włącz pgvector — baza wektorowa w Supabase

> ⚠️ **Ten warsztat jest INNY niż pozostałe!**
> Tutaj NIE wklejamy promptu do AI assistanta.
> Prowadzący pokazuje na ekranie — Ty klikasz krok po kroku.

## Cel
Włączyć rozszerzenie pgvector w Supabase i stworzyć tabelę do przechowywania fragmentów dokumentów z ich wektorami (embeddingami).

## Kontekst
Po Lekcji 5 Twój agent pamięta rozmowy i Twoje imię. Ale gdy zapytasz go o cennik Twojej firmy — wymyśli odpowiedź (halucynacja). Nie ma skąd wiedzieć ile kosztuje Twój produkt.

Rozwiązanie: **RAG (Retrieval-Augmented Generation)** — wklej dokumenty firmy do bazy, a agent będzie szukał w nich odpowiedzi zamiast zmyślać.

Pierwszy krok: włączymy **pgvector** — rozszerzenie PostgreSQL które pozwala przechowywać i wyszukiwać wektory (embeddingi).

## Co to są embeddingi? (uprościone)

Wyobraź sobie że każde zdanie ma "adres" w przestrzeni znaczeń:
- "Ile kosztuje pakiet Premium?" → adres: [0.23, 0.87, 0.12, ...]
- "Jaka jest cena VIP?" → adres: [0.25, 0.85, 0.14, ...] ← BLISKO!
- "Jaka pogoda w Warszawie?" → adres: [0.91, 0.02, 0.76, ...] ← DALEKO

Embedding to taki "adres znaczeniowy". Pytania o podobne rzeczy mają podobne adresy. pgvector pozwala szukać "najbliższych adresów" — czyli najbardziej pasujących fragmentów dokumentu.

## Krok po kroku

### 1. Włącz pgvector w Supabase
- Otwórz Supabase Dashboard
- W menu po lewej kliknij **Database**
- Kliknij **Extensions**
- W polu wyszukiwania wpisz **"vector"**
- Znajdź **pgvector** → kliknij przełącznik **Enable**
- Gotowe — Twoja baza umie wektory!

### 2. Stwórz tabelę `documents` (baza wiedzy)
- Kliknij **Table Editor** → **Create a new table**
- Name: `documents`
- Odznacz RLS (na razie)
- Kolumny:

| Nazwa kolumny | Typ | Domyślna wartość | Uwagi |
|---------------|-----|-------------------|-------|
| `id` | `uuid` | `gen_random_uuid()` | ✅ Primary Key |
| `created_at` | `timestamptz` | `now()` | |
| `title` | `text` | (puste) | Nazwa dokumentu (np. "Cennik 2026") |
| `content` | `text` | (puste) | Fragment tekstu dokumentu |
| `embedding` | `vector(768)` | (puste) | Wektor znaczeniowy (768 wymiarów dla Gemini) |
| `metadata` | `jsonb` | `{}` | Dodatkowe info (typ dokumentu, data, autor) |

- Kliknij **"Save"**

> 💡 **Uwaga:** Typ `vector(768)` może nie być dostępny w GUI. Jeśli tak — prowadzący pokaże jak dodać kolumnę przez SQL Editor:
> ```sql
> ALTER TABLE documents ADD COLUMN embedding vector(768);
> ```

### 3. Stwórz funkcję wyszukiwania (SQL)
- Kliknij **SQL Editor** w menu po lewej
- Wklej ten SQL i kliknij **Run**:

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

- Powinieneś zobaczyć: **Success. No rows returned** — to dobrze!

### 4. Sprawdź
- Table Editor → tabela `documents` → pusta, ale z kolumną `embedding`
- SQL Editor → wpisz `SELECT * FROM documents;` → puste, ale działa

## Oczekiwany rezultat
- ✅ pgvector włączony w Supabase
- ✅ Tabela `documents` z kolumną `embedding vector(768)`
- ✅ Funkcja `match_documents` gotowa do wyszukiwania
- ✅ Wszystko puste — gotowe na dane z Warsztatu 2

## Typowe problemy

| Problem | Rozwiązanie |
|---------|-------------|
| "Nie widzę pgvector w Extensions" | Sprawdź czy masz plan Free (pgvector jest dostępny na Free) |
| "Typ vector nie istnieje" | pgvector nie jest włączony — wróć do kroku 1 |
| "Błąd w SQL" | Skopiuj dokładnie — zwróć uwagę na cudzysłowy i nawiasy |
| "Jaki rozmiar wektora: 768 czy 1536?" | 768 dla Gemini text-embedding-004. Dla OpenAI byłoby 1536. |

## Dlaczego to jest ważne
Właśnie przygotowałeś fundament pod RAG — Retrieval-Augmented Generation. To ta sama technologia, którą używają chatboty firm (np. chatbot banku który zna regulaminy, chatbot sklepu który zna cennik). Twój agent za chwilę będzie odpowiadał z TWOICH dokumentów zamiast zmyślać.
