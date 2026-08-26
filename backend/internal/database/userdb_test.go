package database

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"animal-health-ai/backend/internal/models"
)

func TestUserDB_AuthAndBcryptVerification(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_user.db")

	udb, err := OpenUserDB(dbPath)
	if err != nil {
		t.Fatalf("OpenUserDB failed: %v", err)
	}
	defer udb.Close()

	ctx := context.Background()

	// 1. Create a user
	newUser, err := udb.CreateUser(ctx, models.User{
		Name:  "Dr. Sarah Jenkins",
		Email: "sarah.jenkins@vetclinic.com",
		Role:  "veterinarian",
	}, "SecurePass123!", "127.0.0.1")

	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}
	if newUser.ID == 0 {
		t.Fatalf("Expected non-zero user ID")
	}

	// 2. Reject duplicate email
	_, err = udb.CreateUser(ctx, models.User{
		Name:  "Another Sarah",
		Email: "sarah.jenkins@vetclinic.com",
	}, "AnotherPass", "127.0.0.1")
	if err == nil {
		t.Fatalf("Expected duplicate email error, got nil")
	}

	// 3. Test failed authentication (wrong password)
	_, err = udb.AuthenticateUser(ctx, "sarah.jenkins@vetclinic.com", "WrongPassword", "127.0.0.1", "TestAgent")
	if err == nil {
		t.Fatalf("Expected authentication failure for wrong password")
	}

	// 4. Test successful authentication with bcrypt verification
	authRes, err := udb.AuthenticateUser(ctx, "sarah.jenkins@vetclinic.com", "SecurePass123!", "127.0.0.1", "TestAgent")
	if err != nil {
		t.Fatalf("AuthenticateUser failed: %v", err)
	}
	if authRes.Token == "" {
		t.Fatalf("Expected non-empty auth token")
	}
	if authRes.User.Email != "sarah.jenkins@vetclinic.com" {
		t.Fatalf("Expected email %s, got %s", "sarah.jenkins@vetclinic.com", authRes.User.Email)
	}

	// 5. Verify GetUserByToken
	userByToken, err := udb.GetUserByToken(ctx, authRes.Token)
	if err != nil {
		t.Fatalf("GetUserByToken failed: %v", err)
	}
	if userByToken.ID != newUser.ID {
		t.Fatalf("Expected user ID %d, got %d", newUser.ID, userByToken.ID)
	}

	// 6. Test ChangePassword
	err = udb.ChangePassword(ctx, newUser.ID, "SecurePass123!", "BrandNewPass456!", "127.0.0.1")
	if err != nil {
		t.Fatalf("ChangePassword failed: %v", err)
	}

	// Old password should now fail
	_, err = udb.AuthenticateUser(ctx, "sarah.jenkins@vetclinic.com", "SecurePass123!", "127.0.0.1", "TestAgent")
	if err == nil {
		t.Fatalf("Old password should not authenticate")
	}

	// New password should authenticate
	newAuth, err := udb.AuthenticateUser(ctx, "sarah.jenkins@vetclinic.com", "BrandNewPass456!", "127.0.0.1", "TestAgent")
	if err != nil {
		t.Fatalf("New password failed to authenticate: %v", err)
	}

	// 7. Revoke Session / Logout
	err = udb.RevokeSession(ctx, newAuth.Token, "127.0.0.1")
	if err != nil {
		t.Fatalf("RevokeSession failed: %v", err)
	}
	_, err = udb.GetUserByToken(ctx, newAuth.Token)
	if err == nil {
		t.Fatalf("Revoked token should fail lookup")
	}
}

func TestBackupManager_BackupAndIntegrity(t *testing.T) {
	tempDir := t.TempDir()
	userDbPath := filepath.Join(tempDir, "user.db")
	mainDbPath := filepath.Join(tempDir, "animal_health.db")
	backupDir := filepath.Join(tempDir, "backups")

	// Create and initialize databases
	udb, err := OpenUserDB(userDbPath)
	if err != nil {
		t.Fatalf("OpenUserDB failed: %v", err)
	}
	udb.Close()

	mdb, err := Open(mainDbPath)
	if err != nil {
		t.Fatalf("Open main DB failed: %v", err)
	}
	mdb.Close()

	mgr := NewBackupManager(backupDir, userDbPath, mainDbPath)
	ctx := context.Background()

	metas, err := mgr.BackupAll(ctx)
	if err != nil {
		t.Fatalf("BackupAll failed: %v", err)
	}
	if len(metas) != 2 {
		t.Fatalf("Expected 2 backup files, got %d", len(metas))
	}

	for _, meta := range metas {
		if _, err := os.Stat(meta.Path); err != nil {
			t.Fatalf("Backup file not found on disk: %s", meta.Path)
		}
		if meta.Status != "healthy" {
			t.Fatalf("Expected healthy backup, got status %s", meta.Status)
		}
	}

	backupsList, err := mgr.ListBackups()
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}
	if len(backupsList) < 2 {
		t.Fatalf("Expected at least 2 backups in list, got %d", len(backupsList))
	}

	health, err := CheckDBIntegrity(userDbPath)
	if err != nil {
		t.Fatalf("CheckDBIntegrity failed: %v", err)
	}
	if !health.IntegrityOK || !health.QuickCheckOK {
		t.Fatalf("Expected healthy database integrity check")
	}
	if health.TotalTables == 0 {
		t.Fatalf("Expected tables in database, got 0")
	}
}
