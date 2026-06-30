# ==============================================================================
# SZABLON 3: PROSTY CHATBOT Z PAMIĘCIĄ
# ==============================================================================
# To jest najprostszy kod chatbota, który pamięta historię konwersacji.
# Będzie działał bez końca (pętla 'while True'), aż nie wpiszesz słowa 'wyjdz'.
#
# Zobaczysz tu kluczowy mechanizm: za każdym razem wysyłamy modelowi
# CAŁĄ listę dotychczasowych wiadomości. Tylko dzięki temu AI "pamięta"
# o czym mówiliśmy chwilę wcześniej.
# ==============================================================================

import os
from dotenv import load_dotenv
from openai import OpenAI

# 1. Wczytujemy z pliku .env nasze klucze (np. OPENAI_API_KEY)
load_dotenv()

# 2. Tworzymy klienta OpenAI (połączy się z modelem GPT)
klient = OpenAI()

# 3. Tworzymy naszą "pamięć". Jest to po prostu zwykła lista [].
# W tej liście będziemy zapisywać krok po kroku:
# - To co wpisał człowiek (z rolą "user")
# - To co odpowiedziało AI (z rolą "assistant")
# Pierwsza wiadomość to zawsze ukryta instrukcja systemu (rola "system")

historia_rozmowy = [
    # Możesz zmienić tę instrukcję na inną, np. "Jesteś prawnikiem"
    {"role": "system", "content": "Jesteś pomocnym asystentem biznesowym. Odpowiadaj krótko po polsku."}
]

print("======================================================")
print(" START ROZMOWY Z CHATBOTEM (Wpisz 'wyjdz' aby uciec)  ")
print("======================================================")

# 4. Rozpoczynamy główną pętlę naszego programu. 'while True' znaczy "powtarzaj bez końca".
while True:
    
    # Czekamy, aż wpiszesz coś z klawiatury
    tekst_uzytkownika = input("\n👤 Ty: ")
    
    # Jeśli wpiszesz "wyjdz" (niezależnie czy dużymi czy małymi literami), kończymy.
    if tekst_uzytkownika.lower() == 'wyjdz':
        print("Zakończono rozmowę.")
        break  # 'break' to magiczne słowo przerywające pętlę
        
    # KROK A: Zapisujemy Twoje pytanie w naszej pamięci (na końcu listy)
    historia_rozmowy.append({"role": "user", "content": tekst_uzytkownika})
    
    # KROK B: Wysyłamy do AI naszą CAŁĄ pamięć (wszystko co było do tej pory + najnowsze pytanie)
    odpowiedz = klient.chat.completions.create(
        model="gpt-5.5", 
        messages=historia_rozmowy
    )
    
    # Wyciągamy sam tekst odpowiedzi z wielkiej paczki danych, którą zwróciło AI
    tekst_ai = odpowiedz.choices[0].message.content
    
    # Drukujemy odpowiedź AI na ekranie
    print(f"🤖 Bot: {tekst_ai}")
    
    # KROK C: Bardzo ważne! Zapisujemy odpowiedź AI w naszej pamięci.
    # Jeśli byśmy tego nie zrobili, w kolejnej rundzie AI nie wiedziałoby, co przed chwilą powiedziało.
    historia_rozmowy.append({"role": "assistant", "content": tekst_ai})

# ==============================================================================
# ĆWICZENIE DLA CIEBIE:
# 1. Zmień "role": "system" na eksperta z jakiejś dziedziny (np. dietetyka).
# 2. Uruchom program i w pierwszej wiadomości powiedz mu, jak masz na imię.
# 3. W kolejnej zapytaj go o jakąś dietę.
# 4. W trzeciej zapytaj: "Zaraz, a jak ja mam na imię?". Zobacz, że bot pamięta!
# ==============================================================================
