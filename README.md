# AI Agents - Warsztaty

Materiały do kursu "Budowanie Agentów AI" (Laba).

## 🚀 Jak używać (Krok po kroku)

Ten kurs polega na **wydawaniu poleceń sztucznej inteligencji**, a nie na ręcznym pisaniu kodu. Twój asystent AI odwali całą "brudną robotę"! Oto jak będzie wyglądać Twoja praca:

1. **Pobierz materiały**: Ściągnij to repozytorium jako plik ZIP i wypakuj na swój komputer (np. na Pulpicie).
2. **Otwórz folder w AI**: Uruchom swojego asystenta AI (np. Codex Desktop, Claude Code lub Antigravity) i załaduj w nim główny, wypakowany folder kursu.
3. **Zleć zadanie**: Wybierz plik konkretnej lekcji i wyślij asystentowi w oknie czatu dokładne polecenie, na przykład:
   > *"Przeczytaj plik `lekcja_01/W1_CHATBOT.md` i zbuduj dokładnie to, co jest tam opisane."*
4. **Weryfikuj i naprawiaj**: AI wygeneruje kod. Uruchom aplikację (instrukcja poniżej). Jeśli cokolwiek nie działa, **nie próbuj naprawiać tego ręcznie!** Skopiuj błąd i napisz do AI: *"Kiedy próbuję uruchomić aplikację, dostaję taki błąd: [wklej błąd]. Napraw to."*
5. **Eksperymentuj!**: Gdy projekt działa, modyfikuj go po swojemu. Poproś AI o zmianę kolorów interfejsu, dodanie nowej funkcji lub zmianę osobowości bota. Baw się tym!

## Wymagania (Narzędzia)

Do ukończenia kursu będziesz potrzebować tylko kilku darmowych narzędzi:

