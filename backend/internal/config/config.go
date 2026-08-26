package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	Port             string
	DatabasePath     string
	UserDatabasePath string
	BackupDir        string
	MediaStoragePath string
	FrontendOrigin   string
	DemoMode         bool
	HuggingFaceToken string
	VisionModel      string
	VeterinaryModel  string
}

func Load() Config {
	loadEnvFiles(".env", "backend/.env", "../backend/.env", "../.env")

	hfToken := firstNonEmpty(
		os.Getenv("HUGGINGFACE_API_KEY"),
		os.Getenv("HUGGING_FACE_API_KEY"),
		os.Getenv("HF_TOKEN"),
		os.Getenv("HUGGINGFACE_TOKEN"),
		os.Getenv("VISION_API_KEY"),
		os.Getenv("VETERINARY_API_KEY"),
	)

	demoEnv := strings.ToLower(strings.TrimSpace(os.Getenv("DEMO_MODE")))
	demoMode := false
	if demoEnv == "true" {
		demoMode = true
	} else if demoEnv == "false" {
		demoMode = false
	} else {
		demoMode = (hfToken == "")
	}

	return Config{
		Port:             getenv("PORT", "8080"),
		DatabasePath:     getenv("DATABASE_PATH", "./animal_health.db"),
		UserDatabasePath: getenv("USER_DATABASE_PATH", "./user.db"),
		BackupDir:        getenv("BACKUP_DIR", "./backups"),
		MediaStoragePath: getenv("MEDIA_STORAGE_PATH", "./uploads"),
		FrontendOrigin:   getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
		DemoMode:         demoMode,
		HuggingFaceToken: hfToken,
		VisionModel:      getenv("VISION_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct"),
		VeterinaryModel:  getenv("VETERINARY_MODEL", "Qwen/Qwen2.5-72B-Instruct"),
	}
}

func loadEnvFiles(paths ...string) {
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			val = strings.Trim(val, `"'`)
			if key != "" && os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
		_ = f.Close()
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
