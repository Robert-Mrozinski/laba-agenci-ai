# -*- coding: utf-8 -*-
"""
Lekcja 01 — Template 03: Chatbot z pamięcią konwersacji
Kurs "AI Agents" — Laba IT

Cel: Zrozumieć jak działa "pamięć" chatbota (lista messages[]).
     Zmodyfikować system prompt dla wybranej domeny.
     Porównać zachowanie różnych modeli.

Instrukcja:
1. Uruchom: python 01_chatbot.py
2. Porozmawiaj z botem (min. 3 tury)
3. Sprawdź czy pamięta Twoje imię po 3 turach
4. Zmień SYSTEM_PROMPT na swoją domenę (prawnik, coach, dietetyk...)
5. Zmień PROVIDER na "anthropic" lub "google" i porównaj

Komendy specjalne w czacie:
  /historia  — pokaż pełną historię messages[]
  /tokeny    — pokaż zużycie tokenów
  /reset     — wyczyść historię
  /model X   — zmień dostawcę (openai / anthropic / google)
  /quit      — wyjdź
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ═══════════════════════════════════════════════════════
#  KONFIGURACJA — zmień na swoje!
# ═══════════════════════════════════════════════════════

# Wybierz dostawcę: "openai", "anthropic", "google"
PROVIDER = "openai"

# Modele per dostawca
MODELS = {
    "openai": "gpt-5.5",
    "anthropic": "claude-sonnet-4-6-20260201",
    "google": "gemini-3.5-flash",
}

# ── System prompt — ZMIEŃ NA SWOJĄ DOMENĘ ──
# Przykłady:
#   "Jesteś doświadczonym prawnikiem specjalizującym się w prawie pracy..."
#   "Jesteś dietetykiem klinicznym z 10-letnim doświadczeniem..."
#   "Jesteś senior Python developerem z doświadczeniem w FastAPI..."

SYSTEM_PROMPT = """Jesteś pomocnym asystentem biznesowym. Odpowiadaj po polsku.

