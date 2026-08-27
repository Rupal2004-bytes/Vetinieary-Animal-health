package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
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
	UserDB   *database.UserDB
	Backups  *database.BackupManager
	Storage  storage.Store
	Vision   ai.VisionProvider
	VetAI    ai.VeterinaryProvider
	Clinics  clinics.Provider
	MediaDir string
}

func (h *Handler) Register(mux *http.ServeMux) {
	// Health & System
	mux.HandleFunc("/api/health", h.health)

	// User Authentication & Account Management (backed by user.db)
	mux.HandleFunc("/api/auth/login", h.login)
	mux.HandleFunc("/api/auth/signup", h.signup)
	mux.HandleFunc("/api/auth/register", h.signup)
	mux.HandleFunc("/api/auth/logout", h.logout)
	mux.HandleFunc("/api/auth/me", h.me)
	mux.HandleFunc("/api/auth/profile", h.updateProfile)
	mux.HandleFunc("/api/auth/change-password", h.changePassword)
	mux.HandleFunc("/api/auth/logs", h.authLogs)
	mux.HandleFunc("/api/account/huggingface", h.connectHuggingFace)

	// Core Veterinary Entities & Health Screenings
	mux.HandleFunc("/api/animals", h.animals)
	mux.HandleFunc("/api/animals/", h.animalSubroutes)
	mux.HandleFunc("/api/health-check/upload", h.upload)
	mux.HandleFunc("/api/health-check/analyze", h.analyze)
	mux.HandleFunc("/api/health-screenings/", h.screening)
	mux.HandleFunc("/api/clinics/nearby", h.nearbyClinics)
	mux.HandleFunc("/api/reminders", h.reminders)

	// Media File Server
	mux.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir(h.MediaDir))))
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"demo_mode": false,
		"time":      time.Now().Format(time.RFC3339),
	})
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
		writeError(w, http.StatusBadRequest, "invalid_json", "Please check your login credentials format.")
		return
	}

	ip := clientIP(r)
	userAgent := r.UserAgent()
	authRes, err := h.UserDB.AuthenticateUser(r.Context(), req.Email, req.Password, ip, userAgent)
	if err != nil {
		status := http.StatusUnauthorized
		if !errors.Is(err, database.ErrInvalidCredentials) {
			status = http.StatusInternalServerError
		}
		writeError(w, status, "invalid_credentials", "Invalid email or password.")
		return
	}

	writeJSON(w, http.StatusOK, authRes)
}

func (h *Handler) signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Please check your registration details.")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = strings.TrimSpace(req.FullName)
	}
	if name == "" || strings.TrimSpace(req.Email) == "" || len(req.Password) < 4 {
		writeError(w, http.StatusBadRequest, "invalid_input", "Name, valid email, and password (at least 4 characters) are required.")
		return
	}

	ip := clientIP(r)
	user, err := h.UserDB.CreateUser(r.Context(), models.User{
		Name:  name,
		Email: req.Email,
		Role:  req.Role,
	}, req.Password, ip)

	if err != nil {
		if errors.Is(err, database.ErrEmailAlreadyExists) {
			writeError(w, http.StatusConflict, "email_in_use", "An account with this email address already exists.")
			return
		}
		writeError(w, http.StatusBadRequest, "signup_failed", err.Error())
		return
	}

	authRes, err := h.UserDB.AuthenticateUser(r.Context(), req.Email, req.Password, ip, r.UserAgent())
	if err != nil {
		writeJSON(w, http.StatusCreated, map[string]any{"user": user})
		return
	}

	writeJSON(w, http.StatusCreated, authRes)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	token := extractToken(r)
	ip := clientIP(r)
	_ = h.UserDB.RevokeSession(r.Context(), token, ip)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Logged out successfully."})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not_signed_in", "Please sign in to access your profile.")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

