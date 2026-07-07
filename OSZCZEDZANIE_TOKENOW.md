# Jak oszczędzać tokeny w AI Coding Assistantach

> Każdy AI asystent ma limity - najczęściej w oknie 5-godzinnym. Na warsztacie (2h) nie powinno zabraknąć, ale warto znać triki żeby nie marnować tokenów na głupoty.

---

## Claude Code

### Jak działają limity
- **Plan Pro ($20/mies):** limit w oknie 5-godzinnym (rolling window)
- **Sonnet 4:** ~200 wiadomości / 5h - zalecany na warsztaty
- **Opus:** ~45 wiadomości / 5h - używaj tylko do architektury
- Reset: co 5h od pierwszej wiadomości

### Komendy które musisz znać

| Komenda | Co robi | Kiedy używać |
|---|---|---|
| `/compact` | Kompresuje historię rozmowy do streszczenia | Gdy sesja się ciągnie i zwalnia |
| `/clear` | Czyści całą historię | Przed nowym warsztatem |
| `/model sonnet` | Przełącza na tańszy model | Na codzień (domyślnie) |
| `/model opus` | Przełącza na mocniejszy model | Tylko gdy Sonnet nie daje rady |
| `/usage` | Pokazuje ile tokenów zużyłeś | Sprawdź co jakiś czas |

### Top 5 zasad oszczędzania

1. **`/clear` między warsztatami**
   Po skończeniu W1 zrób `/clear` zanim zaczniesz W2. Historia z W1 jest już niepotrzebna - a każda wiadomość niesie ze sobą cały kontekst.

2. **Wklej plik .md, nie opisuj słowami**
   ❌ "Dodaj mi Google Search do agenta, żeby szukał w internecie i czytał strony..."
   ✅ "Przeczytaj plik W1_TOOL_CALLING.md i zaimplementuj wszystko co tam jest"

3. **Nie pisz "proszę", "dziękuję", "czy mógłbyś"**
   Każde słowo to tokeny. Pisz krótko i konkretnie.
   ❌ "Cześć! Czy mógłbyś proszę dodać mi obsługę wklejania obrazów ze schowka?"
   ✅ "Dodaj obsługę Ctrl+V dla obrazów ze schowka w komponencie czatu"

4. **Używaj CLAUDE.md**
   Stwórz plik `CLAUDE.md` w katalogu projektu z instrukcjami które się powtarzają:
   ```
   - Projekt: Next.js 15 + Vercel AI SDK + Gemini
   - Język: TypeScript
   - Styl: używaj 'use client' tylko gdy potrzebne
   - Klucz API: GOOGLE_API_KEY z .env.local
   ```
   Claude czyta ten plik automatycznie - nie musisz powtarzać tego w każdym prompcie.

5. **Nie iteruj w nieskończoność**
   Jeśli Claude nie rozwiązuje problemu po 2-3 próbach, zrób `/clear`, opisz problem od nowa z kontekstem błędu. Ciągłe poprawianie w tej samej sesji zjada tokeny wykładniczo.

### Checklist na warsztat
```
□ /clear przed nowym warsztatem
□ Sonnet (nie Opus) jako domyślny model
□ CLAUDE.md z podstawowymi instrukcjami
□ Wklej .md zamiast opisywać słowami
□ /compact gdy sesja przekracza ~15 wiadomości
```

---

## OpenAI Codex

### Jak działają limity
- **ChatGPT Plus ($20/mies):** limit dzienno-godzinny
- **Bring Your Own Key:** płacisz za tokeny
- Sprawdź limit: `/status` lub chatgpt.com/codex/settings/usage
- Koduje w sandboxie - każde zadanie = osobna sesja

### Komendy które musisz znać

| Komenda | Co robi | Kiedy używać |
|---|---|---|
| `/status` | Pokazuje zużycie i limity | Sprawdź ile zostało |
| `/compact` | Kompresuje historię | Jak w Claude Code |
| `/clear` | Czyści sesję | Między warsztatami |
| `codex resume --last` | Wznawia ostatnią sesję | Gdy chcesz kontynuować pracę |
| `/init` | Tworzy plik AGENTS.md | Na początku projektu |

### Top 5 zasad oszczędzania

1. **Używaj AGENTS.md**
   Odpowiednik CLAUDE.md. Stwórz w katalogu projektu:
   ```
   - Framework: Next.js 15 z App Router
   - AI SDK: Vercel AI SDK + @ai-sdk/google
   - Po każdej zmianie uruchom: npm run build
   - Klucz API: GOOGLE_API_KEY
   ```
   Codex czyta to automatycznie na starcie każdej sesji.

2. **Jeden plik .md = jedno zadanie**
   Wklej zawartość pliku warsztatowego i daj jedno polecenie. Nie rozdzielaj na 5 osobnych promptów - Codex lepiej działa z jednym dużym zadaniem.

