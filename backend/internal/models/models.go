package models

import "time"

type User struct {
	ID           int64      `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	Role         string     `json:"role"`
	HFConnected  bool       `json:"hf_connected"`
	Phone        string     `json:"phone,omitempty"`
	ClinicName   string     `json:"clinic_name,omitempty"`
	AvatarURL    string     `json:"avatar_url,omitempty"`
	PasswordHash string     `json:"-"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
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
	PhotoURL  string    `json:"photo_url"`
	Notes     string    `json:"notes"`
	Weight    string    `json:"weight"`
	CreatedAt time.Time `json:"created_at"`
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
	ID             int64              `json:"id"`
	AnimalID       int64              `json:"animal_id"`
	MediaURL       string             `json:"media_url"`
	MediaType      string             `json:"media_type"`
	Symptoms       SymptomInput       `json:"symptoms"`
	VisualAnalysis VisualAnalysis     `json:"visual_analysis"`
	Assessment     ClinicalAssessment `json:"assessment"`
	Urgency        string             `json:"urgency"`
	CreatedAt      time.Time          `json:"created_at"`
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
