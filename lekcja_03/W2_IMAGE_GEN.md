# Warsztat 2: Generator grafik AI

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_WEB_SEARCH.md i dodaj generowanie obrazów do mojego agenta"*

## Cel
Agent generuje obrazy na podstawie opisu. Logo, grafiki na social media, mockupy produktów. Darmowy model z AI Studio, ten sam klucz API.

## Kontekst
Google AI Studio udostępnia model **gemini-3.1-flash-lite-image** (Nano Banana 2 Lite) do generowania obrazów. Darmowy w free tier - nie trzeba włączać billingu ani podawać karty. Ten sam klucz API co w Lekcji 1.

## Co budujemy

### 1. Zainstaluj SDK do generowania obrazów

```
npm install @google/genai

To jest osobna biblioteka od @ai-sdk/google (Vercel AI SDK).
Vercel AI SDK obsługuje tekst i narzędzia.
@google/genai obsługuje generowanie obrazów.
Obie używają tego samego klucza GOOGLE_API_KEY.
```

### 2. Endpoint: `app/api/generate-image/route.ts`

```
Stwórz nowy endpoint POST /api/generate-image:

1. Odbierz prompt z body: { prompt: "opis obrazu" }

2. Wywołaj model obrazowy:
   - Użyj GoogleGenAI z @google/genai
   - Model: 'gemini-3.1-flash-lite-image'
   - Klucz: process.env.GOOGLE_API_KEY
   - Config: responseModalities zawierające TEXT i IMAGE

3. Wyciągnij obraz z odpowiedzi:
   - Przejdź po response.candidates[0].content.parts
   - Znajdź part z polem inlineData (to jest obraz w base64)
   - Znajdź part z polem text (komentarz modelu)

4. Zwróć JSON:
   {
     image: "data:image/png;base64,...",
     text: "komentarz modelu",
   }

5. Obsłuż błędy:
   - Brak promptu → 400
   - Błąd API → 500 z czytelnym komunikatem
   - Timeout 30s (generowanie trwa 5-15 sekund)
```

### 3. Strona: `app/generate/page.tsx`

```
Interfejs generatora grafik:

- Nagłówek: "🎨 Generator grafik AI"
- Podtytuł: "Opisz co chcesz - AI stworzy obraz w kilka sekund"

- Pole tekstowe (textarea, nie input)
  placeholder: "Opisz obraz który chcesz wygenerować..."

- Przycisk: "🎨 Generuj" (aktywny gdy jest tekst)

- Klikalne przykłady promptów:
  "Minimalistyczne logo kawiarni w stylu japońskim"
  "Post na Instagram: kawa latte art, ciepłe światło, widok z góry"
  "Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design"
  "Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design"
  "Infografika: 5 kroków do produktywności, pastelowe kolory"
  "Zdjęcie produktowe: elegancki zegarek na ciemnym tle"

- Stan ładowania:
  Pulsujący placeholder z tekstem "Generuję... (5-15 sekund)"

- Wynik:
  - Wygenerowany obraz (img z src=base64)
  - Komentarz modelu pod obrazem
  - Przycisk "💾 Pobierz" - download jako PNG
  - Przycisk "🔄 Ponownie" - ten sam prompt, nowy obraz

- Przycisk Pobierz - implementacja:
  Stwórz element <a> z href=base64, download="ai-generated.png", 
  wywołaj click() programatycznie.

- Dodaj do nawigacji: "🎨 Grafiki"
```

## Oczekiwany rezultat
- Strona /generate z interfejsem generatora
- Wpis opisu → obraz w kilka sekund
- Przycisk pobierania działa
- Klikalne przykłady inspirują

## Test

1. "Minimalistyczne logo kawiarni" → obraz logo
2. "Post na Instagram z kawą" → obraz w stylu social media
3. "Ikona aplikacji: robot AI" → ikona w stylu app store
4. Kliknij "Pobierz" → plik .png na dysku
5. Kliknij "Ponownie" → inny wariant tego samego promptu
