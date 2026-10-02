export const SAMPLE_TENDER_1 = {
  id: "sample_cloud_security_rfp",
  title: "Enterprise Cloud Security & Managed Services RFP",
  buyer: "Department of Transportation & Infrastructure",
  file_name: "DoT_Cloud_Security_RFP_2026.pdf",
  total_pages: 45,
  evaluation_criteria: [
    { name: "Technical Architecture & Cloud Migration", weight: 35 },
    { name: "Security Compliance & ISO 27001 Certification", weight: 35 },
    { name: "SLA, 24/7 Support & Incident Response", weight: 30 }
  ],
  content: `
UNITED STATES DEPARTMENT OF TRANSPORTATION
REQUEST FOR PROPOSALS (RFP #DOT-2026-CS-099)
ENTERPRISE CLOUD SECURITY & INFRASTRUCTURE MODERNIZATION

SECTION 1: OVERVIEW AND SCOPE OF WORK
1.1 Objective. The Department of Transportation requires a certified cloud security solution provider to migrate legacy infrastructure to an AWS/Azure FedRAMP Moderate cloud environment.

SECTION 2: MANDATORY ELIGIBILITY & CERTIFICATIONS
2.1 ISO 27001 Certification. The offeror MUST possess active ISO/IEC 27001 Information Security Management Certification at the time of proposal submission. Non-compliant proposals will be disqualified immediately without evaluation. Page 4.
2.2 SOC 2 Type II Compliance. The offeror MUST provide an unredacted SOC 2 Type II audit report covering the preceding 12 months. Page 5.
2.3 Data Residency. All federal data MUST remain within the continental United States (CONUS). No foreign remote access is permitted under any circumstances. Page 6.

SECTION 3: TECHNICAL & ARCHITECTURAL REQUIREMENTS
3.1 Architecture. Offeror shall design an automated zero-trust cloud architecture featuring continuous vulnerability scanning and automated threat remediation. Page 10.
3.2 Encryption. All data at rest MUST be encrypted using AES-256 bits, and data in transit MUST be encrypted using TLS 1.3 or higher. Page 12.
3.3 API Access. Offeror should provide open RESTful APIs for integration with existing SIEM tools (Splunk, Datadog). Page 14.

SECTION 4: SLA AND OPERATIONAL REQUIREMENTS
4.1 Incident Response SLA. The vendor MUST guarantee a 15-minute initial response time SLA for P1 Critical Security Incidents 24/7/365. Page 20.
4.2 Availability SLA. System uptime MUST be guaranteed at 99.95% monthly availability. Page 22.
4.3 Disaster Recovery. RTO (Recovery Time Objective) MUST be under 1 hour, and RPO (Recovery Point Objective) MUST be under 15 minutes. Page 24.
4.4 Liquidated Damages. Vendor shall agree to $5,000 per hour liquidated damages for downtime exceeding allowable SLA thresholds. Page 28.
`
};

export const SAMPLE_TENDER_2 = {
  id: "sample_healthcare_analytics_tender",
  title: "AI Patient Data Analytics & Cloud Platform Tender",
  buyer: "National Healthcare Alliance",
  file_name: "NHA_AI_Patient_Analytics_Tender.pdf",
  total_pages: 38,
  evaluation_criteria: [
    { name: "AI/ML Model Accuracy & Clinical Relevance", weight: 40 },
    { name: "HIPAA Security & Patient Data Privacy", weight: 40 },
    { name: "System Integration & EHR Compatibility", weight: 20 }
  ],
  content: `
NATIONAL HEALTHCARE ALLIANCE (NHA)
TENDER SPECIFICATION #NHA-AI-2026-04
AI-POWERED PATIENT DATA ANALYTICS PLATFORM

SECTION 1: MANDATORY COMPLIANCE & PRIVACY
1.1 HIPAA Compliance. The solution MUST fully comply with HIPAA Security, Privacy, and Breach Notification Rules. Offeror must sign standard Business Associate Agreement (BAA). Page 3.
1.2 Patient Privacy. All patient health information (PHI) used for AI model training MUST be de-identified in strict accordance with HIPAA Safe Harbor standards. Page 5.

SECTION 2: FUNCTIONAL & AI REQUIREMENTS
2.1 Predictive Analytics. System MUST process real-time patient vitals and predict ICU readmission risk with a minimum Receiver Operating Characteristic (ROC-AUC) score of 0.85. Page 12.
2.2 Model Explainability. AI outputs MUST provide human-interpretable feature attribution scores for clinicians. Page 15.
2.3 EHR Integration. Offeror should support FHIR (Fast Healthcare Interoperability Resources) R4 APIs for seamless EPIC and Cerner integration. Page 18.

SECTION 3: SLA AND DISASTER RECOVERY
3.1 Service Uptime. Offeror MUST maintain 99.99% high-availability SLA with multi-region failover. Page 25.
3.2 Support SLA. Critical severity tickets MUST receive engineer response within 15 minutes. Page 27.
`
};

// Checklist benchmark data for recall evaluation (PRD Section 4 F5 benchmark view)
export const BENCHMARK_CHECKLIST_SAMPLES = [
  {
    tender_id: "sample_cloud_security_rfp",
    human_checklist_count: 10,
    model_recalled_count: 9,
    recall: 90.0,
    precision: 95.0
  },
  {
    tender_id: "sample_healthcare_analytics_tender",
    human_checklist_count: 8,
    model_recalled_count: 8,
    recall: 100.0,
    precision: 92.5
  }
];
