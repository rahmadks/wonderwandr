# ✈️ WonderWandr — AI Travel Planner

A full-stack AI-powered travel planner and budget tracker built with Node.js, Express, and Groq AI.

---

## 🌟 Features

- **AI Destination Pool** — generates 8 recommended spots per city based on your interests, travel pace, and accommodation style
- **Smart Itinerary Generator** — builds a day-by-day schedule that respects opening hours, groups nearby spots, and fits exactly within your chosen trip duration
- **Transport Connectors** — shows how to get between each activity (metro, bus, taxi, walk) with duration and cost
- **Inter-city Transit Days** — when your trip spans multiple cities, a dedicated travel day is inserted with multiple transport options (e.g. KTX vs. Express Bus)
- **✏️ Adjust Mode** — drag activities between days, reorder within a day, or change any time with a click
- **💾 Save / Load** — saves your itinerary to the browser so you can pick up where you left off
- **📊 Budget Dashboard** — tracks total spent vs. remaining balance with a live Chart.js bar chart
- **💱 Currency Converter** — logs expenses in any currency and converts them to your base currency via the Frankfurter API
- **🌐 Bilingual** — full English and Indonesian (Bahasa) support across the entire UI

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| AI | Groq SDK (`llama-3.3-70b-versatile`) |
| Frontend | Vanilla JS + Tailwind CSS (CDN) |
| Charts | Chart.js (CDN) |
| Currency | Frankfurter API (with fallback rates) |
| Hosting | Vercel |

---

## 📁 Project Structure

```
wonderwandr/
├── server.js          ← Express server + 3 API routes
├── vercel.json        ← Vercel deployment config
├── package.json       ← Dependencies
├── .env               ← Your secret API key (never uploaded)
├── .gitignore         ← Protects .env and node_modules
└── public/
    └── index.html     ← Entire frontend (HTML + CSS + JS)
```

---

## 🚀 Getting Started (Local)

### 1. Prerequisites
- [Node.js](https://nodejs.org) v18 or higher
- A free [Groq API key](https://console.groq.com)

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/wonderwandr.git
cd wonderwandr
npm install
```

### 3. Set up your API key

Create a `.env` file in the project root:

```
GROQ_API_KEY=gsk_your_key_here
PORT=3000
```

### 4. Run

```bash
node server.js
```

Open **http://localhost:3000** in your browser.

---

## ☁️ Deploying to Vercel

### One-time setup

1. Push your project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. In **Environment Variables**, add:
   - Name: `GROQ_API_KEY`
   - Value: your Groq key (`gsk_...`)
4. Click **Deploy**

### Updating after changes

```bash
git add .
git commit -m "your message here"
git push
```

Vercel automatically re-deploys within ~60 seconds.

---

## 🔌 API Routes

### `POST /api/recommendations`
Generates a destination pool for the given cities.

Request body:
```json
{
  "cities": "Busan, Seoul",
  "interests": "Beach, Culinary, Culture",
  "pace": "Moderate",
  "style": "Mid-range",
  "lang": "en"
}
```

### `POST /api/itinerary`
Builds a day-by-day itinerary from selected destinations.

Request body:
```json
{
  "destinations": [{ "city": "Busan", "name": "Haeundae Beach", "type": "beach" }],
  "days": 5,
  "pace": "Moderate",
  "style": "Mid-range",
  "currency": "IDR",
  "lang": "en"
}
```

### `POST /api/exchange`
Converts an amount between currencies.

Request body:
```json
{
  "amount": 50000,
  "fromCurrency": "KRW",
  "toCurrency": "IDR"
}
```

---

## ⚙️ Configuration

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Your Groq API key from console.groq.com |
| `PORT` | ❌ No | Server port (default: 3000) |

---

## 🧭 How to Use

1. **Enter destinations** — type cities separated by commas (e.g. `Bali, Lombok`)
2. **Set your trip** — choose number of days, total budget, and currency
3. **Pick interests** — select chips like Beach, Culinary, Culture
4. **Set pace & style** — Relaxed / Moderate / Packed, and Budget / Mid / Luxury
5. **Generate AI Recommendations** — click the green button and wait ~5 seconds
6. **Select destinations** — click cards to add them to your itinerary (turns green ✓)
7. **Generate Itinerary** — click the sticky bar button at the bottom
8. **Adjust if needed** — click ✏️ Adjust to move activities between days or change times
9. **Save** — click 💾 Save to store your itinerary in the browser
10. **Log expenses** — use the Add Expense form on the left to track spending

---

## 🐛 Common Issues

**Buttons frozen / app not loading**
Make sure `"type": "module"` is NOT in your `package.json`. The app uses CommonJS (`require`).

**"Gagal memuat destinasi" / "Could not load destinations"**
Check that your `GROQ_API_KEY` is set correctly in `.env` (local) or Vercel environment variables (production).

**Itinerary has wrong number of days**
The AI trims automatically — if it still happens, try reducing the number of selected destination cards before generating.

**Currency conversion shows wrong values**
The app falls back to hardcoded rates if the Frankfurter API is unreachable. Live rates require internet access.

---

## 📄 License

MIT — free to use, modify, and share.

---

Built with ❤️ using [Groq](https://groq.com), [Express](https://expressjs.com), and [Tailwind CSS](https://tailwindcss.com).
