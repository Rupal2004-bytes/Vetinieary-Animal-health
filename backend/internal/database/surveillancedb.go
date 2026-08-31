package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"animal-health-ai/backend/internal/models"
)

type SurveillanceDB struct {
	*sql.DB
	Path     string
	OnChange func(dbPath string)
}

func (s *SurveillanceDB) notifyChange() {
	if s != nil && s.OnChange != nil && s.Path != "" {
		s.OnChange(s.Path)
	}
}

func OpenSurveillanceDB(path string) (*SurveillanceDB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=10000")
	if err != nil {
		return nil, fmt.Errorf("open surveillance database: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;`); err != nil {
		_ = db.Close()
		return nil, err
	}

	sdb := &SurveillanceDB{DB: db, Path: path}
	if err := sdb.Migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate surveillance database: %w", err)
	}

	if err := sdb.SeedInitialData(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("seed surveillance database: %w", err)
	}

	return sdb, nil
}

func (s *SurveillanceDB) Migrate(ctx context.Context) error {
	migrations := []Migration{
		{
			Version: 1,
			Name:    "create_surveillance_tables",
			Up: `
CREATE TABLE IF NOT EXISTS outbreaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disease_name TEXT NOT NULL,
  species TEXT NOT NULL,
  district TEXT NOT NULL,
  taluka TEXT NOT NULL,
  village TEXT NOT NULL,
  farm_name TEXT,
  affected_count INTEGER NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'URGENT',
  prevention_guide TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  latitude REAL DEFAULT 0.0,
  longitude REAL DEFAULT 0.0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  role_target TEXT NOT NULL DEFAULT 'all',
  district TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  outbreak_id INTEGER DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'INFO',
  is_sos INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vet_consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screening_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  user_phone TEXT,
  location TEXT,
  vet_id INTEGER DEFAULT 0,
  vet_name TEXT,
  animal_name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  media_url TEXT,
  symptoms_json TEXT NOT NULL,
  owner_notes TEXT,
  ai_diagnosis TEXT NOT NULL,
  ai_urgency TEXT NOT NULL,
  vet_diagnosis TEXT,
  vet_suggestion TEXT,
  vet_prescriptions TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  owner_name TEXT NOT NULL,
  org_type TEXT NOT NULL,
  district TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  min_threshold INTEGER NOT NULL DEFAULT 10,
  expiry_date TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issuer TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  district TEXT NOT NULL,
  category TEXT NOT NULL,
  urgency TEXT NOT NULL,
  date_issued TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbreaks_district ON outbreaks(district);
CREATE INDEX IF NOT EXISTS idx_outbreaks_species ON outbreaks(species);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_sos ON notifications(is_sos);
CREATE INDEX IF NOT EXISTS idx_vet_consultations_status ON vet_consultations(status);
CREATE INDEX IF NOT EXISTS idx_inventories_district ON inventories(district);
`,
		},
		{
			Version: 2,
			Name:    "add_outbreak_verification_and_resolution_tracking",
			Up: `
ALTER TABLE outbreaks ADD COLUMN verified_by_vets INTEGER DEFAULT 0;
ALTER TABLE outbreaks ADD COLUMN reported_by_farmers INTEGER DEFAULT 1;
ALTER TABLE outbreaks ADD COLUMN resolution_notes TEXT;
ALTER TABLE outbreaks ADD COLUMN resolved_at DATETIME;
`,
		},
	}

	return RunMigrations(ctx, s.DB, migrations)
}

