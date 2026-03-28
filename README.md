# AutoCourse: Personal AI Professor

An AI-powered curriculum planning agent that designs personalized course plans through interactive conversation. Features a live-updating timeline visualization and streaming AI responses.

## Architecture

- **Backend**: Python FastAPI with SSE streaming, OpenAI integration
- **Frontend**: Next.js, Tailwind CSS, Framer Motion, Zustand

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OpenAI API key
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key | (required) |
| `OPENAI_MODEL` | Model to use | `gpt-4o` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |

## How It Works

1. Enter a topic you want to learn
2. The AI professor asks you targeted follow-up questions about your background, goals, and preferences
3. A course timeline builds and refines in real-time on the right panel
4. The agent continues asking questions until it has high confidence in the plan
5. Review and approve your personalized curriculum
