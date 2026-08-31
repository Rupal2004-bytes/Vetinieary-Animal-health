package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"animal-health-ai/backend/internal/models"
)

type DB struct {
	*sql.DB
	Path     string
	OnChange func(dbPath string)
}

func (db *DB) notifyChange() {
	if db != nil && db.OnChange != nil && db.Path != "" {
		db.OnChange(db.Path)
	}
}

func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=10000")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;`); err != nil {
		_ = db.Close()
		return nil, err
	}
	wrapped := &DB{DB: db, Path: path}
	if err := wrapped.Migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return wrapped, nil
}

func (db *DB) Migrate(ctx context.Context) error {
	migrations := []Migration{
		{
			Version: 1,
			Name:    "create_animals_media_screenings_reminders_tables",
			Up: `
CREATE TABLE IF NOT EXISTS animals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  age TEXT,
  sex TEXT,
  photo_url TEXT,
  notes TEXT,
  weight TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_screenings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER NOT NULL,
  media_url TEXT,
  media_type TEXT,
  symptoms_json TEXT NOT NULL,
  visual_analysis_json TEXT NOT NULL,
  assessment_json TEXT NOT NULL,
  urgency TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  animal_id INTEGER,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at DATETIME NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_animals_user_id ON animals(user_id);
CREATE INDEX IF NOT EXISTS idx_health_screenings_animal_id ON health_screenings(animal_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
`,
		},
		{
			Version: 2,
			Name:    "add_screening_urgency_and_created_at_indexes",
			Up: `
CREATE INDEX IF NOT EXISTS idx_health_screenings_urgency ON health_screenings(urgency);
CREATE INDEX IF NOT EXISTS idx_health_screenings_created_at ON health_screenings(created_at);
`,
		},
		{
			Version: 3,
			Name:    "remove_cross_db_users_fk_constraint",
			Up: `
CREATE TABLE IF NOT EXISTS animals_v3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  age TEXT,
  sex TEXT,
  photo_url TEXT,
  notes TEXT,
  weight TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO animals_v3 (id, user_id, name, species, breed, age, sex, photo_url, notes, weight, created_at)
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''), COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at FROM animals;

DROP TABLE animals;
ALTER TABLE animals_v3 RENAME TO animals;

CREATE TABLE IF NOT EXISTS reminders_v3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  animal_id INTEGER,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at DATETIME NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO reminders_v3 (id, user_id, animal_id, type, title, description, due_at, completed, created_at)
SELECT id, user_id, animal_id, type, title, COALESCE(description,''), due_at, completed, created_at FROM reminders;

DROP TABLE reminders;
ALTER TABLE reminders_v3 RENAME TO reminders;

CREATE INDEX IF NOT EXISTS idx_animals_user_id ON animals(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
`,
		},
		{
			Version: 4,
			Name:    "add_livestock_pashu_tag_and_screening_geo",
			Up: `
ALTER TABLE animals ADD COLUMN tag_number TEXT;
ALTER TABLE animals ADD COLUMN herd_size INTEGER DEFAULT 0;
ALTER TABLE animals ADD COLUMN village TEXT;
ALTER TABLE animals ADD COLUMN taluka TEXT;
ALTER TABLE animals ADD COLUMN district TEXT;

ALTER TABLE health_screenings ADD COLUMN user_id INTEGER DEFAULT 0;
ALTER TABLE health_screenings ADD COLUMN district TEXT;
ALTER TABLE health_screenings ADD COLUMN taluka TEXT;
ALTER TABLE health_screenings ADD COLUMN farm_name TEXT;
ALTER TABLE health_screenings ADD COLUMN vet_review_requested INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_animals_tag_number ON animals(tag_number);
CREATE INDEX IF NOT EXISTS idx_screenings_user_id ON health_screenings(user_id);
`,
		},
		{
			Version: 5,
			Name:    "add_clinic_test_results_table",
			Up: `
CREATE TABLE IF NOT EXISTS clinic_test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  vet_id INTEGER NOT NULL,
  vet_name TEXT NOT NULL,
  clinic_name TEXT,
  test_type TEXT NOT NULL,
  sample_date TEXT NOT NULL,
  test_parameters_json TEXT,
  interpretation TEXT NOT NULL,
  status TEXT NOT NULL,
  recommendation TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_test_results_animal_id ON clinic_test_results(animal_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON clinic_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_vet_id ON clinic_test_results(vet_id);
`,
		},
	}

	return RunMigrations(ctx, db.DB, migrations)
}

