# -*- coding: utf-8 -*-
"""
Lekcja 01 — Template 01: Hello AI
Kurs "AI Agents" — Laba IT

Cel: Sprawdzenie czy środowisko działa poprawnie.
     Jedno proste wywołanie API OpenAI.

Instrukcja:
1. Upewnij się, że masz plik .env z kluczem OPENAI_API_KEY
2. Uruchom: python 01_hello.py
3. Poproś AI coding assistant o wyjaśnienie tego kodu
4. Zmień prompt na swój i uruchom ponownie
"""

from dotenv import load_dotenv
from openai import OpenAI

# ── Ładujemy klucze z pliku .env ──
load_dotenv()

# ── Tworzymy klienta OpenAI ──
client = OpenAI()  # automatycznie czyta OPENAI_API_KEY z .env

# ── Wysyłamy zapytanie do modelu ──
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "system", "content": "Jesteś pomocnym asystentem. Odpowiadaj po polsku."},
        {"role": "user", "content": "Czym jest agent AI? Odpowiedz w 3 zdaniach."}
    ],
    temperature=0.7,
    max_tokens=300
)

# ── Wyświetlamy odpowiedź ──
answer = response.choices[0].message.content
print("=" * 60)
print("🤖 Odpowiedź modelu GPT-5.5:")
print("=" * 60)
print(answer)
print("=" * 60)

# ── Statystyki użycia tokenów ──
usage = response.usage
print(f"\n📊 Tokeny: {usage.prompt_tokens} (prompt) + {usage.completion_tokens} (odpowiedź) = {usage.total_tokens} (razem)")


# ╔══════════════════════════════════════════════════════╗
# ║  ĆWICZENIA — zrób z pomocą AI coding assistant:     ║
# ║                                                      ║
# ║  1. Zmień prompt na pytanie z Twojej domeny          ║
# ║  2. Zmień temperature na 0.0 i 1.5 — porównaj        ║
# ║  3. Zmień max_tokens na 50 — co się stanie?          ║
# ║  4. Celowo zepsuj kod (usuń nawias) — niech AI       ║
# ║     coding assistant go naprawi                       ║
# ╚══════════════════════════════════════════════════════╝