func (s *SurveillanceDB) SeedInitialData(ctx context.Context) error {
	var count int
	_ = s.QueryRowContext(ctx, `SELECT COUNT(1) FROM outbreaks`).Scan(&count)
	if count > 0 {
		return nil
	}

	// Seed Initial Outbreaks across broad spectrum
	outbreaks := []models.Outbreak{
		{
			DiseaseName:     "Foot-and-Mouth Disease (FMD / लाळ्या खुरकूत)",
			Species:         "Bovine",
			District:        "Pune",
			Taluka:          "Baramati",
			Village:         "Malegaon Budruk",
			FarmName:        "Sahyadri Dairy Farm #4",
			AffectedCount:   18,
			Severity:        "CRITICAL",
			PreventionGuide: "Strictly quarantine all infected cattle. Prohibit shared water troughs. Apply 4% sodium carbonate or 2% sodium hydroxide disinfectant to shed floors. Isolate nearby calves immediately.",
			Status:          "active",
			Latitude:        18.1517,
			Longitude:       74.5772,
		},
		{
			DiseaseName:     "Canine Parvovirus Enteritis",
			Species:         "Canine",
			District:        "Thane",
			Taluka:          "Kalyan",
			Village:         "Dombivli East",
			FarmName:        "City Canine Care Center",
			AffectedCount:   7,
			Severity:        "URGENT",
			PreventionGuide: "Ensure all puppies receive 6-in-1 / DHPPi booster series. Bleach all kennel surfaces (1:32 diluted bleach). Do not allow unimmunized puppies outdoors.",
			Status:          "active",
			Latitude:        19.2183,
			Longitude:       73.0867,
		},
		{
			DiseaseName:     "Lumpy Skin Disease (LSD)",
			Species:         "Bovine",
			District:        "Ahmednagar",
			Taluka:          "Sangamner",
			Village:         "Ashwi Khurd",
			FarmName:        "Godavari Cattle Cooperative",
			AffectedCount:   12,
			Severity:        "URGENT",
			PreventionGuide: "Administer Goat Pox vaccine (heterologous protection). Install vector netting and spray pyrethroid fly repellents. Isolate animals with nodular cutaneous eruptions.",
			Status:          "active",
			Latitude:        19.5761,
			Longitude:       74.2122,
		},
		{
			DiseaseName:     "Peste des Petits Ruminants (PPR / शेळ्यांमधील देवी)",
			Species:         "Caprine",
			District:        "Kolhapur",
			Taluka:          "Hatkangale",
			Village:         "Rukadi",
			FarmName:        "Mahalaxmi Goat Unit",
			AffectedCount:   24,
			Severity:        "CRITICAL",
			PreventionGuide: "Vaccinate healthy goats with homologous PPR vaccine. Enforce 3-week quarantine for new incoming stock. Provide warm electrolyte hydration and clean soft forage.",
			Status:          "active",
			Latitude:        16.7050,
			Longitude:       74.3411,
		},
	}

	for _, ob := range outbreaks {
		res, err := s.ExecContext(ctx, `
INSERT INTO outbreaks (disease_name, species, district, taluka, village, farm_name, affected_count, severity, prevention_guide, status, latitude, longitude, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			ob.DiseaseName, ob.Species, ob.District, ob.Taluka, ob.Village, ob.FarmName, ob.AffectedCount, ob.Severity, ob.PreventionGuide, ob.Status, ob.Latitude, ob.Longitude)
		if err == nil {
			obID, _ := res.LastInsertId()
			// Generate SOS Notifications for each
			_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, district, title, message, outbreak_id, severity, is_sos, read, action_url, created_at)
VALUES (0, 'all', ?, ?, ?, ?, ?, 1, 0, '#notifications', CURRENT_TIMESTAMP)`,
				ob.District,
				fmt.Sprintf("🚨 URGENT SOS: %s Outbreak in %s (%s)", ob.DiseaseName, ob.District, ob.Taluka),
				fmt.Sprintf("Outbreak detected at %s (%s, %s). %d animals reported affected. Nearby farmers & clinics are urged to implement biosecurity and isolate unaffected herds.", ob.FarmName, ob.Village, ob.Taluka, ob.AffectedCount),
				obID,
				ob.Severity,
			)
		}
	}

	// Seed Initial Gov/NGO Advisories
	advisories := []models.GovAdvisory{
		{
			Issuer:     "Maharashtra Animal Husbandry Commissionerate",
			Title:      "Statewide Ring Vaccination & Animal Market Movement Protocol",
			Content:    "All taluka veterinary dispensaries are directed to enforce ring vaccination within a 10 km radius of index FMD and LSD clusters. Livestock markets in Baramati & Sangamner will operate under strict health check screening.",
			District:   "Statewide (Maharashtra)",
			Category:   "quarantine",
			Urgency:    "CRITICAL",
			DateIssued: time.Now().Format("2006-01-02"),
		},
		{
			Issuer:     "State Veterinary Polyclinic & Relief Taskforce",
			Title:      "Free Emergency Vaccine & Antibiotic Distribution Camp",
			Content:    "Government mobile veterinary vans (1962) deployed across Pune & Kolhapur. Farmers can collect complimentary electrolyte sachets, antiseptic sprays, and scheduled booster doses from local LDO offices.",
			District:   "Pune & Kolhapur",
			Category:   "vaccine_drive",
			Urgency:    "URGENT",
			DateIssued: time.Now().Format("2006-01-02"),
		},
	}

	for _, adv := range advisories {
		_, _ = s.ExecContext(ctx, `
INSERT INTO gov_advisories (issuer, title, content, district, category, urgency, date_issued, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
			adv.Issuer, adv.Title, adv.Content, adv.District, adv.Category, adv.Urgency, adv.DateIssued)
	}

	// Seed Initial Dynamic Inventory (Dispensary & NGO)
	items := []models.InventoryItem{
		{UserID: 0, OwnerName: "District Veterinary Dispensary", OrgType: "gov_dispensary", District: "Pune", ItemName: "FMD Quadrivalent Vaccine", Category: "vaccine", Quantity: 450, Unit: "doses", MinThreshold: 100, ExpiryDate: "2027-04-30", Status: "in_stock"},
		{UserID: 0, OwnerName: "District Veterinary Dispensary", OrgType: "gov_dispensary", District: "Pune", ItemName: "Oxytetracycline LA 200mg/ml", Category: "antibiotic", Quantity: 85, Unit: "vials", MinThreshold: 30, ExpiryDate: "2026-11-15", Status: "in_stock"},
		{UserID: 0, OwnerName: "Red Cross Livestock Relief NGO", OrgType: "ngo", District: "Ahmednagar", ItemName: "Lumpy Skin Goat Pox Vaccine", Category: "vaccine", Quantity: 20, Unit: "vials", MinThreshold: 50, ExpiryDate: "2026-09-30", Status: "low_stock"},
		{UserID: 0, OwnerName: "Red Cross Livestock Relief NGO", OrgType: "ngo", District: "Kolhapur", ItemName: "Veterinary Surgical Disinfectant & Wound Spray", Category: "antiseptic", Quantity: 240, Unit: "bottles", MinThreshold: 40, ExpiryDate: "2027-08-31", Status: "in_stock"},
		{UserID: 0, OwnerName: "Central Vet Polyclinic", OrgType: "clinic", District: "Thane", ItemName: "Canine Parvo Antiserum & IV Fluids", Category: "iv_fluid", Quantity: 60, Unit: "bottles", MinThreshold: 20, ExpiryDate: "2026-12-31", Status: "in_stock"},
		{UserID: 0, OwnerName: "Government Animal Relief Depot", OrgType: "gov_dispensary", District: "Statewide", ItemName: "Sterile Syringes & PPE Biohazard Kits", Category: "ppe", Quantity: 1200, Unit: "kits", MinThreshold: 200, ExpiryDate: "2028-01-01", Status: "in_stock"},
	}

	for _, item := range items {
		_, _ = s.ExecContext(ctx, `
INSERT INTO inventories (user_id, owner_name, org_type, district, item_name, category, quantity, unit, min_threshold, expiry_date, status, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
			item.UserID, item.OwnerName, item.OrgType, item.District, item.ItemName, item.Category, item.Quantity, item.Unit, item.MinThreshold, item.ExpiryDate, item.Status)
	}

	return nil
}

