package main

import (
	"context"
	"log"
	"net/http"
	"time"

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

	// 1. Initialize Backup Manager first to attach auto-backup hooks
	backupMgr := database.NewBackupManager(cfg.BackupDir, cfg.UserDatabasePath, cfg.DatabasePath)

	// 2. Initialize user.db for account management (runs versioned migrations on startup)
	userDB, err := database.OpenUserDB(cfg.UserDatabasePath)
	if err != nil {
		log.Fatalf("failed to open user database (%s): %v", cfg.UserDatabasePath, err)
	}
	defer userDB.Close()
	userDB.OnChange = backupMgr.TriggerAsyncBackup
	log.Printf("User account database loaded (%s) with bcrypt security and versioned migrations", cfg.UserDatabasePath)

	// 3. Initialize application database (runs versioned migrations on startup)
	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("failed to open application database (%s): %v", cfg.DatabasePath, err)
	}
	defer db.Close()
	db.OnChange = backupMgr.TriggerAsyncBackup
	log.Printf("Application database loaded (%s) with versioned migrations", cfg.DatabasePath)

	// 4. Run Server-Internal Health Checks on startup (server-only verification)
	database.RunInternalHealthChecks(cfg.UserDatabasePath, cfg.DatabasePath)

	// 5. Initial snapshot backup & periodic scheduled snapshot
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := backupMgr.BackupAll(ctx); err != nil {
			log.Printf("Startup database backup warning: %v", err)
		} else {
			log.Printf("Startup database snapshot verified in %s", cfg.BackupDir)
		}

		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			bCtx, bCancel := context.WithTimeout(context.Background(), 60*time.Second)
			if _, bErr := backupMgr.BackupAll(bCtx); bErr != nil {
				log.Printf("Periodic database backup warning: %v", bErr)
			}
			bCancel()
		}
	}()

	// 6. Initialize AI providers
	var vision ai.VisionProvider = ai.MockVisionProvider{}
	var vet ai.VeterinaryProvider = ai.MockVeterinaryProvider{}
	if !cfg.DemoMode && cfg.HuggingFaceToken != "" {
		provider := ai.HuggingFaceProvider{
			Token:           cfg.HuggingFaceToken,
			VisionModel:     cfg.VisionModel,
			VeterinaryModel: cfg.VeterinaryModel,
		}
		vision = provider
		vet = provider
		log.Printf("Live Hugging Face AI provider enabled (vision=%s, veterinary=%s)", cfg.VisionModel, cfg.VeterinaryModel)
	} else {
		log.Printf("Running in AI demo simulation mode")
	}

	// 7. Initialize Handlers and Routes (NO admin endpoints exposed)
	h := &handlers.Handler{
		DB:       db,
		UserDB:   userDB,
		Backups:  backupMgr,
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
