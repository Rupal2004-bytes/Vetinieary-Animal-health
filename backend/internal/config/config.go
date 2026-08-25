package config

import "os"

type Config struct {
	Port             string
	DatabasePath     string
	MediaStoragePath string
	FrontendOrigin   string
	DemoMode         bool
	HuggingFaceToken string
	VisionModel      string
	VeterinaryModel  string
}

func Load() Config {
	return Config{
		Port:             getenv("PORT", "8080"),
		DatabasePath:     getenv("DATABASE_PATH", "./animal_health.db"),
		MediaStoragePath: getenv("MEDIA_STORAGE_PATH", "./uploads"),
		FrontendOrigin:   getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
		DemoMode:         getenv("DEMO_MODE", "true") != "false",
		HuggingFaceToken: firstNonEmpty(os.Getenv("HF_TOKEN"), os.Getenv("HUGGINGFACE_TOKEN")),
		VisionModel:      getenv("VISION_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct"),
		VeterinaryModel:  getenv("VETERINARY_MODEL", "viggovet/viggoVet-Reasoning-20B"),
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
		if v != "" {
			return v
		}
	}
	return ""
}