// ----------------- Outbreaks & Surveillance Methods -----------------

func IsOutbreakDisease(name string) bool {
	n := strings.ToLower(name)
	keywords := []string{
		"foot-and-mouth", "fmd", "लाळ्या", "खुरकूत", "lumpy skin", "lsd", "parvo", "distemper",
		"peste des petits", "ppr", "शेळ्यांमधील देवी", "rabies", "anthrax", "brucellos",
		"avian influenza", "bird flu", "ranikhet", "newcastle", "black quarter", "bq",
		"hemorrhagic septicemia", "hs", "घटसर्प", "african swine", "swine fever",
		"panleukopenia", "gastroenteritis", "gumboro", "theileriosis", "babesiosis",
	}
	for _, kw := range keywords {
		if strings.Contains(n, kw) {
			return true
		}
	}
	return false
}

func (s *SurveillanceDB) ListOutbreaks(ctx context.Context, district string, species string) ([]models.Outbreak, error) {
	query := `
SELECT id, disease_name, species, district, taluka, village, COALESCE(farm_name,''), affected_count, severity, prevention_guide, status, latitude, longitude,
       COALESCE(verified_by_vets,0), COALESCE(reported_by_farmers,1), COALESCE(resolution_notes,''), resolved_at, created_at, updated_at
FROM outbreaks
WHERE (? = '' OR LOWER(district) = LOWER(?))
  AND (? = '' OR LOWER(species) = LOWER(?))
ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'contained' THEN 2 ELSE 3 END,
         CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'URGENT' THEN 2 ELSE 3 END, updated_at DESC`

	rows, err := s.QueryContext(ctx, query, district, district, species, species)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Outbreak
	for rows.Next() {
		var o models.Outbreak
		var resolvedAt sql.NullTime
		if err := rows.Scan(
			&o.ID, &o.DiseaseName, &o.Species, &o.District, &o.Taluka, &o.Village,
			&o.FarmName, &o.AffectedCount, &o.Severity, &o.PreventionGuide, &o.Status,
			&o.Latitude, &o.Longitude, &o.VerifiedByVets, &o.ReportedByFarmers,
			&o.ResolutionNotes, &resolvedAt, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if resolvedAt.Valid {
			t := resolvedAt.Time
			o.ResolvedAt = &t
		}
		list = append(list, o)
	}
	return list, rows.Err()
}

func (s *SurveillanceDB) GetOutbreakByID(ctx context.Context, id int64) (models.Outbreak, error) {
	var o models.Outbreak
	var resolvedAt sql.NullTime
	err := s.QueryRowContext(ctx, `
SELECT id, disease_name, species, district, taluka, village, COALESCE(farm_name,''), affected_count, severity, prevention_guide, status, latitude, longitude,
       COALESCE(verified_by_vets,0), COALESCE(reported_by_farmers,1), COALESCE(resolution_notes,''), resolved_at, created_at, updated_at
FROM outbreaks
WHERE id = ?`, id).Scan(
		&o.ID, &o.DiseaseName, &o.Species, &o.District, &o.Taluka, &o.Village,
		&o.FarmName, &o.AffectedCount, &o.Severity, &o.PreventionGuide, &o.Status,
		&o.Latitude, &o.Longitude, &o.VerifiedByVets, &o.ReportedByFarmers,
		&o.ResolutionNotes, &resolvedAt, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return models.Outbreak{}, err
	}
	if resolvedAt.Valid {
		t := resolvedAt.Time
		o.ResolvedAt = &t
	}
	return o, nil
}

func (s *SurveillanceDB) CreateOrUpdateOutbreak(ctx context.Context, o models.Outbreak) (models.Outbreak, error) {
	o.DiseaseName = strings.TrimSpace(o.DiseaseName)
	o.District = strings.TrimSpace(o.District)
	o.Taluka = strings.TrimSpace(o.Taluka)
	if o.DiseaseName == "" || o.District == "" {
		return models.Outbreak{}, fmt.Errorf("disease name and district are required")
	}

	var existingID int64
	var currCount int
	err := s.QueryRowContext(ctx, `
SELECT id, affected_count FROM outbreaks 
WHERE LOWER(disease_name) = LOWER(?) AND LOWER(district) = LOWER(?) AND status = 'active'
LIMIT 1`, o.DiseaseName, o.District).Scan(&existingID, &currCount)

	if err == nil && existingID > 0 {
		_, err = s.ExecContext(ctx, `
UPDATE outbreaks 
SET affected_count = affected_count + 1, reported_by_farmers = reported_by_farmers + 1, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, existingID)
		o.ID = existingID
		o.AffectedCount = currCount + 1
	} else {
		res, err := s.ExecContext(ctx, `
INSERT INTO outbreaks (disease_name, species, district, taluka, village, farm_name, affected_count, severity, prevention_guide, status, latitude, longitude, verified_by_vets, reported_by_farmers, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			o.DiseaseName, o.Species, o.District, o.Taluka, o.Village, o.FarmName, o.AffectedCount, o.Severity, o.PreventionGuide, o.Latitude, o.Longitude, o.VerifiedByVets)
		if err != nil {
			return models.Outbreak{}, err
		}
		o.ID, _ = res.LastInsertId()
	}

	// Emit SOS Notification
	sosTitle := fmt.Sprintf("🚨 URGENT SOS: %s Outbreak in %s", o.DiseaseName, o.District)
	sosMsg := fmt.Sprintf("Cluster alert for %s reported in %s (%s). Immediate isolation and biosecurity defenses recommended for healthy livestock.", o.DiseaseName, o.District, o.FarmName)
	_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, district, title, message, outbreak_id, severity, is_sos, read, action_url, created_at)
VALUES (0, 'all', ?, ?, ?, ?, ?, 1, 0, '#notifications', CURRENT_TIMESTAMP)`,
		o.District, sosTitle, sosMsg, o.ID, o.Severity)

	s.notifyChange()
	return s.GetOutbreakByID(ctx, o.ID)
}

// CheckAndTriggerVetConsensusOutbreak triggers when >= 3 distinct vet reviews confirm the same outbreak disease in a district.
func (s *SurveillanceDB) CheckAndTriggerVetConsensusOutbreak(ctx context.Context, diseaseName, district, taluka, farmName, species string) (models.Outbreak, bool, error) {
	if !IsOutbreakDisease(diseaseName) || district == "" {
		return models.Outbreak{}, false, nil
	}

	var vetReviewCount int
	err := s.QueryRowContext(ctx, `
SELECT COUNT(DISTINCT id)
FROM vet_consultations
WHERE LOWER(location) LIKE LOWER(?)
  AND (LOWER(vet_diagnosis) LIKE LOWER(?) OR LOWER(ai_diagnosis) LIKE LOWER(?))
  AND status = 'reviewed'`, "%"+district+"%", "%"+diseaseName+"%", "%"+diseaseName+"%").Scan(&vetReviewCount)
	if err != nil {
		return models.Outbreak{}, false, err
	}

	// Threshold: 3 or more veterinarian confirmations in the same locality
	if vetReviewCount >= 3 {
		var existingID int64
		_ = s.QueryRowContext(ctx, `
SELECT id FROM outbreaks
WHERE LOWER(district) = LOWER(?) AND LOWER(disease_name) LIKE LOWER(?) AND status = 'active'
LIMIT 1`, district, "%"+diseaseName+"%").Scan(&existingID)

		if existingID > 0 {
			_, _ = s.ExecContext(ctx, `
UPDATE outbreaks
SET verified_by_vets = ?, severity = 'CRITICAL', updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, vetReviewCount, existingID)

			sosTitle := fmt.Sprintf("🚨 VERIFIED OUTBREAK SOS: 3+ Vets Confirmed %s in %s!", diseaseName, district)
			sosMsg := fmt.Sprintf("Clinical consensus reached by %d licensed veterinarians in %s. Immediate ring vaccination and livestock containment active.", vetReviewCount, district)
			_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, district, title, message, outbreak_id, severity, is_sos, read, action_url, created_at)
