package database

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"

	"animal-health-ai/backend/internal/models"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailAlreadyExists = errors.New("email is already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrSessionExpired     = errors.New("session has expired or is invalid")
)

type UserDB struct {
	*sql.DB
	Path     string
	OnChange func(dbPath string)
}

func (db *UserDB) notifyChange() {
	if db != nil && db.OnChange != nil && db.Path != "" {
		db.OnChange(db.Path)
	}
}

func OpenUserDB(path string) (*UserDB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=10000")
	if err != nil {
		return nil, fmt.Errorf("open user database: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;`); err != nil {
		_ = db.Close()
		return nil, err
	}

	udb := &UserDB{DB: db, Path: path}
	if err := udb.Migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate user database: %w", err)
	}

	if err := udb.EnsureDemoUser(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("seed demo user in user database: %w", err)
	}

	return udb, nil
}

func (db *UserDB) Migrate(ctx context.Context) error {
	migrations := []Migration{
		{
			Version: 1,
			Name:    "create_users_sessions_logs_tables",
			Up: `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner',
  password_hash TEXT NOT NULL,
  hf_connected INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  clinic_name TEXT,
  avatar_url TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT NOT NULL,
  event TEXT NOT NULL,
  ip_address TEXT,
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
`,
		},
		{
			Version: 2,
			Name:    "add_user_profile_indices",
			Up: `
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`,
		},
	}

	return RunMigrations(ctx, db.DB, migrations)
}

func (db *UserDB) EnsureDemoUser(ctx context.Context) error {
	hash, err := bcrypt.GenerateFromPassword([]byte("demo-password"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	var count int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(1) FROM users WHERE email = 'demo@animalhealth.ai'`).Scan(&count)
	if count == 0 {
		_, err = db.ExecContext(ctx, `
INSERT INTO users (name, email, role, password_hash, hf_connected, clinic_name)
VALUES ('Demo Veterinarian', 'demo@animalhealth.ai', 'veterinarian', ?, 1, 'Central Emergency Veterinary Clinic')`, string(hash))
		return err
	}
	return nil
}

func (db *UserDB) CreateUser(ctx context.Context, u models.User, password string, ip string) (models.User, error) {
	u.Name = strings.TrimSpace(u.Name)
	u.Email = strings.ToLower(strings.TrimSpace(u.Email))
	u.Role = strings.TrimSpace(u.Role)
	if u.Role == "" {
		u.Role = "owner"
	}
	if u.Name == "" || u.Email == "" || len(password) < 4 {
		return models.User{}, errors.New("name, valid email, and password (at least 4 characters) are required")
	}

	var exists int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(1) FROM users WHERE email = ?`, u.Email).Scan(&exists); err != nil {
		return models.User{}, err
	}
	if exists > 0 {
		return models.User{}, ErrEmailAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return models.User{}, fmt.Errorf("hash password: %w", err)
	}

	res, err := db.ExecContext(ctx, `
INSERT INTO users (name, email, role, password_hash, phone, clinic_name, avatar_url, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		u.Name, u.Email, u.Role, string(hash), u.Phone, u.ClinicName, u.AvatarURL)
	if err != nil {
		return models.User{}, err
	}

	id, _ := res.LastInsertId()
	db.logAuthEvent(ctx, id, u.Email, "register", ip, fmt.Sprintf("Account registered with role %s", u.Role))
	db.notifyChange()

	return db.GetUserByID(ctx, id)
}

func (db *UserDB) AuthenticateUser(ctx context.Context, email, password, ip, userAgent string) (models.AuthResponse, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u models.User
	var hfConnected int
	var phone, clinicName, avatarURL sql.NullString
	var lastLogin sql.NullTime

	row := db.QueryRowContext(ctx, `
SELECT id, name, email, role, password_hash, hf_connected, phone, clinic_name, avatar_url, created_at, updated_at, last_login_at
FROM users WHERE email = ?`, email)

	if err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.Role, &u.PasswordHash, &hfConnected,
		&phone, &clinicName, &avatarURL, &u.CreatedAt, &u.UpdatedAt, &lastLogin,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			db.logAuthEvent(ctx, 0, email, "login_failed", ip, "User not found")
			return models.AuthResponse{}, ErrInvalidCredentials
		}
		return models.AuthResponse{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		db.logAuthEvent(ctx, u.ID, email, "login_failed", ip, "Incorrect password")
		return models.AuthResponse{}, ErrInvalidCredentials
	}

	u.HFConnected = hfConnected == 1
	if phone.Valid {
		u.Phone = phone.String
	}
	if clinicName.Valid {
		u.ClinicName = clinicName.String
	}
	if avatarURL.Valid {
		u.AvatarURL = avatarURL.String
	}
	if lastLogin.Valid {
		t := lastLogin.Time
		u.LastLoginAt = &t
	}

	token, expiresAt, err := db.createSession(ctx, u.ID, ip, userAgent)
	if err != nil {
		return models.AuthResponse{}, err
	}

	_, _ = db.ExecContext(ctx, `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, u.ID)
	db.logAuthEvent(ctx, u.ID, email, "login_success", ip, fmt.Sprintf("Logged in successfully via %s", userAgent))

	return models.AuthResponse{
		User:      u,
		Token:     token,
		ExpiresAt: expiresAt,
	}, nil
}

func (db *UserDB) GetUserByID(ctx context.Context, id int64) (models.User, error) {
	var u models.User
	var hfConnected int
	var phone, clinicName, avatarURL sql.NullString
	var lastLogin sql.NullTime

	row := db.QueryRowContext(ctx, `
SELECT id, name, email, role, password_hash, hf_connected, phone, clinic_name, avatar_url, created_at, updated_at, last_login_at
FROM users WHERE id = ?`, id)

	if err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.Role, &u.PasswordHash, &hfConnected,
		&phone, &clinicName, &avatarURL, &u.CreatedAt, &u.UpdatedAt, &lastLogin,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, ErrUserNotFound
		}
		return models.User{}, err
	}

	u.HFConnected = hfConnected == 1
	if phone.Valid {
		u.Phone = phone.String
	}
	if clinicName.Valid {
		u.ClinicName = clinicName.String
	}
	if avatarURL.Valid {
		u.AvatarURL = avatarURL.String
	}
	if lastLogin.Valid {
		t := lastLogin.Time
		u.LastLoginAt = &t
	}
	return u, nil
}

