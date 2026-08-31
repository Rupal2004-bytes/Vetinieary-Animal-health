package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"animal-health-ai/backend/internal/models"
)

type BackupManager struct {
	BackupDir        string
	UserDatabasePath string
	MainDatabasePath string
	mu               sync.Mutex
	triggerChan      chan string
}

func NewBackupManager(backupDir, userDbPath, mainDbPath string) *BackupManager {
	bm := &BackupManager{
		BackupDir:        backupDir,
		UserDatabasePath: userDbPath,
		MainDatabasePath: mainDbPath,
		triggerChan:      make(chan string, 100),
	}
	go bm.processBackupQueue()
	return bm
}

func (bm *BackupManager) TriggerAsyncBackup(sourcePath string) {
	if sourcePath == "" {
		return
	}
	select {
	case bm.triggerChan <- sourcePath:
	default:
		// Queue full, non-blocking
	}
}

func (bm *BackupManager) processBackupQueue() {
	var lastBackups = make(map[string]time.Time)
	for path := range bm.triggerChan {
		bm.mu.Lock()
		last, ok := lastBackups[path]
		// Debounce 2 seconds per DB to avoid disk thrashing on rapid batch operations
		if ok && time.Since(last) < 2*time.Second {
			bm.mu.Unlock()
			continue
		}
		lastBackups[path] = time.Now()
		bm.mu.Unlock()

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		meta, err := bm.BackupDatabase(ctx, path)
		cancel()
		if err != nil {
			log.Printf("[Internal Backup Warning] Auto-backup failed for %s: %v", path, err)
		} else {
			log.Printf("[Internal Backup] Auto-backup created: %s (%s, %s)", meta.Filename, meta.SizeFormatted, meta.Status)
		}
	}
}

func (bm *BackupManager) BackupDatabase(ctx context.Context, sourcePath string) (models.BackupMeta, error) {
	if err := os.MkdirAll(bm.BackupDir, 0o755); err != nil {
		return models.BackupMeta{}, fmt.Errorf("create backup directory: %w", err)
	}

	cleanSource := filepath.Clean(sourcePath)
	if _, err := os.Stat(cleanSource); err != nil {
		return models.BackupMeta{}, fmt.Errorf("source database does not exist: %w", err)
	}

	baseName := strings.TrimSuffix(filepath.Base(cleanSource), filepath.Ext(cleanSource))
	timestamp := time.Now().Format("20060102_150405")
	backupFilename := fmt.Sprintf("%s_backup_%s.db", baseName, timestamp)
	backupPath := filepath.Join(bm.BackupDir, backupFilename)

	// Attempt SQLite VACUUM INTO for online, transactional point-in-time snapshot
	vacuumSuccess := false
	db, err := sql.Open("sqlite3", cleanSource)
	if err == nil {
		defer db.Close()
		escapedDst := strings.ReplaceAll(backupPath, "'", "''")
		_, vacuumErr := db.ExecContext(ctx, fmt.Sprintf("VACUUM INTO '%s';", escapedDst))
		if vacuumErr == nil {
			vacuumSuccess = true
		}
	}

	// Fallback to atomic streaming copy if VACUUM INTO is unsupported
	if !vacuumSuccess {
		if err := copyFile(cleanSource, backupPath); err != nil {
			return models.BackupMeta{}, fmt.Errorf("copy database backup: %w", err)
		}
	}

	// Verify the backup file integrity
	health, err := CheckDBIntegrity(backupPath)
	status := "healthy"
	if err != nil || !health.IntegrityOK {
		status = "corrupt"
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		return models.BackupMeta{}, err
	}

	hash, _ := calculateFileSHA256(backupPath)

	return models.BackupMeta{
		Filename:      backupFilename,
		Database:      baseName,
		Path:          backupPath,
		SizeBytes:     info.Size(),
		SizeFormatted: formatBytes(info.Size()),
		SHA256:        hash,
		CreatedAt:     info.ModTime(),
		Status:        status,
	}, nil
}

func (bm *BackupManager) BackupAll(ctx context.Context) ([]models.BackupMeta, error) {
	var metas []models.BackupMeta

	if bm.UserDatabasePath != "" {
		if _, err := os.Stat(bm.UserDatabasePath); err == nil {
			meta, err := bm.BackupDatabase(ctx, bm.UserDatabasePath)
			if err != nil {
				return metas, fmt.Errorf("backup user.db: %w", err)
			}
			metas = append(metas, meta)
		}
	}

	if bm.MainDatabasePath != "" {
		if _, err := os.Stat(bm.MainDatabasePath); err == nil {
			meta, err := bm.BackupDatabase(ctx, bm.MainDatabasePath)
			if err != nil {
				return metas, fmt.Errorf("backup main db: %w", err)
			}
			metas = append(metas, meta)
		}
	}

	// Rotate old backups keeping 20 newest per database
	_, _ = bm.RotateBackups(20)

	return metas, nil
}