VALUES (0, 'all', ?, ?, ?, ?, 'CRITICAL', 1, 0, '#notifications', CURRENT_TIMESTAMP)`,
				district, sosTitle, sosMsg, existingID)

			s.notifyChange()
			ob, _ := s.GetOutbreakByID(ctx, existingID)
			return ob, true, nil
		} else {
			created, err := s.CreateOrUpdateOutbreak(ctx, models.Outbreak{
				DiseaseName:     diseaseName,
				Species:         species,
				District:        district,
				Taluka:          taluka,
				FarmName:        farmName,
				AffectedCount:   vetReviewCount * 2,
				Severity:        "CRITICAL",
				VerifiedByVets:  vetReviewCount,
				PreventionGuide: "Official vet consensus active. Strictly isolate suspect animals, prohibit cattle congregation, disinfect sheds with 4% sodium carbonate, and vaccinate unaffected perimeter herds.",
			})
			return created, true, err
		}
	}

	return models.Outbreak{}, false, nil
}

// CheckAndTriggerFarmerClusteringOutbreak triggers when >= 3 farmers in the same locality report the same outbreak disease.
func (s *SurveillanceDB) CheckAndTriggerFarmerClusteringOutbreak(ctx context.Context, diseaseName, district, taluka, farmName, species string, affectedCount int) (models.Outbreak, bool, error) {
	if !IsOutbreakDisease(diseaseName) || district == "" {
		return models.Outbreak{}, false, nil
	}

	var farmerReportCount int
	_ = s.QueryRowContext(ctx, `
