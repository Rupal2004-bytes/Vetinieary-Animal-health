package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"animal-health-ai/backend/internal/ai"
	"animal-health-ai/backend/internal/clinics"
	"animal-health-ai/backend/internal/database"
	"animal-health-ai/backend/internal/models"
	"animal-health-ai/backend/internal/storage"
)

func TestAnalyzeCreatesHealthScreening(t *testing.T) {
	server := testServer(t)
	body := `{"animal":{"name":"Buddy","species":"dog","breed":"Mix"},"symptoms":{"symptoms":["severe_itching"],"duration":"1-3 Days"}}`
	req := httptest.NewRequest(http.MethodPost, "/api/health-check/analyze", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var screening models.HealthScreening
	if err := json.Unmarshal(rec.Body.Bytes(), &screening); err != nil {
		t.Fatal(err)
	}
	if screening.ID == 0 || screening.Assessment.Summary == "" {
		t.Fatalf("unexpected screening: %+v", screening)
	}
}

func TestUploadRejectsBadFile(t *testing.T) {
	server := testServer(t)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "bad.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("not media"))
	_ = writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/health-check/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func testServer(t *testing.T) http.Handler {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	h := &Handler{
		DB:       db,
		Storage:  storage.NewLocalStore(t.TempDir()),
		Vision:   ai.MockVisionProvider{},
		VetAI:    ai.MockVeterinaryProvider{},
		Clinics:  clinics.MockProvider{},
		MediaDir: t.TempDir(),
	}
	mux := http.NewServeMux()
	h.Register(mux)
	return mux
}

var _ = context.Background
