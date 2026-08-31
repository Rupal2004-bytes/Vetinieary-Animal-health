package models

import "time"

type User struct {
	ID                 int64      `json:"id"`
	Name               string     `json:"name"`
	Email              string     `json:"email"`
	Role               string     `json:"role"` // pet_owner, farmer, vet, ngo, gov
	HFConnected        bool       `json:"hf_connected"`
	Phone              string     `json:"phone,omitempty"`
	Address            string     `json:"address,omitempty"`
	City               string     `json:"city,omitempty"`
	District           string     `json:"district,omitempty"`
	State              string     `json:"state,omitempty"`
	Pincode            string     `json:"pincode,omitempty"`
	FarmName           string     `json:"farm_name,omitempty"`
	FarmVillage        string     `json:"farm_village,omitempty"`
	FarmTaluka         string     `json:"farm_taluka,omitempty"`
	LivestockTypes     string     `json:"livestock_types,omitempty"`
	HerdSize           int        `json:"herd_size,omitempty"`
	ClinicName             string     `json:"clinic_name,omitempty"`
	ClinicAddress          string     `json:"clinic_address,omitempty"`
	ClinicHours            string     `json:"clinic_hours,omitempty"`
	ClinicAvailability     string     `json:"clinic_availability,omitempty"`
	ClinicVisitingLocation string     `json:"clinic_visiting_location,omitempty"`
	UnavailabilityNotice   string     `json:"unavailability_notice,omitempty"`
	AvatarURL              string     `json:"avatar_url,omitempty"`
	PasswordHash           string     `json:"-"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
	LastLoginAt            *time.Time `json:"last_login_at,omitempty"`
}

type AuthSession struct {
	Token     string    `json:"token"`
	UserID    int64     `json:"user_id"`
	UserAgent string    `json:"user_agent"`
	IPAddress string    `json:"ip_address"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type AuthResponse struct {
	User      User      `json:"user"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

type AuthLog struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Email     string    `json:"email"`
	Event     string    `json:"event"`
	IPAddress string    `json:"ip_address"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

type BackupMeta struct {
	Filename      string    `json:"filename"`
	Database      string    `json:"database"`
	Path          string    `json:"path"`
	SizeBytes     int64     `json:"size_bytes"`
	SizeFormatted string    `json:"size_formatted"`
	SHA256        string    `json:"sha256"`
	CreatedAt     time.Time `json:"created_at"`
	Status        string    `json:"status"`
}

type MigrationInfo struct {
	Version   int       `json:"version"`
	Name      string    `json:"name"`
	AppliedAt time.Time `json:"applied_at"`
}

type DatabaseHealth struct {
	Database       string          `json:"database"`
	Path           string          `json:"path"`
	IntegrityOK    bool            `json:"integrity_ok"`
	QuickCheckOK   bool            `json:"quick_check_ok"`
	TotalTables    int             `json:"total_tables"`
	SizeBytes      int64           `json:"size_bytes"`
	SizeFormatted  string          `json:"size_formatted"`
	CurrentVersion int             `json:"current_version"`
	Migrations     []MigrationInfo `json:"migrations"`
}

type Animal struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Name      string    `json:"name"`
	Species   string    `json:"species"`
	Breed     string    `json:"breed"`
	Age       string    `json:"age"`
	Sex       string    `json:"sex"`
	TagNumber string    `json:"tag_number,omitempty"` // Pashu Aadhaar 12-digit Ear Tag
	HerdSize  int       `json:"herd_size,omitempty"`
	Village   string    `json:"village,omitempty"`
	Taluka    string    `json:"taluka,omitempty"`
	District  string    `json:"district,omitempty"`
	PhotoURL  string    `json:"photo_url"`
	Notes     string    `json:"notes"`
	Weight    string    `json:"weight"`
	CreatedAt time.Time `json:"created_at"`
}

type ClinicTestResult struct {
	ID                 int64     `json:"id"`
	AnimalID           int64     `json:"animal_id"`
	AnimalName         string    `json:"animal_name,omitempty"`
	Species            string    `json:"species,omitempty"`
	UserID             int64     `json:"user_id"`
	VetID              int64     `json:"vet_id"`
	VetName            string    `json:"vet_name"`
	ClinicName         string    `json:"clinic_name"`
	TestType           string    `json:"test_type"`
	SampleDate         string    `json:"sample_date"`
	TestParametersJSON string    `json:"test_parameters_json,omitempty"`
	Interpretation     string    `json:"interpretation"`
	Status             string    `json:"status"` // Normal, Abnormal, Critical
	Recommendation     string    `json:"recommendation"`
	CreatedAt          time.Time `json:"created_at"`
}

type Media struct {
	ID        int64     `json:"id"`
	URL       string    `json:"url"`
	Path      string    `json:"-"`
	Type      string    `json:"type"`
	MIMEType  string    `json:"mime_type"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}

type SymptomInput struct {
	Symptoms           []string `json:"symptoms"`
	Duration           string   `json:"duration"`
	GettingWorse       bool     `json:"getting_worse"`
	RecentInjury       bool     `json:"recent_injury"`
	RecentVaccination  bool     `json:"recent_vaccination"`
	ContactSickAnimals bool     `json:"contact_sick_animals"`
	Other              string   `json:"other"`
}

type VisualAnalysis struct {
	Animal                   string   `json:"animal"`
	VisibleAbnormalities     []string `json:"visible_abnormalities"`
	AffectedBodyParts        []string `json:"affected_body_parts"`
	LesionDescription        string   `json:"lesion_description"`
	SkinChanges              []string `json:"skin_changes"`
	Wounds                   []string `json:"wounds"`
	Swelling                 []string `json:"swelling"`
	Discharge                []string `json:"discharge"`
	BehavioralObservations   []string `json:"behavioral_observations"`
	SeverityVisibleSymptoms  string   `json:"severity_of_visible_symptoms"`
	ImageQuality             string   `json:"image_quality"`
	NonDiagnosticObservation string   `json:"non_diagnostic_observation"`
}

type PossibleCondition struct {
	Name       string `json:"name"`
	Likelihood string `json:"likelihood"`
	Reason     string `json:"reason"`
}

type ClinicalAssessment struct {
	Summary              string              `json:"summary"`
	PossibleConditions   []PossibleCondition `json:"possible_conditions"`
	Urgency              string              `json:"urgency"`
	RecommendedNextSteps []string            `json:"recommended_next_steps"`
	SupportiveCare       []string            `json:"supportive_care"`
	Avoid                []string            `json:"avoid"`
	VeterinaryAttention  string              `json:"veterinary_attention"`
	Disclaimer           string              `json:"disclaimer"`
}

type ClinicalInput struct {
	Animal         Animal         `json:"animal"`
	VisualAnalysis VisualAnalysis `json:"visual_analysis"`
	Symptoms       SymptomInput   `json:"symptoms"`
	Media          Media          `json:"media"`
}

type HealthScreening struct {
	ID                 int64              `json:"id"`
	AnimalID           int64              `json:"animal_id"`
	UserID             int64              `json:"user_id,omitempty"`
	MediaURL           string             `json:"media_url"`
	MediaType          string             `json:"media_type"`
	Symptoms           SymptomInput       `json:"symptoms"`
	VisualAnalysis     VisualAnalysis     `json:"visual_analysis"`
	Assessment         ClinicalAssessment `json:"assessment"`
	Urgency            string             `json:"urgency"`
	District           string             `json:"district,omitempty"`
	Taluka             string             `json:"taluka,omitempty"`
	FarmName           string             `json:"farm_name,omitempty"`
	VetReviewRequested bool               `json:"vet_review_requested"`
	CreatedAt          time.Time          `json:"created_at"`
}

type Reminder struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	AnimalID    int64     `json:"animal_id"`
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueAt       time.Time `json:"due_at"`
	Completed   bool      `json:"completed"`
	CreatedAt   time.Time `json:"created_at"`
}

type Clinic struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Distance   string  `json:"distance"`
	Rating     float64 `json:"rating"`
	Open       bool    `json:"open"`
	Phone      string  `json:"phone"`
	Address    string  `json:"address"`
	Directions string  `json:"directions"`
}

type Outbreak struct {
	ID                int64      `json:"id"`
	DiseaseName       string     `json:"disease_name"`
	Species           string     `json:"species"` // Canine, Feline, Bovine, Caprine, Ovine, Avian, Equine
	District          string     `json:"district"`
	Taluka            string     `json:"taluka"`
	Village           string     `json:"village"`
	FarmName          string     `json:"farm_name,omitempty"`
	AffectedCount     int        `json:"affected_count"`
	Severity          string     `json:"severity"` // CRITICAL, URGENT, WARNING, RESOLVED
	PreventionGuide   string     `json:"prevention_guide"`
	Status            string     `json:"status"` // active, contained, resolved, monitored
	Latitude          float64    `json:"latitude"`
	Longitude         float64    `json:"longitude"`
	VerifiedByVets    int        `json:"verified_by_vets"`
	ReportedByFarmers int        `json:"reported_by_farmers"`
	ResolutionNotes   string     `json:"resolution_notes,omitempty"`
	ResolvedAt        *time.Time `json:"resolved_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type Notification struct {
	ID         int64     `json:"id"`
	UserID     int64     `json:"user_id"`     // 0 for role/district broadcast
	RoleTarget string    `json:"role_target"` // all, farmer, pet_owner, vet, ngo, gov
	District   string    `json:"district,omitempty"`
	Title      string    `json:"title"`
	Message    string    `json:"message"`
	OutbreakID int64     `json:"outbreak_id,omitempty"`
	Severity   string    `json:"severity"` // SOS, CRITICAL, WARNING, INFO
	IsSOS      bool      `json:"is_sos"`
	Read       bool      `json:"read"`
	ActionURL  string    `json:"action_url,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type VetConsultation struct {
	ID               int64     `json:"id"`
	ScreeningID      int64     `json:"screening_id"`
	UserID           int64     `json:"user_id"`
	UserName         string    `json:"user_name"`
	UserRole         string    `json:"user_role"`
	UserPhone        string    `json:"user_phone,omitempty"`
	Location         string    `json:"location,omitempty"`
	VetID            int64     `json:"vet_id,omitempty"`
	VetName          string    `json:"vet_name,omitempty"`
	AnimalName       string    `json:"animal_name"`
	Species          string    `json:"species"`
	Breed            string    `json:"breed,omitempty"`
	MediaURL         string    `json:"media_url"`
	Symptoms         []string  `json:"symptoms"`
	OwnerNotes       string    `json:"owner_notes,omitempty"`
	AIDiagnosis      string    `json:"ai_diagnosis"`
	AIUrgency        string    `json:"ai_urgency"`
	VetDiagnosis     string    `json:"vet_diagnosis,omitempty"`
	VetSuggestion    string    `json:"vet_suggestion,omitempty"`
	VetPrescriptions string    `json:"vet_prescriptions,omitempty"`
	Status           string    `json:"status"` // pending, reviewed
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type InventoryItem struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"user_id"` // Owner (Vet or NGO/Gov dispensary)
	OwnerName    string    `json:"owner_name"`
	OrgType      string    `json:"org_type"` // clinic, ngo, gov_dispensary
	District     string    `json:"district"`
	ItemName     string    `json:"item_name"`
	Category     string    `json:"category"` // vaccine, antibiotic, tool, antiseptic, iv_fluid, ppe
	Quantity     int       `json:"quantity"`
	Unit         string    `json:"unit"` // vials, doses, kits, bottles, boxes
	MinThreshold int       `json:"min_threshold"`
	ExpiryDate   string    `json:"expiry_date"`
	Status       string    `json:"status"` // in_stock, low_stock, critical
	UpdatedAt    time.Time `json:"updated_at"`
}

type GovAdvisory struct {
	ID         int64     `json:"id"`
	Issuer     string    `json:"issuer"` // e.g. "Maharashtra Animal Husbandry Dept"
	Title      string    `json:"title"`
	Content    string    `json:"content"`
	District   string    `json:"district"`
	Category   string    `json:"category"` // quarantine, vaccine_drive, relief_fund, biosecurity
	Urgency    string    `json:"urgency"`  // CRITICAL, URGENT, INFO
	DateIssued string    `json:"date_issued"`
}