type updateProfileRequest struct {
	Name       string `json:"name"`
	Role       string `json:"role"`
	Phone      string `json:"phone"`
	ClinicName string `json:"clinic_name"`
	AvatarURL  string `json:"avatar_url"`
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not_signed_in", "Please sign in to update your profile.")
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid profile update data.")
		return
	}

	updated, err := h.UserDB.UpdateProfile(r.Context(), user.ID, req.Name, req.Role, req.Phone, req.ClinicName, req.AvatarURL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not update profile: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

type changePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not_signed_in", "Please sign in to change password.")
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid password data.")
		return
	}

	if len(req.NewPassword) < 4 {
		writeError(w, http.StatusBadRequest, "invalid_password", "New password must be at least 4 characters.")
		return
	}

	ip := clientIP(r)
	if err := h.UserDB.ChangePassword(r.Context(), user.ID, req.OldPassword, req.NewPassword, ip); err != nil {
		writeError(w, http.StatusBadRequest, "password_change_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Password changed successfully."})
}

func (h *Handler) authLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not_signed_in", "Please sign in to view security activity.")
		return
	}

	logs, err := h.UserDB.GetAuthLogs(r.Context(), user.ID, 30)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not retrieve activity logs.")
		return
	}

	writeJSON(w, http.StatusOK, logs)
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
		writeError(w, http.StatusBadRequest, "invalid_token", "Please enter a valid Hugging Face access token (starts with hf_).")
		return
	}
	updated, err := h.UserDB.SetHuggingFaceConnected(r.Context(), user.ID, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not update your account connection.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": updated, "connected": true})
}