func (db *UserDB) GetUserByToken(ctx context.Context, token string) (models.User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return models.User{}, ErrSessionExpired
	}

	var u models.User
	var hfConnected int
	var phone, clinicName, avatarURL sql.NullString
	var lastLogin sql.NullTime

	row := db.QueryRowContext(ctx, `
SELECT u.id, u.name, u.email, u.role, u.password_hash, u.hf_connected, u.phone, u.clinic_name, u.avatar_url, u.created_at, u.updated_at, u.last_login_at
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`, token)

	if err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.Role, &u.PasswordHash, &hfConnected,
		&phone, &clinicName, &avatarURL, &u.CreatedAt, &u.UpdatedAt, &lastLogin,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, ErrSessionExpired
		}
		return models.User{}, err
	}

	u.HFConnected = hfConnected == 1
	if phone.Valid {
		u.Phone = phone.String
	}
	if clinicName.Valid {
		u.ClinicName = clinicName.String
	}
	if avatarURL.Valid {
		u.AvatarURL = avatarURL.String
	}
	if lastLogin.Valid {
		t := lastLogin.Time
		u.LastLoginAt = &t
	}
	return u, nil
}

func (db *UserDB) RevokeSession(ctx context.Context, token string, ip string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}

	var userID int64
	var email string
	_ = db.QueryRowContext(ctx, `
SELECT s.user_id, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?`, token).Scan(&userID, &email)

	_, err := db.ExecContext(ctx, `DELETE FROM sessions WHERE token = ?`, token)
	if userID != 0 {
		db.logAuthEvent(ctx, userID, email, "logout", ip, "Session revoked / logged out")
	}
	db.notifyChange()
	return err
}

func (db *UserDB) ChangePassword(ctx context.Context, userID int64, oldPassword, newPassword, ip string) error {
	if len(newPassword) < 4 {
		return errors.New("new password must be at least 4 characters")
	}

	var currentHash string
	var email string
	if err := db.QueryRowContext(ctx, `SELECT password_hash, email FROM users WHERE id = ?`, userID).Scan(&currentHash, &email); err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(oldPassword)); err != nil {
		db.logAuthEvent(ctx, userID, email, "password_change_failed", ip, "Incorrect current password")
		return errors.New("current password is incorrect")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, string(newHash), userID)
	if err != nil {
		return err
	}

	db.logAuthEvent(ctx, userID, email, "password_change_success", ip, "Password updated successfully")
	db.notifyChange()
	return nil
}

func (db *UserDB) UpdateProfile(ctx context.Context, userID int64, name, role, phone, clinicName, avatarURL string) (models.User, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return models.User{}, errors.New("name cannot be empty")
	}

	_, err := db.ExecContext(ctx, `
UPDATE users
SET name = ?, role = COALESCE(NULLIF(?, ''), role), phone = ?, clinic_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, name, role, phone, clinicName, avatarURL, userID)
	if err != nil {
		return models.User{}, err
	}

	db.notifyChange()
	return db.GetUserByID(ctx, userID)
}

func (db *UserDB) SetHuggingFaceConnected(ctx context.Context, userID int64, connected bool) (models.User, error) {
	val := 0
	if connected {
		val = 1
	}
	_, err := db.ExecContext(ctx, `UPDATE users SET hf_connected = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, val, userID)
	if err != nil {
		return models.User{}, err
	}
	db.notifyChange()
	return db.GetUserByID(ctx, userID)
}

func (db *UserDB) GetAuthLogs(ctx context.Context, userID int64, limit int) ([]models.AuthLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := db.QueryContext(ctx, `
SELECT id, user_id, email, event, COALESCE(ip_address, ''), COALESCE(details, ''), created_at
FROM auth_logs
WHERE user_id = ? OR ? = 0
ORDER BY created_at DESC
LIMIT ?`, userID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.AuthLog
	for rows.Next() {
		var l models.AuthLog
		if err := rows.Scan(&l.ID, &l.UserID, &l.Email, &l.Event, &l.IPAddress, &l.Details, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}

func (db *UserDB) createSession(ctx context.Context, userID int64, ip, userAgent string) (string, time.Time, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", time.Time{}, err
	}
	token := hex.EncodeToString(tokenBytes)
	expiresAt := time.Now().Add(30 * 24 * time.Hour) // 30 days session

	_, err := db.ExecContext(ctx, `
INSERT INTO sessions (token, user_id, user_agent, ip_address, expires_at, created_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, token, userID, userAgent, ip, expiresAt)
	if err != nil {
		return "", time.Time{}, err
	}
	db.notifyChange()
	return token, expiresAt, nil
}

func (db *UserDB) logAuthEvent(ctx context.Context, userID int64, email, event, ip, details string) {
	_, _ = db.ExecContext(ctx, `
INSERT INTO auth_logs (user_id, email, event, ip_address, details, created_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, userID, email, event, ip, details)
}
