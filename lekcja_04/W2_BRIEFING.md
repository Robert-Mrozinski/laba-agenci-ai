# Warsztat 2: Asystent podróży — prawdziwy scenariusz biznesowy

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_BRIEFING.md i zbuduj asystenta podróży który planuje wyjazdy"*

## Cel
Agent ReAct jako asystent podróży — planuje wyjazdy używając prawdziwych danych: pogoda, waluty, święta, informacje o miastach. Scenariusz który każdy rozumie i może przetestować.

## Kontekst
W Warsztacie 1 dodaliśmy agentowi 8 nowych narzędzi (pogoda, waluty, święta, Wikipedia, kalkulator, czas, notatki) i zbudowaliśmy agenta ReAct na stronie /react.

Teraz budujemy SPECJALIZOWANĄ wersję tego agenta — asystenta podróży. Ten sam zestaw narzędzi, ale system prompt wyspecjalizowany w planowaniu podróży.

"Lecę do Berlina w piątek. Sprawdź pogodę, kurs euro, czy są święta w Niemczech, i co warto zobaczyć."

Jeden prompt → agent autonomicznie zbiera PRAWDZIWE dane z 4-5 źródeł → zwraca gotowy plan podróży.

## Co budujemy

### 1. Nowy endpoint: `app/api/travel/route.ts`

```
Stwórz endpoint z wyspecjalizowanym system promptem dla podróży:

Model: gemini-3.1-flash-lite z useSearchGrounding sterowanym zmienną ENABLE_SEARCH_GROUNDING (domyślnie wyłączony — patrz L03 W1)
maxSteps: 10
Wszystkie narzędzia z Warsztatu 1 (te same tools co w /api/react)

System prompt:
"Jesteś profesjonalnym asystentem podróży. Gdy użytkownik opisuje
planowaną podróż, AUTONOMICZNIE zbierasz wszystkie potrzebne informacje.

## TWÓJ PROCES:

Dla każdej podróży MUSISZ sprawdzić:
1. 🌤️ Pogodę w miejscu docelowym (getWeather)
2. 💶 Kurs lokalnej waluty (getExchangeRate)
3. 📅 Dni wolne/święta w kraju docelowym (getHolidays)
4. 📖 Informacje o mieście (searchWikipedia)
5. 🧮 Przeliczenie budżetu jeśli podany (calculator)

Po zebraniu danych, wygeneruj GOTOWY PLAN w formacie:

## 🗺️ Plan podróży: [MIASTO]

### 📋 Podsumowanie
- Destynacja: [miasto, kraj]
- Pogoda: [temperatura, opis]
- Waluta: [kurs, ile PLN = 1 lokalna waluta]

### 🌤️ Pogoda
[Szczegóły pogody + co spakować]

### 💰 Budżet
[Przeliczenia walutowe, orientacyjne koszty]

### 📅 Ważne daty
[Święta, dni wolne — co może być zamknięte?]

### 🏛️ Co zobaczyć
[Na podstawie Wikipedii i Google — główne atrakcje]

### ✅ Checklist przed wyjazdem
[Lista rzeczy do zrobienia/spakowania]

## ZASADY:
- Używaj PRAWDZIWYCH danych z narzędzi — nie zgaduj
- Jeśli narzędzie zwróci błąd — poinformuj i kontynuuj
- Bądź praktyczny — konkretne rady, nie ogólniki
- Podawaj ceny w PLN (przeliczone po aktualnym kursie)"
```

### 2. Nowa strona: `app/travel/page.tsx`

```
Interfejs "Asystent podróży":

- Nagłówek: "✈️ Asystent podróży AI"
- Podtytuł: "Powiedz dokąd jedziesz — agent zaplanuje wszystko"
- Placeholder: "Np. Lecę do Barcelony na weekend..."
- Endpoint: /api/travel

- Klikalne scenariusze:
  "Planuję weekend w Berlinie. Budżet: 2000 PLN"
  "Lecę do Paryża na tydzień w sierpniu"
  "Wycieczka do Pragi z rodziną na 3 dni"
  "Podróż służbowa do Londynu w przyszłym tygodniu"
  "Porównaj Barcelonę i Lizbonę na wakacje"

- Wynik renderuj jako ładne karty (nie surowy tekst):
  - Karta pogody z emoji i temperaturą
  - Karta walutowa z kursem i przelicznikiem
  - Karta świąt z flagą kraju
  - Karta atrakcji z listą miejsc
```

### 3. Tryb porównywania miast

```
Gdy użytkownik powie "porównaj X i Y":

Agent powinien sprawdzić pogodę, waluty i święta dla OBU miast,
a potem wygenerować tabelę porównawczą:

| Aspekt      | Barcelona    | Lizbona      |
|-------------|-------------|--------------|
| Pogoda      | 28°C ☀️     | 25°C 🌤️     |
| Waluta      | 1 EUR=4.28  | 1 EUR=4.28   |
| Święta      | Brak        | 1 (10 czerwca)|
| Polecam     | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐      |

+ rekomendacja agenta
```

### 4. Link w nawigacji

Dodaj "✈️ Podróże" do nawigacji.

## Oczekiwany rezultat
- Agent autonomicznie zbiera prawdziwe dane o destynacji
- Plan podróży zawiera: pogodę, walutę, święta, atrakcje, checklist
- Dane są PRAWDZIWE — student może zweryfikować pogodę na telefonie
- Tryb porównania dla niezdecydowanych

## Test

1. "Planuję weekend w Berlinie" →
   - 🌤️ getWeather("Berlin") → prawdziwa pogoda
   - 💶 getExchangeRate("EUR") → prawdziwy kurs
   - 📅 getHolidays("DE") → prawdziwe święta
   - 📖 searchWikipedia("Berlin") → informacje o mieście
   - ✅ Gotowy plan z checklistą

2. "Lecę do Londynu. Budżet 3000 PLN." →
   - 💶 getExchangeRate("GBP") → kurs funta
   - 🧮 calculator("3000 / [kurs]") → ile GBP
   - 🌤️ getWeather("London") → pogoda
   - ✅ Plan + budżet w funtach

3. "Porównaj Pragę i Wiedeń na długi weekend" →
   - 2x getWeather, 2x getHolidays, 2x searchWikipedia
   - getExchangeRate("CZK") + getExchangeRate("EUR")
   - ✅ Tabela porównawcza + rekomendacja

4. "Jadę do Japonii w kwietniu" →
   - getWeather("Tokyo") + getExchangeRate("JPY")
   - getHolidays("JP") → Golden Week!
   - searchWikipedia("Hanami") → sezon kwitnięcia wiśni
   - ✅ Plan z ostrzeżeniem o Golden Week

## Dlaczego to jest ważne
To jest scenariusz który **każdy rozumie** — nie trzeba znać programowania żeby docenić agenta który planuje podróż. "Powiedziałem mu że lecę do Berlina i dostałem gotowy plan z prawdziwą pogodą i kursem euro" — to jest zdanie które imponuje szefowi, znajomym, rodzinie.
