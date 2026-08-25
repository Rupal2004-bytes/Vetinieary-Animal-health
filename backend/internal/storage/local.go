package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"animal-health-ai/backend/internal/models"
)

const MaxMediaBytes int64 = 25 << 20

var allowedMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"video/mp4":  ".mp4",
}

type Store interface {
	Save(ctx context.Context, file multipart.File, header *multipart.FileHeader) (models.Media, error)
}

type LocalStore struct {
	Dir     string
	BaseURL string
}

func NewLocalStore(dir string) *LocalStore {
	return &LocalStore{Dir: dir, BaseURL: "/media"}
}

func (s *LocalStore) Save(ctx context.Context, file multipart.File, header *multipart.FileHeader) (models.Media, error) {
	if header == nil || header.Size == 0 {
		return models.Media{}, ErrEmptyUpload
	}
	if header.Size > MaxMediaBytes {
		return models.Media{}, ErrTooLarge
	}
	head := make([]byte, 512)
	n, _ := file.Read(head)
	if seeker, ok := file.(io.Seeker); ok {
		_, _ = seeker.Seek(0, io.SeekStart)
	}
	mimeType := http.DetectContentType(head[:n])
	ext, ok := allowedMIMEs[mimeType]
	if !ok {
		return models.Media{}, ErrUnsupportedMedia
	}
	origExt := strings.ToLower(filepath.Ext(header.Filename))
	if origExt != ext && !(mimeType == "image/jpeg" && (origExt == ".jpeg" || origExt == ".jpg")) {
		return models.Media{}, ErrUnsupportedMedia
	}
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return models.Media{}, err
	}
	name, err := randomName(ext)
	if err != nil {
		return models.Media{}, err
	}
	dstPath := filepath.Join(s.Dir, name)
	dst, err := os.Create(dstPath)
	if err != nil {
		return models.Media{}, err
	}
	defer dst.Close()
	written, err := io.Copy(dst, io.LimitReader(file, MaxMediaBytes+1))
	if err != nil {
		return models.Media{}, err
	}
	if written > MaxMediaBytes {
		return models.Media{}, ErrTooLarge
	}
	mediaType := "image"
	if strings.HasPrefix(mimeType, "video/") {
		mediaType = "video"
	}
	return models.Media{
		URL:      fmt.Sprintf("%s/%s", s.BaseURL, name),
		Path:     dstPath,
		Type:     mediaType,
		MIMEType: mimeType,
		Size:     written,
	}, nil
}

var (
	ErrEmptyUpload      = errors.New("empty upload")
	ErrTooLarge         = errors.New("file too large")
	ErrUnsupportedMedia = errors.New("unsupported media type")
)

func randomName(ext string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b) + ext, nil
}
