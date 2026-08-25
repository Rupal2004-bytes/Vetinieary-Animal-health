package main

import (
	"log"
	"net/http"

	"animal-health-ai/backend/internal/ai"
	"animal-health-ai/backend/internal/api"
	"animal-health-ai/backend/internal/clinics"
	"animal-health-ai/backend/internal/config"
	"animal-health-ai/backend/internal/database"
	"animal-health-ai/backend/internal/handlers"
	"animal-health-ai/backend/internal/storage"
)

func main() {
	cfg := config.Load()
	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	var vision ai.VisionProvider = ai.MockVisionProvider{}
	var vet ai.VeterinaryProvider = ai.MockVeterinaryProvider{}
	if !cfg.DemoMode {
		provider := ai.HuggingFaceProvider{
			Token:           cfg.HuggingFaceToken,
			VisionModel:     cfg.VisionModel,
			VeterinaryModel: cfg.VeterinaryModel,
		}
		vision = provider
		vet = provider
	}

	h := &handlers.Handler{
		DB:       db,
		Storage:  storage.NewLocalStore(cfg.MediaStoragePath),
		Vision:   vision,
		VetAI:    vet,
		Clinics:  clinics.MockProvider{},
		MediaDir: cfg.MediaStoragePath,
	}
	mux := http.NewServeMux()
	h.Register(mux)

	addr := ":" + cfg.Port
	log.Printf("Animal Health AI backend listening on %s (demo_mode=%v)", addr, cfg.DemoMode)
	if err := http.ListenAndServe(addr, api.WithCORS(mux, cfg.FrontendOrigin)); err != nil {
		log.Fatal(err)
	}
}