3. **`codex resume --last` zamiast od nowa**
   Jeśli musiałeś przerwać - wznów sesję zamiast zaczynać od zera. Nowa sesja = Codex musi od nowa przeczytać cały projekt.

4. **Ogranicz kontekst plików**
   Codex automatycznie czyta pliki w projekcie. Jeśli masz dużo śmieci (node_modules, .next, dist) - upewnij się że `.gitignore` jest poprawny. Mniej plików = mniej tokenów.

5. **Nie dawaj za dużo swobody**
   ❌ "Zrób fajny generator obrazów"
   ✅ "Przeczytaj W2_IMAGE_GEN.md i zaimplementuj dokładnie to co jest opisane"

### Checklist na warsztat
```
□ AGENTS.md z opisem projektu
□ .gitignore wyklucza node_modules, .next, dist
□ /status na początku - sprawdź ile masz limitu
□ Wklej plik .md jako jedno zadanie
□ codex resume --last jeśli wznawiasz
```

---

## Google Antigravity

### Jak działają limity
- **Limit w oknie 5-godzinnym** (rolling window, jak Claude Code)
- Model domyślny: Gemini - wydajny tokenowo
- Tryb planowania: oszczędza tokeny na złożonych zadaniach

### Komendy i funkcje

| Funkcja | Co robi | Kiedy używać |
|---|---|---|
| Planning Mode | Agent planuje przed działaniem | Złożone zadania (cały warsztat) |
| Approve/Reject | Zatwierdzasz lub odrzucasz akcje | Kontroluj co agent robi |
| New conversation | Nowa sesja z czystym kontekstem | Między warsztatami |
| Knowledge Items | Trwała pamięć projektu | Zamiast powtarzania instrukcji |

### Top 5 zasad oszczędzania

1. **Nowa konwersacja między warsztatami**
   Antigravity pamięta całą historię rozmowy. Po W1 zacznij nową konwersację na W2 - nie ciągnij jednej sesji przez 4 warsztaty.

2. **Wklej plik .md i powiedz "zrób"**
   Agent przeczyta plik, zaplanuje i zaimplementuje. Nie opisuj słowami tego co jest w pliku.
   ✅ "Przeczytaj W2_IMAGE_GEN.md z katalogu lekcja_03 i zaimplementuj wszystko"

3. **Zatwierdzaj komendy świadomie**
   Antigravity pyta o zgodę przed uruchomieniem komend. Jeśli widzisz że agent robi coś niepotrzebnego - odrzuć. Każda komenda to tokeny na wejściu i wyjściu.

4. **Nie poprawiaj w kółko**
   Jeśli agent źle zaimplementował coś po 2 próbach - zacznij nową konwersację i opisz problem precyzyjnie z kodem błędu. Ciągłe "popraw to" w jednej sesji marnuje tokeny.

5. **Używaj trybu planowania dla warsztatów**
   Dla całego warsztatu (np. cały W2) użyj trybu planowania - agent najpierw zaplanuje co zrobić, pokaże plan, dopiero po zatwierdzeniu implementuje. Mniej błędnych prób = mniej tokenów.

### Checklist na warsztat
```
□ Nowa konwersacja przed każdym warsztatem
□ Wklej plik .md zamiast opisywania
□ Tryb planowania dla złożonych zadań
□ Odrzucaj zbędne akcje agenta
□ Nie iteruj powyżej 3 prób - zacznij od nowa
```

---

## Uniwersalne zasady (dla każdego asystenta)

### Złota reguła: JEDNO zadanie = JEDNA sesja
Nie mieszaj warsztatów w jednej sesji. Po każdym warsztacie czyść kontekst.

### Ile tokenów zużyjesz na lekcję?
| Warsztat | Szacunek | Z poprawkami |
|---|---|---|
| W1: Tool Calling | ~30K | ~50K |
| W2: Image Gen | ~40K | ~60K |
| W3: Vision | ~50K | ~80K |
| W4: Multi-tool | ~60K | ~100K |
| **Razem** | **~180K** | **~290K** |

### Formatka promptu na warsztat
```
Przeczytaj plik [NAZWA].md z katalogu lekcja_XX i zaimplementuj 
wszystko co jest tam opisane. Nie pytaj o potwierdzenie, 
po prostu zrób to krok po kroku.
```

### Czego NIE robić
- ❌ Opisywać słowami to co jest w pliku .md
- ❌ Pisać "proszę", "dziękuję", "czy mógłbyś"
- ❌ Poprawiać ten sam błąd 5+ razy w jednej sesji
- ❌ Ciągnąć jedną sesję przez cały warsztat bez kompresji
- ❌ Używać najmocniejszego modelu do prostych zadań