func (db *DB) ListAnimals(ctx context.Context, userID int64) ([]models.Animal, error) {
	if userID <= 0 {
		return []models.Animal{}, nil
	}
	rows, err := db.QueryContext(ctx, `
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''),
       COALESCE(tag_number,''), COALESCE(herd_size,0), COALESCE(village,''), COALESCE(taluka,''), COALESCE(district,''),
       COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at
FROM animals
WHERE user_id=?
ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Animal, 0)
	for rows.Next() {
		var a models.Animal
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.Name, &a.Species, &a.Breed, &a.Age, &a.Sex,
			&a.TagNumber, &a.HerdSize, &a.Village, &a.Taluka, &a.District,
			&a.PhotoURL, &a.Notes, &a.Weight, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (db *DB) ListAnimalsForVet(ctx context.Context, searchQuery string, tagNumber string) ([]models.Animal, error) {
	var rows *sql.Rows
	var err error

	tagNumber = strings.TrimSpace(tagNumber)
	searchQuery = strings.TrimSpace(searchQuery)

	if tagNumber != "" {
		rows, err = db.QueryContext(ctx, `
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''),
       COALESCE(tag_number,''), COALESCE(herd_size,0), COALESCE(village,''), COALESCE(taluka,''), COALESCE(district,''),
       COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at
FROM animals
WHERE tag_number = ? OR tag_number LIKE ?
ORDER BY created_at DESC`, tagNumber, "%"+tagNumber+"%")
	} else if searchQuery != "" {
		pattern := "%" + searchQuery + "%"
		rows, err = db.QueryContext(ctx, `
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''),
       COALESCE(tag_number,''), COALESCE(herd_size,0), COALESCE(village,''), COALESCE(taluka,''), COALESCE(district,''),
       COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at
FROM animals
WHERE tag_number LIKE ? OR name LIKE ? OR breed LIKE ? OR species LIKE ? OR village LIKE ? OR district LIKE ?
ORDER BY created_at DESC`, pattern, pattern, pattern, pattern, pattern, pattern)
	} else {
		rows, err = db.QueryContext(ctx, `
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''),
       COALESCE(tag_number,''), COALESCE(herd_size,0), COALESCE(village,''), COALESCE(taluka,''), COALESCE(district,''),
       COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at
FROM animals
ORDER BY created_at DESC LIMIT 100`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Animal, 0)
	for rows.Next() {
		var a models.Animal
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.Name, &a.Species, &a.Breed, &a.Age, &a.Sex,
			&a.TagNumber, &a.HerdSize, &a.Village, &a.Taluka, &a.District,
			&a.PhotoURL, &a.Notes, &a.Weight, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (db *DB) GetAnimalByTagNumber(ctx context.Context, tagNumber string) (models.Animal, error) {
	var a models.Animal
	err := db.QueryRowContext(ctx, `
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''),
       COALESCE(tag_number,''), COALESCE(herd_size,0), COALESCE(village,''), COALESCE(taluka,''), COALESCE(district,''),
       COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at
FROM animals WHERE tag_number = ? OR tag_number LIKE ?`, strings.TrimSpace(tagNumber), "%"+strings.TrimSpace(tagNumber)+"%").
		Scan(
			&a.ID, &a.UserID, &a.Name, &a.Species, &a.Breed, &a.Age, &a.Sex,
			&a.TagNumber, &a.HerdSize, &a.Village, &a.Taluka, &a.District,
			&a.PhotoURL, &a.Notes, &a.Weight, &a.CreatedAt,
		)
	return a, err
}

func (db *DB) CreateAnimal(ctx context.Context, a models.Animal) (models.Animal, error) {
	if a.UserID == 0 {
		a.UserID = 1
	}
	res, err := db.ExecContext(ctx, `
INSERT INTO animals (user_id, name, species, breed, age, sex, tag_number, herd_size, village, taluka, district, photo_url, notes, weight)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.UserID, a.Name, a.Species, a.Breed, a.Age, a.Sex,
		a.TagNumber, a.HerdSize, a.Village, a.Taluka, a.District,
		a.PhotoURL, a.Notes, a.Weight)
	if err != nil {
		return models.Animal{}, err
	}
	a.ID, _ = res.LastInsertId()
	db.notifyChange()
	return db.GetAnimal(ctx, a.ID)
}

