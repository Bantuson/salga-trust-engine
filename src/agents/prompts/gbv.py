"""GBV intake — emergency constants and classification keywords.

Backstory/system prompts have been moved to agents.yaml (trilingual).
This module retains:
- Emergency phone numbers (SAPS, GBV Command Centre)
- GBV classification keywords for intent detection
"""

# Emergency numbers for South Africa
EMERGENCY_SAPS = "10111"
EMERGENCY_GBV_COMMAND_CENTRE = "0800 150 150"

# GBV classification keywords for detection in intake flow
GBV_CLASSIFICATION_KEYWORDS = {
    "en": [
        "domestic violence",
        "abuse",
        "hitting me",
        "beats me",
        "beat me",
        "rape",
        "raped",
        "sexual assault",
        "threatened",
        "threatening",
        "violence",
        "violent",
        "hurt me",
        "afraid",
        "scared",
        "safe",
        "not safe",
        "hit me"
    ],
    "zu": [
        "uyangihlukumeza",
        "uyangishaya",
        "ukudlwengula",
        "udlame lwasekhaya",
        "udlame",
        "dlame",
        "ukungibetha",
        "uyangigabhela",
        "angiphephile",
        "ngesaba"
    ],
    "af": [
        "huishoudelike geweld",
        "mishandeling",
        "slaan my",
        "geslaan",
        "verkragting",
        "verkrag",
        "geweld",
        "gewelddadig",
        "bedreig",
        "bang",
        "veilig",
        "nie veilig"
    ]
}