SELECT COUNT(DISTINCT user_id)
FROM vet_consultations
WHERE LOWER(location) LIKE LOWER(?) AND LOWER(species) = LOWER(?)`, "%"+district+"%", species).Scan(&farmerReportCount)

	if farmerReportCount >= 3 {
		ob, err := s.CreateOrUpdateOutbreak(ctx, models.Outbreak{
			DiseaseName:     diseaseName,
			Species:         species,
			District:        district,
			Taluka:          taluka,
			FarmName:        farmName,
			AffectedCount:   affectedCount,
			Severity:        "URGENT",
			PreventionGuide: "Local farm cluster detected (3+ livestock owners). Disinfect water sources, quarantine newly purchased cattle, and check nearby herds for early oral/skin lesions.",
		})
		return ob, true, err
	}

	return models.Outbreak{}, false, nil
}

// ReportOutbreakRecovery allows farmers or vets to report animals recovered / out of disease, resolving the outbreak when clear.
func (s *SurveillanceDB) ReportOutbreakRecovery(ctx context.Context, outbreakID int64, recoveredCount int, notes, reporterName, reporterRole string) (models.Outbreak, error) {
	var ob models.Outbreak
	ob, err := s.GetOutbreakByID(ctx, outbreakID)
	if err != nil {
		return models.Outbreak{}, err
	}

	newCount := ob.AffectedCount - recoveredCount
	if newCount < 0 {
		newCount = 0
	}

	if newCount == 0 {
		_, err = s.ExecContext(ctx, `
UPDATE outbreaks
SET affected_count = 0, status = 'resolved', severity = 'RESOLVED', resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, notes, outbreakID)
		if err != nil {
			return models.Outbreak{}, err
		}

		// Deactivate active SOS notifications for this outbreak
		_, _ = s.ExecContext(ctx, `UPDATE notifications SET is_sos = 0 WHERE outbreak_id = ?`, outbreakID)

		// Broadcast resolution announcement
		resTitle := fmt.Sprintf("🟢 OUTBREAK RESOLVED: %s in %s Cleared!", ob.DiseaseName, ob.District)
		resMsg := fmt.Sprintf("Recovery reported by %s (%s). All affected livestock in %s (%s) have recovered or completed quarantine. Normal operations restored.", reporterName, reporterRole, ob.District, ob.FarmName)
		_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, district, title, message, outbreak_id, severity, is_sos, read, action_url, created_at)
VALUES (0, 'all', ?, ?, ?, ?, 'INFO', 0, 0, '#notifications', CURRENT_TIMESTAMP)`,
			ob.District, resTitle, resMsg, outbreakID)
	} else {
		_, err = s.ExecContext(ctx, `
UPDATE outbreaks
SET affected_count = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, newCount, outbreakID)
		if err != nil {
			return models.Outbreak{}, err
		}
	}

	s.notifyChange()
	return s.GetOutbreakByID(ctx, outbreakID)
}

// ResolveOutbreak directly marks an outbreak as contained / resolved by a veterinarian or official.
func (s *SurveillanceDB) ResolveOutbreak(ctx context.Context, outbreakID int64, notes, resolverName string) (models.Outbreak, error) {
	ob, err := s.GetOutbreakByID(ctx, outbreakID)
	if err != nil {
		return models.Outbreak{}, err
	}

	_, err = s.ExecContext(ctx, `
UPDATE outbreaks
SET status = 'resolved', severity = 'RESOLVED', affected_count = 0, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, notes, outbreakID)
	if err != nil {
		return models.Outbreak{}, err
	}

	_, _ = s.ExecContext(ctx, `UPDATE notifications SET is_sos = 0 WHERE outbreak_id = ?`, outbreakID)

	resTitle := fmt.Sprintf("🟢 OUTBREAK CONTAINED & RESOLVED: %s in %s", ob.DiseaseName, ob.District)
	resMsg := fmt.Sprintf("Dr. %s / Veterinary Authority confirmed full containment and resolution of %s in %s. Biosecurity quarantine lifted.", resolverName, ob.DiseaseName, ob.District)
	_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, district, title, message, outbreak_id, severity, is_sos, read, action_url, created_at)
VALUES (0, 'all', ?, ?, ?, ?, 'INFO', 0, 0, '#notifications', CURRENT_TIMESTAMP)`,
		ob.District, resTitle, resMsg, outbreakID)

	s.notifyChange()
	return s.GetOutbreakByID(ctx, outbreakID)
}

// ----------------- Notifications -----------------

