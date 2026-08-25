package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"animal-health-ai/backend/internal/models"
)

type VisionProvider interface {
	AnalyzeMedia(ctx context.Context, media models.Media, animal models.Animal, symptoms models.SymptomInput) (models.VisualAnalysis, error)
}

type VeterinaryProvider interface {
	Assess(ctx context.Context, input models.ClinicalInput) (models.ClinicalAssessment, error)
}

type contextKey string

const huggingFaceTokenKey contextKey = "huggingface_token"

func WithHuggingFaceToken(ctx context.Context, token string) context.Context {
	token = strings.TrimSpace(token)
	if token == "" {
		return ctx
	}
	return context.WithValue(ctx, huggingFaceTokenKey, token)
}

type MockVisionProvider struct{}

func (p MockVisionProvider) AnalyzeMedia(ctx context.Context, media models.Media, animal models.Animal, symptoms models.SymptomInput) (models.VisualAnalysis, error) {
	select {
	case <-ctx.Done():
		return models.VisualAnalysis{}, ctx.Err()
	default:
	}
	scenario := classifyScenario(animal, symptoms)
	switch scenario {
	case "cattle_skin":
		return models.VisualAnalysis{
			Animal:                   "cattle",
			VisibleAbnormalities:     []string{"raised skin lesions", "patchy hair loss", "surface crusting"},
			AffectedBodyParts:        []string{"skin", "flank or neck region"},
			LesionDescription:        "Multiple raised, round skin lesions with hair loss and crusting are visually apparent.",
			SkinChanges:              []string{"crusting", "alopecia", "irregular raised nodules"},
			Wounds:                   []string{},
			Swelling:                 []string{"localized raised areas"},
			Discharge:                []string{},
			SeverityVisibleSymptoms:  "moderate",
			ImageQuality:             "usable for preliminary visual screening",
			NonDiagnosticObservation: "Visual observations are not a diagnosis and require veterinary confirmation.",
		}, nil
	case "dog_mobility":
		return models.VisualAnalysis{
			Animal:                   "dog",
			VisibleAbnormalities:     []string{"abnormal gait", "reluctance to place weight on one limb"},
			AffectedBodyParts:        []string{"limb", "musculoskeletal system"},
			LesionDescription:        "No clear skin lesion is visible; movement suggests reduced weight bearing.",
			BehavioralObservations:   []string{"guarded posture", "limping or altered stride"},
			SeverityVisibleSymptoms:  "moderate",
			ImageQuality:             "usable for movement screening if video clearly shows gait",
			NonDiagnosticObservation: "A hands-on orthopedic and neurologic exam is needed.",
		}, nil
	default:
		return models.VisualAnalysis{
			Animal:                   animal.Species,
			VisibleAbnormalities:     []string{"redness", "skin irritation", "scratching-related changes"},
			AffectedBodyParts:        []string{"skin", "coat"},
			LesionDescription:        "Localized redness and irritated skin are visible; appearance may be worsened by scratching.",
			SkinChanges:              []string{"erythema", "irritation", "possible excoriation"},
			Wounds:                   []string{},
			Swelling:                 []string{},
			Discharge:                []string{},
			BehavioralObservations:   []string{"scratching reported or suspected"},
			SeverityVisibleSymptoms:  "mild to moderate",
			ImageQuality:             "usable for preliminary visual screening",
			NonDiagnosticObservation: "The image supports visible irritation only, not a confirmed cause.",
		}, nil
	}
}

type MockVeterinaryProvider struct{}