func (h *Handler) animals(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		userID := int64(0)
		if user, ok := h.userFromRequest(r); ok {
			userID = user.ID
		}
		animals, err := h.DB.ListAnimals(r.Context(), userID)
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
		if user, ok := h.userFromRequest(r); ok {
			a.UserID = user.ID
		}
		created, err := h.DB.CreateAnimal(r.Context(), a)
		if err != nil {
			log.Printf("CreateAnimal DB error: %v", err)
			writeError(w, http.StatusInternalServerError, "database_error", "Could not save animal: "+err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
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
			writeError(w, status, "not_found", "Animal not found.")
			return
		}
		writeJSON(w, http.StatusOK, animal)
		return
	}
	if len(parts) == 2 && parts[1] == "history" && r.Method == http.MethodGet {
		userID := int64(0)
		if user, ok := h.userFromRequest(r); ok {
			userID = user.ID
		}
		history, err := h.DB.ListScreenings(r.Context(), userID, id)
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
	MediaURL string              `json:"media_url"`
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
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()
	ctx = ai.WithHuggingFaceToken(ctx, bearerToken(r))

	animal, err := h.resolveAnimal(ctx, req, r)
	if err != nil {
		animal = models.Animal{Name: "Patient", Species: "Animal"}
	}

	var media models.Media
	if req.MediaID != 0 {
		media, err = h.DB.GetMedia(ctx, req.MediaID)
		if err != nil {
			if req.MediaURL != "" {
				media = models.Media{URL: req.MediaURL, Type: "image", MIMEType: "image/jpeg"}
			} else {
				writeError(w, http.StatusBadRequest, "media_not_found", "Uploaded media was not found.")
				return
			}
		}
	} else if req.MediaURL != "" {
		media = models.Media{URL: req.MediaURL, Type: "image", MIMEType: "image/jpeg"}
	}

	visual, err := h.Vision.AnalyzeMedia(ctx, media, animal, req.Symptoms)
	if err != nil {
		writeError(w, http.StatusBadGateway, "ai_provider_unavailable", "Visual analysis error: "+err.Error())
		return
	}
	if visual.Animal != "" && (animal.Species == "" || animal.Species == "Animal" || animal.Species == "animal" || animal.Species == "Unnamed Animal") {
		animal.Species = visual.Animal
	}

	if animal.ID == 0 {
		userID := int64(1)
		if user, ok := h.userFromRequest(r); ok {
			userID = user.ID
		}
		species := animal.Species
		if species == "" {
			species = "Animal"
		}
		createdAnimal, err := h.DB.CreateAnimal(ctx, models.Animal{
			UserID:  userID,
			Name:    "Patient",
			Species: species,
		})
		if err == nil {
			animal = createdAnimal
		}
	}

	assessment, err := h.VetAI.Assess(ctx, models.ClinicalInput{Animal: animal, VisualAnalysis: visual, Symptoms: req.Symptoms, Media: media})
	if err != nil {
		writeError(w, http.StatusBadGateway, "ai_provider_unavailable", "Veterinary reasoning error: "+err.Error())
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
		log.Printf("Failed to save health screening: %v (animal_id=%d, media_url=%s)", err, animal.ID, media.URL)
		writeError(w, http.StatusInternalServerError, "database_error", "Could not save the health screening: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, screening)
}

func (h *Handler) resolveAnimal(ctx context.Context, req analyzeRequest, r *http.Request) (models.Animal, error) {
	if req.AnimalID != 0 {
		return h.DB.GetAnimal(ctx, req.AnimalID)
	}
	userID := int64(1)
	if user, ok := h.userFromRequest(r); ok {
		userID = user.ID
	}
	name := strings.TrimSpace(req.Animal.Name)
	if name == "" {
		name = "Patient"
	}
	species := strings.TrimSpace(req.Animal.Species)
	if species == "" {
		species = "Animal"
	}
	req.Animal.UserID = userID
	req.Animal.Name = name
	req.Animal.Species = species
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
	clinicsList, err := h.Clinics.Nearby(r.Context(), 0, 0, urgency)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "clinics_unavailable", "Could not find nearby veterinary clinics.")
		return
	}
	writeJSON(w, http.StatusOK, clinicsList)
}

func (h *Handler) reminders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		userID := int64(0)
		if user, ok := h.userFromRequest(r); ok {
			userID = user.ID
		}
		remindersList, err := h.DB.ListReminders(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load reminders.")
			return
		}
		writeJSON(w, http.StatusOK, remindersList)
	case http.MethodPost:
		var rmd models.Reminder
		if err := json.NewDecoder(r.Body).Decode(&rmd); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Please check the reminder details.")
			return
		}
		if user, ok := h.userFromRequest(r); ok {
			rmd.UserID = user.ID
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

// Helpers

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
	if token := strings.TrimSpace(r.Header.Get("X-HuggingFace-Token")); strings.HasPrefix(token, "hf_") {
		return token
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		token := strings.TrimSpace(auth[7:])
		if strings.HasPrefix(token, "hf_") {
			return token
		}
	}
	return ""
}

func extractToken(r *http.Request) string {
	if tok := strings.TrimSpace(r.Header.Get("X-Auth-Token")); tok != "" {
		return tok
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		token := strings.TrimSpace(auth[7:])
		if !strings.HasPrefix(token, "hf_") {
			return token
		}
	}
	return strings.TrimSpace(r.Header.Get("X-User-ID"))
}

func (h *Handler) userFromRequest(r *http.Request) (models.User, bool) {
	if tok := strings.TrimSpace(r.Header.Get("X-Auth-Token")); tok != "" {
		if user, err := h.UserDB.GetUserByToken(r.Context(), tok); err == nil {
			return user, true
		}
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		token := strings.TrimSpace(auth[7:])
		if !strings.HasPrefix(token, "hf_") {
			if user, err := h.UserDB.GetUserByToken(r.Context(), token); err == nil {
				return user, true
			}
		}
	}
	if uidStr := strings.TrimSpace(r.Header.Get("X-User-ID")); uidStr != "" {
		if id, err := strconv.ParseInt(uidStr, 10, 64); err == nil && id > 0 {
			if user, err := h.UserDB.GetUserByID(r.Context(), id); err == nil {
				return user, true
			}
		}
	}
	return models.User{}, false
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	return strings.TrimSpace(strings.Split(r.RemoteAddr, ":")[0])
}
