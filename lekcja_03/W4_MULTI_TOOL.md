# Warsztat 4: Wszystkie narzędzia razem

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_MULTI_TOOL.md i zbuduj stronę agenta łączącą wszystkie narzędzia"*

## Cel
Strona "Pełna moc" - agent z dostępem do WSZYSTKICH narzędzi. Google Search, czytanie stron, generowanie obrazów, analiza screenshotów, kalkulator, czas. Sam decyduje których użyć.

## Co budujemy

### 1. Strona: `app/agent/page.tsx`

```
Interfejs centrum dowodzenia:

- Nagłówek: "🤖 Agent AI - Pełna moc"
- Podtytuł: "X narzędzi • autonomiczne decyzje"
  (X = liczba dostępnych narzędzi)

- Panel "Moje narzędzia" (sidebar lub top bar):
  🧮 Kalkulator         ✅ aktywny
  🕐 Data i czas        ✅ aktywny
  🌐 Google Search      ✅ aktywny
  📄 Czytanie stron     ✅ aktywny
  🎨 Generowanie obrazów ✅ aktywny
  👁️ Analiza obrazów    ✅ aktywny

- Klikalne scenariusze (złożone, łączące narzędzia):
  "Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo"
  "Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone"
  "Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto"
  "Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym"
  "Wyszukaj w Google 'best coffee shops Kraków' i streszcz wyniki"

- Obsługa Ctrl+V (z W3) - można wkleić screenshot
- Endpoint: /api/chat z WSZYSTKIMI narzędziami
- maxSteps: minimum 5
```

### 2. Narzędzie: generowanie obrazów w czacie

```
Dodaj generateImage jako tool do endpointu /api/chat:

Nazwa: generateImage
Opis: "Generuje obraz na podstawie opisu. Używaj gdy użytkownik 
prosi o logo, grafikę, ilustrację, post wizualny."
Parametry:
  - prompt (string): opis obrazu do wygenerowania

Wykonanie:
  - Wywołaj wewnętrznie model gemini-3.1-flash-lite-image
    (użyj @google/genai, tak jak w endpoincie /api/generate-image)
  - Zwróć base64 obrazu

Renderowanie w czacie:
  - Gdy wiadomość zawiera wynik z generateImage
  - Wyświetl obraz inline (img tag z src=base64)
  - Dodaj przycisk "💾 Pobierz"
```

### 3. Timeline narzędzi (wizualizacja)

```
Gdy agent używa wielu narzędzi, pokaż timeline:

┌──────────────────────────────────────────┐
│ 🤖 Agent wykonuje zadanie...             │
│                                          │
│ ① 🌐 Google Search                      │
│   → znaleziono 5 wyników o Syntelligence │
│                                          │
│ ② 📄 readWebPage(syntelligence.com)      │
│   → firma AI, CEO Paweł Paruzel...       │
│                                          │
│ ③ 🎨 generateImage("logo dla...")        │
│   → [wygenerowany obraz]                 │
│                                          │
│ 💬 Odpowiedź:                            │
│ Syntelligence to firma specjalizująca... │
│ Oto propozycja logo:                     │
│ [obraz]                                  │
└──────────────────────────────────────────┘

Implementacja:
- Iteruj po message.toolInvocations (z useChat)
- Dla każdego wywołania pokaż:
  numer → emoji narzędzia → nazwa(argumenty) → wynik
- Emoji: calculator → 🧮, currentDateTime → 🕐,
  readWebPage → 📄, generateImage → 🎨
- Kolorowe tła, animacja loading podczas wykonywania
```

### 4. Licznik narzędzi

```
Pod odpowiedzią agenta:
"Użyto 3 narzędzi | 4.2s | Model: gemini-3.1-flash-lite"

Zlicz toolInvocations. Czas od wysłania do końca.
```

### 5. Nawigacja - kompletna

```
Zaktualizuj nawigację o WSZYSTKIE strony z kursu:
- 🤖 Agent (/agent) - GŁÓWNA, wyróżniona
- 💬 Chat (/chat)
- 🧠 Myślenie (/think)
- 🌐 Szukaj (/search)
- 🎨 Grafiki (/generate)
- 👁️ Vision (/vision)
- 📊 Analizator (/extract)
- 📐 Formater (/format)

Agent powinien być wyróżniony jako główny tryb aplikacji.
```

## Oczekiwany rezultat
- Agent z 6+ narzędziami na jednej stronie
- Timeline pokazuje krok po kroku co agent zrobił
- Generowanie obrazów działa bezpośrednio w czacie
- Można wkleić screenshot (Ctrl+V) i zadać pytanie
- Klikalne scenariusze łączą wiele narzędzi

## Test

1. "Znajdź w Google co robi Syntelligence i wygeneruj logo" →
   Google Search + readWebPage + generateImage

2. "Ile to 23% VAT z 8500 PLN?" →
   calculator (8500 * 0.23 = 1955, brutto = 10455)

3. "Jakie są najnowsze newsy o AI? Wygeneruj grafikę do posta" →
   Google Search + generateImage

4. Screenshot strony → Ctrl+V → "Opisz ten design" →
   analiza obrazu

5. "Przeczytaj stronę laba.pl i powiedz czym się zajmują" →
   readWebPage

## Podsumowanie Lekcji 3

Po tych warsztatach Twój agent ma narzędzia:
- ✅ 🧮 Kalkulator (z L1)
- ✅ 🕐 Data i czas (z L1)
- ✅ 🌐 Google Search (NOWE - Gemini grounding)
- ✅ 📄 Czytanie stron WWW (NOWE)
- ✅ 🎨 Generowanie obrazów (NOWE - Nano Banana 2 Lite)
- ✅ 👁️ Analiza obrazów i screenshotów (NOWE - Ctrl+V)

## Praca domowa

Wybierz dowolny temat który Cię interesuje (AI, sport, kuchnia, podróże - cokolwiek).
Powiedz agentowi: znajdź najciekawsze informacje o tym w Google, wygeneruj grafikę
i napisz gotowy post na social media. Screenshot wyniku wyślij na czat kursu.
