# Agenci AI — Kurs praktyczny

> 12 lekcji. Jeden agent. Od zera do produkcji.

## O kursie

Przez 12 tygodni budujesz jednego agenta AI od prostego chatbota do w pełni autonomicznego systemu wdrożonego w chmurze. Nie osobne demo co tydzień — jeden spójny projekt, który rośnie z Tobą.

**Prowadzący:** Paweł Paruzel — CEO Syntelligence, 17+ lat w IT, 7 produktów SaaS, 25 certyfikatów DeepLearning.AI

## Szybki start

```bash
# 1. Sklonuj repo (lub pobierz ZIP z GitHub → Code → Download ZIP)
git clone https://github.com/SirIdontCare/laba-agenci-ai.git
cd laba-agenci-ai

# 2. Utwórz virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# 3. Zainstaluj zależności
pip install -r requirements.txt

# 4. Skopiuj klucze API
cp lekcja_01/.env.example .env
# Edytuj .env — wpisz swoje klucze

# 5. Uruchom pierwszy skrypt
cd lekcja_01
python 01_hello.py
```

## Struktura repo

```
laba-agenci-ai/
├── lekcja_01/          Od LLM do agenta
├── lekcja_02/          Inżynieria promptów
├── lekcja_03/          Narzędzia — ręce agenta
├── lekcja_04/          Pętla rozumowania (ReAct)
├── lekcja_05/          LangGraph — agenci jako grafy
├── lekcja_06/          RAG — agent z bazą wiedzy
├── lekcja_07/          Pamięć i kontekst
├── lekcja_08/          Systemy wieloagentowe
├── lekcja_09/          Ewaluacja i monitoring
├── lekcja_10/          Bezpieczeństwo i zabezpieczenia
├── lekcja_11/          Wdrożenie produkcyjne
├── lekcja_12/          Prezentacja projektów
├── .env.example        Szablon kluczy API
├── .gitignore
└── requirements.txt    Zależności Python
```

## Wymagania

- Python 3.11+
- Git
- VS Code
- AI coding assistant (jedno z): Claude Code / Cursor / GitHub Copilot
- Konta API: min. Google (darmowy) + OpenAI lub Anthropic

## Klucze API — skąd wziąć?

| Dostawca | Link | Cena |
|----------|------|------|
| **Google (Gemini)** | [aistudio.google.com](https://aistudio.google.com/apikey) | **Darmowy** |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Pay-as-you-go |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Pay-as-you-go |
| xAI (Grok) | [console.x.ai](https://console.x.ai/) | Pay-as-you-go |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/api_keys) | Pay-as-you-go |
| Mistral | [console.mistral.ai](https://console.mistral.ai/api-keys) | Pay-as-you-go |

## Lekcje

| # | Temat | Status |
|---|-------|--------|
| 01 | Od LLM do agenta | ✅ |
| 02 | Inżynieria promptów | 🔜 |
| 03 | Narzędzia — ręce agenta | 🔜 |
| 04 | Pętla rozumowania (ReAct) | 🔜 |
| 05 | LangGraph — agenci jako grafy | 🔜 |
| 06 | RAG — agent z bazą wiedzy | 🔜 |
| 07 | Pamięć i kontekst | 🔜 |
| 08 | Systemy wieloagentowe | 🔜 |
| 09 | Ewaluacja i monitoring | 🔜 |
| 10 | Bezpieczeństwo i zabezpieczenia | 🔜 |
| 11 | Wdrożenie produkcyjne | 🔜 |
| 12 | Prezentacja projektów | 🔜 |

## Licencja

Materiały kursu — wszelkie prawa zastrzeżone © 2026 Paweł Paruzel / Syntelligence
