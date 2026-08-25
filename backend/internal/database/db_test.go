package database

import (
	"context"
	"testing"

	"animal-health-ai/backend/internal/models"
)

func TestSQLiteAnimalAndScreeningFlow(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	animal, err := db.CreateAnimal(context.Background(), models.Animal{Name: "Daisy", Species: "cattle", Breed: "Holstein"})
	if err != nil {
		t.Fatal(err)
	}
	screening, err := db.CreateScreening(context.Background(), models.HealthScreening{
		AnimalID: animal.ID,
		Symptoms: models.SymptomInput{Symptoms: []string{"skin_nodules"}},
		VisualAnalysis: models.VisualAnalysis{
			Animal:               "cattle",
			VisibleAbnormalities: []string{"raised lesions"},
		},
		Assessment: models.ClinicalAssessment{
			Summary:            "Moderate concern",
			Urgency:            "moderate",
			PossibleConditions: []models.PossibleCondition{{Name: "Possible skin disease", Likelihood: "possible", Reason: "visible lesion"}},
		},
		Urgency: "moderate",
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := db.GetScreening(context.Background(), screening.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.AnimalID != animal.ID || got.Assessment.Summary == "" || got.VisualAnalysis.Animal != "cattle" {
		t.Fatalf("unexpected screening: %+v", got)
	}
}