func (s *SurveillanceDB) ListNotifications(ctx context.Context, userID int64, role string, district string) ([]models.Notification, error) {
	query := `
SELECT id, user_id, role_target, COALESCE(district,''), title, message, outbreak_id, severity, is_sos, read, COALESCE(action_url,''), created_at
FROM notifications
WHERE (user_id = ? OR user_id = 0)
  AND (role_target = 'all' OR role_target = ? OR ? = '')
  AND (? = '' OR district = '' OR LOWER(district) = LOWER(?) OR LOWER(district) LIKE '%statewide%')
ORDER BY is_sos DESC, created_at DESC
LIMIT 50`

	rows, err := s.QueryContext(ctx, query, userID, role, role, district, district)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Notification
	for rows.Next() {
		var n models.Notification
		var isSOS, read int
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.RoleTarget, &n.District, &n.Title, &n.Message,
			&n.OutbreakID, &n.Severity, &isSOS, &read, &n.ActionURL, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		n.IsSOS = isSOS == 1
		n.Read = read == 1
		list = append(list, n)
	}
	return list, rows.Err()
}

func (s *SurveillanceDB) MarkNotificationRead(ctx context.Context, id int64) error {
	_, err := s.ExecContext(ctx, `UPDATE notifications SET read = 1 WHERE id = ?`, id)
	return err
}

func (s *SurveillanceDB) MarkAllNotificationsRead(ctx context.Context, userID int64) error {
	_, err := s.ExecContext(ctx, `UPDATE notifications SET read = 1 WHERE user_id = ? OR user_id = 0`, userID)
	return err
}

// ----------------- Vet Consultations / Second Opinions -----------------

func (s *SurveillanceDB) RequestVetConsultation(ctx context.Context, c models.VetConsultation) (models.VetConsultation, error) {
	symptomsJSON, _ := json.Marshal(c.Symptoms)
	res, err := s.ExecContext(ctx, `
INSERT INTO vet_consultations (
  screening_id, user_id, user_name, user_role, user_phone, location,
  animal_name, species, breed, media_url, symptoms_json, owner_notes,
  ai_diagnosis, ai_urgency, status, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		c.ScreeningID, c.UserID, c.UserName, c.UserRole, c.UserPhone, c.Location,
		c.AnimalName, c.Species, c.Breed, c.MediaURL, string(symptomsJSON), c.OwnerNotes,
		c.AIDiagnosis, c.AIUrgency,
	)
	if err != nil {
		return models.VetConsultation{}, err
	}
	c.ID, _ = res.LastInsertId()
	c.Status = "pending"
	c.CreatedAt = time.Now()
	c.UpdatedAt = time.Now()

	// Notify Vets
	_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, title, message, severity, is_sos, read, action_url, created_at)
VALUES (0, 'vet', ?, ?, 'INFO', 0, 0, '#vet-consultations', CURRENT_TIMESTAMP)`,
		fmt.Sprintf("🩺 New Case Review Requested: %s (%s)", c.AnimalName, c.Species),
		fmt.Sprintf("%s (%s) requested second opinion on suspected %s. Tap to review symptoms and provide clinical suggestion.", c.UserName, c.UserRole, c.AIDiagnosis),
	)

	s.notifyChange()
	return c, nil
}

