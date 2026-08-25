package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"animal-health-ai/backend/internal/models"
)

type DB struct {
	*sql.DB
}

func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		_ = db.Close()
		return nil, err
	}
	wrapped := &DB{DB: db}
	if err := wrapped.Migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := wrapped.EnsureDemoUser(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return wrapped, nil
}

func (db *DB) Migrate(ctx context.Context) error {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner',
  hf_connected INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(animal_id) REFERENCES animals(id) ON DELETE CASCADE
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(animal_id) REFERENCES animals(id) ON DELETE SET NULL
);`)
	if err != nil {
		return err
	}
	_, _ = db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'`)
	_, _ = db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN hf_connected INTEGER NOT NULL DEFAULT 0`)
	return nil
}

func (db *DB) EnsureDemoUser(ctx context.Context) error {
	_, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO users (id, name, email, role, password_hash) VALUES (1, 'Demo User', 'demo@animalhealth.ai', 'veterinarian', ?)`, hashPassword("demo-password"))
	return err
}

func (db *DB) CreateUser(ctx context.Context, u models.User, password string) (models.User, error) {
	u.Name = strings.TrimSpace(u.Name)
	u.Email = strings.ToLower(strings.TrimSpace(u.Email))
	u.Role = strings.TrimSpace(u.Role)
	if u.Role == "" {
		u.Role = "owner"
	}
	if u.Name == "" || u.Email == "" || strings.TrimSpace(password) == "" {
		return models.User{}, errors.New("name, email, and password are required")
	}
	res, err := db.ExecContext(ctx, `INSERT INTO users (name,email,role,password_hash) VALUES (?,?,?,?)`, u.Name, u.Email, u.Role, hashPassword(password))
	if err != nil {
		return models.User{}, err
	}
	u.ID, _ = res.LastInsertId()
	return db.GetUser(ctx, u.ID)
}

func (db *DB) AuthenticateUser(ctx context.Context, email, password, role string) (models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	row := db.QueryRowContext(ctx, `SELECT id,name,email,role,hf_connected,password_hash,created_at FROM users WHERE email=?`, email)
	var u models.User
	var hfConnected int
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &hfConnected, &u.PasswordHash, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.CreateUser(ctx, models.User{Name: displayNameFromEmail(email), Email: email, Role: role}, password)
		}
		return models.User{}, err
	}
	if u.PasswordHash != hashPassword(password) {
		return models.User{}, sql.ErrNoRows
	}
	u.HFConnected = hfConnected == 1
	return u, nil
}

func (db *DB) GetUser(ctx context.Context, id int64) (models.User, error) {
	var u models.User
	var hfConnected int
	err := db.QueryRowContext(ctx, `SELECT id,name,email,role,hf_connected,password_hash,created_at FROM users WHERE id=?`, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &hfConnected, &u.PasswordHash, &u.CreatedAt)
	u.HFConnected = hfConnected == 1
	return u, err
}

func (db *DB) SetHuggingFaceConnected(ctx context.Context, userID int64, connected bool) (models.User, error) {
	_, err := db.ExecContext(ctx, `UPDATE users SET hf_connected=? WHERE id=?`, boolInt(connected), userID)
	if err != nil {
		return models.User{}, err
	}
	return db.GetUser(ctx, userID)
}

func (db *DB) ListAnimals(ctx context.Context) ([]models.Animal, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,user_id,name,species,COALESCE(breed,''),COALESCE(age,''),COALESCE(sex,''),COALESCE(photo_url,''),COALESCE(notes,''),COALESCE(weight,''),created_at FROM animals ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Animal
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
	return m, nil
}

func (db *DB) GetMedia(ctx context.Context, id int64) (models.Media, error) {
	var m models.Media
	err := db.QueryRowContext(ctx, `SELECT id,url,path,type,mime_type,size,created_at FROM media WHERE id=?`, id).
		Scan(&m.ID, &m.URL, &m.Path, &m.Type, &m.MIMEType, &m.Size, &m.CreatedAt)
	return m, err
}

func (db *DB) CreateScreening(ctx context.Context, s models.HealthScreening) (models.HealthScreening, error) {
	sym, _ := json.Marshal(s.Symptoms)
	vis, _ := json.Marshal(s.VisualAnalysis)
	assess, _ := json.Marshal(s.Assessment)
	res, err := db.ExecContext(ctx, `INSERT INTO health_screenings (animal_id,media_url,media_type,symptoms_json,visual_analysis_json,assessment_json,urgency) VALUES (?,?,?,?,?,?,?)`,
		s.AnimalID, s.MediaURL, s.MediaType, string(sym), string(vis), string(assess), s.Urgency)
	if err != nil {
		return models.HealthScreening{}, err
	}
	s.ID, _ = res.LastInsertId()
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

func (db *DB) ListScreenings(ctx context.Context, animalID int64) ([]models.HealthScreening, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,animal_id,COALESCE(media_url,''),COALESCE(media_type,''),symptoms_json,visual_analysis_json,assessment_json,urgency,created_at FROM health_screenings WHERE (?=0 OR animal_id=?) ORDER BY created_at DESC`, animalID, animalID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScreenings(rows)
}

func scanScreenings(rows *sql.Rows) ([]models.HealthScreening, error) {
	var out []models.HealthScreening
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
	return r, nil
}

func (db *DB) ListReminders(ctx context.Context) ([]models.Reminder, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,user_id,COALESCE(animal_id,0),type,title,COALESCE(description,''),due_at,completed,created_at FROM reminders ORDER BY due_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Reminder
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

func hashPassword(password string) string {
	sum := sha256.Sum256([]byte(password))
	return hex.EncodeToString(sum[:])
}

func displayNameFromEmail(email string) string {
	local := strings.TrimSpace(strings.Split(email, "@")[0])
	if local == "" {
		return "VetScan User"
	}
	return strings.ReplaceAll(local, ".", " ")
}
