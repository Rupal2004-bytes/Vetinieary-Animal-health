# 🐾 PashuRakshak (पशुरक्षक)
### Unified Animal Health, Digital Health Passports & Outbreak Surveillance Grid

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat&logo=react)](https://react.dev)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_v3-003B57?style=flat&logo=sqlite)](https://sqlite.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🏛️ 1. Problem Statement

### **Maharashtra State Innovation Society (MSIS) & Government of Maharashtra**
* **Problem Statement ID:** `PS 26128`
* **Title:** *Efficient systems for early detection, prevention, and management of livestock diseases and animal health issues.*

### **Context & Core Challenges:**
Livestock owners, dairy farmers, field veterinarians, para-veterinary workers, NGOs, and government animal husbandry departments face severe fragmentation in animal healthcare delivery:
1. **Late Symptom Detection & Distant Labs:** Rural farmers discover disease symptoms late; diagnostic labs and polyclinics are often far away, delaying critical medical intervention.
2. **Fragmented & Incomplete Records:** Vaccination calendars and lifelong treatment histories are scattered across paper registers or lost between farm transitions.
3. **Siloed Stakeholders:** Information from farms, dispensaries, testing laboratories, vaccination campaigns, and state monitoring programs remains disconnected.
4. **Epidemic Escalation & Livelihood Loss:** Delays in containing infectious outbreaks (e.g., Foot-and-Mouth Disease, Lumpy Skin Disease, PPR) lead to high livestock mortality, plummeting milk yields, farmer debt, and severe zoonotic transmission risks.

---

## 💡 2. Our Solution: PashuRakshak (पशुरक्षक)

**PashuRakshak** is a unified, real-time epidemiological grid that connects livestock farmers, companion pet owners, licensed veterinarians, NGOs, and government animal husbandry departments into a collaborative biosecurity defense network.

```mermaid
flowchart TD
    subgraph STAKEHOLDERS["👥 Connected Stakeholders"]
        A["🚜 Farmers & Herdsmen<br/>• Video/Photo Screening<br/>• Pashu Aadhaar Passport<br/>• Recovery Reporting"]
        B["🩺 Licensed Veterinarians<br/>• Case Review Queue<br/>• ℞ E-Prescriptions<br/>• Aadhaar Search (12-Digit)<br/>• Verified Lab Results Hub"]
        C["📦 Dispensaries & NGOs<br/>• Vaccine & Serum Stock<br/>• Creator-Scoped Inventory<br/>• Automated Low-Stock Alerts"]
        D["🏛️ Govt Animal Husbandry<br/>• District Outbreak Radar<br/>• State Circulars & Quarantine<br/>• Containment Clearance"]
    end

    A <-->|REST API & Secure Sessions| CORE["🐾 PashuRakshak Unified Grid"]
    B <-->|REST API & Secure Sessions| CORE
    C <-->|REST API & Secure Sessions| CORE
    D <-->|REST API & Secure Sessions| CORE
```

### 🌟 Key Capabilities

1. **Multimodal Clinical Screening & Rapid Triage:**
   * Farmers and pet owners upload photos or 10-second video clips (capturing gait anomalies, tremors, or lesions).
   * Generates instant clinical observations, differential possibilities, and emergency urgency levels (Critical, Urgent, Moderate, Routine).
2. **Digital Health Passports & 12-Digit Pashu Aadhaar Registry:**
   * Lifelong digital records indexed by the official **12-digit Pashu Aadhaar Ear Tag** (`tag_number`).
   * Longitudinal timeline linking verified veterinary laboratory assays, screening histories, and species vaccination calendars (FMD, LSD, PPR, Brucellosis, Rabies).
   * Searchable by licensed veterinarians across districts.
3. **Autonomous Outbreak Radar & Vet Consensus Engine:**
   * **Rule 1 (Vet Consensus):** When 3 or more (≥ 3) licensed doctors in a district confirm matching infectious symptoms, the system triggers an active outbreak cluster and broadcasts SOS alarms.
   * **Rule 2 (Farmer Reporting):** When 3 or more (≥ 3) local farms report identical symptoms, early-warning containment protocols activate.
   * **Dynamic Recovery & Clearance:** When farmers report herd recovery (`POST /api/outbreaks/report-recovery`), active affected counts decrement, and official veterinary clearance resolves alerts.
4. **Confidential Veterinary Lab Reporting:**
   * Attending veterinarians publish formal laboratory reports (Complete Blood Count, California Mastitis Test, PCR, Serum Neutralization) directly into the animal's Health Passport.
   * Scoped access: Private to the registered animal owner and attending doctors, with automated notification dispatch.
5. **District Supply & Vaccine Inventory Grid:**
   * Real-time monitoring of emergency ring vaccines, antibiotics, wound care, and PPE kits across dispensaries.
   * Strict creator-level data protection: Stock can only be edited or removed by the specific user/clinic that registered it.
6. **State Directives & Circular Command Center:**
   * Government authorities broadcast binding quarantine notices, 5 km ring vaccination orders, and livestock market restrictions directly to farmers in affected talukas.

---

## 🔄 3. Outbreak Early Warning & Dynamic Resolution Lifecycle

```mermaid
stateDiagram-v2
    [*] --> SymptomDetection : Farmer Uploads Scan / Vet Reviews Case
    SymptomDetection --> ClusterEvaluation : Realtime Syndromic Analysis

    state ClusterEvaluation {
        Rule1 : Vet Consensus >= 3 Doctors
        Rule2 : Farmer Cluster >= 3 Farms
    }

    ClusterEvaluation --> OutbreakActive : Threshold Met
    OutbreakActive --> OutbreakActive : Broadcast District Red SOS & Ring Vaccine Directives
    OutbreakActive --> DecrementCount : Farmers Submit Recovery (POST /api/outbreaks/report-recovery)
    DecrementCount --> OutbreakActive : Affected Count > 0
    DecrementCount --> OutbreakResolved : Affected Count = 0 OR Vet Issues Clearance Certificate (POST /api/outbreaks/resolve)
    OutbreakResolved --> [*] : SOS Cleared & All-Clear Notice Broadcast
```

---

## 🏗️ 4. System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph CLIENT["🌐 FRONTEND CLIENT (React 18 / Tailwind CSS / Vite)"]
        UI1["🚜 Farmers / Owners: Multimodal Screening & Health Passport"]
        UI2["🩺 Veterinarians: Decision Hub & Pashu Aadhaar Directory"]
        UI3["📦 NGOs / Dispensaries: Creator-Protected Vaccine Stock Grid"]
        UI4["🏛️ Public / Gov: Real-time Outbreak Radar & Advisories"]
    end

    CLIENT -->|REST API • JSON / Multipart • X-Auth-Token| SERVER

    subgraph SERVER["⚙️ GO HIGH-PERFORMANCE BACKEND (Go 1.22+ & CGO)"]
        AUTH["🔐 Authentication & Bcrypt Session Manager"]
        MEDIA["📁 FFmpeg 4-Frame Keyframe Extractor"]
        CONSENSUS["🚨 Outbreak Sensing & Vet Consensus Engine"]
        API["📡 HTTP Handler & Security Guard Router"]
    end

    SERVER --> DECISION_ENGINE
    subgraph DECISION_ENGINE["🧠 CLINICAL DECISION ENGINE"]
        VL["Qwen2.5-VL-72B (Visual Lesion Inspection)"]
        REASONING["viggoVet-Reasoning-20B (Differential Assessment)"]
    end

    SERVER --> DB_LAYER
    subgraph DB_LAYER["🗄️ TRIPLE SQLITE 3 STORAGE (Write-Ahead Logging / WAL Mode)"]
        DB1["user.db (v4)<br/>• Users & Roles<br/>• Bcrypt Auth<br/>• Clinic Hours & Duty Status"]
        DB2["animal_health.db (v5)<br/>• 12-Digit Pashu Aadhaar Registry<br/>• Health Passports<br/>• Confidential Lab Test Results<br/>• Screening History"]
        DB3["surveillance.db (v2)<br/>• Outbreak Clusters & SOS Alarms<br/>• Doctor Consultation Queue<br/>• Emergency Vaccine Inventories<br/>• Government Directives"]
    end
```

---

## ⚙️ 5. Prerequisites & Installation Requirements

Before building and running the project, ensure the following dependencies are installed on your machine:

### 1. **GCC Compiler & CGO (CRITICAL)**
> [!IMPORTANT]
> The SQLite database engine (`github.com/mattn/go-sqlite3`) is written in C and requires **CGO** enabled during compilation (`CGO_ENABLED=1`). You **must have a C compiler (`gcc`) installed**.

* **Ubuntu / Debian:**
  ```bash
  sudo apt update && sudo apt install -y build-essential gcc sqlite3 libsqlite3-dev ffmpeg
  ```
* **Fedora / RHEL:**
  ```bash
  sudo dnf groupinstall "Development Tools" && sudo dnf install gcc sqlite3-devel ffmpeg
  ```
* **macOS:**
  ```bash
  xcode-select --install
  brew install sqlite ffmpeg
  ```
* **Windows:**
  Install [MinGW-w64](https://www.mingw-w64.org/) (via MSYS2 or Chocolatey: `choco install mingw`) and ensure `gcc` is in your system `PATH`.

### 2. **Go Programming Language**
* Go version **1.22 or higher** is required.
* Verify: `go version`

### 3. **Node.js & npm**
* Node.js version **18.x or higher** and `npm` **9.x or higher**.
* Verify: `node -v` and `npm -v`

---

## 🚀 6. How to Run Locally

### Step 1: Clone the Repository
```bash
git clone https://github.com/arpangreat/Vetinieary-Animal-health.git
cd Vetinieary-Animal-health
```

---

### Step 2: Configure and Start the Go Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Download Go dependencies:
   ```bash
   go mod download
   ```

3. Ensure **CGO is enabled** and build the server binary:
   ```bash
   # On Linux / macOS:
   export CGO_ENABLED=1
   go build -o ./bin/server ./cmd/server

   # On Windows (cmd):
   set CGO_ENABLED=1
   go build -o ./bin/server.exe ./cmd/server

   # On Windows (PowerShell):
   $env:CGO_ENABLED="1"
   go build -o ./bin/server.exe ./cmd/server
   ```

4. Run the backend server:
   ```bash
   # Linux / macOS
   ./bin/server

   # Windows
   .\bin\server.exe
   ```
   *The backend will initialize `user.db`, `animal_health.db`, and `surveillance.db` automatically in WAL mode on port `8080` (`http://localhost:8080`).*

---

### Step 3: Start the Frontend UI

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd vet-disease-detector
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your web browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

### Step 4: (Optional) Production Build
To create an optimized production build of the frontend:
```bash
cd vet-disease-detector
npm run build
```
The compiled static assets will be output to `vet-disease-detector/dist/`.

---

## 📡 7. Core REST API Reference

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register user account (`farmer`, `pet_owner`, `vet`, `ngo`) |
| `POST` | `/api/auth/login` | Public | Authenticate credentials; returns 30-day session token |
| `POST` | `/api/auth/profile` | Auth | Update profile, location, clinic hours, or vet duty status |
| `POST` | `/api/auth/change-password` | Auth | Secure password change with old password verification |
| `GET` | `/api/vets` | Public / Auth | Search licensed vets by district with live duty/visiting status |
| `GET` | `/api/animals` | Auth | List user's animals (owners) or full regional directory (vets) |
| `GET` | `/api/animals/tag/:tag_number` | Auth | Instant lookup of animal by 12-digit Pashu Aadhaar tag |
| `POST` | `/api/animals` | Auth | Create a new livestock or pet profile |
| `PUT` | `/api/animals/:id` | Auth | Update animal details (weight, age, breed, ear tag, notes) |
| `POST` | `/api/health-check/upload` | Auth | Upload clinical photo/video to storage |
| `POST` | `/api/health-check/analyze` | Auth | Execute multi-frame extraction & differential assessment |
| `GET` | `/api/clinic-test-results` | Auth | Confidential retrieval of vet-issued lab reports |
| `POST` | `/api/clinic-test-results` | Auth (Vet) | Veterinarian publishes verified lab assay (CBC, CMT, PCR) |
| `GET` | `/api/outbreaks` | Public / Auth | Lists active and resolved disease clusters across Maharashtra |
| `POST` | `/api/outbreaks/report-recovery`| Auth | Farmer reports herd recovery, decrementing active counts |
| `POST` | `/api/outbreaks/resolve` | Auth (Vet/Gov)| Doctor issues clearance certificate to close an outbreak |
| `GET` | `/api/inventory` | Auth | View district vaccine and emergency medical supply stock |
| `PUT` | `/api/inventory` | Auth (Owner) | Update stock quantity (restricted to record creator) |
| `DELETE`| `/api/inventory` | Auth (Owner) | Remove stock entry (restricted to record creator) |
| `GET` | `/api/gov-advisories` | Public / Auth | View state animal husbandry circulars & quarantine orders |

---

## 👥 8. Team Members & Contributors

| # | Member Name | Course & Specialization | Sem | Institution | Profile & Contact |
| :-: | :--- | :--- | :-: | :--- | :--- |
| 1 | **Balaka Mandal** <br><sub>👑 *Team Leader*</sub> | Master of Computer Applications (MCA) | 2nd | University of Kalyani | [![GitHub](https://img.shields.io/badge/GitHub-%40balaka555-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/balaka555) |
| 2 | **Swastik Acharyya** | M.Sc. Computer Science | 1st | University of Kalyani | [![GitHub](https://img.shields.io/badge/GitHub-%40arpangreat-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/arpangreat) |
| 3 | **Rupal Karmakar** | M.Sc. AI and Data Science | 1st | University of Kalyani | [![GitHub](https://img.shields.io/badge/GitHub-%40Rupal2004--bytes-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/Rupal2004-bytes) |
| 4 | **Abhilock Saha Chowdhury** | M.Sc. AI and Data Science | 1st | University of Kalyani | — |
| 5 | **Jyouti Mondal** | M.Sc. AI and Data Science | 1st | University of Kalyani | — |
| 6 | **Sayan Baishya** | M.Sc. AI and Data Science | 1st | University of Kalyani | — |

---

## 📄 License & Disclaimer

* **License:** Distributed under the MIT License. See `LICENSE` for more information.
* **Veterinary Medical Disclaimer:** *PashuRakshak is designed for clinical decision-support, triage, and syndromic outbreak surveillance. It does not replace physical clinical examination, diagnostic cytology, histology, or direct in-person prescription by a registered veterinary practitioner.*
