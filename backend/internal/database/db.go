package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
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
	}

	return RunMigrations(ctx, db.DB, migrations)
}

func (db *DB) ListAnimals(ctx context.Context, userID int64) ([]models.Animal, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,user_id,name,species,COALESCE(breed,''),COALESCE(age,''),COALESCE(sex,''),COALESCE(photo_url,''),COALESCE(notes,''),COALESCE(weight,''),created_at FROM animals WHERE (?=0 OR user_id=?) ORDER BY created_at DESC`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Animal, 0)
	for rows.Next() {
		var a models.Animal
		if err := rows.Scan(&a.ID, &a.UserID, &a.Name, &a.Species, &a.Breed, &a.Age, &a.Sex, &a.PhotoURL, &a.Notes, &a.Weight, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (db *DB) CreateAnimal(ctx context.Context, a models.Animal) (models.Animal, error) {
	if a.UserID == 0 {
		a.UserID = 1
	}
	res, err := db.ExecContext(ctx, `INSERT INTO animals (user_id,name,species,breed,age,sex,photo_url,notes,weight) VALUES (?,?,?,?,?,?,?,?,?)`,
		a.UserID, a.Name, a.Species, a.Breed, a.Age, a.Sex, a.PhotoURL, a.Notes, a.Weight)
	if err != nil {
		return models.Animal{}, err
	}
	a.ID, _ = res.LastInsertId()
	db.notifyChange()
	return db.GetAnimal(ctx, a.ID)
}

func (db *DB) GetAnimal(ctx context.Context, id int64) (models.Animal, error) {
	var a models.Animal
	err := db.QueryRowContext(ctx, `SELECT id,user_id,name,species,COALESCE(breed,''),COALESCE(age,''),COALESCE(sex,''),COALESCE(photo_url,''),COALESCE(notes,''),COALESCE(weight,''),created_at FROM animals WHERE id=?`, id).
		Scan(&a.ID, &a.UserID, &a.Name, &a.Species, &a.Breed, &a.Age, &a.Sex, &a.PhotoURL, &a.Notes, &a.Weight, &a.CreatedAt)
	return a, err
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
			UserID:  1,
			Name:    "Patient",
			Species: species,
		})
		if err == nil {
			s.AnimalID = animal.ID
		}
	}
	sym, _ := json.Marshal(s.Symptoms)
	vis, _ := json.Marshal(s.VisualAnalysis)
	assess, _ := json.Marshal(s.Assessment)
	res, err := db.ExecContext(ctx, `INSERT INTO health_screenings (animal_id,media_url,media_type,symptoms_json,visual_analysis_json,assessment_json,urgency) VALUES (?,?,?,?,?,?,?)`,
		s.AnimalID, s.MediaURL, s.MediaType, string(sym), string(vis), string(assess), s.Urgency)
	if err != nil {
		return models.HealthScreening{}, err
	}
	s.ID, _ = res.LastInsertId()
	db.notifyChange()
	return db.GetScreening(ctx, s.ID)
}

func (db *DB) GetScreening(ctx context.Context, id int64) (models.HealthScreening, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,animal_id,COALESCE(media_url,''),COALESCE(media_type,''),symptoms_json,visual_analysis_json,assessment_json,urgency,created_at FROM health_screenings WHERE id=?`, id)
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
	query := `SELECT hs.id, hs.animal_id, COALESCE(hs.media_url,''), COALESCE(hs.media_type,''), 
	                 hs.symptoms_json, hs.visual_analysis_json, hs.assessment_json, hs.urgency, hs.created_at 
	          FROM health_screenings hs
	          JOIN animals a ON hs.animal_id = a.id
	          WHERE (?=0 OR a.user_id=?) AND (?=0 OR hs.animal_id=?)
	          ORDER BY hs.created_at DESC`
	rows, err := db.QueryContext(ctx, query, userID, userID, animalID, animalID)
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
		if err := rows.Scan(&s.ID, &s.AnimalID, &s.MediaURL, &s.MediaType, &symptomsJSON, &visualJSON, &assessmentJSON, &s.Urgency, &s.CreatedAt); err != nil {
			return nil, err
		}
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
	rows, err := db.QueryContext(ctx, `SELECT id,user_id,COALESCE(animal_id,0),type,title,COALESCE(description,''),due_at,completed,created_at FROM reminders WHERE (?=0 OR user_id=?) ORDER BY due_at ASC`, userID, userID)
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