func (s *SurveillanceDB) ListVetConsultations(ctx context.Context, vetID int64, userID int64, status string) ([]models.VetConsultation, error) {
	if vetID <= 0 && userID <= 0 {
		return []models.VetConsultation{}, nil
	}

	var query string
	var rows *sql.Rows
	var err error

	if vetID > 0 {
		// Veterinarian view: see all incoming cases in district / queue
		query = `
SELECT id, screening_id, user_id, user_name, user_role, COALESCE(user_phone,''), COALESCE(location,''),
       vet_id, COALESCE(vet_name,''), animal_name, species, COALESCE(breed,''), COALESCE(media_url,''),
       symptoms_json, COALESCE(owner_notes,''), ai_diagnosis, ai_urgency,
       COALESCE(vet_diagnosis,''), COALESCE(vet_suggestion,''), COALESCE(vet_prescriptions,''),
       status, created_at, updated_at
FROM vet_consultations
WHERE (? = '' OR status = ?)
ORDER BY CASE status WHEN 'pending' THEN 1 ELSE 2 END, created_at DESC`
		rows, err = s.QueryContext(ctx, query, status, status)
	} else {
		// Farmer / Pet owner view: see ONLY their own submitted cases
		query = `
SELECT id, screening_id, user_id, user_name, user_role, COALESCE(user_phone,''), COALESCE(location,''),
       vet_id, COALESCE(vet_name,''), animal_name, species, COALESCE(breed,''), COALESCE(media_url,''),
       symptoms_json, COALESCE(owner_notes,''), ai_diagnosis, ai_urgency,
       COALESCE(vet_diagnosis,''), COALESCE(vet_suggestion,''), COALESCE(vet_prescriptions,''),
       status, created_at, updated_at
FROM vet_consultations
WHERE user_id = ?
  AND (? = '' OR status = ?)
ORDER BY created_at DESC`
		rows, err = s.QueryContext(ctx, query, userID, status, status)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.VetConsultation
	for rows.Next() {
		var c models.VetConsultation
		var symJSON string
		if err := rows.Scan(
			&c.ID, &c.ScreeningID, &c.UserID, &c.UserName, &c.UserRole, &c.UserPhone, &c.Location,
			&c.VetID, &c.VetName, &c.AnimalName, &c.Species, &c.Breed, &c.MediaURL,
			&symJSON, &c.OwnerNotes, &c.AIDiagnosis, &c.AIUrgency,
			&c.VetDiagnosis, &c.VetSuggestion, &c.VetPrescriptions,
			&c.Status, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(symJSON), &c.Symptoms)
		list = append(list, c)
	}
	return list, rows.Err()
}

func (s *SurveillanceDB) GetVetConsultationByID(ctx context.Context, id int64) (models.VetConsultation, error) {
	var c models.VetConsultation
	var symJSON string
	err := s.QueryRowContext(ctx, `
SELECT id, screening_id, user_id, user_name, user_role, COALESCE(user_phone,''), COALESCE(location,''),
       vet_id, COALESCE(vet_name,''), animal_name, species, COALESCE(breed,''), COALESCE(media_url,''),
       symptoms_json, COALESCE(owner_notes,''), ai_diagnosis, ai_urgency,
       COALESCE(vet_diagnosis,''), COALESCE(vet_suggestion,''), COALESCE(vet_prescriptions,''),
       status, created_at, updated_at
FROM vet_consultations
WHERE id = ?`, id).Scan(
		&c.ID, &c.ScreeningID, &c.UserID, &c.UserName, &c.UserRole, &c.UserPhone, &c.Location,
		&c.VetID, &c.VetName, &c.AnimalName, &c.Species, &c.Breed, &c.MediaURL,
		&symJSON, &c.OwnerNotes, &c.AIDiagnosis, &c.AIUrgency,
		&c.VetDiagnosis, &c.VetSuggestion, &c.VetPrescriptions,
		&c.Status, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return models.VetConsultation{}, err
	}
	_ = json.Unmarshal([]byte(symJSON), &c.Symptoms)
	return c, nil
}

func (s *SurveillanceDB) ReviewVetConsultation(ctx context.Context, id int64, vetID int64, vetName, vetDiag, vetSug, vetPresc string) (models.VetConsultation, error) {
	_, err := s.ExecContext(ctx, `
UPDATE vet_consultations
SET vet_id = ?, vet_name = ?, vet_diagnosis = ?, vet_suggestion = ?, vet_prescriptions = ?, status = 'reviewed', updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, vetID, vetName, vetDiag, vetSug, vetPresc, id)
	if err != nil {
		return models.VetConsultation{}, err
	}

	var userID int64
	var animalName, location, species string
	_ = s.QueryRowContext(ctx, `SELECT user_id, animal_name, location, species FROM vet_consultations WHERE id = ?`, id).Scan(&userID, &animalName, &location, &species)

	if userID > 0 {
		_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, title, message, severity, is_sos, read, action_url, created_at)
VALUES (?, 'all', ?, ?, 'INFO', 0, 0, '#consultations', CURRENT_TIMESTAMP)`,
			userID,
			fmt.Sprintf("✅ Dr. %s Provided Clinical Feedback for %s", vetName, animalName),
			fmt.Sprintf("Veterinary suggestions & prescription received for %s. Tap to view details.", animalName),
		)
	}

	// Dynamic Vet Consensus Outbreak Trigger: If >= 3 vets in same district confirm this diagnosis
	district := location
	if strings.Contains(district, ",") {
		parts := strings.Split(district, ",")
		district = strings.TrimSpace(parts[len(parts)-1])
	}
	if district != "" && vetDiag != "" {
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_, _, _ = s.CheckAndTriggerVetConsensusOutbreak(bgCtx, vetDiag, district, "Local", location, species)
		}()
	}

	s.notifyChange()
	return s.GetVetConsultationByID(ctx, id)
}

// ----------------- Inventory Tracking -----------------