1. **Node.js** (Środowisko uruchomieniowe)
   - [Pobierz i zainstaluj z nodejs.org](https://nodejs.org) (wymagana wersja 18 lub nowsza)

2. **Klucz API Google AI Studio** (Twój dostęp do sztucznej inteligencji)
   - [Odbierz darmowy klucz tutaj](https://aistudio.google.com) (kliknij "Get API Key")

3. **Asystent Programowania AI** (Wybierz JEDNO z poniższych środowisk):
   - **Codex Desktop** - [Pobierz z OpenAI](https://chatgpt.com/codex)
   - **Claude Code** (oficjalna apka desktopowa) - [Pobierz od Anthropic](https://claude.com/download)
   - **Antigravity** (platforma agent-first z wbudowanym IDE) - [Pobierz od Google](https://antigravity.google/)
   - *Opcja dla zaawansowanych:* Tradycyjny **VS Code** ([Pobierz](https://code.visualstudio.com/)) z wtyczką **Codex** lub **Claude Code**.

4. **Konto GitHub** (Platforma dla programistów)
   - [Załóż darmowe konto GitHub](https://github.com/signup) 
   - ⚠️ **Ważne:** Konto to będzie wymagane **dopiero od Lekcji 11**. Jeśli robisz wcześniejsze warsztaty, możesz ten krok na razie całkowicie pominąć!

> 🛑 **Czego NIE potrzebujesz:**  
> Nie musisz znać **Pythona**, ani ręcznie obsługiwać **Gita**. Do niczego Cię nie zmuszamy – wszystko opiera się na prostych rozmowach z AI!

## Struktura

```
lekcja_01/          ← Od LLM do agenta
  W0_SETUP.md       - Twój pierwszy klucz do AI (Node.js + API key)
  W1_CHATBOT.md     - Zbuduj chatbota AI od zera
  W2_PERSONA.md     - Nadaj agentowi osobowość
  W3_TRYBY.md       - Dodaj tryby rozmowy
  W4_PAMIEC.md      - Pamięć + eksport rozmowy

lekcja_02/          ← Inżynieria promptów
  W1_PERSONA_PRO.md - Profesjonalny prompt + przełącznik modeli
  W2_CHAIN_OF_THOUGHT.md - Myślenie krok po kroku
  W3_FEW_SHOT.md    - Słownik AI (few-shot prompting)
  W4_FORMATOWANIE.md - Komendy /tabela /lista /email

lekcja_03/          ← Narzędzia — ręce agenta
  W1_TOOL_CALLING.md - Google Search + czytanie stron WWW
  W2_IMAGE_GEN.md    - Generator grafik AI (Nano Banana 2 Lite)
  W3_VISION.md       - Analiza obrazów i screenshotów (Ctrl+V)
  W4_MULTI_TOOL.md   - Wszystkie narzędzia razem

lekcja_04/          ← Pętla rozumowania (ReAct)
  W1_REACT_LOOP.md   - Agent ReAct: Myśl → Działaj → Obserwuj
  W2_BRIEFING.md     - Asystent podróży (prawdziwe dane)
  W3_ERROR_HANDLING.md - Obsługa błędów i limity bezpieczeństwa
  W4_DASHBOARD.md    - Dashboard z live data (pogoda, waluty, święta)
```

## Jak otworzyć terminal (konsolę)

Aby uruchomić swój projekt lub przeprowadzić testy, musisz wpisać odpowiednie polecenia w terminalu. Jak go znaleźć?

- **Windows:** Wciśnij klawisz `Windows`, wpisz `cmd` i wybierz **Wiersz polecenia** (Command Prompt).
- **Mac:** Wciśnij `Cmd + Spacja`, wpisz `Terminal` i wciśnij Enter.
- **Wbudowany w edytor:** Jeśli korzystasz z asystentów takich jak Codex Desktop, Claude Code Desktop czy Antigravity, po prostu poszukaj zakładki z terminalem lub opcji `Terminal -> New Terminal`.

W otwartym oknie terminala wpisujesz komendy (np. `npm run dev` do uruchomienia aplikacji lub `npm test` dla testów) i zatwierdzasz klawiszem `Enter`.

> **Ważne:** Wszystkie komendy musisz wpisywać będąc **wewnątrz folderu swojego projektu**. Jeśli otworzysz zwykły terminal systemowy, najpierw przejdź do folderu z kodem za pomocą komendy `cd` (np. `cd Pulpit/moj-agent`). Terminal wbudowany w edytor zazwyczaj otwiera się od razu w odpowiednim miejscu.

## Jak uruchomić swojego Agenta (krok po kroku)

Kiedy AI wygeneruje dla Ciebie kod projektu, musisz go "odpalić", by móc zobaczyć efekt i zacząć testy:

1. **Wejdź do folderu z aplikacją**: W terminalu użyj komendy przejścia do folderu (`cd`), podając nazwę projektu. Jeśli nazwiesz go `moj-agent`, wpisz:
   ```bash
   cd moj-agent
   ```
2. **Zainstaluj zależności** (rób to tylko za pierwszym razem lub gdy dodajesz nową funkcję!):
   ```bash
   npm install
   ```
3. **Włącz serwer aplikacji**: Ta komenda uruchamia Twój program lokalnie na komputerze.
   ```bash
   npm run dev
   ```
4. **Gotowe! Wejdź na stronę**: Terminal wyświetli adres (najczęściej **http://localhost:3000**). Kliknij w ten link trzymając wciśnięty klawisz `Ctrl` (lub `Cmd` na Macu), albo skopiuj go i wklej do przeglądarki (np. Chrome/Edge).

💡 **Rozwiązywanie problemów (Gdy strona nie działa):**
- **Adres `127.0.0.1` a `localhost`**: To dokładnie to samo! Jeśli terminal wyświetla `http://127.0.0.1:3000`, to znaczy to samo co `http://localhost:3000`. Oba kierują na Twój własny komputer.
- **Błąd 404 lub "Nie można połączyć"? Sprawdź PORT!**
  Bardzo częstym błędem jest to, że wchodzisz z przyzwyczajenia na `localhost:3000`, podczas gdy Twój serwer uruchomił się na innym porcie (np. `:3001`, `:3002` lub `:5173`). Dzieje się tak, gdy np. port 3000 jest już przez coś zajęty. **Zawsze klikaj w adres, który pokazał się w Twoim terminalu po wpisaniu `npm run dev`!**
- **Wszystko wydaje się w porządku, ale strona nie odpowiada (zawieszony serwer)?**
  Zdarza się, że po napisaniu nowej paczki kodu przez AI serwer deweloperski potrafi się "zawiesić" w tle. Najszybsza recepta to tzw. **twardy restart**:
  1. Kliknij w czarne okienko terminala.
  2. Wciśnij **`Ctrl + C`**, aby natychmiast ubić serwer (jeśli zapyta o potwierdzenie, wciśnij `Y` i `Enter`). Możesz też używać tego po prostu, gdy chcesz wpisać inną komendę.
  3. Wpisz znów `npm run dev` i odśwież stronę.
- **Prawdziwe 404 na dobrym porcie**: Jeśli na 100% jesteś na właściwym porcie i widzisz "404 Not Found", to znaczy, że serwer działa, ale AI nie wygenerowało głównego widoku. Napisz wtedy: *"Widzę błąd 404 na dobrym porcie. Upewnij się, że utworzyłeś główny plik strony (np. app/page.tsx lub index) i napraw to"*.

## Zasady

- **Nie pisz kodu ręcznie** - opisz AI czego chcesz
- **Eksperymentuj** - zmień prompt, dodaj coś od siebie
- **Pytaj na czacie kursu** jeśli coś nie działa

## Przydatne

- [💰 Jak oszczędzać tokeny w AI Coding Assistantach](OSZCZEDZANIE_TOKENOW.md) - poradnik dla Claude Code, Codex i Antigravity
