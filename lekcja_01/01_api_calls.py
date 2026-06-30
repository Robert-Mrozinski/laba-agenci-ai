# ==============================================================================
# SZABLON 2: WYWOŁANIA RÓŻNYCH MODELI AI (OPENAI, CLAUDE, GEMINI)
# ==============================================================================
# W tym pliku pokazujemy, jak wywołać różne modele od 4 głównych dostawców.
# Zobaczysz, że wystarczy zmienić zaledwie kilka linijek kodu.
# 
# Instrukcja: 
# 1. Odkomentuj fragment kodu dla dostawcy, którego chcesz użyć 
#    (usuń znak '#' z początku danej linijki).
# 2. Upewnij się, że masz odpowiedni klucz API w swoim pliku .env.
# 3. Uruchom plik.
# ==============================================================================

import os
from dotenv import load_dotenv

# Wczytujemy klucze (np. OPENAI_API_KEY) z pliku .env
load_dotenv()

# Pytanie i instrukcja, które wyślemy do każdego z modeli
pytanie = "Czym różni się model językowy od agenta AI? Odpowiedz w 2 zdaniach."
instrukcja = "Odpowiadaj krótko, prosto i zwięźle."

print("Twoje pytanie to:", pytanie)
print("=" * 60)


# ==============================================================================
# 1. OPENAI (np. model GPT-5.5)
# ==============================================================================
# Wymaga w pliku .env wpisu: OPENAI_API_KEY=sk-xxxx...

from openai import OpenAI
klient_openai = OpenAI()

odp_openai = klient_openai.chat.completions.create(
    model="gpt-5.5", 
    messages=[
        {"role": "system", "content": instrukcja},
        {"role": "user", "content": pytanie}
    ]
)
print("[OPENAI] Odpowiedź:")
print(odp_openai.choices[0].message.content)
print("-" * 60)


# ==============================================================================
# 2. GOOGLE (np. model Gemini 3.5 Flash) - IDEALNY NA START, JEST DARMOWY!
# ==============================================================================
# Wymaga w pliku .env wpisu: GOOGLE_API_KEY=xxxx...

# from google import genai
# klient_google = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
# 
# odp_google = klient_google.models.generate_content(
#     model="gemini-3.5-flash",
#     # Google Gemini woli, kiedy instrukcja i pytanie idą jako jeden duży tekst
#     contents=instrukcja + "\n\n" + pytanie
# )
# print("[GOOGLE] Odpowiedź:")
# print(odp_google.text)
# print("-" * 60)


# ==============================================================================
# 3. ANTHROPIC (np. model Claude Sonnet)
# ==============================================================================
# Wymaga w pliku .env wpisu: ANTHROPIC_API_KEY=sk-ant-xxxx...
# UWAGA: W Claude, instrukcję systemową ('system') podajemy OSOBNO, a nie w liście wiadomości. To najczęstszy błąd!

# from anthropic import Anthropic
# klient_anthropic = Anthropic()
# 
# odp_anthropic = klient_anthropic.messages.create(
#     model="claude-sonnet-4-6-20260201",
#     max_tokens=500,
#     system=instrukcja,  # <--- Instrukcja jest tu! Osobno.
#     messages=[
#         {"role": "user", "content": pytanie}
#     ]
# )
# print("[ANTHROPIC] Odpowiedź:")
# print(odp_anthropic.content[0].text) # <--- Zwróć uwagę, jak inna jest ścieżka do tekstu!
# print("-" * 60)


# ==============================================================================
# 4. xAI (np. model Grok) - UŻYWA TEGO SAMEGO KODU CO OPENAI!
# ==============================================================================
# Wymaga w pliku .env wpisu: XAI_API_KEY=xai-xxxx...
# Sekret: xAI (Grok), DeepSeek, czy Mistral pod maską udają OpenAI, 
# więc korzystamy z tej samej biblioteki! Zmieniamy tylko "base_url" (adres serwera).

# from openai import OpenAI
# klient_xai = OpenAI(
#     base_url="https://api.x.ai/v1",  # <--- Po prostu mówimy, żeby łączył się do serwerów xAI
#     api_key=os.getenv("XAI_API_KEY") # <--- I podajemy klucz xAI
# )
# 
# odp_xai = klient_xai.chat.completions.create(
#     model="grok-4.3", 
#     messages=[
#         {"role": "system", "content": instrukcja},
#         {"role": "user", "content": pytanie}
#     ]
# )
# print("[XAI / GROK] Odpowiedź:")
# print(odp_xai.choices[0].message.content)
# print("-" * 60)
