# Agenci AI — Kurs praktyczny

> 12 lekcji. Jeden agent. Od zera do produkcji.

## O kursie

Przez 12 lekcji (2 razy w tygodniu) budujesz jednego agenta AI od prostego chatbota do w pełni autonomicznego systemu wdrożonego w chmurze. Nie osobne demo co lekcji — jeden spójny projekt, który rośnie z Tobą.

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
| **OpenRouter** | [openrouter.ai](https://openrouter.ai/keys) | Pay-as-you-go (wielu dostawców w jednym kluczu!) |



## Licencja

Materiały kursu — wszelkie prawa zastrzeżone © 2026 Paweł Paruzel / Syntelligence
