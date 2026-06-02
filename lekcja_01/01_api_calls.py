# -*- coding: utf-8 -*-
"""
Lekcja 01 — Template 02: Wywołania API — 7 dostawców
Kurs "AI Agents" — Laba IT

Cel: Nauczyć się wywoływać modele AI od różnych dostawców.
     Zobaczyć, że OpenAI SDK obsługuje 4 dostawców (zmiana base_url).
     Porównać odpowiedzi, czas i format.

Instrukcja:
1. Uzupełnij plik .env kluczami API (patrz .env.example)
2. Uruchom: python 01_api_calls.py
3. Porównaj odpowiedzi — który model odpowiedział lepiej?
4. Zmień PYTANIE na swoje i uruchom ponownie

Dostawcy:
- OpenAI (GPT-5.5)           — własny SDK
- Anthropic (Claude)          — własny SDK
- Google (Gemini)             — własny SDK, DARMOWY tier
- xAI (Grok)                  — OpenAI-compatible SDK
- DeepSeek                    — OpenAI-compatible SDK
- Mistral                     — OpenAI-compatible SDK
- Lokalny model (Ollama)      — OpenAI-compatible SDK
"""

import os
import time
from dotenv import load_dotenv

load_dotenv()

# ── Pytanie testowe — zmień na swoje! ──
PYTANIE = "Czym różni się agent AI od zwykłego chatbota? Odpowiedz w 3 zdaniach."
SYSTEM_PROMPT = "Jesteś ekspertem od sztucznej inteligencji. Odpowiadaj po polsku, konkretnie i zwięźle."


def print_result(provider: str, model: str, answer: str, elapsed: float):
    """Wyświetla wynik w ujednoliconym formacie."""
    print(f"\n{'━' * 60}")
    print(f"🏢 {provider}  |  📦 {model}  |  ⏱️ {elapsed:.1f}s")
    print(f"{'━' * 60}")
    print(answer)


# ═══════════════════════════════════════════════════════
#  1. OpenAI (GPT-5.5)
# ═══════════════════════════════════════════════════════

def call_openai():
    """Wywołanie OpenAI — podstawowy pattern."""
    from openai import OpenAI

    client = OpenAI()  # czyta OPENAI_API_KEY z .env

    start = time.time()
    response = client.chat.completions.create(
        model="gpt-5.5",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": PYTANIE}
        ],
        temperature=0.7,
        max_tokens=500
    )
    elapsed = time.time() - start

    answer = response.choices[0].message.content
    print_result("OpenAI", "GPT-5.5", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  2. Anthropic (Claude Sonnet 4.6)
#     UWAGA: system prompt jest OSOBNYM parametrem!
# ═══════════════════════════════════════════════════════

def call_anthropic():
    """Wywołanie Anthropic — system prompt OSOBNO, nie w messages[]."""
    from anthropic import Anthropic

    client = Anthropic()  # czyta ANTHROPIC_API_KEY z .env

    start = time.time()
    response = client.messages.create(
        model="claude-sonnet-4-6-20260201",
        max_tokens=500,
        system=SYSTEM_PROMPT,  # <-- OSOBNO! To najczęstszy błąd.
        messages=[
            {"role": "user", "content": PYTANIE}
        ]
    )
    elapsed = time.time() - start

    # Odpowiedź: response.content[0].text (NIE response.choices[0]!)
    answer = response.content[0].text
    print_result("Anthropic", "Claude Sonnet 4.6", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  3. Google (Gemini 3.5 Flash) — DARMOWY TIER
# ═══════════════════════════════════════════════════════

def call_google():
    """Wywołanie Google Gemini — darmowy tier w AI Studio."""
    from google import genai

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    start = time.time()
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=f"{SYSTEM_PROMPT}\n\n{PYTANIE}"
    )
    elapsed = time.time() - start

    answer = response.text
    print_result("Google", "Gemini 3.5 Flash", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  4. xAI (Grok 4.3) — OpenAI-compatible!
#     Zmień base_url i api_key — reszta identyczna
# ═══════════════════════════════════════════════════════

def call_xai():
    """Wywołanie xAI Grok — ten sam OpenAI SDK, zmień 2 linie."""
    from openai import OpenAI

    client = OpenAI(
        base_url="https://api.x.ai/v1",
        api_key=os.getenv("XAI_API_KEY")
    )

    start = time.time()
    response = client.chat.completions.create(
        model="grok-4.3",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": PYTANIE}
        ],
        temperature=0.7,
        max_tokens=500
    )
    elapsed = time.time() - start

    answer = response.choices[0].message.content
    print_result("xAI", "Grok 4.3", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  5. DeepSeek (V4) — OpenAI-compatible!
# ═══════════════════════════════════════════════════════

def call_deepseek():
    """Wywołanie DeepSeek — OpenAI SDK z innym base_url."""
    from openai import OpenAI

    client = OpenAI(
        base_url="https://api.deepseek.com/v1",
        api_key=os.getenv("DEEPSEEK_API_KEY")
    )

    start = time.time()
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": PYTANIE}
        ],
        temperature=0.7,
        max_tokens=500
    )
    elapsed = time.time() - start

    answer = response.choices[0].message.content
    print_result("DeepSeek", "V4", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  6. Mistral (Large 3) — OpenAI-compatible!
# ═══════════════════════════════════════════════════════

def call_mistral():
    """Wywołanie Mistral — OpenAI SDK z innym base_url."""
    from openai import OpenAI

    client = OpenAI(
        base_url="https://api.mistral.ai/v1",
        api_key=os.getenv("MISTRAL_API_KEY")
    )

    start = time.time()
    response = client.chat.completions.create(
        model="mistral-large-latest",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": PYTANIE}
        ],
        temperature=0.7,
        max_tokens=500
    )
    elapsed = time.time() - start

    answer = response.choices[0].message.content
    print_result("Mistral", "Large 3", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  7. Lokalny model (Ollama) — BONUS, opcjonalny
#     Zainstaluj Ollama: https://ollama.com
#     Pobierz model: ollama pull llama3.2
# ═══════════════════════════════════════════════════════

def call_ollama():
    """Wywołanie lokalnego modelu przez Ollama — zero kosztów, pełna prywatność."""
    from openai import OpenAI

    client = OpenAI(
        base_url="http://localhost:11434/v1",
        api_key="ollama"  # Ollama nie wymaga klucza
    )

    start = time.time()
    response = client.chat.completions.create(
        model="llama3.2",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": PYTANIE}
        ],
        temperature=0.7,
        max_tokens=500
    )
    elapsed = time.time() - start

    answer = response.choices[0].message.content
    print_result("Ollama (lokalny)", "Llama 3.2", answer, elapsed)
    return answer


