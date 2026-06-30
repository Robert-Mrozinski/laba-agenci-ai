# ==============================================================================
# SZABLON 1: PIERWSZE URUCHOMIENIE (HELLO WORLD)
# ==============================================================================
# Ten plik to najprostszy możliwy sposób na połączenie się z AI.
# Skopiuj ten kod, zapisz jako plik i uruchom w swoim środowisku (np. VS Code).
# Nie ma tu nic skomplikowanego, czytamy z góry na dół!
# ==============================================================================

# KROK 1: Importujemy potrzebne narzędzia z bibliotek, które zainstalowaliśmy.
from dotenv import load_dotenv  # Pozwala czytać bezpiecznie hasła z pliku .env
from openai import OpenAI       # Biblioteka do rozmowy z systemami OpenAI

# KROK 2: Ładujemy ukryte hasła (klucze API) z pliku .env
# Funkcja load_dotenv() szuka pliku .env w tym samym folderze i wczytuje zmienne.
load_dotenv()

# KROK 3: Tworzymy "klienta", czyli naszego łącznika z AI.
# Jeśli masz poprawnie zapisany OPENAI_API_KEY w pliku .env, 
# OpenAI() samo go znajdzie. Nic nie musisz tu wpisywać.
klient = OpenAI()

# KROK 4: Zadajemy pytanie sztucznej inteligencji.
print("Wysyłam pytanie do AI... (to może potrwać kilka sekund)")

odpowiedz = klient.chat.completions.create(
    model="gpt-5.5",  # Wybieramy konkretny model (np. gpt-5.5, gpt-4o, gpt-3.5-turbo)
    messages=[
        # System: to główna instrukcja (kontekst), kim ma być nasze AI.
        {"role": "system", "content": "Jesteś bardzo miłym i pomocnym asystentem."},
        
        # User: to Twoje właściwe pytanie lub polecenie.
        {"role": "user", "content": "Napisz jedno zdanie na powitanie dla początkujących programistów, którzy nie znają jeszcze Pythona."}
    ]
)

# KROK 5: Wyciągamy sam tekst odpowiedzi z paczki, którą dostaliśmy od OpenAI
# i drukujemy go na ekranie.
tekst_odpowiedzi = odpowiedz.choices[0].message.content

print("\n--- ODPOWIEDŹ AI ---")
print(tekst_odpowiedzi)
print("--------------------")

# ĆWICZENIE DLA CIEBIE:
# Zmień "role": "system" na: "Jesteś złośliwym i znudzonym robotem." i uruchom plik jeszcze raz!
