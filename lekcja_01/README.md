# Lekcja 01: Od LLM do agenta — Materiały warsztatowe

## Szybki start

```bash
# 1. Sklonuj repo i wejdź do folderu
cd lekcja_01

# 2. Utwórz virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate

# Mac/Linux:
source .venv/bin/activate

# 3. Zainstaluj zależności
pip install openai anthropic google-genai mistralai python-dotenv

# 4. Skopiuj plik z kluczami i uzupełnij
cp .env.example .env
# Edytuj .env — wpisz swoje klucze API

# 5. Uruchom pierwszy skrypt
python 01_hello.py
```

## Pliki

| Plik | Warsztat | Opis |
|------|----------|------|
| `01_hello.py` | Warsztat 1 | Szablon 1: Super prosty skrypt sprawdzający połączenie z AI. |
| `01_api_calls.py` | Warsztat 3 | Szablon 2: Wywoływanie 4 różnych dostawców (OpenAI, Google, Anthropic, xAI) przez odkomentowanie. |
| `01_chatbot.py` | Warsztat 4 | Szablon 3: Podstawowy chatbot z pamięcią w prostej pętli while. |
| `.env.example` | — | Szablon pliku z kluczami API |

## Skąd wziąć klucze API?

| Dostawca | Link | Cena |
|----------|------|------|
| **Google (Gemini)** | [aistudio.google.com](https://aistudio.google.com/apikey) | **DARMOWY** — bez karty |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Pay-as-you-go |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Pay-as-you-go |
| xAI (Grok) | [console.x.ai](https://console.x.ai/) | Pay-as-you-go |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/api_keys) | Pay-as-you-go |
| Mistral | [console.mistral.ai](https://console.mistral.ai/api-keys) | Pay-as-you-go |

> Na start wystarczy Google (darmowy) + jeden płatny (OpenAI lub Anthropic).

## Praca domowa

1. Zmień `SYSTEM_PROMPT` w `01_chatbot.py` na wybraną domenę (prawnik, coach, dietetyk, programista)
2. Podłącz minimum 3 dostawców
3. Porównaj: który model lepiej radzi sobie z Twoją domeną?
4. Opisz wyniki w swoim README

**Co oddajesz:**
- Plik `.py` z działającym chatbotem (min. 3 dostawców)
- README z porównaniem modeli
- Screenshot działającej konwersacji (min. 3 tury)