func (p MockVeterinaryProvider) Assess(ctx context.Context, input models.ClinicalInput) (models.ClinicalAssessment, error) {
	select {
	case <-ctx.Done():
		return models.ClinicalAssessment{}, ctx.Err()
	default:
	}
	scenario := classifyScenario(input.Animal, input.Symptoms)
	disclaimer := "This is an AI-assisted preliminary screening tool and does not replace examination by a qualified veterinarian."
	switch scenario {
	case "cattle_skin":
		return models.ClinicalAssessment{
			Summary: "Moderate to high concern: the visible raised lesions, hair loss, and crusting may indicate a dermatological or infectious condition in cattle.",
			PossibleConditions: []models.PossibleCondition{
				{Name: "Possible infectious dermatological condition", Likelihood: "moderate", Reason: "Raised nodules with crusting and hair loss can be seen with infectious or vector-associated skin disease."},
				{Name: "Possible parasitic or secondary bacterial skin disease", Likelihood: "possible", Reason: "Crusting and hair loss may also occur with parasites, trauma, or secondary infection."},
			},
			Urgency: "high",
			RecommendedNextSteps: []string{
				"Separate the animal from the herd until a veterinarian advises otherwise.",
				"Arrange a veterinary farm visit or clinic assessment promptly.",
				"Photograph lesion progression and note fever, appetite, milk production, and new affected animals.",
			},
			SupportiveCare:      []string{"Provide clean water, shade, and soft feed.", "Limit fly exposure if safe and practical."},
			Avoid:               []string{"Do not lance lesions or apply unverified chemicals.", "Do not start prescription medicines without a veterinarian."},
			VeterinaryAttention: "Prompt veterinary attention is recommended, especially if fever, spread through the herd, or reduced milk yield is present.",
			Disclaimer:          disclaimer,
		}, nil
	case "dog_mobility":
		return models.ClinicalAssessment{
			Summary: "Moderate concern: abnormal gait and reluctance to bear weight may indicate a musculoskeletal injury or painful condition.",
			PossibleConditions: []models.PossibleCondition{
				{Name: "Possible sprain, strain, or soft-tissue injury", Likelihood: "moderate", Reason: "Reduced weight bearing commonly follows limb pain or injury."},
				{Name: "Possible joint, paw, or orthopedic condition", Likelihood: "possible", Reason: "A veterinary exam is needed to localize pain and rule out fracture or neurologic disease."},
			},
			Urgency: "moderate",
			RecommendedNextSteps: []string{
				"Restrict running, jumping, and stairs until evaluated.",
				"Inspect the paw gently for obvious thorns, cuts, or swelling if the animal tolerates handling.",
				"Schedule a veterinary exam within 24 to 48 hours, sooner if pain is severe.",
			},
			SupportiveCare:      []string{"Keep the dog rested in a comfortable area.", "Use a leash for short bathroom breaks."},
			Avoid:               []string{"Do not give human pain medicines.", "Do not force exercise to test the limb."},
			VeterinaryAttention: "Seek urgent care now if the dog cannot stand, cries in pain, has obvious deformity, or symptoms worsen quickly.",
			Disclaimer:          disclaimer,
		}, nil
	default:
		return models.ClinicalAssessment{
			Summary: "Moderate health concern: visible redness, irritation, and scratching may indicate a dermatological issue that needs veterinary confirmation.",
			PossibleConditions: []models.PossibleCondition{
				{Name: "Possible allergic or irritant dermatitis", Likelihood: "moderate", Reason: "Redness and scratching are compatible with irritation or allergy."},
				{Name: "Possible parasite, yeast, or bacterial skin issue", Likelihood: "possible", Reason: "Skin irritation can have multiple causes that require examination or cytology."},
			},
			Urgency: "moderate",
			RecommendedNextSteps: []string{
				"Prevent licking or scratching if possible using a safe barrier collar.",
				"Book a veterinary exam if symptoms persist, spread, smell foul, or discharge appears.",
				"Share photos, duration, diet changes, and parasite prevention history with the veterinarian.",
			},
			SupportiveCare:      []string{"Keep the area clean and dry.", "Use only pet-safe products previously recommended by a veterinarian."},
			Avoid:               []string{"Do not apply steroid, antibiotic, or essential-oil products without veterinary guidance.", "Do not bandage tightly."},
			VeterinaryAttention: "Veterinary assessment is recommended if irritation is spreading, painful, recurrent, or associated with lethargy or fever.",
			Disclaimer:          disclaimer,
		}, nil
	}
}

type HuggingFaceProvider struct {
	Token           string
	VisionModel     string
	VeterinaryModel string
	Client          *http.Client
}

func (p HuggingFaceProvider) AnalyzeMedia(ctx context.Context, media models.Media, animal models.Animal, symptoms models.SymptomInput) (models.VisualAnalysis, error) {
	content := []map[string]any{{
		"type": "text",
		"text": "Return only JSON for a preliminary veterinary visual observation. Match this shape: {\"animal\":\"\",\"visible_abnormalities\":[],\"affected_body_parts\":[],\"lesion_description\":\"\",\"skin_changes\":[],\"wounds\":[],\"swelling\":[],\"discharge\":[],\"behavioral_observations\":[],\"severity_of_visible_symptoms\":\"low|mild|moderate|high|emergency\",\"image_quality\":\"\",\"non_diagnostic_observation\":\"\"}. Do not diagnose. Animal and symptoms: " + mustJSON(map[string]any{"animal": animal, "symptoms": symptoms}),
	}}
	if dataURL, err := mediaDataURL(media); err == nil && dataURL != "" {
		content = append(content, map[string]any{
			"type": "image_url",
			"image_url": map[string]string{
				"url": dataURL,
			},
		})
	}
	text, err := p.chat(ctx, p.VisionModel, []map[string]any{{
		"role":    "user",
		"content": content,
	}})
	if err != nil {
		return models.VisualAnalysis{}, err
	}
	var out models.VisualAnalysis
	if err := decodeJSONText(text, &out); err != nil {
		return models.VisualAnalysis{}, err
	}
	return out, nil
}

