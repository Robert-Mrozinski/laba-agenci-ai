# Warsztat 3: Analiza obrazów i screenshotów

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_EMAIL_TOOL.md i dodaj analizę obrazów do mojego agenta - Ctrl+V ze schowka, upload pliku i drag & drop"*

## Cel
Agent przyjmuje obrazy na trzy sposoby: Ctrl+V ze schowka, upload pliku, drag & drop. Analizuje co widzi, wyciąga tekst, odpowiada na pytania o obrazie.

## Kontekst
Gemini Flash obsługuje obrazy natywnie - wystarczy wysłać obraz jako część wiadomości. Nie trzeba dodatkowych bibliotek ani konfiguracji. Ten sam model i klucz co w czacie.

## Co budujemy

### 1. Obsługa Ctrl+V (screenshot ze schowka)

```
W komponencie czatu dodaj obsługę wklejania obrazów:

1. Nasłuchuj na event 'paste' na polu tekstowym:
   - Sprawdź clipboardData.items
   - Jeśli któryś item ma type zaczynający się od 'image/'
   - Weź go jako File, wczytaj przez FileReader jako base64
   - Zapisz w state (np. attachedImage)

2. Podgląd wklejonego obrazu:
   - Miniaturka nad polem tekstowym (max-height: 120px)
   - Przycisk X żeby usunąć
   - Tekst: "📎 Screenshot - zadaj pytanie o ten obraz"

3. Przy wysyłaniu wiadomości dołącz obraz:
   - Wyślij jako część body: { message, image: base64String }

WAŻNE: Win+Shift+S (Windows) lub Cmd+Shift+4 (Mac) robi 
screenshot do schowka. Potem Ctrl+V w czacie agenta. 
Musi działać płynnie, bez dodatkowych kliknięć.
```

### 2. Upload pliku i drag & drop

```
Dodaj dwa dodatkowe sposoby wrzucania obrazów:

1. Przycisk upload (📎):
   - Input type="file" accept="image/*" - ukryty
   - Ładny przycisk z ikoną spinacza obok pola tekstowego
   - Po wybraniu pliku: wczytaj jako base64, pokaż podgląd

2. Drag & drop:
   - Nasłuchuj onDragOver i onDrop na obszarze czatu
   - Gdy użytkownik przeciąga plik: pokaż overlay "Upuść obraz"
   - Po upuszczeniu: wczytaj jako base64, pokaż podgląd

3. Walidacja:
   - Akceptuj: PNG, JPG, JPEG, GIF, WEBP
   - Max rozmiar: 4MB
   - Za duży → komunikat "Max 4MB. Zrób screenshot fragmentu."
```

### 3. Endpoint czatu z obsługą obrazów

```
Zmodyfikuj endpoint /api/chat/route.ts:

Gdy request zawiera obraz (pole image w body):
1. Stwórz wiadomość multimodalną:
   content: [
     { type: 'image', image: base64Data },
     { type: 'text', text: userMessage }
   ]

2. Gemini automatycznie widzi i analizuje obraz.
   Nie trzeba specjalnego modelu - gemini-3.1-flash-lite 
   obsługuje obrazy natywnie.
```

### 4. Strona: `app/vision/page.tsx`

```
Dedykowana strona do analizy obrazów:

- Nagłówek: "👁️ Agent Vision"
- Podtytuł: "Wklej screenshot, wrzuć plik lub przeciągnij obraz"

- Duża strefa paste/drop na środku (przed pierwszym obrazem):
  "📸 Ctrl+V - wklej screenshot"
  "📁 Kliknij - wybierz plik"  
  "🖱️ Przeciągnij - upuść obraz"

- Po wrzuceniu obrazu: podgląd + pole pytania + klikalne pytania:
  "Co widzisz na tym obrazie?"
  "Wyciągnij cały tekst z tego screena"
  "Opisz to w 3 zdaniach"
  "Jakie kolory dominują? Podaj kody HEX"
  "Wygeneruj podobny obraz w innym stylu"

- Ostatnia opcja ("Wygeneruj podobny"):
  Agent opisuje co widzi, modyfikuje opis wg instrukcji,
  wywołuje /api/generate-image z nowym promptem.
  Wyświetla oryginał obok nowej wersji.

- Dodaj do nawigacji: "👁️ Vision"
```

### 5. Dodaj obsługę obrazów do istniejących czatów

```
We WSZYSTKICH stronach czatowych (/chat, /search, /agent):
- Dodaj obsługę paste (Ctrl+V) 
- Dodaj przycisk upload (📎)
- Użytkownik może wkleić screenshot w dowolnym czacie
```

## Oczekiwany rezultat
- Ctrl+V w dowolnym czacie wkleja screenshot jako załącznik
- Drag & drop i przycisk upload działają
- Agent opisuje, analizuje i odpowiada na pytania o obrazie
- Strona /vision z dedykowanym interfejsem

## Test

1. Win+Shift+S dowolnego okna → Ctrl+V w czacie → "Co widzisz?" → opis
2. Screenshot tekstu → "Wyciągnij cały tekst" → OCR
3. Zdjęcie produktu → "Napisz opis na Allegro" → opis sprzedażowy
4. Screenshot strony → "Jakie kolory? Podaj HEX" → paleta kolorów
5. Logo → "Zrób podobne ale ciemniejsze" → nowy obraz obok oryginału
6. Screenshot błędu z konsoli → "Jak naprawić?" → rozwiązanie