# ═══════════════════════════════════════════════════════
#  MAIN — uruchom wszystkich dostawców
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    print("🚀 Porównanie dostawców AI — to samo pytanie, różne modele\n")
    print(f"❓ Pytanie: {PYTANIE}\n")

    # Lista dostawców do wywołania — odkomentuj te, do których masz klucze
    providers = [
        ("OpenAI",    call_openai,    "OPENAI_API_KEY"),
        ("Anthropic", call_anthropic, "ANTHROPIC_API_KEY"),
        ("Google",    call_google,    "GOOGLE_API_KEY"),
        ("xAI",       call_xai,       "XAI_API_KEY"),
        ("DeepSeek",  call_deepseek,  "DEEPSEEK_API_KEY"),
        ("Mistral",   call_mistral,   "MISTRAL_API_KEY"),
        # ("Ollama",    call_ollama,    None),  # odkomentuj jeśli masz Ollama
    ]

    results = {}
    for name, func, env_key in providers:
        if env_key and not os.getenv(env_key):
            print(f"\n⚠️  {name}: brak klucza {env_key} w .env — pomijam")
            continue
        try:
            results[name] = func()
        except Exception as e:
            print(f"\n❌ {name}: błąd — {e}")

    # Podsumowanie
    print(f"\n\n{'═' * 60}")
    print(f"📊 PODSUMOWANIE: Odpowiedzi uzyskano od {len(results)}/{len(providers)} dostawców")
    print(f"{'═' * 60}")
    for name in results:
        print(f"  ✅ {name}")


# ╔══════════════════════════════════════════════════════╗
# ║  ĆWICZENIA:                                          ║
# ║                                                      ║
# ║  1. Zmień PYTANIE na pytanie z Twojej domeny         ║
# ║  2. Który model odpowiedział najlepiej? Najszybciej? ║
# ║  3. Dodaj zliczanie kosztów (cena × tokeny)          ║
# ║  4. Zmień temperature na 0.0 — czy odpowiedzi się    ║
# ║     ujednolicą?                                      ║
# ║  5. BONUS: Dodaj Ollama (model lokalny, zero kosztów)║
# ╚══════════════════════════════════════════════════════╝