func (db *DB) UpdateAnimal(ctx context.Context, a models.Animal) (models.Animal, error) {
	_, err := db.ExecContext(ctx, `
UPDATE animals
SET name = ?, species = ?, breed = ?, age = ?, sex = ?, tag_number = ?, herd_size = ?, village = ?, taluka = ?, district = ?, notes = ?, weight = ?
WHERE id = ? AND user_id = ?`,
		a.Name, a.Species, a.Breed, a.Age, a.Sex,
		a.TagNumber, a.HerdSize, a.Village, a.Taluka, a.District,
		a.Notes, a.Weight, a.ID, a.UserID)
	if err != nil {
		return models.Animal{}, err
	}
	db.notifyChange()
	return db.GetAnimal(ctx, a.ID)
}

func (db *DB) DeleteAnimal(ctx context.Context, id int64, userID int64) error {
	_, err := db.ExecContext(ctx, `DELETE FROM animals WHERE id = ? AND user_id = ?`, id, userID)
	if err == nil {
		db.notifyChange()
	}
	return err
}

func (db *DB) GetAnimal(ctx context.Context, id int64) (models.Animal, error) {
	var a models.Animal
	err := db.QueryRowContext(ctx, `
SELECT id, user_id, name, species, COALESCE(breed,''), COALESCE(age,''), COALESCE(sex,''),
       COALESCE(tag_number,''), COALESCE(herd_size,0), COALESCE(village,''), COALESCE(taluka,''), COALESCE(district,''),
       COALESCE(photo_url,''), COALESCE(notes,''), COALESCE(weight,''), created_at
FROM animals WHERE id=?`, id).
		Scan(
			&a.ID, &a.UserID, &a.Name, &a.Species, &a.Breed, &a.Age, &a.Sex,
			&a.TagNumber, &a.HerdSize, &a.Village, &a.Taluka, &a.District,
			&a.PhotoURL, &a.Notes, &a.Weight, &a.CreatedAt,
		)
	return a, err
}

// ----------------- Clinic Test Results -----------------

