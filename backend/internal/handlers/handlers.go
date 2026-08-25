package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"animal-health-ai/backend/internal/ai"
	"animal-health-ai/backend/internal/clinics"
	"animal-health-ai/backend/internal/database"
	"animal-health-ai/backend/internal/models"
	"animal-health-ai/backend/internal/storage"
)

type Handler struct {
	DB       *database.DB
	Storage  storage.Store
	Vision   ai.VisionProvider
	VetAI    ai.VeterinaryProvider
	Clinics  clinics.Provider
	MediaDir string
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", h.health)
	mux.HandleFunc("/api/auth/login", h.login)
	mux.HandleFunc("/api/auth/signup", h.signup)
	mux.HandleFunc("/api/auth/me", h.me)
	mux.HandleFunc("/api/account/huggingface", h.connectHuggingFace)
	mux.HandleFunc("/api/animals", h.animals)
	mux.HandleFunc("/api/animals/", h.animalSubroutes)
	mux.HandleFunc("/api/health-check/upload", h.upload)
	mux.HandleFunc("/api/health-check/analyze", h.analyze)
	mux.HandleFunc("/api/health-screenings/", h.screening)
	mux.HandleFunc("/api/clinics/nearby", h.nearbyClinics)
	mux.HandleFunc("/api/reminders", h.reminders)
	mux.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir(h.MediaDir))))
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "demo_mode": true})
}

func (h *Handler) animals(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		animals, err := h.DB.ListAnimals(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load animals.")
			return
		}
		writeJSON(w, http.StatusOK, animals)
	case http.MethodPost:
		var a models.Animal
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Please check the animal information.")
			return
		}
		if strings.TrimSpace(a.Name) == "" || strings.TrimSpace(a.Species) == "" {
			writeError(w, http.StatusBadRequest, "missing_fields", "Animal name and species are required.")
			return
		}
		created, err := h.DB.CreateAnimal(r.Context(), a)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not save animal.")
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

type authRequest struct {
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Please check your login details.")
		return
	}
	user, err := h.DB.AuthenticateUser(r.Context(), req.Email, req.Password, req.Role)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, sql.ErrNoRows) {
			status = http.StatusUnauthorized
		}
		writeError(w, status, "login_failed", "Email or password is incorrect.")
		return
	}
	writeJSON(w, http.StatusOK, authResponse(user))
}

func (h *Handler) signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Please check your account details.")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = req.FullName
	}
	user, err := h.DB.CreateUser(r.Context(), models.User{Name: name, Email: req.Email, Role: req.Role}, req.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, "signup_failed", "Could not create that account. The email may already be registered.")
		return
	}
	writeJSON(w, http.StatusCreated, authResponse(user))
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not_signed_in", "Please sign in.")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

type hfConnectRequest struct {
	Token string `json:"token"`
}

func (h *Handler) connectHuggingFace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not_signed_in", "Please sign in before connecting Hugging Face.")
		return
	}
	var req hfConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Please enter a Hugging Face access token.")
		return
	}
	if !strings.HasPrefix(strings.TrimSpace(req.Token), "hf_") {
		writeError(w, http.StatusBadRequest, "invalid_token", "Please enter a valid Hugging Face access token.")
		return
	}
	user, err := h.DB.SetHuggingFaceConnected(r.Context(), user.ID, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not update your account connection.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "connected": true})
}

func (h *Handler) animalSubroutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/animals/"), "/")
	if len(parts) == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid animal id.")
		return
	}
	if len(parts) == 1 && r.Method == http.MethodGet {
		animal, err := h.DB.GetAnimal(r.Context(), id)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, sql.ErrNoRows) {
				status = http.StatusNotFound
			}
			writeError(w, status, "not_found", "Animal not found.")
			return
		}
		writeJSON(w, http.StatusOK, animal)
		return
	}
	if len(parts) == 2 && parts[1] == "history" && r.Method == http.MethodGet {
		history, err := h.DB.ListScreenings(r.Context(), id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load health history.")
			return
		}
		writeJSON(w, http.StatusOK, history)
		return
	}
	w.WriteHeader(http.StatusNotFound)
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseMultipartForm(storage.MaxMediaBytes + 1024); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_upload", "Please upload a JPG, PNG, WebP image or supported video.")
		return
	}
	file, header, err := formFile(r, "file", "image", "photo", "media")
	if err != nil {
		writeError(w, http.StatusBadRequest, "empty_upload", "Please choose an image or video file.")
		return
	}
	defer file.Close()
	media, err := h.Storage.Save(r.Context(), file, header)
	if err != nil {
		switch {
		case errors.Is(err, storage.ErrTooLarge):
			writeError(w, http.StatusBadRequest, "file_too_large", "Please upload a file smaller than 25 MB.")
		case errors.Is(err, storage.ErrUnsupportedMedia):
			writeError(w, http.StatusBadRequest, "unsupported_media_type", "Please upload a JPG, PNG, WebP image or supported video.")
		default:
			writeError(w, http.StatusInternalServerError, "storage_error", "Could not store the uploaded media.")
		}
		return
	}
	media, err = h.DB.SaveMedia(r.Context(), media)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not save media metadata.")
		return
	}
	writeJSON(w, http.StatusCreated, media)
}

