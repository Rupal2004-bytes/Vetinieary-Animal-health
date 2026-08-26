package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"animal-health-ai/backend/internal/models"
)

type Migration struct {
	Version int
	Name    string
	Up      string
}

func EnsureMigrationTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`)
	return err
}

func RunMigrations(ctx context.Context, db *sql.DB, migrations []Migration) error {
	if err := EnsureMigrationTable(ctx, db); err != nil {
		return fmt.Errorf("ensure migration table: %w", err)
	}

	for _, m := range migrations {
		var exists int
		err := db.QueryRowContext(ctx, `SELECT COUNT(1) FROM schema_migrations WHERE version = ?`, m.Version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check migration version %d: %w", m.Version, err)
		}
		if exists > 0 {
			continue
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin transaction for migration %d (%s): %w", m.Version, m.Name, err)
		}

		if m.Up != "" {
			if _, err := tx.ExecContext(ctx, m.Up); err != nil {
				_ = tx.Rollback()
				return fmt.Errorf("execute migration %d (%s): %w", m.Version, m.Name, err)
			}
		}

		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`, m.Version, m.Name, time.Now()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record migration %d (%s): %w", m.Version, m.Name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %d (%s): %w", m.Version, m.Name, err)
		}
	}
	return nil
}

func GetAppliedMigrations(ctx context.Context, db *sql.DB) ([]models.MigrationInfo, error) {
	if err := EnsureMigrationTable(ctx, db); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.MigrationInfo
	for rows.Next() {
		var info models.MigrationInfo
		if err := rows.Scan(&info.Version, &info.Name, &info.AppliedAt); err != nil {
			return nil, err
		}
		list = append(list, info)
	}
	return list, rows.Err()
}
