package storage

import (
	"mime/multipart"
	"os"
	"testing"
)

func TestLocalStoreRejectsUnsupportedMedia(t *testing.T) {
	store := NewLocalStore(t.TempDir())
	tmp, err := os.CreateTemp(t.TempDir(), "bad-*.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer tmp.Close()
	if _, err := tmp.Write([]byte("plain text")); err != nil {
		t.Fatal(err)
	}
	if _, err := tmp.Seek(0, 0); err != nil {
		t.Fatal(err)
	}
	file := multipart.File(tmp)
	_, err = store.Save(nil, file, &multipart.FileHeader{Filename: "note.txt", Size: 10})
	if err != ErrUnsupportedMedia {
		t.Fatalf("expected unsupported media, got %v", err)
	}
}

func TestLocalStoreSavesPNG(t *testing.T) {
	store := NewLocalStore(t.TempDir())
	png := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0}
	tmp, err := os.CreateTemp(t.TempDir(), "upload-*.png")
	if err != nil {
		t.Fatal(err)
	}
	defer tmp.Close()
	if _, err := tmp.Write(png); err != nil {
		t.Fatal(err)
	}
	if _, err := tmp.Seek(0, 0); err != nil {
		t.Fatal(err)
	}
	media, err := store.Save(nil, tmp, &multipart.FileHeader{Filename: "skin.png", Size: int64(len(png))})
	if err != nil {
		t.Fatal(err)
	}
	if media.Type != "image" || media.MIMEType != "image/png" {
		t.Fatalf("unexpected media: %+v", media)
	}
}
