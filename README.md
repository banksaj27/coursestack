# CourseStack: Personal AI Professor

An AI-powered curriculum planning agent that designs personalized course plans through interactive conversation. Features a live-updating timeline visualization and streaming AI responses.

## Architecture

- **Backend**: Python FastAPI with SSE streaming, Google Gemini API
- **Frontend**: Next.js, Tailwind CSS, Framer Motion, Zustand

## Quick Start Guide

### Option 1: Local Deployment
### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Vercel
CourseStack is hosted on Vercel. Come check it out [here](https://coursestacklearn.vercel.app/)!


## Environment Variables

### Backend (`backend/.env`)

| Variable         | Description                       | Default            |
|------------------|-----------------------------------|--------------------|
| `GOOGLE_API_KEY` | Google AI Studio / Gemini API key | (required)         |
| `GEMINI_MODEL`   | Gemini model id                   | `gemini-2.5-flash` |

### Frontend (`frontend/.env.local`)

| Variable              | Description     | Default                 |
|-----------------------|-----------------|-------------------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |

## How It Works

1. Enter a topic you want to learn
2. The AI professor asks you targeted follow-up questions about your background, goals, and preferences
3. A course timeline builds and refines on the right panel
4. Review and approve your personalized curriculum, or continue editing
5. After creating the curriculum, the AI professor will create weekly plans
6. Assignments and Lecture Notes are generated automatically for each week