type analyzeRequest struct {
	AnimalID int64               `json:"animal_id"`
	Animal   models.Animal       `json:"animal"`
	MediaID  int64               `json:"media_id"`
	Symptoms models.SymptomInput `json:"symptoms"`
}

func (h *Handler) analyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req analyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Please check the health screening information.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	ctx = ai.WithHuggingFaceToken(ctx, bearerToken(r))
	animal, err := h.resolveAnimal(ctx, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "animal_required", "Please provide or select an animal before analysis.")
		return
	}
	var media models.Media
	if req.MediaID != 0 {
		media, err = h.DB.GetMedia(ctx, req.MediaID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "media_not_found", "Uploaded media was not found.")
			return
		}
	}
	visual, err := h.Vision.AnalyzeMedia(ctx, media, animal, req.Symptoms)
	if err != nil {
		writeError(w, http.StatusBadGateway, "ai_provider_unavailable", "Visual analysis is temporarily unavailable.")
		return
	}
	assessment, err := h.VetAI.Assess(ctx, models.ClinicalInput{Animal: animal, VisualAnalysis: visual, Symptoms: req.Symptoms, Media: media})
	if err != nil {
		writeError(w, http.StatusBadGateway, "ai_provider_unavailable", "Veterinary reasoning is temporarily unavailable.")
		return
	}
	if err := ai.ValidateAssessment(assessment); err != nil {
		writeError(w, http.StatusBadGateway, "invalid_ai_json", "The AI response could not be safely interpreted.")
		return
	}
	screening, err := h.DB.CreateScreening(ctx, models.HealthScreening{
		AnimalID:       animal.ID,
		MediaURL:       media.URL,
		MediaType:      media.Type,
		Symptoms:       req.Symptoms,
		VisualAnalysis: visual,
		Assessment:     assessment,
		Urgency:        assessment.Urgency,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not save the health screening.")
		return
	}
	writeJSON(w, http.StatusCreated, screening)
}

func (h *Handler) resolveAnimal(ctx context.Context, req analyzeRequest) (models.Animal, error) {
	if req.AnimalID != 0 {
		return h.DB.GetAnimal(ctx, req.AnimalID)
	}
	if strings.TrimSpace(req.Animal.Name) == "" {
		req.Animal.Name = "Unnamed Animal"
	}
	if strings.TrimSpace(req.Animal.Species) == "" {
		return models.Animal{}, errors.New("missing species")
	}
	return h.DB.CreateAnimal(ctx, req.Animal)
}

func (h *Handler) screening(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/health-screenings/"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid screening id.")
		return
	}
	screening, err := h.DB.GetScreening(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Health screening not found.")
		return
	}
	writeJSON(w, http.StatusOK, screening)
}

func (h *Handler) nearbyClinics(w http.ResponseWriter, r *http.Request) {
	urgency := r.URL.Query().Get("urgency")
	clinics, err := h.Clinics.Nearby(r.Context(), 0, 0, urgency)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "clinic_error", "Could not load nearby veterinary services.")
		return
	}
	writeJSON(w, http.StatusOK, clinics)
}

func (h *Handler) reminders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		reminders, err := h.DB.ListReminders(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load reminders.")
			return
		}
		writeJSON(w, http.StatusOK, reminders)
	case http.MethodPost:
		var rmd models.Reminder
		if err := json.NewDecoder(r.Body).Decode(&rmd); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Please check the reminder information.")
			return
		}
		created, err := h.DB.CreateReminder(r.Context(), rmd)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_reminder", "Reminder type, title, and due date are required.")
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}

func formFile(r *http.Request, names ...string) (multipart.File, *multipart.FileHeader, error) {
	for _, name := range names {
		file, header, err := r.FormFile(name)
		if err == nil {
			return file, header, nil
		}
	}
	return nil, nil, http.ErrMissingFile
}

func bearerToken(r *http.Request) string {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return strings.TrimSpace(r.Header.Get("X-HuggingFace-Token"))
}

func (h *Handler) userFromRequest(r *http.Request) (models.User, bool) {
	id, err := strconv.ParseInt(strings.TrimSpace(r.Header.Get("X-User-ID")), 10, 64)
	if err != nil || id == 0 {
		return models.User{}, false
	}
	user, err := h.DB.GetUser(r.Context(), id)
	return user, err == nil
}

func authResponse(user models.User) map[string]any {
	return map[string]any{
		"user":  user,
		"token": strconv.FormatInt(user.ID, 10),
	}
}
