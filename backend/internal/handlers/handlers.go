package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	DB             *database.DB
	UserDB         *database.UserDB
	SurveillanceDB *database.SurveillanceDB
	Backups        *database.BackupManager
	Storage        storage.Store
	Vision         ai.VisionProvider
	VetAI          ai.VeterinaryProvider
	Clinics        clinics.Provider
	MediaDir       string
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

	// Outbreak Surveillance, SOS Notifications & Village Clusters
	mux.HandleFunc("/api/outbreaks", h.outbreaks)
	mux.HandleFunc("/api/outbreaks/", h.outbreakSubroutes)
	mux.HandleFunc("/api/notifications", h.notifications)
	mux.HandleFunc("/api/notifications/read", h.markNotificationRead)
	mux.HandleFunc("/api/notifications/read-all", h.markAllNotificationsRead)

	// Vet Second Opinion / Review Queue & Directory
	mux.HandleFunc("/api/vets", h.vetsList)
	mux.HandleFunc("/api/vet-consultations", h.vetConsultations)
	mux.HandleFunc("/api/vet-consultations/review", h.reviewVetConsultation)

	// Medical & Vaccine Inventory Tracking (Vets, NGOs, Gov Dispensaries)
	mux.HandleFunc("/api/inventory", h.inventory)

	// Government & NGO Official Advisories
	mux.HandleFunc("/api/gov-advisories", h.govAdvisories)

	// Clinical Laboratory & Diagnostic Test Results
	mux.HandleFunc("/api/clinic-test-results", h.clinicTestResults)

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
	Name               string `json:"name"`
	FullName           string `json:"full_name"`
	Email              string `json:"email"`
	Password           string `json:"password"`
	Role               string `json:"role"`
	Phone              string `json:"phone"`
	Address            string `json:"address"`
	City               string `json:"city"`
	District           string `json:"district"`
	State              string `json:"state"`
	Pincode            string `json:"pincode"`
	FarmName           string `json:"farm_name"`
	FarmVillage        string `json:"farm_village"`
	FarmTaluka         string `json:"farm_taluka"`
	LivestockTypes     string `json:"livestock_types"`
	HerdSize           int    `json:"herd_size"`
	ClinicName         string `json:"clinic_name"`
	ClinicAddress      string `json:"clinic_address"`
	ClinicHours        string `json:"clinic_hours"`
	ClinicAvailability string `json:"clinic_availability"`
	AvatarURL          string `json:"avatar_url"`
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

	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "pet_owner"
	}

	ip := clientIP(r)
	user, err := h.UserDB.CreateUser(r.Context(), models.User{
		Name:               name,
		Email:              req.Email,
		Role:               role,
		Phone:              req.Phone,
		Address:            req.Address,
		City:               req.City,
		District:           req.District,
		State:              req.State,
		Pincode:            req.Pincode,
		FarmName:           req.FarmName,
		FarmVillage:        req.FarmVillage,
		FarmTaluka:         req.FarmTaluka,
		LivestockTypes:     req.LivestockTypes,
		HerdSize:           req.HerdSize,
		ClinicName:         req.ClinicName,
		ClinicAddress:      req.ClinicAddress,
		ClinicHours:        req.ClinicHours,
		ClinicAvailability: req.ClinicAvailability,
		AvatarURL:          req.AvatarURL,
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
	Name               string `json:"name"`
	Role               string `json:"role"`
	Phone              string `json:"phone"`
	Address                string `json:"address"`
	City                   string `json:"city"`
	District               string `json:"district"`
	State                  string `json:"state"`
	Pincode                string `json:"pincode"`
	FarmName               string `json:"farm_name"`
	FarmVillage            string `json:"farm_village"`
	FarmTaluka             string `json:"farm_taluka"`
	LivestockTypes         string `json:"livestock_types"`
	HerdSize               int    `json:"herd_size"`
	ClinicName             string `json:"clinic_name"`
	ClinicAddress          string `json:"clinic_address"`
	ClinicHours            string `json:"clinic_hours"`
	ClinicAvailability     string `json:"clinic_availability"`
	ClinicVisitingLocation string `json:"clinic_visiting_location"`
	UnavailabilityNotice   string `json:"unavailability_notice"`
	AvatarURL              string `json:"avatar_url"`
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

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = user.Name
	}
	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = user.Role
	}

	updated, err := h.UserDB.UpdateProfile(r.Context(), models.User{
		ID:                     user.ID,
		Name:                   name,
		Role:                   role,
		Phone:                  req.Phone,
		Address:                req.Address,
		City:                   req.City,
		District:               req.District,
		State:                  req.State,
		Pincode:                req.Pincode,
		FarmName:               req.FarmName,
		FarmVillage:            req.FarmVillage,
		FarmTaluka:             req.FarmTaluka,
		LivestockTypes:         req.LivestockTypes,
		HerdSize:               req.HerdSize,
		ClinicName:             req.ClinicName,
		ClinicAddress:          req.ClinicAddress,
		ClinicHours:            req.ClinicHours,
		ClinicAvailability:     req.ClinicAvailability,
		ClinicVisitingLocation: req.ClinicVisitingLocation,
		UnavailabilityNotice:   req.UnavailabilityNotice,
		AvatarURL:              req.AvatarURL,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not update profile: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) vetsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	district := r.URL.Query().Get("district")
	if user, ok := h.userFromRequest(r); ok && district == "" {
		district = user.District
	}
	list, err := h.UserDB.ListVets(r.Context(), district)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not load veterinarians.")
		return
	}
	writeJSON(w, http.StatusOK, list)
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
		user, ok := h.userFromRequest(r)
		if !ok {
			writeJSON(w, http.StatusOK, []models.Animal{})
			return
		}
		q := r.URL.Query().Get("q")
		tagNumber := r.URL.Query().Get("tag_number")
		if tagNumber == "" {
			tagNumber = r.URL.Query().Get("pashu_aadhaar")
		}

		if user.Role == "vet" {
			animals, err := h.DB.ListAnimalsForVet(r.Context(), q, tagNumber)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "database_error", "Could not load animals: "+err.Error())
				return
			}
			writeJSON(w, http.StatusOK, animals)
			return
		}

		animals, err := h.DB.ListAnimals(r.Context(), user.ID)
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
	case http.MethodPut:
		user, ok := h.userFromRequest(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Please sign in to update animal profiles.")
			return
		}
		var a models.Animal
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil || a.ID == 0 {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid animal data or missing ID.")
			return
		}
		a.UserID = user.ID
		updated, err := h.DB.UpdateAnimal(r.Context(), a)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not update animal: "+err.Error())
			return
		}
		writeJSON(w, http.StatusOK, updated)
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

	if parts[0] == "tag" && len(parts) >= 2 && r.Method == http.MethodGet {
		tagNumber := parts[1]
		animal, err := h.DB.GetAnimalByTagNumber(r.Context(), tagNumber)
		if err != nil {
			writeError(w, http.StatusNotFound, "not_found", "No animal profile found with Pashu Aadhaar #"+tagNumber)
			return
		}
		writeJSON(w, http.StatusOK, animal)
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
			status := http.StatusNotFound
			writeError(w, status, "not_found", "Animal not found.")
			return
		}
		writeJSON(w, http.StatusOK, animal)
		return
	}
	if len(parts) == 1 && r.Method == http.MethodPut {
		user, ok := h.userFromRequest(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Please sign in to update animal profiles.")
			return
		}
		var a models.Animal
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid animal data.")
			return
		}
		a.ID = id
		a.UserID = user.ID
		updated, err := h.DB.UpdateAnimal(r.Context(), a)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, updated)
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		user, ok := h.userFromRequest(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Please sign in to delete animal profiles.")
			return
		}
		if err := h.DB.DeleteAnimal(r.Context(), id, user.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	if len(parts) == 2 && parts[1] == "history" && r.Method == http.MethodGet {
		user, ok := h.userFromRequest(r)
		if !ok {
			writeJSON(w, http.StatusOK, []models.HealthScreening{})
			return
		}
		history, err := h.DB.ListScreenings(r.Context(), user.ID, id)
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

	var user models.User
	var ok bool
	if u, found := h.userFromRequest(r); found {
		user = u
		ok = true
	}

	screeningDistrict := ""
	screeningTaluka := ""
	screeningFarm := ""
	if ok {
		screeningDistrict = user.District
		screeningTaluka = user.FarmTaluka
		screeningFarm = user.FarmName
	}

	screening, err := h.DB.CreateScreening(ctx, models.HealthScreening{
		AnimalID:       animal.ID,
		UserID:         animal.UserID,
		MediaURL:       media.URL,
		MediaType:      media.Type,
		Symptoms:       req.Symptoms,
		VisualAnalysis: visual,
		Assessment:     assessment,
		Urgency:        assessment.Urgency,
		District:       screeningDistrict,
		Taluka:         screeningTaluka,
		FarmName:       screeningFarm,
	})
	if err != nil {
		log.Printf("Failed to save health screening: %v (animal_id=%d, media_url=%s)", err, animal.ID, media.URL)
		writeError(w, http.StatusInternalServerError, "database_error", "Could not save the health screening: "+err.Error())
		return
	}

	// Automatic Outbreak Sensing & SOS Dispatch
	if h.SurveillanceDB != nil && len(assessment.PossibleConditions) > 0 {
		topCondition := assessment.PossibleConditions[0]
		isHighUrgency := strings.ToLower(assessment.Urgency) == "high" || strings.ToLower(assessment.Urgency) == "emergency"
		isContagious := strings.ToLower(topCondition.Likelihood) == "high" || strings.ToLower(topCondition.Likelihood) == "moderate"

		if isHighUrgency || isContagious {
			district := screeningDistrict
			if district == "" {
				district = "Pune" // default region if unspecified
			}
			taluka := screeningTaluka
			if taluka == "" {
				taluka = "Central"
			}
			species := animal.Species
			if species == "" {
				species = "Animal"
			}

			go func() {
				bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				_, _ = h.SurveillanceDB.CreateOrUpdateOutbreak(bgCtx, models.Outbreak{
					DiseaseName:     topCondition.Name,
					Species:         species,
					District:        district,
					Taluka:          taluka,
					Village:         user.FarmVillage,
					FarmName:        user.FarmName,
					AffectedCount:   1,
					Severity:        strings.ToUpper(assessment.Urgency),
					PreventionGuide: strings.Join(assessment.RecommendedNextSteps, " "),
				})
			}()
		}
	}

	writeJSON(w, http.StatusCreated, screening)
}

func (h *Handler) resolveAnimal(ctx context.Context, req analyzeRequest, r *http.Request) (models.Animal, error) {
	if req.AnimalID != 0 {
		return h.DB.GetAnimal(ctx, req.AnimalID)
	}
	userID := int64(1)
	district := ""
	taluka := ""
	if user, ok := h.userFromRequest(r); ok {
		userID = user.ID
		district = user.District
		taluka = user.FarmTaluka
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
	if req.Animal.District == "" {
		req.Animal.District = district
	}
	if req.Animal.Taluka == "" {
		req.Animal.Taluka = taluka
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
		user, ok := h.userFromRequest(r)
		if !ok {
			writeJSON(w, http.StatusOK, []models.Reminder{})
			return
		}
		remindersList, err := h.DB.ListReminders(r.Context(), user.ID)
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

// ----------------- Surveillance, SOS Notifications & Inventory -----------------

func (h *Handler) outbreaks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		district := r.URL.Query().Get("district")
		species := r.URL.Query().Get("species")
		if user, ok := h.userFromRequest(r); ok && district == "" {
			district = user.District
		}
		list, err := h.SurveillanceDB.ListOutbreaks(r.Context(), district, species)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load outbreaks.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var ob models.Outbreak
		if err := json.NewDecoder(r.Body).Decode(&ob); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid outbreak details.")
			return
		}
		created, err := h.SurveillanceDB.CreateOrUpdateOutbreak(r.Context(), ob)
		if err != nil {
			writeError(w, http.StatusBadRequest, "outbreak_error", err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) outbreakSubroutes(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/outbreaks/")
	if sub == "report-recovery" && r.Method == http.MethodPost {
		var req struct {
			OutbreakID     int64  `json:"outbreak_id"`
			RecoveredCount int    `json:"recovered_count"`
			Notes          string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OutbreakID == 0 {
			writeError(w, http.StatusBadRequest, "invalid_json", "Outbreak ID is required.")
			return
		}
		reporterName := "Local Farmer / Herdsman"
		reporterRole := "farmer"
		if user, ok := h.userFromRequest(r); ok {
			reporterName = user.Name
			reporterRole = user.Role
		}
		updated, err := h.SurveillanceDB.ReportOutbreakRecovery(r.Context(), req.OutbreakID, req.RecoveredCount, req.Notes, reporterName, reporterRole)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, updated)
		return
	}

	if sub == "resolve" && r.Method == http.MethodPost {
		user, ok := h.userFromRequest(r)
		if !ok || (user.Role != "vet" && user.Role != "ngo" && user.Role != "gov") {
			writeError(w, http.StatusForbidden, "unauthorized", "Only veterinarians and officials can mark outbreaks as officially resolved.")
			return
		}
		var req struct {
			OutbreakID int64  `json:"outbreak_id"`
			Notes      string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OutbreakID == 0 {
			writeError(w, http.StatusBadRequest, "invalid_json", "Outbreak ID is required.")
			return
		}
		updated, err := h.SurveillanceDB.ResolveOutbreak(r.Context(), req.OutbreakID, req.Notes, user.Name)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, updated)
		return
	}

	if r.Method == http.MethodGet {
		id, err := strconv.ParseInt(sub, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_id", "Invalid outbreak ID.")
			return
		}
		ob, err := h.SurveillanceDB.GetOutbreakByID(r.Context(), id)
		if err != nil {
			writeError(w, http.StatusNotFound, "not_found", "Outbreak not found.")
			return
		}
		writeJSON(w, http.StatusOK, ob)
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (h *Handler) notifications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := int64(0)
	role := ""
	district := ""
	if user, ok := h.userFromRequest(r); ok {
		userID = user.ID
		role = user.Role
		district = user.District
	}
	list, err := h.SurveillanceDB.ListNotifications(r.Context(), userID, role, district)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", "Could not load notifications.")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID int64 `json:"id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	_ = h.SurveillanceDB.MarkNotificationRead(r.Context(), req.ID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) markAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := int64(0)
	if user, ok := h.userFromRequest(r); ok {
		userID = user.ID
	}
	_ = h.SurveillanceDB.MarkAllNotificationsRead(r.Context(), userID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) vetConsultations(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		user, ok := h.userFromRequest(r)
		if !ok {
			writeJSON(w, http.StatusOK, []models.VetConsultation{})
			return
		}
		status := r.URL.Query().Get("status")
		var list []models.VetConsultation
		var err error
		if user.Role == "vet" {
			// Vets see all cases in queue
			list, err = h.SurveillanceDB.ListVetConsultations(r.Context(), user.ID, 0, status)
		} else {
			// Farmers / Pet owners see their submitted cases
			list, err = h.SurveillanceDB.ListVetConsultations(r.Context(), 0, user.ID, status)
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load case reviews.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var raw struct {
			ScreeningID int64  `json:"screening_id"`
			AnimalName  string `json:"animal_name"`
			Species     string `json:"species"`
			Breed       string `json:"breed"`
			MediaURL    string `json:"media_url"`
			Symptoms    any    `json:"symptoms"`
			DoubtReason string `json:"doubt_reason"`
			OwnerNotes  string `json:"owner_notes"`
			AIDiagnosis string `json:"ai_diagnosis"`
			AIUrgency   string `json:"ai_urgency"`
		}
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid consultation request.")
			return
		}

		var symList []string
		switch v := raw.Symptoms.(type) {
		case []any:
			for _, item := range v {
				if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
					symList = append(symList, strings.TrimSpace(s))
				}
			}
		case []string:
			symList = v
		case string:
			if strings.TrimSpace(v) != "" {
				symList = []string{strings.TrimSpace(v)}
			}
		}

		c := models.VetConsultation{
			ScreeningID: raw.ScreeningID,
			AnimalName:  raw.AnimalName,
			Species:     raw.Species,
			Breed:       raw.Breed,
			MediaURL:    raw.MediaURL,
			Symptoms:    symList,
			OwnerNotes:  raw.OwnerNotes,
			AIDiagnosis: raw.AIDiagnosis,
			AIUrgency:   raw.AIUrgency,
		}
		if c.AnimalName == "" {
			c.AnimalName = "Patient"
		}
		if c.Species == "" {
			c.Species = "Animal"
		}
		if c.AIDiagnosis == "" {
			c.AIDiagnosis = "Clinical Review Required"
		}
		if raw.DoubtReason != "" && c.OwnerNotes == "" {
			c.OwnerNotes = raw.DoubtReason
		}

		if user, ok := h.userFromRequest(r); ok {
			c.UserID = user.ID
			c.UserName = user.Name
			c.UserRole = user.Role
			c.UserPhone = user.Phone
			c.Location = user.District
			if user.FarmName != "" {
				c.Location = user.FarmName + ", " + user.District
			}
		}
		created, err := h.SurveillanceDB.RequestVetConsultation(r.Context(), c)
		if err != nil {
			writeError(w, http.StatusBadRequest, "consultation_error", err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) reviewVetConsultation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	user, ok := h.userFromRequest(r)
	if !ok || user.Role != "vet" {
		writeError(w, http.StatusForbidden, "vet_only", "Only licensed veterinarians can review diagnostic cases.")
		return
	}

	var req struct {
		ID           int64  `json:"id"`
		Diagnosis    string `json:"diagnosis"`
		Suggestion   string `json:"suggestion"`
		Prescription string `json:"prescription"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == 0 {
		writeError(w, http.StatusBadRequest, "invalid_json", "Case ID and suggestions are required.")
		return
	}

	reviewed, err := h.SurveillanceDB.ReviewVetConsultation(r.Context(), req.ID, user.ID, user.Name, req.Diagnosis, req.Suggestion, req.Prescription)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, reviewed)
}

func (h *Handler) inventory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		district := r.URL.Query().Get("district")
		orgType := r.URL.Query().Get("org_type")
		userID := int64(0)
		if r.URL.Query().Get("my_inventory") == "true" {
			if user, ok := h.userFromRequest(r); ok {
				userID = user.ID
			}
		}
		list, err := h.SurveillanceDB.ListInventory(r.Context(), district, orgType, userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load inventory items.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost, http.MethodPut:
		user, ok := h.userFromRequest(r)
		if !ok || (user.Role != "vet" && user.Role != "ngo" && user.Role != "gov") {
			writeError(w, http.StatusForbidden, "unauthorized", "Only veterinarians, NGOs, and government dispensaries can manage medical inventory.")
			return
		}
		var item models.InventoryItem
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid inventory item format.")
			return
		}
		item.UserID = user.ID
		if item.OwnerName == "" {
			item.OwnerName = user.ClinicName
			if item.OwnerName == "" {
				item.OwnerName = user.Name
			}
		}
		if item.OrgType == "" {
			if user.Role == "vet" {
				item.OrgType = "clinic"
			} else if user.Role == "ngo" {
				item.OrgType = "ngo"
			} else {
				item.OrgType = "gov_dispensary"
			}
		}
		if item.District == "" {
			item.District = user.District
		}
		upserted, err := h.SurveillanceDB.UpsertInventory(r.Context(), item)
		if err != nil {
			writeError(w, http.StatusBadRequest, "inventory_error", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, upserted)
	case http.MethodDelete:
		user, ok := h.userFromRequest(r)
		if !ok || (user.Role != "vet" && user.Role != "ngo" && user.Role != "gov") {
			writeError(w, http.StatusForbidden, "unauthorized", "Only authorized providers can delete stock items.")
			return
		}
		idStr := r.URL.Query().Get("id")
		id, _ := strconv.ParseInt(idStr, 10, 64)
		if id == 0 {
			writeError(w, http.StatusBadRequest, "invalid_id", "Inventory item ID is required.")
			return
		}
		if err := h.SurveillanceDB.DeleteInventory(r.Context(), id, user.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) govAdvisories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		district := r.URL.Query().Get("district")
		if user, ok := h.userFromRequest(r); ok && district == "" {
			district = user.District
		}
		list, err := h.SurveillanceDB.ListGovAdvisories(r.Context(), district)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load advisories.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		user, ok := h.userFromRequest(r)
		if !ok || (user.Role != "ngo" && user.Role != "gov" && user.Role != "vet") {
			writeError(w, http.StatusForbidden, "unauthorized", "Only NGO and Government officials can publish official circulars and advisories.")
			return
		}
		var adv models.GovAdvisory
		if err := json.NewDecoder(r.Body).Decode(&adv); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid advisory payload.")
			return
		}
		if strings.TrimSpace(adv.Title) == "" || strings.TrimSpace(adv.Content) == "" {
			writeError(w, http.StatusBadRequest, "missing_fields", "Directive title and content are required.")
			return
		}
		if adv.Issuer == "" {
			adv.Issuer = user.Name
		}
		if adv.District == "" {
			adv.District = user.District
			if adv.District == "" {
				adv.District = "Statewide"
			}
		}
		if adv.DateIssued == "" {
			adv.DateIssued = time.Now().Format("02 Jan 2006")
		}
		if adv.Urgency == "" {
			adv.Urgency = "HIGH"
		}
		created, err := h.SurveillanceDB.CreateGovAdvisory(r.Context(), adv)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) clinicTestResults(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		user, ok := h.userFromRequest(r)
		if !ok {
			writeJSON(w, http.StatusOK, []models.ClinicTestResult{})
			return
		}
		animalIDStr := r.URL.Query().Get("animal_id")
		animalID, _ := strconv.ParseInt(animalIDStr, 10, 64)
		vetID := int64(0)
		userID := user.ID
		if user.Role == "vet" {
			vetID = user.ID
		}
		list, err := h.DB.ListClinicTestResults(r.Context(), animalID, userID, vetID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not load laboratory test results.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		user, ok := h.userFromRequest(r)
		if !ok || user.Role != "vet" {
			writeError(w, http.StatusForbidden, "unauthorized", "Only licensed veterinarians can publish laboratory test results.")
			return
		}
		var testRes models.ClinicTestResult
		if err := json.NewDecoder(r.Body).Decode(&testRes); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Invalid test result data.")
			return
		}
		if testRes.AnimalID <= 0 || strings.TrimSpace(testRes.TestType) == "" || strings.TrimSpace(testRes.Interpretation) == "" {
			writeError(w, http.StatusBadRequest, "missing_fields", "Animal ID, Test Type, and Interpretation are required.")
			return
		}
		testRes.VetID = user.ID
		testRes.VetName = user.Name
		testRes.ClinicName = user.ClinicName

		// Look up animal owner if not provided
		if testRes.UserID <= 0 {
			if animal, err := h.DB.GetAnimal(r.Context(), testRes.AnimalID); err == nil {
				testRes.UserID = animal.UserID
				testRes.AnimalName = animal.Name
			}
		}

		created, err := h.DB.CreateClinicTestResult(r.Context(), testRes)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database_error", "Could not save test result: "+err.Error())
			return
		}

		// Broadcast real-time notification to the animal owner
		if created.UserID > 0 {
			animalName := "Patient"
			if a, err := h.DB.GetAnimal(r.Context(), created.AnimalID); err == nil && a.Name != "" {
				animalName = a.Name
			}
			severity := "INFO"
			if strings.EqualFold(created.Status, "Critical") {
				severity = "CRITICAL"
			} else if strings.EqualFold(created.Status, "Abnormal") {
				severity = "URGENT"
			}
			_, _ = h.SurveillanceDB.ExecContext(r.Context(), `
INSERT INTO notifications (user_id, role_target, district, title, message, severity, is_sos, read, action_url, created_at)
VALUES (?, 'all', ?, ?, ?, ?, 0, 0, '#dashboard', CURRENT_TIMESTAMP)`,
				created.UserID,
				user.District,
				fmt.Sprintf("🧪 Lab Test Results Published for %s", animalName),
				fmt.Sprintf("Dr. %s (%s) published %s results. Diagnostic status: %s. %s", user.Name, user.ClinicName, created.TestType, created.Status, created.Interpretation),
				severity,
			)
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
