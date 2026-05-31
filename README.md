# Trimly — Premium URL Shortener & Analytics Dashboard (Day 8)

Welcome to **Trimly**, a high-fidelity URL shortener and real-time visitor analytics dashboard built as part of the **30 Days Web Development Challenge**.

This application is designed using state-of-the-art frontend practices, featuring a glassmorphic dark-mode layout, micro-interactions, customizable branding aliases, and comprehensive charts.

---

## ⚡ Key Features

- **High-Fidelity Glassmorphism Interface**: A stunning dashboard that seamlessly supports light and dark themes.
- **Custom Branding Aliases**: Create premium, branded short codes (e.g. `trimly.co/my-promo`) for high click-through rates.
- **Unified DB Fail-Safe**: If local MongoDB is not running or active, the application automatically falls back to an optimized JSON-based local database (`db-fallback.json`), ensuring out-of-the-box functionality with full feature parity!
- **Rich Interactive Analytics (Chart.js)**:
  - Timeline tracking (clicks over time)
  - Browser distribution donut chart
  - Operating system distribution donut chart
  - Top traffic referrers and sources list
- **Sharing QR Codes**: Instant custom QR code generation with download capability for visual sharing.
- **Search & Filters**: Instantly query and filter trimmed links in real-time.
- **Responsive Layout**: Tailored grids that adapt gracefully to mobile, tablet, and widescreen monitors.

---

## 🛠️ Tech Stack & Libraries

- **Backend**: Node.js, Express
- **Database Layer**: MongoDB / Mongoose (with hybrid fallback)
- **Frontend**: Vanilla HTML5, CSS3, ES6+ Javascript
- **Asset/Icon Packs**: Lucide Icons, Chart.js (CDN), QR Code API (CDN)

---

## 🚀 Getting Started

### 1. Installation

Change directory into `DAY8 --URL SHORTNER` and install Node dependencies:

```bash
npm install
```

### 2. Configure Environment

Create or edit the `.env` file to customize your port or Mongo connection string:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/url_shortener
```

### 3. Run the Server

Start in production mode:
```bash
npm start
```

Or start in development mode with automatic reload:
```bash
npm run dev
```

Visit the dashboard in your web browser: **`http://localhost:3000`**

---

## 📡 REST API Documentation

### 1. Shorten a URL
* **Endpoint**: `POST /api/shorten`
* **Content-Type**: `application/json`
* **Body**:
  ```json
  {
    "originalUrl": "https://example.com/long/path/name",
    "customAlias": "optional-custom-alias"
  }
  ```
* **Success Response (201)**:
  ```json
  {
    "message": "URL shortened successfully!",
    "data": {
      "_id": "645a27...",
      "originalUrl": "https://example.com/long/path/name",
      "shortCode": "optional-custom-alias",
      "clicks": 0,
      "analytics": [],
      "createdAt": "2026-05-31T13:22:00.000Z"
    },
    "isFallback": false
  }
  ```

### 2. Fetch Saved Short URLs
* **Endpoint**: `GET /api/urls`
* **Success Response (200)**:
  ```json
  {
    "urls": [...],
    "isFallback": false
  }
  ```

### 3. Get Advanced Visitor Analytics
* **Endpoint**: `GET /api/urls/:code/analytics`
* **Success Response (200)**:
  ```json
  {
    "clicks": 42,
    "createdAt": "2026-05-31T13:22:00.000Z",
    "originalUrl": "https://example.com",
    "shortCode": "abcdef",
    "breakdowns": {
      "browsers": { "Chrome": 20, "Safari": 15, "Firefox": 7 },
      "os": { "macOS": 25, "iOS": 10, "Windows": 7 },
      "referrers": { "Direct / Email": 30, "github.com": 12 },
      "clicksOverTime": { "2026-05-31": 42 }
    }
  }
  ```

### 4. Delete Short URL
* **Endpoint**: `DELETE /api/urls/:code`
* **Success Response (200)**:
  ```json
  { "message": "Short URL deleted successfully!" }
  ```
# trimly
