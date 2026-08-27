package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
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

	species, scenario := classifyScenarioAndSpecies(animal, symptoms, media)

	switch scenario {
	case "parvo_gastro":
		return models.VisualAnalysis{
			Animal:                   species,
			VisibleAbnormalities:     []string{"severe lethargy and recumbency", "sunken eyes indicating marked dehydration", "perianal hemorrhagic/diarrheic staining", "tucked abdomen and weak pulse presentation"},
			AffectedBodyParts:        []string{"gastrointestinal tract", "perianal region", "systemic/ocular"},
			LesionDescription:        "Patient exhibits severe systemic depression with evident sunken globes, skin tenting (dehydration >8%), and hemorrhagic fecal staining on perineum and hindquarters.",
			SkinChanges:              []string{"loss of skin turgor", "pale/dry mucous membranes"},
			Wounds:                   []string{},
			Swelling:                 []string{"mild abdominal guarding"},
			Discharge:                []string{"foul-smelling bloody/mucoid diarrhea", "frothy vomitus residue"},
			BehavioralObservations:   []string{"prostration", "inability to stand", "hyporexia/anorexia"},
			SeverityVisibleSymptoms:  "emergency",
			ImageQuality:             "High diagnostic clarity for posture and systemic clinical presentation",
			NonDiagnosticObservation: "Visual presentation is highly indicative of acute viral enteritis or severe gastrointestinal toxicity requiring urgent emergency hospital stabilization.",
		}, nil

	case "distemper_systemic":
		return models.VisualAnalysis{
			Animal:                   species,
			VisibleAbnormalities:     []string{"bilateral mucopurulent ocular and nasal discharge", "hard pad hyperkeratosis on nasal planum and paw pads", "generalized muscle myoclonus/chorea", "crusty peri-orbital erythema"},
			AffectedBodyParts:        []string{"eyes", "nasal cavity", "footpads/nasal planum", "nervous system"},
			LesionDescription:        "Bilateral thick purulent oculonasal crusting, nasal hyperkeratosis with thickened cracked footpads, and visible involuntary facial twitching/myoclonus.",
			SkinChanges:              []string{"nasal hyperkeratosis", "digital hyperkeratosis", "pustular abdominal rash"},
			Wounds:                   []string{},
			Swelling:                 []string{"conjunctival chemosis"},
			Discharge:                []string{"thick yellowish mucopurulent oculonasal discharge"},
			BehavioralObservations:   []string{"lethargy", "depressed mentation", "involuntary localized muscle spasms"},
			SeverityVisibleSymptoms:  "emergency",
			ImageQuality:             "Clear anatomical detail of facial features and digital pads",
			NonDiagnosticObservation: "Presentation strongly suggests multisystemic viral infection with respiratory, dermatological, and neurological involvement.",
		}, nil

	case "cattle_lumpy_skin":
		return models.VisualAnalysis{
			Animal:                   "Bovine (Cattle)",
			VisibleAbnormalities:     []string{"multiple well-circumscribed cutaneous nodules (2-5 cm)", "focal necrotic core ulcerations ('sit-fasts')", "prescapular and prefemoral lymph node enlargement", "edematous dewlap and limb swelling"},
			AffectedBodyParts:        []string{"skin and subcutaneous tissue", "neck", "flank", "perineum", "limbs"},
			LesionDescription:        "Widespread firm, raised, round cutaneous nodules throughout the neck, torso, and perineal region. Several lesions show central necrosis with scab formation and peripheral edema.",
			SkinChanges:              []string{"raised circumscribed nodules", "indurated plaques", "crusted sloughing centers"},
			Wounds:                   []string{"ulcerated necrotic lesions"},
			Swelling:                 []string{"enlarged superficial lymph nodes", "dependent limb edema"},
			Discharge:                []string{"serosanguinous exudate from ruptured nodules"},
			BehavioralObservations:   []string{"reduced grazing", "stiff reluctant gait", "feverish posture"},
			SeverityVisibleSymptoms:  "high",
			ImageQuality:             "Excellent resolution of cutaneous nodule morphology",
			NonDiagnosticObservation: "Classic visual pathognomonic presentation for poxviral cutaneous eruption such as Lumpy Skin Disease (LSD) or severe Bovine Papular Stomatitis.",
		}, nil

	case "feline_ringworm":
		return models.VisualAnalysis{
			Animal:                   "Feline (Cat)",
			VisibleAbnormalities:     []string{"circular patches of alopecia", "fine cigarette-ash scaling and peripheral crusting", "broken stubbled hairs (trichorrhexis)", "mild erythema at active margins"},
			AffectedBodyParts:        []string{"ears (pinnae)", "face/muzzle", "forepaws"},
			LesionDescription:        "Characteristic expanding circular alopecic lesions with fine silvery scaling and localized follicular plugging on the facial margins and pinnae.",
			SkinChanges:              []string{"focal circular alopecia", "epidermal collarettes", "desquamation"},
			Wounds:                   []string{},
			Swelling:                 []string{"mild focal follicular papules"},
			Discharge:                []string{},
			BehavioralObservations:   []string{"mild pruritus", "frequent localized grooming"},
			SeverityVisibleSymptoms:  "moderate",
			ImageQuality:             "High resolution macro view of follicular hair loss and scaling",
			NonDiagnosticObservation: "Dermatophytosis (Microsporum canis) suspected with potential zoonotic transmission to human handlers.",
		}, nil

	case "equine_wound_colic":
		return models.VisualAnalysis{
			Animal:                   "Equine (Horse)",
			VisibleAbnormalities:     []string{"flank watching and kicking at abdomen", "sweating and pawing at ground", "distended abdominal contour", "frequent recumbency and rolling signs"},
			AffectedBodyParts:        []string{"abdomen", "gastrointestinal tract", "musculoskeletal"},
			LesionDescription:        "Equine demonstrates active visceral abdominal pain posture with patch sweating, flared nostrils, and elevated respiratory effort.",
			SkinChanges:              []string{"patchy flank diaphoresis (sweating)"},
			Wounds:                   []string{},
			Swelling:                 []string{"mild right paralumbar distension"},
			Discharge:                []string{},
			BehavioralObservations:   []string{"restlessness", "ground pawing", "frequent looking at flank"},
			SeverityVisibleSymptoms:  "emergency",
			ImageQuality:             "Diagnostic quality posture and behavioral assessment",
			NonDiagnosticObservation: "Clinical presentation of acute equine colic requiring urgent veterinary evaluation to rule out impaction, displacement, or strangulating volvulus.",
		}, nil

	default:
		return models.VisualAnalysis{
			Animal:                   species,
			VisibleAbnormalities:     []string{"multifocal erythematous macules and papules", "epidermal collarettes and crusting", "localized pruritic excoriations", "patchy hair thinning"},
			AffectedBodyParts:        []string{"ventral abdomen", "axillae", "inguinal skin"},
			LesionDescription:        "Erythematous cutaneous inflammatory pattern with follicular papules, mild crusting, and secondary excoriations consistent with infectious pyoderma or atopic hypersensitivity.",
			SkinChanges:              []string{"erythema", "folliculitis", "crusts", "secondary excoriation"},
			Wounds:                   []string{},
			Swelling:                 []string{"mild superficial skin thickening"},
			Discharge:                []string{"scant serous exudate"},
			BehavioralObservations:   []string{"frequent licking and scratching observed"},
			SeverityVisibleSymptoms:  "moderate",
			ImageQuality:             "Clear visual resolution for dermatological evaluation",
			NonDiagnosticObservation: "Cutaneous presentation suggests superficial bacterial pyoderma, allergic dermatitis, or parasitic infestation requiring skin scraping/cytology.",
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

	species, scenario := classifyScenarioAndSpecies(input.Animal, input.Symptoms, input.Media)
	disclaimer := "This AI assessment provides clinical decision support and does not replace a physical examination and diagnostic workup by a licensed veterinarian."

	switch scenario {
	case "parvo_gastro":
		return models.ClinicalAssessment{
			Summary: fmt.Sprintf("CRITICAL EMERGENCY: The presentation in this %s is strongly indicative of acute, life-threatening viral enteritis (such as Canine Parvovirus CPV-2). Immediate in-patient hospitalization with IV fluid therapy, antiemetics, and antimicrobial sepsis prophylaxis is mandatory.", species),
			PossibleConditions: []models.PossibleCondition{
				{
					Name:       "Canine Parvovirus (CPV-2) / Feline Panleukopenia (FPV)",
					Likelihood: "high",
					Reason:     "The combination of severe prostration, rapid onset dehydration, profuse hemorrhagic diarrhea, and vomiting in a vulnerable patient is the hallmark of parvoviral villous atrophy and crypt cell destruction.",
				},
				{
					Name:       "Acute Hemorrhagic Gastroenteritis (HGE / AHDS)",
					Likelihood: "moderate",
					Reason:     "Marked hemoconcentration and rapid mucosal sloughing can trigger sudden bloody diarrhea and hypovolemic shock in dogs.",
				},
				{
					Name:       "Severe Intestinal Intussusception / Foreign Body Obstruction",
					Likelihood: "possible",
					Reason:     "Intestinal telescoping or linear foreign body can produce intractable vomiting, bloody mucus, and acute abdominal pain.",
				},
				{
					Name:       "Salmonellosis / Clostridial Enterotoxicosis",
					Likelihood: "possible",
					Reason:     "Bacterial cytotoxins cause mucosal ulceration and systemic septicemia.",
				},
			},
			Urgency: "emergency",
			RecommendedNextSteps: []string{
				"TRANSPORT IMMEDIATELY to the nearest 24/7 Emergency Veterinary Hospital.",
				"Perform immediate in-clinic CPV Antigen Fecal ELISA / PCR Rapid Test.",
				"Run Stat Packed Cell Volume (PCV), Total Solids (TS), Blood Glucose, and Blood Gas Electrolytes.",
				"Place peripheral IV catheter and initiate balanced crystalloid resuscitation (e.g. Normosol-R / Plasmalyte).",
				"Administer parenteral broad-spectrum antimicrobials (Ampicillin/Sulbactam + Enrofloxacin or Metronidazole) to prevent gram-negative translocation sepsis.",
				"Provide Maropitant (Cerenia) or Ondansetron for antiemetic control and buprenorphine for visceral analgesia.",
			},
			SupportiveCare: []string{
				"Strict isolation barrier nursing to prevent environmental parvoviral contamination (bleach 1:30 dilution).",
				"Keep patient warm with safe forced-air warming blanket; monitor for hypothermia.",
				"Zero oral food/water until vomiting is controlled; early enteral micro-nutrition once stabilized.",
			},
			Avoid: []string{
				"DO NOT administer oral medications or forced fluids while patient is vomiting (severe aspiration risk).",
				"DO NOT administer human NSAIDs (Ibuprofen, Paracetamol, Aspirin) which cause lethal organ failure.",
				"DO NOT delay emergency hospitalization; parvoviral mortality exceeds 90% without intensive fluid therapy.",
			},
			VeterinaryAttention: "CRITICAL: Immediate 24/7 emergency hospital transport required within 1-2 hours.",
			Disclaimer:          disclaimer,
		}, nil

	case "distemper_systemic":
		return models.ClinicalAssessment{
			Summary: fmt.Sprintf("HIGH URGENCY: The multisystemic clinical presentation in this %s (mucopurulent oculonasal discharge, digital hyperkeratosis, and myoclonus) strongly suggests Canine Distemper Virus (CDV) infection with central nervous system involvement.", species),
			PossibleConditions: []models.PossibleCondition{
				{
					Name:       "Canine Distemper Virus (CDV) Systemic Encephalomyelitis",
					Likelihood: "high",
					Reason:     "The triad of respiratory discharge, 'hard pad' footpad hyperkeratosis, and involuntary muscle myoclonus is classic for paramyxoviral distemper pathogenesis.",
				},
				{
					Name:       "Infectious Tracheobronchitis / Secondary Bacterial Bronchopneumonia",
					Likelihood: "moderate",
					Reason:     "Bordetella bronchiseptica or Mycoplasma can cause severe purulent oculonasal discharge and productive coughing.",
				},
				{
					Name:       "Canine Infectious Hepatitis (Adenovirus CAV-1)",
					Likelihood: "possible",
					Reason:     "Produces severe conjunctivitis, corneal edema ('blue eye'), fever, and systemic signs.",
				},
				{
					Name:       "Rabies Virus / Viral Encephalitis",
					Likelihood: "possible",
					Reason:     "Must be considered in non-vaccinated animals exhibiting altered mentation, muscle tremors, or cranial nerve deficits.",
				},
			},
			Urgency: "emergency",
			RecommendedNextSteps: []string{
				"Perform Canine Distemper Virus RT-PCR (conjunctival/nasal swab and whole blood).",
				"Thoracic 3-view radiographs to assess for secondary interstitial or alveolar bronchopneumonia.",
				"Complete Blood Count (CBC) with differential to detect severe lymphopenia or toxic neutrophils.",
				"Prescribe broad-spectrum antibiotic coverage (e.g. Doxycycline, Amoxicillin-Clavulanate) for secondary pneumonia.",
				"Administer anticonvulsant / neuroprotective therapy (Levetiracetam / Phenobarbital) if myoclonus progresses to generalized seizures.",
			},
			SupportiveCare: []string{
				"Nebulization with sterile saline 3-4 times daily and gentle coupage to mobilize respiratory secretions.",
				"Clean eyes and nares with sterile warm ophthalmic wash; apply lubricating ocular gel.",
				"Maintain in a quiet, padded, darkened environment to reduce seizure triggers.",
			},
			Avoid: []string{
				"DO NOT expose patient to other dogs; CDV is highly contagious via aerosol and bodily fluids.",
				"DO NOT use human decongestants (Pseudoephedrine is highly toxic to canines).",
			},
			VeterinaryAttention: "Emergency veterinary examination required within 2 to 4 hours.",
			Disclaimer:          disclaimer,
		}, nil

	case "cattle_lumpy_skin":
		return models.ClinicalAssessment{
			Summary: "NOTIFIABLE DISEASE ALERT: Multiple circumscribed cutaneous nodules with central necrosis in cattle are strongly indicative of Lumpy Skin Disease (Capripoxvirus). Immediate quarantine and veterinary reporting are required.",
			PossibleConditions: []models.PossibleCondition{
				{
					Name:       "Lumpy Skin Disease (LSDV - Capripoxvirus)",
					Likelihood: "high",
					Reason:     "Multiple firm, circumscribed dermal nodules (2-5cm) throughout the body with lymphadenopathy and central 'sit-fast' necrosis are the hallmark of LSD.",
				},
				{
					Name:       "Pseudo-Lumpy Skin Disease (Bovine Herpesvirus 2 / Mammillitis)",
					Likelihood: "moderate",
					Reason:     "BHV-2 produces superficial cutaneous lesions and teat necrosis, typically milder than true LSD.",
				},
				{
					Name:       "Bovine Papular Stomatitis / Pseudocowpox",
					Likelihood: "possible",
					Reason:     "Parapoxviruses cause localized papular and ring-like lesions on muzzle and skin.",
				},
				{
					Name:       "Cutaneous Streptothricosis (Dermatophilus congolensis)",
					Likelihood: "possible",
					Reason:     "Paintbrush crusts and exudative dermatitis in humid conditions can resemble nodular skin disease.",
				},
			},
			Urgency: "high",
			RecommendedNextSteps: []string{
				"Immediately isolate affected animals and notify local veterinary authorities (Reportable/Notifiable epizootic disease).",
				"Collect skin lesion biopsy / nodular fluid for Capripoxvirus Real-Time PCR confirmation.",
				"Implement aggressive vector control (fly, mosquito, and tick repellents/pour-on insecticides).",
				"Administer NSAIDs (Flunixin Meglumine or Meloxicam) for fever, inflammation, and pain.",
				"Administer systemic antibiotics (Long-acting Oxytetracycline) to prevent secondary bacterial abscessation.",
			},
			SupportiveCare: []string{
				"Provide soft, palatable feed, abundant clean water, and shaded, well-ventilated housing.",
				"Disinfect premises with approved virucidal agents (2% sodium hydroxide or Virkon S).",
			},
			Avoid: []string{
				"DO NOT move animals off the property or sell milk/meat until cleared by animal health authorities.",
				"DO NOT lance or crush skin nodules (prevents environmental viral contamination).",
			},
			VeterinaryAttention: "Urgent veterinary inspection and official reporting required within 24 hours.",
			Disclaimer:          disclaimer,
		}, nil

	case "feline_ringworm":
		return models.ClinicalAssessment{
			Summary: "CONTAGIOUS ZOONOSIS: The well-demarcated circular alopecic scaling lesions in this feline are classic for Dermatophytosis (Ringworm). Treatment and strict environmental hygiene are required to prevent spread to humans and other pets.",
			PossibleConditions: []models.PossibleCondition{
				{
					Name:       "Dermatophytosis (Microsporum canis / Trichophyton)",
					Likelihood: "high",
					Reason:     "Expanding circular focal alopecia with cigarette-ash scaling, broken hair shafts, and localized follicular plugging is the classic presentation of feline ringworm.",
				},
				{
					Name:       "Notoedric Mange (Feline Scabies / Notoedres cati)",
					Likelihood: "moderate",
					Reason:     "Produces severe pruritic crusted lesions primarily on ear pinnae, face, and neck.",
				},
				{
					Name:       "Feline Eosinophilic Granuloma Complex / Flea Allergy Dermatitis",
					Likelihood: "possible",
					Reason:     "Hypersensitivity reactions can create localized alopecic erythematous plaques.",
				},
				{
					Name:       "Demodex cati / Demodex gatoi Folliculitis",
					Likelihood: "possible",
					Reason:     "Follicular mite overgrowth causing focal alopecia and scaling.",
				},
			},
			Urgency: "moderate",
			RecommendedNextSteps: []string{
				"Perform Wood's lamp examination (apple-green fluorescence seen in ~50% of M. canis strains).",
				"Conduct direct microscopic trichogram and fungal culture (DTM - Dermatophyte Test Medium) or PCR.",
				"Initiate systemic antifungal therapy (Itraconazole 5 mg/kg pulse therapy) under veterinary prescription.",
				"Apply topical antifungal therapy (Miconazole-Chlorhexidine shampoo or lime sulfur dips 1-2x weekly).",
			},
			SupportiveCare: []string{
				"Isolate the cat in an easily cleanable room without carpet.",
				"Vacuum daily and wash all bedding with hot water and bleach.",
				"Wear gloves when handling affected areas to prevent zoonotic human ringworm transmission.",
			},
			Avoid: []string{
				"DO NOT use human topical corticosteroids (Hydrocortisone/Betamethasone) which worsen fungal proliferation.",
				"DO NOT use tea tree oil or essential oils (lethally toxic to felines).",
			},
			VeterinaryAttention: "Schedule a veterinary consultation within 24 to 48 hours for confirmatory DTM culture.",
			Disclaimer:          disclaimer,
		}, nil

	case "equine_wound_colic":
		return models.ClinicalAssessment{
			Summary: "ACUTE EQUINE EMERGENCY: Clinical signs of active abdominal pain (flank watching, pawing, sweating, abnormal posturing) indicate Equine Colic. Immediate veterinary evaluation is required to evaluate gastrointestinal motility, peritoneal fluid, and potential surgical lesions.",
			PossibleConditions: []models.PossibleCondition{
				{
					Name:       "Equine Spasmodic / Gas / Impaction Colic",
					Likelihood: "high",
					Reason:     "Hyperperistalsis or large colon pelvic flexure impaction causing severe visceral pain and restlessness.",
				},
				{
					Name:       "Strangulating Intestinal Obstruction / Volvulus / Lipoma",
					Likelihood: "moderate",
					Reason:     "Surgical emergency where compromised vascular supply produces severe, unremitting abdominal pain and toxic mucous membranes.",
				},
				{
					Name:       "Right Dorsal Colitis / Equine Gastric Ulcer Syndrome (EGUS)",
					Likelihood: "possible",
					Reason:     "Chronic low-grade or recurrent post-prandial colic episodes with variable appetite.",
				},
			},
			Urgency: "emergency",
			RecommendedNextSteps: []string{
				"Call emergency equine veterinarian immediately for on-farm nasogastric intubation and rectal palpation.",
				"Perform transabdominal ultrasonography and abdominocentesis if indicated.",
				"Administer intravenous Flunixin Meglumine (Banamine) only under veterinary direction.",
				"Withhold all grain and hay until veterinary assessment is completed.",
			},
			SupportiveCare: []string{
				"Hand-walk the horse slowly if safe to prevent violent rolling and self-trauma.",
				"Do not exhaust the horse with continuous vigorous trotting or running.",
				"Monitor rectal temperature, heart rate, and capillary refill time every 30 minutes.",
			},
			Avoid: []string{
				"DO NOT force feed or administer oral mineral oil without a nasogastric tube (aspiration risk).",
				"DO NOT administer multiple repeated doses of analgesics without veterinary guidance (can mask surgical deterioration).",
			},
			VeterinaryAttention: "CRITICAL: Immediate on-site emergency veterinary visit required.",
			Disclaimer:          disclaimer,
		}, nil

	default:
		return models.ClinicalAssessment{
			Summary: fmt.Sprintf("VETERINARY ASSESSMENT: Clinical signs in this %s reveal localized cutaneous inflammation, papular lesions, and pruritus. A structured diagnostic workup including skin scraping, cytology, and parasite screening is recommended.", species),
			PossibleConditions: []models.PossibleCondition{
				{
					Name:       "Superficial Bacterial Pyoderma / Staphylococcal Folliculitis",
					Likelihood: "high",
					Reason:     "Erythematous papules, pustules, and epidermal collarettes resulting from secondary Staphylococcus pseudintermedius overgrowth.",
				},
				{
					Name:       "Canine/Feline Atopic Dermatitis & Environmental Hypersensitivity",
					Likelihood: "moderate",
					Reason:     "Immunoglobulin E-mediated allergic reaction to environmental allergens causing ventral and pedal pruritus.",
				},
				{
					Name:       "Sarcoptic Mange (Scabies - Sarcoptes scabiei) / Demodicosis",
					Likelihood: "possible",
					Reason:     "Intensely pruritic ectoparasitic mite infestation with crusting and excoriations.",
				},
				{
					Name:       "Malassezia Pachydermatis Yeast Dermatitis",
					Likelihood: "possible",
					Reason:     "Secondary fungal yeast proliferation in warm, moist cutaneous folds.",
				},
			},
			Urgency: "moderate",
			RecommendedNextSteps: []string{
				"Schedule a physical veterinary clinical examination.",
				"Perform direct skin tape impression cytology and deep/superficial skin scraping.",
				"Apply an Elizabethan collar (e-collar) to halt self-mutilation and licking.",
				"Evaluate flea/tick preventative compliance and update isoxazoline ectoparasite prevention.",
			},
			SupportiveCare: []string{
				"Cleanse affected skin with antiseptic 2-4% Chlorhexidine shampoo or wipes.",
				"Keep the environment clean, dry, and cool.",
			},
			Avoid: []string{
				"DO NOT apply human corticosteroid ointments, alcohol, or harsh hydrogen peroxide.",
				"DO NOT administer human pain relievers or antibiotics without a prescription.",
			},
			VeterinaryAttention: "Consult a qualified veterinarian within 24 to 48 hours for cytology and targeted therapy.",
			Disclaimer:          disclaimer,
		}, nil
	}
}

type HuggingFaceProvider struct {
	Token                 string
	VisionModel           string
	VeterinaryModel       string
	VeterinaryEndpointURL string
	Client                *http.Client
}

func (p HuggingFaceProvider) AnalyzeMedia(ctx context.Context, media models.Media, animal models.Animal, symptoms models.SymptomInput) (models.VisualAnalysis, error) {
	visionPrompt := `You are an expert veterinary diagnostic computer vision AI.
Analyze the provided visual imagery objectively and thoroughly across all animal species and anatomical systems.

OBJECTIVE VISUAL INSPECTION INSTRUCTIONS:
1. SPECIES & TRAITS: Identify the exact animal species (e.g. Canine, Feline, Bovine, Equine, Caprine, Ovine, Porcine, Avian, etc.) and any visible breed/physical characteristics.
2. POSTURE, GAIT & MOBILITY: Objectively describe the animal's physical posture, body condition, activity state, gait, voluntary/involuntary movements, or recumbency.
3. ANATOMICAL REGIONS & LESIONS: Inspect all visible areas (eyes, nose, mouth, ears, skin, coat, limbs, footpads, abdomen, perineum) for any abnormal findings, lesions, scaling, crusting, nodules, erythema, swelling, lacerations, or discharges.
4. BEHAVIOR & MENTATION: Note visible demeanor, responsiveness, distress, or normal calm/playful behavior.

Return ONLY valid JSON matching this exact structure:
{
  "animal": "Exact identified species (e.g. Canine (Dog), Feline (Cat), Bovine (Cattle), Equine (Horse), etc.)",
  "visible_abnormalities": ["observed physical abnormality 1", "observed physical abnormality 2"],
  "affected_body_parts": ["affected anatomical locations"],
  "lesion_description": "Objective, detailed description of what is physically visible in the imagery, including posture, movement, skin/coat, and anatomical state",
  "skin_changes": ["observed skin/coat changes or empty"],
  "wounds": ["observed wounds or empty"],
  "swelling": ["observed swelling or empty"],
  "discharge": ["observed discharges or empty"],
  "behavioral_observations": ["observed demeanor/behavioral actions"],
  "severity_of_visible_symptoms": "low|mild|moderate|high|emergency",
  "image_quality": "High resolution anatomical view",
  "non_diagnostic_observation": "Objective summary of physical findings"
}`

	var userContent []map[string]any

	mediaURLs, _ := extractMediaDataURLs(ctx, media)
	isVideo := media.Type == "video" || strings.HasPrefix(media.MIMEType, "video/") || len(mediaURLs) > 1

	promptSuffix := ""
	if isVideo {
		promptSuffix = "\n\nTEMPORAL VIDEO FRAMES: The attached images represent temporal frames sampled across the video timeline. Observe movements, gait, respiratory dynamics, posture changes, and behavioral interactions across the frames."
	}

	userContent = append(userContent, map[string]any{
		"type": "text",
		"text": visionPrompt + promptSuffix + "\n\nPATIENT INFORMATION & CLINICAL NOTES:\n" +
			"- Species context: " + animal.Species + " " + animal.Breed + "\n" +
			"- Reported Symptoms: " + strings.Join(symptoms.Symptoms, ", ") + "\n" +
			"- Clinical Notes: " + symptoms.Other + "\n",
	})

	for _, frameURL := range mediaURLs {
		if frameURL != "" {
			userContent = append(userContent, map[string]any{
				"type": "image_url",
				"image_url": map[string]string{
					"url": frameURL,
				},
			})
		}
	}

	text, err := p.chat(ctx, p.VisionModel, []map[string]any{{
		"role":    "user",
		"content": userContent,
	}})
	if err != nil {
		return models.VisualAnalysis{}, err
	}
	var out models.VisualAnalysis
	if err := decodeJSONText(text, &out); err != nil {
		return models.VisualAnalysis{}, fmt.Errorf("failed to parse vision AI output: %w", err)
	}
	if out.Animal == "" {
		out.Animal = "Canine (Dog)"
	}
	return out, nil
}

func (p HuggingFaceProvider) Assess(ctx context.Context, input models.ClinicalInput) (models.ClinicalAssessment, error) {
	vetPrompt := `You are a board-certified veterinary internal medicine and diagnostic specialist.
Analyze the patient data, reported clinical complaints, and objective visual/motion findings across the broad spectrum of veterinary medicine to formulate an unbiased, evidence-based clinical differential diagnosis and triage assessment.

DIAGNOSTIC GUIDELINES:
1. UNBIASED EVALUATION: Formulate differentials based purely on the patient's species, reported clinical complaints, and visual/motion findings. Do not bias toward or assume any predetermined condition.
2. COMPREHENSIVE ETIOLOGICAL SPECTRUM: Systematically consider all relevant etiologies across infectious diseases (viral, bacterial, fungal, parasitic), mechanical/surgical conditions (obstructions, trauma), toxicological, inflammatory, and metabolic disorders that correspond to the clinical presentation.
3. EVIDENCE-BASED REASONING: Provide 4-5 specific differential diagnoses ranked strictly by true clinical likelihood, explaining the pathophysiological mechanisms linking the presenting signs to each condition.
4. DIAGNOSTIC WORKUP & TRIAGE: Recommend specific confirmatory laboratory tests, imaging modalities, and immediate clinical management.

Return ONLY valid JSON matching this exact structure:
{
  "summary": "Thorough, objective clinical explanation of presenting signs, suspected pathophysiological mechanisms, and key clinical risks.",
  "possible_conditions": [
    {
      "name": "Veterinary Disease / Condition Name",
      "likelihood": "high|moderate|possible|low",
      "reason": "Detailed clinical reasoning linking observed signs, species susceptibility, and disease pathogenesis."
    }
  ],
  "urgency": "low|mild|moderate|high|emergency",
  "recommended_next_steps": [
    "Specific diagnostic tests and investigations",
    "Immediate clinical management steps"
  ],
  "supportive_care": ["Specific evidence-based supportive care guidelines"],
  "avoid": ["Specific contraindications and potentially harmful actions/medications"],
  "veterinary_attention": "Appropriate clinical timeframe for veterinary examination",
  "disclaimer": "This AI assessment provides clinical decision support and does not replace a physical examination by a licensed veterinarian."
}`

	patientInfo := fmt.Sprintf(
		"PATIENT & CLINICAL DATA FOR EVALUATION:\n- Species: %s %s\n- Owner Notes / Presenting Symptoms: %s | %s\n- Visual Analysis Findings: %s\n- Observed Abnormalities: %s\n- Affected Anatomical Regions: %s\n- Visual Severity: %s",
		input.Animal.Species,
		input.Animal.Breed,
		strings.Join(input.Symptoms.Symptoms, ", "),
		input.Symptoms.Other,
		input.VisualAnalysis.LesionDescription,
		strings.Join(input.VisualAnalysis.VisibleAbnormalities, ", "),
		strings.Join(input.VisualAnalysis.AffectedBodyParts, ", "),
		input.VisualAnalysis.SeverityVisibleSymptoms,
	)

	text, err := p.chat(ctx, p.VeterinaryModel, []map[string]any{
		{
			"role":    "system",
			"content": "You are a senior veterinary diagnostic specialist. Always return strict valid JSON matching the requested schema.",
		},
		{
			"role":    "user",
			"content": vetPrompt + "\n\n" + patientInfo,
		},
	})
	if err != nil {
		return models.ClinicalAssessment{}, err
	}
	var out models.ClinicalAssessment
	if err := decodeJSONText(text, &out); err != nil {
		return models.ClinicalAssessment{}, fmt.Errorf("failed to parse veterinary AI output: %w", err)
	}
	if out.Disclaimer == "" {
		out.Disclaimer = "This AI assessment provides clinical decision support and does not replace examination by a qualified veterinarian."
	}
	return out, nil
}

func (p HuggingFaceProvider) chat(ctx context.Context, model string, messages []map[string]any) (string, error) {
	token := p.token(ctx)
	if token == "" {
		return "", errors.New("huggingface API key is required in backend/.env")
	}
	if model == "" {
		return "", errors.New("inference model is not configured")
	}
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 90 * time.Second}
	}

	endpoint := "https://router.huggingface.co/v1/chat/completions"
	if p.VeterinaryEndpointURL != "" && model == p.VeterinaryModel {
		endpoint = p.VeterinaryEndpointURL
	}

	body, err := json.Marshal(map[string]any{
		"model":           model,
		"messages":        messages,
		"temperature":     0.2,
		"max_tokens":      1500,
		"response_format": map[string]string{"type": "json_object"},
		"stream":          false,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI inference network error: %w", err)
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
		return "", fmt.Errorf("failed to decode AI response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errMsg := fmt.Sprintf("%v", decoded.Error)
		// If custom/gated model is not hosted on HF serverless shared router, fallback to general reasoning model
		if strings.Contains(errMsg, "model_not_supported") && model != "Qwen/Qwen2.5-72B-Instruct" {
			log.Printf("[AI Notice] Model %s is not enabled on serverless shared router. Falling back to Qwen/Qwen2.5-72B-Instruct for clinical reasoning.", model)
			return p.chat(ctx, "Qwen/Qwen2.5-72B-Instruct", messages)
		}
		return "", fmt.Errorf("AI inference request failed (HTTP %d): %v", resp.StatusCode, decoded.Error)
	}
	if len(decoded.Choices) == 0 {
		return "", errors.New("AI inference response did not include content")
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
		return "", errors.New("AI inference response content was not valid text")
	}
}

func (p HuggingFaceProvider) token(ctx context.Context) string {
	if strings.TrimSpace(p.Token) != "" {
		return strings.TrimSpace(p.Token)
	}
	if token, ok := ctx.Value(huggingFaceTokenKey).(string); ok {
		trimmed := strings.TrimSpace(token)
		if strings.HasPrefix(trimmed, "hf_") {
			return trimmed
		}
	}
	return ""
}

func mediaDataURL(media models.Media) (string, error) {
	if media.Path != "" {
		data, err := os.ReadFile(filepath.Clean(media.Path))
		if err == nil {
			mime := media.MIMEType
			if mime == "" {
				mime = "image/jpeg"
			}
			return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
		}
	}
	if strings.HasPrefix(media.URL, "data:image/") || strings.HasPrefix(media.URL, "http://") || strings.HasPrefix(media.URL, "https://") {
		return media.URL, nil
	}
	return "", nil
}

func extractMediaDataURLs(ctx context.Context, media models.Media) ([]string, error) {
	cleanPath := filepath.Clean(media.Path)
	lowerPath := strings.ToLower(cleanPath)
	isVideo := media.Type == "video" ||
		strings.HasPrefix(media.MIMEType, "video/") ||
		strings.HasSuffix(lowerPath, ".mp4") ||
		strings.HasSuffix(lowerPath, ".webm") ||
		strings.HasSuffix(lowerPath, ".mov") ||
		strings.HasSuffix(lowerPath, ".mkv")

	if isVideo && media.Path != "" {
		tmpDir, err := os.MkdirTemp("", "vet_vid_frames_*")
		if err == nil {
			defer os.RemoveAll(tmpDir)
			framePattern := filepath.Join(tmpDir, "frame_%03d.jpg")
			// Extract 4 representative temporal keyframes across the video using ffmpeg
			// (Hugging Face router enforces max 5 images per request)
			cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-i", cleanPath, "-vf", "fps=1/2,scale=512:-1", "-vframes", "4", framePattern)
			if err := cmd.Run(); err == nil {
				files, _ := filepath.Glob(filepath.Join(tmpDir, "frame_*.jpg"))
				sort.Strings(files)
				var frames []string
				for _, f := range files {
					data, readErr := os.ReadFile(f)
					if readErr == nil && len(data) > 0 {
						frames = append(frames, "data:image/jpeg;base64,"+base64.StdEncoding.EncodeToString(data))
					}
					if len(frames) >= 4 {
						break
					}
				}
				if len(frames) > 0 {
					return frames, nil
				}
			}
		}
	}

	single, err := mediaDataURL(media)
	if err != nil || single == "" {
		return nil, err
	}
	return []string{single}, nil
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
	case "low", "mild", "moderate", "high", "emergency":
		return nil
	default:
		return errors.New("invalid AI urgency")
	}
}

