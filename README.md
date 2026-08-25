# Animal Health AI

Animal Health AI is a hackathon MVP for AI-assisted veterinary health screening. It keeps the existing `vet-disease-detector` React UI and adds a Go backend with SQLite persistence, local media storage, demo AI providers, and a mock clinic provider.

The app is a preliminary screening and triage tool. It does not train a model and does not replace examination by a qualified veterinarian.

## Problem

Pet owners, farmers, and field workers often need quick guidance about whether an animal health issue is routine, urgent, or an emergency. Images, videos, symptoms, and animal history are usually disconnected, which makes triage harder.

## Solution

The workflow is:

```text
Select/add animal
  -> Upload/capture image or video
  -> Provide animal information
  -> Answer symptom questions
  -> AI visual analysis
  -> Veterinary AI reasoning
  -> Health assessment and urgency
  -> Recommended next steps
  -> Nearby veterinary services
  -> Save screening to animal history
```

## Architecture

```text
                     FRONTEND
              vet-disease-detector
                       |
                       | HTTP
                       v
                  GO BACKEND
                       |
          +------------+-------------+
          |            |             |
          v            v             v
       SQLite       AI Layer     Clinic Layer
                       |
              +--------+--------+
              |                 |
              v                 v
       Qwen2.5-VL         viggoVet
          7B                20B
              |
              v
       Visual observations
              |
              + User symptoms
              + Animal information
              |
              v
       Veterinary assessment
```

## Frontend

`vet-disease-detector/` is a Vite React app. The existing dashboard, prediction scanner, result page, history page, Tailwind/CDN styling, and clinical card layout are preserved.

Key files:

- `src/App.jsx`: page state, backend-backed analysis flow, history conversion.
- `src/api/client.js`: clean HTTP client for backend APIs.
- `src/pages/Prediction.jsx`: symptom questionnaire, saved animal selection, upload image/video, camera capture, submit analysis.
- `src/pages/Result.jsx`: visual observations, possible conditions, safe next steps, veterinary attention, nearby clinics.
- `src/pages/Dashboard.jsx`: SQLite-backed animal creation/listing.

## Backend

`backend/` is a Go service with modular internal packages:

- `cmd/server`: server entry point.
- `internal/handlers`: HTTP handlers.
- `internal/database`: SQLite schema and persistence.
- `internal/storage`: local media storage abstraction and validation.
- `internal/ai`: `VisionProvider` and `VeterinaryProvider` interfaces, mock providers, provider stubs.
- `internal/clinics`: `ClinicProvider` interface and mock clinic provider.
- `internal/models`: shared API/data models.

## SQLite Schema

The backend initializes these tables automatically:

- `users`
- `animals`
- `media`
- `health_screenings`
- `reminders`

Passwords are represented by a hash field; plaintext passwords are not stored.

## AI Architecture

The intended production pipeline is:

1. `Qwen/Qwen2.5-VL-7B-Instruct` analyzes uploaded image/video and returns structured visual observations only.
2. `viggovet/viggoVet-Reasoning-20B` combines animal information, visual observations, symptoms, duration, and history into a safe veterinary assessment.
3. The backend validates the structured result and applies safety constraints before returning it to the UI.

The current MVP includes provider interfaces and demo/mock implementations. Real provider stubs are present and configurable through environment variables.

## Demo Mode

The app works without external AI credentials:

```env
DEMO_MODE=true
```

Demo scenarios include:

- Cattle skin condition: raised lesions, hair loss, crusting, high urgency.
- Dog skin condition: redness, irritation, scratching, moderate urgency.
- Dog mobility issue: abnormal gait, reduced weight bearing, moderate urgency.

Demo outputs use "possible condition" language and avoid confirmed diagnoses, drug dosages, prescription plans, and dangerous procedures.

## Environment

Copy `backend/.env.example` values into your shell or local environment:

```env
DEMO_MODE=true
PORT=8080
DATABASE_PATH=./animal_health.db
MEDIA_STORAGE_PATH=./uploads
FRONTEND_ORIGIN=http://localhost:5173
VISION_API_KEY=
VETERINARY_API_KEY=
VISION_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
VETERINARY_MODEL=viggovet/viggoVet-Reasoning-20B
```

Do not commit `.env` files or AI provider keys.

## Local Setup

Backend:

```bash
cd backend
DEMO_MODE=true go run ./cmd/server
```

Frontend:

```bash
cd vet-disease-detector
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## API Endpoints

- `GET /api/health`
- `GET /api/animals`
- `POST /api/animals`
- `GET /api/animals/{id}`
- `GET /api/animals/{id}/history`
- `POST /api/health-check/upload`
- `POST /api/health-check/analyze`
- `GET /api/health-screenings/{id}`
- `GET /api/clinics/nearby`
- `GET /api/reminders`
- `POST /api/reminders`
- `GET /media/{filename}`

## Safety

The app provides safe next-step guidance only. It should not present definitive diagnoses, prescribe medication dosages, recommend prescription-only treatment, or instruct users to perform dangerous procedures.

High-risk or worsening cases direct users to seek veterinary attention promptly.

## Verification

Backend tests:

```bash
cd backend
GOCACHE="$PWD/.gocache" go test ./...
```

Frontend build:

```bash
cd vet-disease-detector
npm run build
```

Manual MVP flow:

```text
Dashboard
  -> Add Animal Profile
  -> AI Prediction
  -> Upload Image/Video or Capture Image
  -> Select symptoms and context
  -> Run Full AI Health Assessment
  -> Review result, clinics, and history
```

Camera capture requires a real browser context with camera permissions.

## Future Improvements

- Connect real Qwen and viggoVet provider clients.
- Add auth screens backed by secure password hashing and sessions.
- Replace local media storage with S3, Supabase Storage, or Cloudinary.
- Replace mock clinics with a maps/places provider.
- Add frontend component tests and Playwright E2E tests.
- Add reminder completion/update endpoints.