Zasady:
- Odpowiadaj konkretnie i zwięźle
- Jeśli nie znasz odpowiedzi, powiedz to wprost
- Używaj punktów gdy wymieniasz kilka rzeczy
- Zapamiętuj informacje, które użytkownik Ci podaje"""

# ═══════════════════════════════════════════════════════
#  KLIENTY API
# ═══════════════════════════════════════════════════════

def create_client(provider: str):
    """Tworzy klienta API dla wybranego dostawcy."""
    if provider == "openai":
        from openai import OpenAI
        return OpenAI()

    elif provider == "anthropic":
        from anthropic import Anthropic
        return Anthropic()

    elif provider == "google":
        from google import genai
        return genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    else:
        raise ValueError(f"Nieznany dostawca: {provider}. Użyj: openai, anthropic, google")


def get_response(client, provider: str, messages: list) -> tuple[str, dict]:
    """
    Wysyła messages[] do wybranego dostawcy i zwraca (odpowiedź, statystyki).

    KLUCZOWY KONCEPT:
    Za każdym razem wysyłamy CAŁĄ historię konwersacji (messages[]).
    To jest "pamięć" chatbota — model widzi wszystkie wcześniejsze tury.
    Im dłuższa konwersacja, tym więcej tokenów = więcej kosztów.
    """
    stats = {"prompt_tokens": 0, "completion_tokens": 0}

    if provider == "openai":
        response = client.chat.completions.create(
            model=MODELS[provider],
            messages=messages,  # ← CAŁA historia!
            temperature=0.7,
            max_tokens=800
        )
        answer = response.choices[0].message.content
        if response.usage:
            stats["prompt_tokens"] = response.usage.prompt_tokens
            stats["completion_tokens"] = response.usage.completion_tokens

    elif provider == "anthropic":
        # Anthropic: system prompt jest OSOBNO, nie w messages[]
        # Filtrujemy system message z listy
        user_messages = [m for m in messages if m["role"] != "system"]
        system_text = next((m["content"] for m in messages if m["role"] == "system"), "")

        response = client.messages.create(
            model=MODELS[provider],
            max_tokens=800,
            system=system_text,
            messages=user_messages
        )
        answer = response.content[0].text
        if response.usage:
            stats["prompt_tokens"] = response.usage.input_tokens
            stats["completion_tokens"] = response.usage.output_tokens

    elif provider == "google":
        # Google Gemini: prosty format, łączymy historię w jeden string
        conversation = ""
        for m in messages:
            if m["role"] == "system":
                conversation += f"[Instrukcja systemowa]: {m['content']}\n\n"
            elif m["role"] == "user":
                conversation += f"Użytkownik: {m['content']}\n"
            elif m["role"] == "assistant":
                conversation += f"Asystent: {m['content']}\n"
        conversation += "Asystent: "

        response = client.models.generate_content(
            model=MODELS[provider],
            contents=conversation
        )
        answer = response.text

    return answer, stats


# ═══════════════════════════════════════════════════════
#  KOMENDY SPECJALNE
# ═══════════════════════════════════════════════════════

def handle_command(command: str, messages: list, provider: str, total_tokens: dict) -> tuple[bool, str]:
    """
    Obsługuje komendy specjalne. Zwraca (kontynuuj, nowy_provider).
    """
    cmd = command.strip().lower()

    if cmd == "/quit":
        return False, provider

    elif cmd == "/historia":
        print(f"\n{'─' * 40}")
        print(f"📜 Historia ({len(messages)} wiadomości):")
        print(f"{'─' * 40}")
        for i, m in enumerate(messages):
            role_icon = {"system": "⚙️", "user": "👤", "assistant": "🤖"}.get(m["role"], "❓")
            content_preview = m["content"][:120] + "..." if len(m["content"]) > 120 else m["content"]
            print(f"  [{i}] {role_icon} {m['role']}: {content_preview}")
        print(f"{'─' * 40}\n")
        return True, provider

    elif cmd == "/tokeny":
        total = total_tokens["prompt"] + total_tokens["completion"]
        print(f"\n📊 Tokeny sesji: {total_tokens['prompt']} (prompt) + {total_tokens['completion']} (completion) = {total} total\n")
        return True, provider

    elif cmd == "/reset":
        messages.clear()
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
        print("\n🔄 Historia wyczyszczona. Zaczynam od nowa.\n")
        return True, provider

    elif cmd.startswith("/model"):
        parts = cmd.split()
        if len(parts) >= 2 and parts[1] in MODELS:
            new_provider = parts[1]
            print(f"\n🔄 Zmieniam dostawcę: {provider} → {new_provider} ({MODELS[new_provider]})\n")
            return True, new_provider
        else:
            print(f"\n⚠️  Użycie: /model [openai|anthropic|google]\n")
            return True, provider

    return True, provider


# ═══════════════════════════════════════════════════════
#  GŁÓWNA PĘTLA CHATBOTA
# ═══════════════════════════════════════════════════════

def main():
    provider = PROVIDER
    client = create_client(provider)

    # ── Inicjalizacja historii ──
    # To jest "pamięć" chatbota — lista wiadomości
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    total_tokens = {"prompt": 0, "completion": 0}

    print("=" * 60)
    print(f"🤖 Chatbot z pamięcią — {MODELS[provider]}")
    print(f"   Dostawca: {provider}")
    print("=" * 60)
    print("Komendy: /historia /tokeny /reset /model X /quit")
    print("=" * 60)
    print()

    while True:
        # ── Input od użytkownika ──
        try:
            user_input = input("👤 Ty: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\n👋 Do zobaczenia!")
            break

        if not user_input:
            continue

        # ── Obsługa komend ──
        if user_input.startswith("/"):
            should_continue, new_provider = handle_command(
                user_input, messages, provider, total_tokens
            )
            if not should_continue:
                print("\n👋 Do zobaczenia!")
                break
            if new_provider != provider:
                provider = new_provider
                client = create_client(provider)
            continue

        # ── Dodaj wiadomość użytkownika do historii ──
        messages.append({"role": "user", "content": user_input})

        # ── Wyślij CAŁĄ historię do modelu ──
        try:
            answer, stats = get_response(client, provider, messages)
        except Exception as e:
            print(f"\n❌ Błąd API: {e}")
            messages.pop()  # usuń wiadomość użytkownika — nie udało się
            continue

        # ── Dodaj odpowiedź do historii ──
        messages.append({"role": "assistant", "content": answer})

        # ── Zlicz tokeny ──
        total_tokens["prompt"] += stats["prompt_tokens"]
        total_tokens["completion"] += stats["completion_tokens"]

        # ── Wyświetl odpowiedź ──
        print(f"\n🤖 Bot: {answer}\n")


if __name__ == "__main__":
    main()


# ╔══════════════════════════════════════════════════════╗
# ║  ĆWICZENIA:                                          ║
# ║                                                      ║
# ║  1. Zmień SYSTEM_PROMPT na wybraną domenę             ║
# ║     (prawnik, dietetyk, coach, programista)           ║
# ║  2. Porozmawiaj 5 tur — czy bot pamięta Twoje imię?  ║
# ║  3. Wpisz /historia — jak rośnie lista messages[]?    ║
# ║  4. Wpisz /model anthropic — porównaj zachowanie      ║
# ║  5. Wpisz /tokeny — ile kosztuje długa rozmowa?       ║
# ║  6. BONUS: dodaj komendę /zapisz która zapisuje       ║
# ║     historię do pliku JSON                            ║
# ╚══════════════════════════════════════════════════════╝