func classifyScenarioAndSpecies(animal models.Animal, symptoms models.SymptomInput, media models.Media) (string, string) {
	text := strings.ToLower(animal.Species + " " + animal.Breed + " " + strings.Join(symptoms.Symptoms, " ") + " " + symptoms.Other + " " + media.Path + " " + media.URL)

	species := "Canine (Dog)"
	if strings.Contains(text, "cat") || strings.Contains(text, "feline") || strings.Contains(text, "kitten") {
		species = "Feline (Cat)"
	} else if strings.Contains(text, "cattle") || strings.Contains(text, "bovine") || strings.Contains(text, "cow") || strings.Contains(text, "calf") || strings.Contains(text, "bull") {
		species = "Bovine (Cattle)"
	} else if strings.Contains(text, "horse") || strings.Contains(text, "equine") || strings.Contains(text, "mare") || strings.Contains(text, "stallion") || strings.Contains(text, "foal") {
		species = "Equine (Horse)"
	} else if strings.Contains(text, "sheep") || strings.Contains(text, "goat") || strings.Contains(text, "caprine") || strings.Contains(text, "ovine") {
		species = "Caprine / Ovine (Goat/Sheep)"
	} else if strings.Contains(text, "bird") || strings.Contains(text, "avian") || strings.Contains(text, "poultry") || strings.Contains(text, "chicken") {
		species = "Avian (Bird / Poultry)"
	} else if strings.Contains(text, "rabbit") || strings.Contains(text, "lagomorph") {
		species = "Lagomorph (Rabbit)"
	} else if animal.Species != "" && animal.Species != "Animal" && animal.Species != "animal" {
		species = animal.Species
	}

	if strings.Contains(text, "distemper") || strings.Contains(text, "myoclonus") || strings.Contains(text, "twitch") || strings.Contains(text, "hard pad") || strings.Contains(text, "hyperkeratosis") || strings.Contains(text, "chorea") || strings.Contains(text, "spasm") || strings.Contains(text, "seizure") || strings.Contains(text, "ataxia") || (strings.Contains(text, "nasal discharge") && (strings.Contains(text, "cough") || strings.Contains(text, "eye"))) {
		return species, "distemper_systemic"
	}
	if strings.Contains(text, "parvo") || strings.Contains(text, "bloody") || strings.Contains(text, "vomit") || strings.Contains(text, "diarrhea") || strings.Contains(text, "dehydrat") || strings.Contains(text, "gastro") || (strings.Contains(text, "letharg") && strings.Contains(text, "stool")) {
		return species, "parvo_gastro"
	}
	if strings.Contains(text, "lumpy") || strings.Contains(text, "nodule") && (strings.Contains(text, "cow") || strings.Contains(text, "cattle") || strings.Contains(text, "bovine")) {
		return "Bovine (Cattle)", "cattle_lumpy_skin"
	}
	if strings.Contains(text, "ringworm") || strings.Contains(text, "circular") && strings.Contains(text, "alopecia") || strings.Contains(text, "dermatophyt") {
		if strings.Contains(text, "cat") || strings.Contains(text, "feline") {
			return "Feline (Cat)", "feline_ringworm"
		}
		return species, "feline_ringworm"
	}
	if strings.Contains(text, "colic") || strings.Contains(text, "flank") && (strings.Contains(text, "horse") || strings.Contains(text, "equine")) {
		return "Equine (Horse)", "equine_wound_colic"
	}

	return species, "general_dermatology"
}