func (s *SurveillanceDB) ListInventory(ctx context.Context, district string, orgType string, userID int64) ([]models.InventoryItem, error) {
	query := `
SELECT id, user_id, owner_name, org_type, district, item_name, category, quantity, unit, min_threshold, COALESCE(expiry_date,''), status, updated_at
FROM inventories
WHERE (? = 0 OR user_id = ?)
  AND (? = '' OR org_type = ?)
  AND (? = '' OR LOWER(district) = LOWER(?) OR LOWER(district) = 'statewide')
ORDER BY CASE status WHEN 'critical' THEN 1 WHEN 'low_stock' THEN 2 ELSE 3 END, category ASC`

	rows, err := s.QueryContext(ctx, query, userID, userID, orgType, orgType, district, district)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.InventoryItem
	for rows.Next() {
		var item models.InventoryItem
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.OwnerName, &item.OrgType, &item.District,
			&item.ItemName, &item.Category, &item.Quantity, &item.Unit,
			&item.MinThreshold, &item.ExpiryDate, &item.Status, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *SurveillanceDB) UpsertInventory(ctx context.Context, item models.InventoryItem) (models.InventoryItem, error) {
	item.ItemName = strings.TrimSpace(item.ItemName)
	if item.ItemName == "" {
		return models.InventoryItem{}, fmt.Errorf("item name is required")
	}

	status := item.Status
	if status == "" {
		status = "in_stock"
	}
	if item.Quantity <= 0 {
		status = "critical"
	} else if item.Quantity <= item.MinThreshold {
		status = "low_stock"
	}
	item.Status = status

	if item.ID > 0 {
		var existingUserID int64
		err := s.QueryRowContext(ctx, `SELECT user_id FROM inventories WHERE id = ?`, item.ID).Scan(&existingUserID)
		if err != nil {
			return models.InventoryItem{}, fmt.Errorf("inventory item not found")
		}
		if existingUserID != 0 && existingUserID != item.UserID {
			return models.InventoryItem{}, fmt.Errorf("permission denied: inventory stock can only be managed by the user who added it")
		}

		_, err = s.ExecContext(ctx, `
UPDATE inventories
SET item_name = ?, category = ?, quantity = ?, unit = ?, min_threshold = ?, expiry_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`,
			item.ItemName, item.Category, item.Quantity, item.Unit, item.MinThreshold, item.ExpiryDate, item.Status, item.ID)
		if err != nil {
			return models.InventoryItem{}, err
		}
	} else {
		res, err := s.ExecContext(ctx, `
INSERT INTO inventories (user_id, owner_name, org_type, district, item_name, category, quantity, unit, min_threshold, expiry_date, status, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
			item.UserID, item.OwnerName, item.OrgType, item.District, item.ItemName, item.Category, item.Quantity, item.Unit, item.MinThreshold, item.ExpiryDate, item.Status)
		if err != nil {
			return models.InventoryItem{}, err
		}
		item.ID, _ = res.LastInsertId()
	}

	_ = s.QueryRowContext(ctx, `
SELECT user_id, owner_name, org_type, district, item_name, category, quantity, unit, min_threshold, COALESCE(expiry_date,''), status, updated_at
FROM inventories WHERE id = ?`, item.ID).Scan(
		&item.UserID, &item.OwnerName, &item.OrgType, &item.District, &item.ItemName,
		&item.Category, &item.Quantity, &item.Unit, &item.MinThreshold, &item.ExpiryDate,
		&item.Status, &item.UpdatedAt,
	)

	s.notifyChange()
	return item, nil
}

// ----------------- Gov Advisories -----------------

func (s *SurveillanceDB) ListGovAdvisories(ctx context.Context, district string) ([]models.GovAdvisory, error) {
	rows, err := s.QueryContext(ctx, `
SELECT id, issuer, title, content, district, category, urgency, date_issued
FROM gov_advisories
WHERE (? = '' OR LOWER(district) = LOWER(?) OR LOWER(district) LIKE '%statewide%')
ORDER BY created_at DESC LIMIT 30`, district, district)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.GovAdvisory
	for rows.Next() {
		var a models.GovAdvisory
		if err := rows.Scan(&a.ID, &a.Issuer, &a.Title, &a.Content, &a.District, &a.Category, &a.Urgency, &a.DateIssued); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (s *SurveillanceDB) CreateGovAdvisory(ctx context.Context, a models.GovAdvisory) (models.GovAdvisory, error) {
	if a.Title == "" || a.Content == "" {
		return models.GovAdvisory{}, fmt.Errorf("title and content are required")
	}
	if a.DateIssued == "" {
		a.DateIssued = time.Now().Format("02 Jan 2006")
	}
	if a.Urgency == "" {
		a.Urgency = "HIGH"
	}
	res, err := s.ExecContext(ctx, `
INSERT INTO gov_advisories (issuer, title, content, district, category, urgency, date_issued, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		a.Issuer, a.Title, a.Content, a.District, a.Category, a.Urgency, a.DateIssued)
	if err != nil {
		return models.GovAdvisory{}, err
	}
	a.ID, _ = res.LastInsertId()

	// Broadcast Notification for all farmers, pet owners, vets
	targetDistrict := a.District
	if targetDistrict == "" {
		targetDistrict = "Statewide"
	}
	isSOS := 0
	if a.Urgency == "CRITICAL" {
		isSOS = 1
	}
	_, _ = s.ExecContext(ctx, `
INSERT INTO notifications (user_id, role_target, district, title, message, severity, is_sos, read, action_url, created_at)
VALUES (0, 'all', ?, ?, ?, ?, ?, 0, '#notifications', CURRENT_TIMESTAMP)`,
		targetDistrict,
		fmt.Sprintf("📢 Official Directive: %s", a.Title),
		fmt.Sprintf("Issued by %s (%s). %s", a.Issuer, a.District, a.Content),
		a.Urgency, isSOS,
	)

	s.notifyChange()
	return a, nil
}

func (s *SurveillanceDB) DeleteInventory(ctx context.Context, id int64, userID int64) error {
	var existingUserID int64
	err := s.QueryRowContext(ctx, `SELECT user_id FROM inventories WHERE id = ?`, id).Scan(&existingUserID)
	if err != nil {
		return fmt.Errorf("inventory item not found")
	}
	if existingUserID != 0 && existingUserID != userID {
		return fmt.Errorf("permission denied: inventory stock can only be deleted by the user who added it")
	}

	_, err = s.ExecContext(ctx, `DELETE FROM inventories WHERE id = ?`, id)
	if err == nil {
		s.notifyChange()
	}
	return err
}
