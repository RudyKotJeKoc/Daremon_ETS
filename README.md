# DAREMON Radio ETS 🎵

System zarządzania projektem transferu oraz internetowe radio firmowe dla DAREMON ETS.

## 📋 Opis projektu

DAREMON Radio ETS to kompleksowy system składający się z trzech głównych modułów:

### 1. 📻 Radio Internetowe (index.html)
Główna aplikacja - firmowe radio internetowe z zaawansowanymi funkcjami:

**Funkcjonalności:**
- Odtwarzacz audio z wizualizacją dźwięku
- System oceniania i komentowania utworów (rating system)
- Historia odtwarzanych utworów
- Lista "Golden Records" - najlepsze utwory
- Top utwory na podstawie ocen użytkowników
- System ważony odtwarzania (priorytetyzacja utworów)
- Wiadomości do DJ-a
- Wsparcie PWA (Progressive Web App)
- Tryb offline z Service Worker
- Wielojęzyczność (Nederlands/Polski)
- Dwa motywy wizualne (Arburg/Rave)
- Inteligentny system cichych godzin (22:00-06:00)
- Crossfade między utworami
- Automatyczne jingle co X utworów

**Technologie:**
- Vanilla JavaScript (ES6+)
- Web Audio API (wizualizacja)
- Service Worker (offline support)
- LocalStorage (zapisywanie preferencji)
- Canvas API (wizualizator)

### 2. 🏭 System Zarządzania Projektem (project-management.html)
Aplikacja do zarządzania projektem transferu sprzętu z Boxtel NL.

**Funkcjonalności:**
- Zarządzanie zadaniami (Tasks)
  - Statusy: Do zrobienia, W toku, Zakończone, Zablokowane
  - Priorytety: Wysoki, Średni, Niski
  - Przypisanie do osób (Paweł, Rudy, Krzysztof, Dawid, Inni)
  - Terminy realizacji
  - Notatki
- Zarządzanie sprzętem (Equipment)
  - Typy: Wtryskarka, Linia produkcyjna, Prasa, Infrastruktura, Inne
  - Przeznaczenie: CZ, Mex, Verschrot (Złom)
  - Status CZ Wishlist
  - Powiązane zadania
  - Notatki
- Dashboard z podsumowaniem:
  - Statystyki zadań według statusu
  - Statystyki sprzętu według kategorii
  - Obciążenie zespołu
  - Postęp projektu
- Eksport danych do CSV
- Przechowywanie danych w localStorage

### 3. 🚚 Plan Wywozu Maszyn (machine-planning.html)
System planowania transportu i demontażu maszyn produkcyjnych.

**Funkcjonalności:**
- Ochrona hasłem (hasło: "Rampa")
- Zarządzanie maszynami:
  - Numer maszyny
  - Typ maszyny
  - Status (Do zaplanowania, Zaplanowane, W trakcie, Zakończone, Wstrzymane)
  - Przeznaczenie (CZ, Mex, Złom)
  - Data transportu
  - Firma transportowa
  - Odpowiedzialny
  - Notatki
- Wyświetlanie terminów:
  - Koniec 2025 (31.12.2025)
  - Koniec Q1 2026 (31.03.2026)
- Liczniki statusów
- Eksport do CSV
- Możliwość importu z Excel (planowana funkcja)
- LocalStorage dla trwałości danych

## 🚀 Instalacja i uruchomienie

### Wymagania
- Node.js (wersja 16+)
- pnpm (package manager)

### Kroki instalacji

1. Sklonuj repozytorium:
```bash
git clone https://github.com/RudyKotJeKoc/Daremon_ETS.git
cd Daremon_ETS
```

2. Zainstaluj zależności:
```bash
pnpm install
```

3. Uruchom serwer deweloperski:
```bash
pnpm dev
```

4. Zbuduj wersję produkcyjną:
```bash
pnpm build
```

5. Uruchom testy:
```bash
pnpm test
```

## 📁 Struktura projektu

```
Daremon_ETS/
├── index.html              # Główna aplikacja - Radio
├── app.js                  # Logika aplikacji radio
├── ui_bootstrap.js         # Bootstrap UI
├── project-management.html # System zarządzania projektem
├── machine-planning.html   # Plan wywozu maszyn
├── styles.css             # Style główne
├── style.css              # Dodatkowe style
├── playlist.json          # Konfiguracja i lista utworów
├── manifest.json          # PWA manifest
├── sw.js                  # Service Worker
├── locales/               # Tłumaczenia
│   ├── nl.json           # Nederlands
│   └── pl.json           # Polski
├── tests/                # Testy
│   └── no-loader.test.js
├── package.json          # Konfiguracja npm
└── README.md            # Ten plik
```

## 🎵 Konfiguracja playlisty (playlist.json)

Plik `playlist.json` zawiera:
- **config**: Globalna konfiguracja
  - `quietHours`: Godziny ciszy (22:00-06:00)
  - `jingle`: Konfiguracja jingle (co 4 utwory lub 15 minut)
  - `recentMemory`: Liczba ostatnio odtwarzanych (15)
  - `crossfadeSeconds`: Czas crossfade (2s)
  - `topTracksConfig`: Konfiguracja top utworów
- **tracks**: Lista utworów z metadanymi
  - id, title, artist, src, cover
  - tags, weight, type
  - golden (czy jest "golden record")

## 🌐 Wielojęzyczność

Aplikacja wspiera dwa języki:
- 🇳🇱 **Nederlands** (domyślny)
- 🇵🇱 **Polski**

Tłumaczenia są przechowywane w folderze `locales/`.

## 🎨 Motywy

Dostępne motywy wizualne:
- **Arburg** - Profesjonalny motyw firmowy
- **Rave** - Energetyczny motyw z efektami

## 🔐 Hasła dostępu

- **Plan Wywozu Maszyn**: `Rampa`

## 💾 Przechowywanie danych

Wszystkie trzy moduły używają **localStorage** do przechowywania danych:
- Radio: oceny, komentarze, polubienia, historia
- Zarządzanie projektem: zadania i sprzęt
- Plan wywozu: lista maszyn

## 🧪 Testowanie

Projekt zawiera podstawowy test sprawdzający, czy loader overlay został usunięty:

```bash
pnpm test
```

## 📦 Build & Deploy

Projekt używa **Vite** jako bundlera:

```bash
# Development
pnpm dev

# Production build
pnpm build

# Lint
pnpm lint
```

## 🤝 Wkład w projekt

Projekt jest wewnętrznym narzędziem DAREMON ETS.

## 📄 Licencja

ISC

## 👥 Zespół

- Paweł
- Rudy
- Krzysztof
- Dawid

---

**DAREMON Radio ETS** - Humor, technologie en najlepsza muzyka! 🎧