func (db *DB) CreateClinicTestResult(ctx context.Context, r models.ClinicTestResult) (models.ClinicTestResult, error) {
	if r.AnimalID <= 0 || r.UserID <= 0 || r.VetID <= 0 {
		return models.ClinicTestResult{}, fmt.Errorf("animal_id, user_id and vet_id are required")
	}
	if r.SampleDate == "" {
		r.SampleDate = time.Now().Format("02 Jan 2006")
	}
	if r.Status == "" {
		r.Status = "Normal"
	}
	res, err := db.ExecContext(ctx, `
INSERT INTO clinic_test_results (animal_id, user_id, vet_id, vet_name, clinic_name, test_type, sample_date, test_parameters_json, interpretation, status, recommendation, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		r.AnimalID, r.UserID, r.VetID, r.VetName, r.ClinicName, r.TestType, r.SampleDate, r.TestParametersJSON, r.Interpretation, r.Status, r.Recommendation)
	if err != nil {
		return models.ClinicTestResult{}, err
	}
	r.ID, _ = res.LastInsertId()
	db.notifyChange()
	return r, nil
}

func (db *DB) ListClinicTestResults(ctx context.Context, animalID int64, userID int64, vetID int64) ([]models.ClinicTestResult, error) {
	if userID <= 0 && vetID <= 0 {
		return []models.ClinicTestResult{}, nil
	}

	var query string
	var rows *sql.Rows
	var err error

	if animalID > 0 {
		// Animal-specific lab results: Only the owner (user_id) or authorized vets can see
		query = `
SELECT t.id, t.animal_id, COALESCE(a.name, 'Patient'), COALESCE(a.species, 'Animal'),
       t.user_id, t.vet_id, t.vet_name, COALESCE(t.clinic_name,''), t.test_type, t.sample_date,
       COALESCE(t.test_parameters_json,''), t.interpretation, t.status, COALESCE(t.recommendation,''), t.created_at
FROM clinic_test_results t
LEFT JOIN animals a ON a.id = t.animal_id
WHERE t.animal_id = ? AND (t.user_id = ? OR ? > 0)
ORDER BY t.created_at DESC`
		rows, err = db.QueryContext(ctx, query, animalID, userID, vetID)
	} else if vetID > 0 {
		// Vet viewing tests they issued
		query = `
SELECT t.id, t.animal_id, COALESCE(a.name, 'Patient'), COALESCE(a.species, 'Animal'),
       t.user_id, t.vet_id, t.vet_name, COALESCE(t.clinic_name,''), t.test_type, t.sample_date,
       COALESCE(t.test_parameters_json,''), t.interpretation, t.status, COALESCE(t.recommendation,''), t.created_at
FROM clinic_test_results t
LEFT JOIN animals a ON a.id = t.animal_id
WHERE t.vet_id = ?
ORDER BY t.created_at DESC`
		rows, err = db.QueryContext(ctx, query, vetID)
	} else {
		// Owner viewing tests for their own animals
		query = `
SELECT t.id, t.animal_id, COALESCE(a.name, 'Patient'), COALESCE(a.species, 'Animal'),
       t.user_id, t.vet_id, t.vet_name, COALESCE(t.clinic_name,''), t.test_type, t.sample_date,
       COALESCE(t.test_parameters_json,''), t.interpretation, t.status, COALESCE(t.recommendation,''), t.created_at
FROM clinic_test_results t
LEFT JOIN animals a ON a.id = t.animal_id
WHERE t.user_id = ?
ORDER BY t.created_at DESC`
		rows, err = db.QueryContext(ctx, query, userID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ClinicTestResult
	for rows.Next() {
		var r models.ClinicTestResult
		if err := rows.Scan(
			&r.ID, &r.AnimalID, &r.AnimalName, &r.Species,
			&r.UserID, &r.VetID, &r.VetName, &r.ClinicName, &r.TestType, &r.SampleDate,
			&r.TestParametersJSON, &r.Interpretation, &r.Status, &r.Recommendation, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (db *DB) SaveMedia(ctx context.Context, m models.Media) (models.Media, error) {
	res, err := db.ExecContext(ctx, `INSERT INTO media (url,path,type,mime_type,size) VALUES (?,?,?,?,?)`, m.URL, m.Path, m.Type, m.MIMEType, m.Size)
	if err != nil {
		return models.Media{}, err
	}
	m.ID, _ = res.LastInsertId()
	m.CreatedAt = time.Now()
	db.notifyChange()
	return m, nil
}

func (db *DB) GetMedia(ctx context.Context, id int64) (models.Media, error) {
	var m models.Media
	err := db.QueryRowContext(ctx, `SELECT id,url,path,type,mime_type,size,created_at FROM media WHERE id=?`, id).
		Scan(&m.ID, &m.URL, &m.Path, &m.Type, &m.MIMEType, &m.Size, &m.CreatedAt)
	return m, err
}

func (db *DB) CreateScreening(ctx context.Context, s models.HealthScreening) (models.HealthScreening, error) {
	if s.AnimalID == 0 {
		species := "Animal"
		if s.VisualAnalysis.Animal != "" {
			species = s.VisualAnalysis.Animal
		}
		animal, err := db.CreateAnimal(ctx, models.Animal{
			UserID:   s.UserID,
			Name:     "Patient",
			Species:  species,
			District: s.District,
			Taluka:   s.Taluka,
		})
		if err == nil {
			s.AnimalID = animal.ID
		}
	}
	sym, _ := json.Marshal(s.Symptoms)
	vis, _ := json.Marshal(s.VisualAnalysis)
	assess, _ := json.Marshal(s.Assessment)
	res, err := db.ExecContext(ctx, `
INSERT INTO health_screenings (animal_id, user_id, media_url, media_type, symptoms_json, visual_analysis_json, assessment_json, urgency, district, taluka, farm_name, vet_review_requested)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.AnimalID, s.UserID, s.MediaURL, s.MediaType, string(sym), string(vis), string(assess), s.Urgency, s.District, s.Taluka, s.FarmName, boolInt(s.VetReviewRequested))
	if err != nil {
		return models.HealthScreening{}, err
	}
	s.ID, _ = res.LastInsertId()
	db.notifyChange()
	return db.GetScreening(ctx, s.ID)
}