func (p HuggingFaceProvider) Assess(ctx context.Context, input models.ClinicalInput) (models.ClinicalAssessment, error) {
	prompt := "Return only JSON for preliminary veterinary decision support. Match this shape exactly: {\"summary\":\"\",\"possible_conditions\":[{\"name\":\"\",\"likelihood\":\"high|moderate|possible|low\",\"reason\":\"\"}],\"urgency\":\"low|moderate|high|emergency\",\"recommended_next_steps\":[],\"supportive_care\":[],\"avoid\":[],\"veterinary_attention\":\"\",\"disclaimer\":\"\"}. Avoid definitive diagnosis, medication dosing, and model/provider references. Input: " + mustJSON(input)
	text, err := p.chat(ctx, p.VeterinaryModel, []map[string]any{{
		"role":    "user",
		"content": prompt,
	}})
	if err != nil {
		return models.ClinicalAssessment{}, err
	}
	var out models.ClinicalAssessment
	if err := decodeJSONText(text, &out); err != nil {
		return models.ClinicalAssessment{}, err
	}
	if out.Disclaimer == "" {
		out.Disclaimer = "This is preliminary decision support and does not replace examination by a qualified veterinarian."
	}
	return out, nil
}

func (p HuggingFaceProvider) chat(ctx context.Context, model string, messages []map[string]any) (string, error) {
	token := p.token(ctx)
	if token == "" {
		return "", errors.New("huggingface token is required")
	}
	if model == "" {
		return "", errors.New("inference model is not configured")
	}
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 45 * time.Second}
	}
	body, err := json.Marshal(map[string]any{
		"model":       model,
		"messages":    messages,
		"temperature": 0.2,
		"max_tokens":  900,
		"stream":      false,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://router.huggingface.co/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var decoded struct {
		Choices []struct {
			Message struct {
				Content any `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error any `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("inference request failed: %v", decoded.Error)
	}
	if len(decoded.Choices) == 0 {
		return "", errors.New("inference response did not include content")
	}
	switch content := decoded.Choices[0].Message.Content.(type) {
	case string:
		return content, nil
	case []any:
		var parts []string
		for _, item := range content {
			if m, ok := item.(map[string]any); ok {
				if text, ok := m["text"].(string); ok {
					parts = append(parts, text)
				}
			}
		}
		return strings.Join(parts, "\n"), nil
	default:
		return "", errors.New("inference response content was not text")
	}
}

func (p HuggingFaceProvider) token(ctx context.Context) string {
	if token, ok := ctx.Value(huggingFaceTokenKey).(string); ok && strings.TrimSpace(token) != "" {
		return strings.TrimSpace(token)
	}
	return strings.TrimSpace(p.Token)
}

func mediaDataURL(media models.Media) (string, error) {
	if media.Path == "" || media.MIMEType == "" || media.Type != "image" {
		return "", nil
	}
	data, err := os.ReadFile(filepath.Clean(media.Path))
	if err != nil {
		return "", err
	}
	return "data:" + media.MIMEType + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func decodeJSONText(text string, out any) error {
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```") {
		re := regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)\\s*```")
		if match := re.FindStringSubmatch(text); len(match) == 2 {
			text = strings.TrimSpace(match[1])
		}
	}
	start := strings.IndexAny(text, "{[")
	end := strings.LastIndexAny(text, "}]")
	if start >= 0 && end > start {
		text = text[start : end+1]
	}
	return json.Unmarshal([]byte(text), out)
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func ValidateAssessment(a models.ClinicalAssessment) error {
	if a.Summary == "" || a.Urgency == "" || len(a.PossibleConditions) == 0 {
		return errors.New("invalid AI assessment")
	}
	switch a.Urgency {
	case "low", "moderate", "high", "emergency":
		return nil
	default:
		return errors.New("invalid AI urgency")
	}
}

func classifyScenario(animal models.Animal, symptoms models.SymptomInput) string {
	text := strings.ToLower(animal.Species + " " + animal.Breed + " " + strings.Join(symptoms.Symptoms, " ") + " " + symptoms.Other)
	if strings.Contains(text, "cattle") || strings.Contains(text, "bovine") || strings.Contains(text, "cow") {
		if strings.Contains(text, "skin") || strings.Contains(text, "nodule") || strings.Contains(text, "lesion") || strings.Contains(text, "crust") || strings.Contains(text, "hair") {
			return "cattle_skin"
		}
	}
	if strings.Contains(text, "lameness") || strings.Contains(text, "gait") || strings.Contains(text, "limp") || strings.Contains(text, "mobility") || strings.Contains(text, "injury") {
		return "dog_mobility"
	}
	return "dog_skin"
}
