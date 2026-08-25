package ai

import (
	"context"
	"testing"

	"animal-health-ai/backend/internal/models"
)

func TestMockProvidersReturnSafeAssessment(t *testing.T) {
	animal := models.Animal{Name: "Daisy", Species: "cattle"}
	symptoms := models.SymptomInput{Symptoms: []string{"skin_nodules", "alopecia", "crusting_scabs"}}
	visual, err := MockVisionProvider{}.AnalyzeMedia(context.Background(), models.Media{}, animal, symptoms)
	if err != nil {
		t.Fatal(err)
	}
	assessment, err := MockVeterinaryProvider{}.Assess(context.Background(), models.ClinicalInput{Animal: animal, Symptoms: symptoms, VisualAnalysis: visual})
	if err != nil {
		t.Fatal(err)
	}
	if err := ValidateAssessment(assessment); err != nil {
		t.Fatal(err)
	}
	if assessment.Urgency != "high" {
		t.Fatalf("expected high urgency, got %q", assessment.Urgency)
	}
}

func TestValidateAssessmentRejectsMalformedResponse(t *testing.T) {
	if err := ValidateAssessment(models.ClinicalAssessment{Summary: "bad", Urgency: "certain"}); err == nil {
		t.Fatal("expected malformed assessment to fail")
	}
}