func (db *DB) GetScreening(ctx context.Context, id int64) (models.HealthScreening, error) {
	rows, err := db.QueryContext(ctx, `
SELECT id, animal_id, COALESCE(user_id,0), COALESCE(media_url,''), COALESCE(media_type,''),
       symptoms_json, visual_analysis_json, assessment_json, urgency,
       COALESCE(district,''), COALESCE(taluka,''), COALESCE(farm_name,''), COALESCE(vet_review_requested,0), created_at
FROM health_screenings WHERE id=?`, id)
	if err != nil {
		return models.HealthScreening{}, err
	}
	defer rows.Close()
	ss, err := scanScreenings(rows)
	if err != nil {
		return models.HealthScreening{}, err
	}
	if len(ss) == 0 {
		return models.HealthScreening{}, sql.ErrNoRows
	}
	return ss[0], nil
}

func (db *DB) ListScreenings(ctx context.Context, userID int64, animalID int64) ([]models.HealthScreening, error) {
	if userID <= 0 {
		return []models.HealthScreening{}, nil
	}
	query := `
SELECT hs.id, hs.animal_id, COALESCE(hs.user_id, a.user_id), COALESCE(hs.media_url,''), COALESCE(hs.media_type,''), 
       hs.symptoms_json, hs.visual_analysis_json, hs.assessment_json, hs.urgency,
       COALESCE(hs.district, a.district, ''), COALESCE(hs.taluka, a.taluka, ''), COALESCE(hs.farm_name, ''), COALESCE(hs.vet_review_requested,0), hs.created_at 
FROM health_screenings hs
JOIN animals a ON hs.animal_id = a.id
WHERE (hs.user_id=? OR a.user_id=?) AND (?=0 OR hs.animal_id=?)
ORDER BY hs.created_at DESC`
	rows, err := db.QueryContext(ctx, query, userID, userID, animalID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScreenings(rows)
}

func scanScreenings(rows *sql.Rows) ([]models.HealthScreening, error) {
	out := make([]models.HealthScreening, 0)
	for rows.Next() {
		var s models.HealthScreening
		var symptomsJSON, visualJSON, assessmentJSON string
		var vetReview int
		if err := rows.Scan(
			&s.ID, &s.AnimalID, &s.UserID, &s.MediaURL, &s.MediaType,
			&symptomsJSON, &visualJSON, &assessmentJSON, &s.Urgency,
			&s.District, &s.Taluka, &s.FarmName, &vetReview, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		s.VetReviewRequested = vetReview == 1
		if err := json.Unmarshal([]byte(symptomsJSON), &s.Symptoms); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(visualJSON), &s.VisualAnalysis); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(assessmentJSON), &s.Assessment); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (db *DB) CreateReminder(ctx context.Context, r models.Reminder) (models.Reminder, error) {
	if r.UserID == 0 {
		r.UserID = 1
	}
	if r.Type == "" || r.Title == "" || r.DueAt.IsZero() {
		return models.Reminder{}, errors.New("type, title, and due_at are required")
	}
	res, err := db.ExecContext(ctx, `INSERT INTO reminders (user_id,animal_id,type,title,description,due_at,completed) VALUES (?,?,?,?,?,?,?)`,
		r.UserID, nullableAnimal(r.AnimalID), r.Type, r.Title, r.Description, r.DueAt, boolInt(r.Completed))
	if err != nil {
		return models.Reminder{}, err
	}
	r.ID, _ = res.LastInsertId()
	db.notifyChange()
	return r, nil
}

func (db *DB) ListReminders(ctx context.Context, userID int64) ([]models.Reminder, error) {
	if userID <= 0 {
		return []models.Reminder{}, nil
	}
	rows, err := db.QueryContext(ctx, `SELECT id,user_id,COALESCE(animal_id,0),type,title,COALESCE(description,''),due_at,completed,created_at FROM reminders WHERE user_id=? ORDER BY due_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Reminder, 0)
	for rows.Next() {
		var r models.Reminder
		var completed int
		if err := rows.Scan(&r.ID, &r.UserID, &r.AnimalID, &r.Type, &r.Title, &r.Description, &r.DueAt, &completed, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.Completed = completed == 1
		out = append(out, r)
	}
	return out, rows.Err()
}

func nullableAnimal(id int64) any {
	if id == 0 {
		return nil
	}
	return id
}

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