func (bm *BackupManager) ListBackups() ([]models.BackupMeta, error) {
	if err := os.MkdirAll(bm.BackupDir, 0o755); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(bm.BackupDir)
	if err != nil {
		return nil, err
	}

	var backups []models.BackupMeta
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".db") {
			continue
		}
		fullPath := filepath.Join(bm.BackupDir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}

		dbName := "database"
		if strings.HasPrefix(entry.Name(), "user") {
			dbName = "user.db"
		} else if strings.HasPrefix(entry.Name(), "animal_health") {
			dbName = "animal_health.db"
		}

		backups = append(backups, models.BackupMeta{
			Filename:      entry.Name(),
			Database:      dbName,
			Path:          fullPath,
			SizeBytes:     info.Size(),
			SizeFormatted: formatBytes(info.Size()),
			CreatedAt:     info.ModTime(),
			Status:        "ready",
		})
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	return backups, nil
}

func (bm *BackupManager) RotateBackups(keepPerDB int) (int, error) {
	if keepPerDB <= 0 {
		keepPerDB = 20
	}
	backups, err := bm.ListBackups()
	if err != nil {
		return 0, err
	}

	byDB := make(map[string][]models.BackupMeta)
	for _, b := range backups {
		byDB[b.Database] = append(byDB[b.Database], b)
	}

	deleted := 0
	for _, group := range byDB {
		if len(group) > keepPerDB {
			toDelete := group[keepPerDB:]
			for _, item := range toDelete {
				if err := os.Remove(item.Path); err == nil {
					deleted++
				}
			}
		}
	}

	return deleted, nil
}

func CheckDBIntegrity(dbPath string) (models.DatabaseHealth, error) {
	cleanPath := filepath.Clean(dbPath)
	info, err := os.Stat(cleanPath)
	if err != nil {
		return models.DatabaseHealth{
			Database: filepath.Base(cleanPath),
			Path:     cleanPath,
		}, err
	}

	db, err := sql.Open("sqlite3", cleanPath+"?mode=ro")
	if err != nil {
		return models.DatabaseHealth{}, err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var integrityResult string
	integrityOK := false
	if err := db.QueryRowContext(ctx, "PRAGMA integrity_check(1);").Scan(&integrityResult); err == nil && strings.ToLower(integrityResult) == "ok" {
		integrityOK = true
	}

	var quickResult string
	quickOK := false
	if err := db.QueryRowContext(ctx, "PRAGMA quick_check(1);").Scan(&quickResult); err == nil && strings.ToLower(quickResult) == "ok" {
		quickOK = true
	}

	var tableCount int
	_ = db.QueryRowContext(ctx, "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';").Scan(&tableCount)

	migrations, _ := GetAppliedMigrations(ctx, db)
	currentVer := 0
	if len(migrations) > 0 {
		currentVer = migrations[len(migrations)-1].Version
	}

	return models.DatabaseHealth{
		Database:       filepath.Base(cleanPath),
		Path:           cleanPath,
		IntegrityOK:    integrityOK,
		QuickCheckOK:   quickOK,
		TotalTables:    tableCount,
		SizeBytes:      info.Size(),
		SizeFormatted:  formatBytes(info.Size()),
		CurrentVersion: currentVer,
		Migrations:     migrations,
	}, nil
}

func RunInternalHealthChecks(dbPaths ...string) {
	log.Printf("==== Internal Database Health & Schema Verification ====")
	for _, p := range dbPaths {
		if p == "" {
			continue
		}
		h, err := CheckDBIntegrity(p)
		if err != nil {
			log.Printf("❌ Database [%s] Check Error: %v", p, err)
			continue
		}
		status := "✅ HEALTHY"
		if !h.IntegrityOK || !h.QuickCheckOK {
			status = "⚠️ DEGRADED / CORRUPT"
		}
		log.Printf("  • %s: %s | Schema v%d (%d applied migrations) | %d tables | Size: %s",
			h.Database, status, h.CurrentVersion, len(h.Migrations), h.TotalTables, h.SizeFormatted)
	}
	log.Printf("========================================================")
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func calculateFileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
