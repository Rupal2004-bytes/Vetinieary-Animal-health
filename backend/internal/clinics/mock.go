package clinics

import (
	"context"

	"animal-health-ai/backend/internal/models"
)

type Provider interface {
	Nearby(ctx context.Context, lat, lng float64, urgency string) ([]models.Clinic, error)
}

type MockProvider struct{}

func (p MockProvider) Nearby(ctx context.Context, lat, lng float64, urgency string) ([]models.Clinic, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return []models.Clinic{
		{ID: "city-vet-er", Name: "City Veterinary Emergency Center", Distance: "1.8 mi", Rating: 4.8, Open: true, Phone: "+1-800-555-0111", Address: "24 Care Lane, Downtown", Directions: "https://maps.google.com/?q=City+Veterinary+Emergency+Center"},
		{ID: "greenfield-mobile", Name: "Greenfield Mobile Livestock Vet", Distance: "5.4 mi", Rating: 4.6, Open: true, Phone: "+1-800-555-0142", Address: "Farm Route 7, Greenfield", Directions: "https://maps.google.com/?q=Greenfield+Mobile+Livestock+Vet"},
		{ID: "companion-care", Name: "Companion Care Animal Hospital", Distance: "3.2 mi", Rating: 4.5, Open: urgency == "emergency" || urgency == "high", Phone: "+1-800-555-0199", Address: "118 Wellness Ave", Directions: "https://maps.google.com/?q=Companion+Care+Animal+Hospital"},
	}, nil
}
