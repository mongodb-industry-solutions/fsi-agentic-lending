#!/usr/bin/env python3
"""
Ingest 14 synthetic PDF documents for Marcus & Sofia Delgado.
Uses Bedrock Claude to extract structured data from each PDF.
Stores results in MongoDB collections.

Usage: uv run python -m scripts.ingest_pdfs
"""
import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from db.mdb import MongoDBConnector
from services.extraction_service import extract_from_pdf, EXTRACTION_PROMPTS
from services.embedding_service import embed_texts, embed_document

def _resolve_project_root() -> Path:
    """Resolve project root, handling both source layout and Docker flat layout."""
    two_up = Path(__file__).resolve().parent.parent
    if (two_up / "docs").is_dir():
        return two_up
    return two_up.parent

PDF_DIR = _resolve_project_root() / "docs" / "synthetic data" / "marcus-delgado"

# Document type mapping (filename prefix -> doc_type)
DOC_TYPES = {
    "01": "government_id",
    "02": "employment_letter",
    "03": "paystubs",
    "04": "income_tax",
    "05": "bank_statements",
    "06": "purchase_agreement",
    "07": "investment_statements",
    "08": "other_property_docs",
    "09": "mortgage_application",
    "10": "utility_bills",
    "11": "credit_report",
    "12": "car_loan_statement",
    "13": "property_tax",
    "14": "property_inspection",
}

APPLICATION_ID = "APP-2026-00001"

# Additional borrower profiles — these seed apps share Marcus's 14 PDFs (cloned at
# demo-session time with name-patching), but have their own credit reports and
# payment histories to exercise different pipeline decision paths.
ADDITIONAL_PROFILES = [
    {
        "app_id": "APP-2026-00002",
        "profile_id": "jane-doe",
        "borrowers": [
            {"full_name": "Jane Doe", "employer": "Pacific Coast Medical Group", "job_title": "Nurse Practitioner", "annual_salary": 95000, "credit_score": 798},
            {"full_name": "John Doe", "employer": "Doe & Associates Accounting", "job_title": "Senior Accountant", "annual_salary": 70000, "credit_score": 772},
        ],
        "loan_amount": 340000,
        "purchase_price": 425000,
        "down_payment": 85000,
        "product": "5yr Fixed (25yr Amort)",
        "property": {"address": "1438 Garden Terrace, Burnaby, BC V5A 3G2", "type": "Townhouse", "purchase_price": 425000, "annual_tax": 3950},
        "income": {"combined_gross": 165000, "primary": 95000, "co_applicant": 70000},
        "existing_monthly_debt": 650,
        "credit_reports": [
            {"score": 798, "bureau": "Equifax", "accounts": [
                {"creditor": "TD Visa", "balance": 1200, "monthly_payment": 60, "status": "good"},
                {"creditor": "RBC Line of Credit", "balance": 0, "monthly_payment": 0, "status": "good"},
            ], "total_outstanding": 1200, "payment_history_summary": "48 months on-time, no late payments", "inquiries": [], "derogatory_items": []},
            {"score": 772, "bureau": "Equifax", "accounts": [
                {"creditor": "CIBC Visa", "balance": 800, "monthly_payment": 40, "status": "good"},
                {"creditor": "Student Loan", "balance": 12000, "monthly_payment": 550, "status": "good"},
            ], "total_outstanding": 12800, "payment_history_summary": "36 months on-time, no late payments", "inquiries": [], "derogatory_items": []},
        ],
        "payment_history": {"loan_id": "L-00002", "loan_amount": 340000, "rate": 0.0489, "months": 36, "late_months": []},
    },
    {
        "app_id": "APP-2026-00003",
        "profile_id": "john-smith",
        "borrowers": [
            {"full_name": "John Smith", "employer": "Meridian Creative Agency", "job_title": "Marketing Manager", "annual_salary": 108000, "credit_score": 695},
        ],
        "loan_amount": 392000,
        "purchase_price": 490000,
        "down_payment": 98000,
        "product": "5yr Fixed (25yr Amort)",
        "property": {"address": "55 Bremner Blvd, Unit 3402, Toronto, ON M5J 0A6", "type": "Condo", "purchase_price": 490000, "annual_tax": 4200},
        "income": {"combined_gross": 108000, "primary": 108000, "co_applicant": 0},
        "existing_monthly_debt": 400,
        "credit_reports": [
            {"score": 695, "bureau": "Equifax", "accounts": [
                {"creditor": "BMO Mastercard", "balance": 3200, "monthly_payment": 96, "status": "good"},
                {"creditor": "Honda Finance (Civic)", "balance": 8500, "monthly_payment": 195, "status": "good"},
                {"creditor": "Student Loan (OSAP)", "balance": 4800, "monthly_payment": 109, "status": "good"},
            ], "total_outstanding": 16500, "payment_history_summary": "24 months on-time, 2 late payments 30+ days (2025)", "inquiries": [
                {"type": "hard", "date": "2026-01-15", "lender": "TD Bank Mortgages"},
                {"type": "hard", "date": "2026-02-01", "lender": "Scotiabank Mortgage"},
            ], "derogatory_items": []},
        ],
        "payment_history": {"loan_id": "L-00003", "loan_amount": 392000, "rate": 0.0489, "months": 36, "late_months": [28, 31, 34]},
    },
    {
        "app_id": "APP-2026-00004",
        "profile_id": "bob-johnson",
        "borrowers": [
            {"full_name": "Bob Johnson", "employer": "Great Lakes Logistics Ltd.", "job_title": "Operations Coordinator", "annual_salary": 85000, "credit_score": 648},
            {"full_name": "Alice Johnson", "employer": "Halton District School Board", "job_title": "Supply Teacher", "annual_salary": 50000, "credit_score": 612},
        ],
        "loan_amount": 960000,
        "purchase_price": 1200000,
        "down_payment": 240000,
        "product": "5yr Fixed (25yr Amort)",
        "property": {"address": "27 Chartwell Crescent, Oakville, ON L6J 3Z8", "type": "Detached Home", "purchase_price": 1200000, "annual_tax": 9200},
        "income": {"combined_gross": 135000, "primary": 85000, "co_applicant": 50000},
        "existing_monthly_debt": 3070,
        "credit_reports": [
            {"score": 648, "bureau": "Equifax", "accounts": [
                {"creditor": "TD Visa Infinite", "balance": 18000, "monthly_payment": 540, "status": "fair"},
                {"creditor": "Ford Credit (F-150)", "balance": 38000, "monthly_payment": 720, "status": "fair"},
                {"creditor": "CIBC Personal LOC", "balance": 25000, "monthly_payment": 625, "status": "fair"},
                {"creditor": "Furniture Financing", "balance": 6000, "monthly_payment": 200, "status": "good"},
            ], "total_outstanding": 87000, "payment_history_summary": "36 months; 5 late payments 30+ days, 1 payment 60+ days (2025)", "inquiries": [
                {"type": "hard", "date": "2025-11-01", "lender": "RBC Mortgage"},
                {"type": "hard", "date": "2025-12-15", "lender": "National Bank Mortgage"},
                {"type": "hard", "date": "2026-01-20", "lender": "First National Mortgage"},
            ], "derogatory_items": [
                {"type": "collection", "amount": 2400, "creditor": "Bell Canada", "date": "2025-06-01"},
            ]},
            {"score": 612, "bureau": "Equifax", "accounts": [
                {"creditor": "RBC Visa", "balance": 12000, "monthly_payment": 360, "status": "fair"},
                {"creditor": "Student Loan (OSAP)", "balance": 28000, "monthly_payment": 520, "status": "good"},
                {"creditor": "Retail Store Card", "balance": 3500, "monthly_payment": 105, "status": "fair"},
            ], "total_outstanding": 43500, "payment_history_summary": "30 months; 3 late payments 30+ days (2025-2026)", "inquiries": [
                {"type": "hard", "date": "2026-01-20", "lender": "First National Mortgage"},
            ], "derogatory_items": []},
        ],
        "payment_history": {"loan_id": "L-00004", "loan_amount": 960000, "rate": 0.0489, "months": 36, "late_months": [18, 22, 26, 30, 33, 35]},
    },
    {
        "app_id": "APP-2026-00005",
        "profile_id": "sarah-williams",
        "borrowers": [
            {"full_name": "Sarah Williams", "employer": "Shopify Inc.", "job_title": "Senior Data Analyst", "annual_salary": 115000, "credit_score": 760},
        ],
        "loan_amount": 364000,
        "purchase_price": 455000,
        "down_payment": 91000,
        "product": "5yr Fixed (25yr Amort)",
        "property": {"address": "280 Metcalfe Street, Unit 801, Ottawa, ON K2P 1R7", "type": "Condo", "purchase_price": 455000, "annual_tax": 3800},
        "income": {"combined_gross": 115000, "primary": 115000, "co_applicant": 0},
        "existing_monthly_debt": 350,
        "credit_reports": [
            {"score": 760, "bureau": "Equifax", "accounts": [
                {"creditor": "RBC Visa", "balance": 1800, "monthly_payment": 54, "status": "good"},
                {"creditor": "Student Loan (NSLSC)", "balance": 8200, "monthly_payment": 296, "status": "good"},
            ], "total_outstanding": 10000, "payment_history_summary": "36 months on-time, no late payments", "inquiries": [
                {"type": "hard", "date": "2026-02-10", "lender": "Axiom Mortgage Solutions"},
            ], "derogatory_items": []},
        ],
        "payment_history": {"loan_id": "L-00005", "loan_amount": 364000, "rate": 0.0489, "months": 36, "late_months": []},
        "skip_doc_types": ["paystubs"],
    },
]


def create_borrowers(db, extraction_data: dict) -> list:
    """Create borrower documents from gov ID + employment letter extractions."""
    now = datetime.now(timezone.utc)
    borrowers = []

    gov_id_data = extraction_data.get("government_id", {})
    employment_data = extraction_data.get("employment_letter", {})
    credit_data = extraction_data.get("credit_report", {})

    persons = gov_id_data.get("persons", [])
    employment = employment_data.get("persons", [])
    credit = credit_data.get("reports", [])

    for i, person in enumerate(persons):
        borrower = {
            "full_name": person.get("full_name", f"Borrower {i+1}"),
            "date_of_birth": person.get("date_of_birth"),
            "gender": person.get("gender"),
            "address": person.get("address"),
            "sin_masked": person.get("id_number", "***-***-***"),
            "employment": employment[i] if i < len(employment) else {},
            "credit_score": credit[i].get("credit_score") if i < len(credit) else None,
            "application_id": APPLICATION_ID,
            "created_at": now,
        }
        result = db["borrowers"].insert_one(borrower)
        borrower["_id"] = result.inserted_id
        borrowers.append(borrower)
        print(f"  Created borrower: {borrower['full_name']} (credit: {borrower.get('credit_score')})")

    return borrowers


def create_application(db, borrowers: list, extraction_data: dict):
    """Create the loan application document."""
    now = datetime.now(timezone.utc)
    mortgage_data = extraction_data.get("mortgage_application", {})
    purchase_data = extraction_data.get("purchase_agreement", {})

    application = {
        "application_id": APPLICATION_ID,
        "profile_id": "marcus-delgado",
        "borrower_ids": [b["_id"] for b in borrowers],
        "borrower_names": [b["full_name"] for b in borrowers],
        "loan_amount": 700000,
        "purchase_price": 875000,
        "down_payment": 175000,
        "product": "5yr Fixed (25yr Amort)",
        "property": {
            "address": purchase_data.get("property_address", "4718 Coronation Drive SW, Calgary, AB T3E 4Y2"),
            "type": "Detached Home",
            "purchase_price": purchase_data.get("purchase_price", 875000),
        },
        "income_summary": {
            "combined_gross": 222700,
            "primary": 128500,
            "co_applicant": 94200,
        },
        "status": "submitted",
        "status_history": [
            {"status": "submitted", "timestamp": now, "detail": "Application received"}
        ],
        "seed_complete": True,
        "created_at": now,
        "updated_at": now,
    }

    db["applications"].insert_one(application)
    print(f"  Created application: {APPLICATION_ID}")


def create_credit_reports(db, borrowers: list, extraction_data: dict):
    """Create credit report documents."""
    credit_data = extraction_data.get("credit_report", {})
    reports = credit_data.get("reports", [])

    for i, borrower in enumerate(borrowers):
        report = reports[i] if i < len(reports) else {}
        credit_doc = {
            "borrower_id": borrower["_id"],
            "borrower_name": borrower["full_name"],
            "score": report.get("credit_score", 0),
            "bureau": "Equifax",
            "accounts": report.get("accounts", []),
            "total_outstanding": report.get("total_outstanding"),
            "payment_history": report.get("payment_history_summary"),
            "inquiries": report.get("inquiries", []),
            "derogatory_items": report.get("derogatory_items", []),
            "pulled_at": datetime.now(timezone.utc),
        }
        db["credit_reports"].insert_one(credit_doc)
        print(f"  Created credit report: {borrower['full_name']} (score: {credit_doc['score']})")


def create_policies(db):
    """Insert Canadian mortgage underwriting policies for RAG."""
    policies = [
        {"policy_id": "GDS-001", "section": "Debt Service Ratios", "title": "Gross Debt Service (GDS) Ratio", "content": "The Gross Debt Service (GDS) ratio must not exceed 39% of gross household income. GDS includes: mortgage principal and interest payments, property taxes, heating costs, and 50% of condominium fees if applicable. For insured mortgages (LTV > 80%), the GDS limit is 35%."},
        {"policy_id": "TDS-001", "section": "Debt Service Ratios", "title": "Total Debt Service (TDS) Ratio", "content": "The Total Debt Service (TDS) ratio must not exceed 44% of gross household income. TDS includes all GDS components plus all other debt obligations: car loans, credit card minimums, lines of credit payments, student loans, and alimony/child support. For insured mortgages, the TDS limit is 42%."},
        {"policy_id": "STRESS-001", "section": "Stress Test", "title": "Mortgage Stress Test (B-20)", "content": "All mortgage applicants must qualify at the greater of: (a) the contract rate plus 2%, or (b) the Bank of Canada 5-year benchmark rate (currently 5.25%). This applies to both insured and uninsured mortgages. The qualifying rate is used to calculate GDS and TDS ratios for approval purposes."},
        {"policy_id": "CREDIT-001", "section": "Credit Requirements", "title": "Minimum Credit Score", "content": "Minimum credit score of 680 for conventional mortgages (LTV <= 80%). Minimum credit score of 600 for insured mortgages (LTV > 80%). Both applicants on a joint application must meet the minimum. Scores below 680 require compensating factors: low LTV, strong income, significant assets."},
        {"policy_id": "LTV-001", "section": "Loan-to-Value", "title": "Maximum Loan-to-Value Ratio", "content": "Maximum LTV of 95% for owner-occupied properties (requires CMHC insurance). Maximum LTV of 80% for conventional (uninsured) mortgages. Maximum LTV of 80% for rental/investment properties. LTV calculated as mortgage amount divided by the lesser of purchase price or appraised value."},
        {"policy_id": "DOWN-001", "section": "Down Payment", "title": "Minimum Down Payment Requirements", "content": "Minimum 5% down payment on first $500,000 of purchase price. Minimum 10% on the portion between $500,000 and $999,999. Minimum 20% on properties $1,000,000 and above (no CMHC insurance available). Down payment sources must be verified: savings, RRSP (Home Buyers' Plan max $35,000 per person), gift from immediate family (with gift letter)."},
        {"policy_id": "INCOME-001", "section": "Income Verification", "title": "Income Documentation Requirements", "content": "Salaried employees: 2 most recent pay stubs, T4 or employment letter, and most recent Notice of Assessment (NOA). Self-employed: 2 years of T1 Generals with NOAs, business financial statements, and potentially a CPA letter. Rental income: current lease agreement, 2 years of T1 showing rental income, most recent NOA. Only 50% of gross rental income is added for qualification. Commission income: 2-year average used."},
        {"policy_id": "PROPERTY-001", "section": "Property Requirements", "title": "Property Eligibility and Appraisal", "content": "Property must be located in Canada and be habitable year-round. Appraisal required for purchases over $500,000 on conventional mortgages. Property inspection recommended but not required (lender reserves right to require). Maximum amortization: 25 years for insured, 30 years for conventional. Property tax must be current."},
        {"policy_id": "RENTAL-001", "section": "Rental Income", "title": "Rental Property Income Treatment", "content": "For existing rental properties: 50% of gross rental income may be added to qualifying income. Rental income must be supported by: current lease agreement, rental history (T776 tax filing), and bank statements showing deposits. Vacancy allowance of 50% applied (i.e., only half of rental income counts). Rental expenses (mortgage, tax, insurance, condo fees) on existing rental property must be included in TDS calculation."},
        {"policy_id": "COBORROW-001", "section": "Co-Borrower", "title": "Joint Application Requirements", "content": "All co-borrowers are jointly and severally liable. Both credit scores must meet minimum requirements. Combined income used for GDS/TDS qualification. All liabilities of both borrowers included in TDS. Both borrowers must sign all mortgage documents. Both borrowers must be on title."},
        {"policy_id": "FRAUD-001", "section": "Fraud Detection", "title": "Anti-Fraud Screening Requirements", "content": "All applications undergo automated fraud screening: identity verification against government databases, employment verification via direct employer contact or third-party service, income consistency check (pay stubs vs NOA vs bank deposits), address verification, credit inquiry pattern analysis (multiple applications across lenders within 30 days flagged), and property valuation anomaly detection."},
        {"policy_id": "REVIEW-001", "section": "Human Review", "title": "Officer Review Triggers", "content": "Applications automatically escalated to human review when: (a) purchase price exceeds $500,000, (b) GDS or TDS within 3% of maximum, (c) credit score between 680-720 (borderline), (d) self-employed income, (e) non-traditional down payment sources, (f) multiple properties owned, (g) recent credit inquiries from other lenders, (h) any fraud screening flag. Tier 1: auto-approve (score > 85, all ratios clear). Tier 2: junior officer review (score 60-85). Tier 3: senior underwriter escalation (score < 60 or fraud flags)."},
        {"policy_id": "AMORT-001", "section": "Amortization", "title": "Amortization Period Rules", "content": "Maximum 25 years for insured mortgages (LTV > 80%). Maximum 30 years for conventional mortgages (LTV <= 80%). Shorter amortization reduces total interest cost. 5-year term is most common in Canada (available for refinancing at maturity). Fixed vs variable rate at borrower's choice. Break penalties: 3 months interest (variable) or Interest Rate Differential (fixed)."},
        {"policy_id": "CLOSING-001", "section": "Closing", "title": "Closing Requirements and Conditions", "content": "Required before closing: title search and insurance, property insurance (minimum replacement cost coverage), final employment verification (within 10 days of closing), source of down payment confirmation, lawyer/notary engagement letter. Standard conditions: satisfactory appraisal, clear title, no material change in financial circumstances, property insurance binder. Closing costs typically 1.5-4% of purchase price."},
        {"policy_id": "REGULATORY-001", "section": "Regulatory Compliance", "title": "OSFI B-20 and Provincial Requirements", "content": "OSFI Guideline B-20: stress test mandatory for all federally regulated lenders. FINTRAC: anti-money laundering reporting for transactions over $10,000. Provincial requirements: Alberta Real Estate Act compliance, land titles registration, Alberta mortgage broker licensing. Privacy: PIPEDA compliance for all borrower data handling. Fair lending: no discrimination based on protected grounds under Canadian Human Rights Act."},
        {"policy_id": "INSURED-001", "section": "Mortgage Insurance", "title": "CMHC Insured Mortgage Requirements", "content": "Mortgages with LTV > 80% require CMHC (or equivalent) mortgage default insurance. Insurance premiums range from 2.80% (LTV 80.01-85%) to 4.00% (LTV 90.01-95%) of the mortgage amount, added to the loan balance. Insured mortgages have tighter qualification limits: maximum GDS of 35% and maximum TDS of 42% (compared to 39%/44% for conventional). Maximum amortization is 25 years for insured mortgages. Maximum purchase price is $999,999 for insured mortgages — properties at or above $1,000,000 require minimum 20% down payment and cannot be insured."},
    ]

    now = datetime.now(timezone.utc)
    for policy in policies:
        policy["version"] = "1.0"
        policy["effective_date"] = now
        policy["created_at"] = now

    # Generate embeddings for policies
    print("  Generating policy embeddings...")
    try:
        policy_texts = [p["content"] for p in policies]
        embeddings = embed_texts(policy_texts, input_type="document")
        for policy, emb in zip(policies, embeddings):
            policy["embedding"] = emb
        print(f"  Embedded {len(embeddings)} policies")
    except Exception as e:
        print(f"  Warning: policy embedding failed: {e}")
        for policy in policies:
            policy["embedding"] = None

    for policy in policies:
        db["underwriting_policies"].update_one(
            {"policy_id": policy["policy_id"]},
            {"$setOnInsert": policy},
            upsert=True,
        )
    print(f"  Upserted {len(policies)} underwriting policies")


def _generate_payment_records(loan_id: str, loan_amount: float, annual_rate: float,
                               num_months: int, late_months: list[int]) -> list[dict]:
    """Generate monthly amortization payment records with configurable late months."""
    from dateutil.relativedelta import relativedelta

    monthly_rate = annual_rate / 12
    amort_months = 300  # 25 years
    # Standard amortization formula
    monthly_payment = round(
        loan_amount * (monthly_rate * (1 + monthly_rate) ** amort_months)
        / ((1 + monthly_rate) ** amort_months - 1), 2
    )

    outstanding = loan_amount
    start_date = datetime(2023, 7, 1, tzinfo=timezone.utc)
    records = []

    for month in range(1, num_months + 1):
        interest = round(outstanding * monthly_rate, 2)
        principal = round(monthly_payment - interest, 2)
        outstanding = round(outstanding - principal, 2)

        is_late = month in late_months
        days_late = 47 if is_late else 0
        status = "late" if is_late else "on_time"

        ts = start_date + relativedelta(months=month - 1)

        records.append({
            "loan_id": loan_id,
            "payment_number": month,
            "amount": monthly_payment,
            "principal": principal,
            "interest": interest,
            "outstanding_balance": max(outstanding, 0),
            "days_late": days_late,
            "status": status,
            "timestamp": ts,
        })

    return records


def create_payment_history(db):
    """Insert 36 monthly payment records for loan L-00001."""
    if db["payments"].count_documents({"loan_id": "L-00001"}) > 0:
        print("  Payment history already exists for L-00001, skipping")
        return

    records = _generate_payment_records("L-00001", 700000, 0.0489, 36, [32])
    db["payments"].insert_many(records)
    print(f"  Inserted {len(records)} payment records for L-00001")


def _ingest_profile_pdfs(db, profile_id: str, app_id: str, skip_doc_types: list[str] | None = None) -> int:
    """Ingest profile-specific PDFs from docs/synthetic data/<profile_id>/.

    Args:
        skip_doc_types: Doc types to skip during seed (e.g., ["paystubs"]).
            Skipped docs remain on disk for later demo-upload by the borrower.

    Returns the number of documents ingested, or 0 if no profile directory found.
    """
    profile_pdf_dir = _resolve_project_root() / "docs" / "synthetic data" / profile_id
    if not profile_pdf_dir.is_dir():
        return 0

    pdf_files = sorted(profile_pdf_dir.glob("*.pdf"))
    if not pdf_files:
        return 0

    count = 0
    for pdf_path in pdf_files:
        prefix = pdf_path.name[:2]
        doc_type = DOC_TYPES.get(prefix, "unknown")
        if skip_doc_types and doc_type in skip_doc_types:
            print(f"      Skipping: {pdf_path.name} ({doc_type}) — will be uploaded by borrower during demo")
            continue
        print(f"      Extracting: {pdf_path.name} ({doc_type})")

        try:
            extracted = extract_from_pdf(pdf_path, doc_type)
            text_for_display = extracted.get("text_summary", json.dumps(extracted, indent=2))

            embedding = None
            embedding_pages = 0
            try:
                embedding, embedding_pages = embed_document(pdf_path)
            except Exception as e:
                print(f"      Warning: embedding failed: {e}")

            db["documents"].insert_one({
                "application_id": app_id,
                "doc_type": doc_type,
                "filename": pdf_path.name,
                "extracted_text": text_for_display,
                "structured_data": extracted,
                "embedding": embedding,
                "embedding_type": "multimodal" if embedding else None,
                "embedding_pages": embedding_pages if embedding else 0,
                "status": "parsed",
                "created_at": datetime.now(timezone.utc),
            })
            count += 1
        except Exception as e:
            print(f"      ERROR extracting {pdf_path.name}: {e}")
            db["documents"].insert_one({
                "application_id": app_id,
                "doc_type": doc_type,
                "filename": pdf_path.name,
                "extracted_text": f"Extraction failed: {str(e)}",
                "structured_data": {},
                "status": "error",
                "created_at": datetime.now(timezone.utc),
            })
            count += 1

    return count


def seed_additional_profiles(db):
    """Seed borrower/application/credit/payment data for additional profiles.

    If profile-specific PDFs exist in docs/synthetic data/<profile_id>/,
    they are extracted via Bedrock Claude (same as Marcus). Otherwise,
    falls back to cloning Marcus's 14 documents with name-patching.
    """
    from services.application_service import clone_demo_documents

    for profile in ADDITIONAL_PROFILES:
        app_id = profile["app_id"]

        # Idempotency — only skip if fully seeded (seed_complete flag set at end)
        if db["applications"].count_documents({"application_id": app_id, "seed_complete": True}) > 0:
            print(f"  {app_id} ({profile['profile_id']}) already fully seeded, skipping")
            continue
        # Clean up partial seed if app exists without seed_complete
        if db["applications"].count_documents({"application_id": app_id}) > 0:
            print(f"  {app_id} partially seeded — cleaning up and re-seeding")
            old_app = db["applications"].find_one({"application_id": app_id}, {"borrower_ids": 1})
            old_bids = old_app.get("borrower_ids", []) if old_app else []
            db["applications"].delete_many({"application_id": app_id})
            db["borrowers"].delete_many({"application_id": app_id})
            db["documents"].delete_many({"application_id": app_id})
            if old_bids:
                db["credit_reports"].delete_many({"borrower_id": {"$in": old_bids}})
            ph = profile.get("payment_history")
            if ph:
                db["payments"].delete_many({"loan_id": ph["loan_id"]})

        now = datetime.now(timezone.utc)

        # --- Borrowers ---
        borrower_ids = []
        borrower_names = []
        for b in profile["borrowers"]:
            borrower_doc = {
                "full_name": b["full_name"],
                "employment": {
                    "employer": b["employer"],
                    "job_title": b["job_title"],
                    "annual_salary": b["annual_salary"],
                },
                "credit_score": b["credit_score"],
                "application_id": app_id,
                "created_at": now,
            }
            result = db["borrowers"].insert_one(borrower_doc)
            borrower_ids.append(result.inserted_id)
            borrower_names.append(b["full_name"])
            print(f"    Borrower: {b['full_name']} (credit: {b['credit_score']})")

        # --- Application ---
        application = {
            "application_id": app_id,
            "borrower_ids": borrower_ids,
            "borrower_names": borrower_names,
            "loan_amount": profile["loan_amount"],
            "purchase_price": profile["purchase_price"],
            "down_payment": profile["down_payment"],
            "product": profile["product"],
            "property": profile["property"],
            "income_summary": profile["income"],
            "existing_monthly_debt": profile.get("existing_monthly_debt", 0),
            "status": "submitted",
            "status_history": [
                {"status": "submitted", "timestamp": now, "detail": "Application received"}
            ],
            "created_at": now,
            "updated_at": now,
        }
        db["applications"].insert_one(application)
        print(f"    Application: {app_id}")

        # --- Documents: use profile-specific PDFs if available, else clone Marcus's ---
        skip_types = profile.get("skip_doc_types")
        ingested = _ingest_profile_pdfs(db, profile["profile_id"], app_id, skip_doc_types=skip_types)
        if ingested > 0:
            skipped_msg = f" (skipped: {', '.join(skip_types)})" if skip_types else ""
            print(f"    Ingested {ingested} profile-specific documents from docs/synthetic data/{profile['profile_id']}/{skipped_msg}")
        else:
            cloned = clone_demo_documents(APPLICATION_ID, app_id)
            print(f"    Cloned {cloned} documents from {APPLICATION_ID} (no profile PDFs found)")

        # --- Credit Reports ---
        for i, cr in enumerate(profile["credit_reports"]):
            if i >= len(borrower_ids):
                break
            credit_doc = {
                "borrower_id": borrower_ids[i],
                "borrower_name": borrower_names[i],
                "score": cr["score"],
                "bureau": cr["bureau"],
                "accounts": cr["accounts"],
                "total_outstanding": cr.get("total_outstanding", 0),
                "payment_history": cr.get("payment_history_summary", ""),
                "inquiries": cr.get("inquiries", []),
                "derogatory_items": cr.get("derogatory_items", []),
                "pulled_at": now,
            }
            db["credit_reports"].insert_one(credit_doc)
            print(f"    Credit report: {borrower_names[i]} (score: {cr['score']})")

        # --- Payment History ---
        ph = profile.get("payment_history")
        if ph:
            loan_id = ph["loan_id"]
            if db["payments"].count_documents({"loan_id": loan_id}) == 0:
                records = _generate_payment_records(
                    loan_id, ph["loan_amount"], ph["rate"],
                    ph["months"], ph.get("late_months", [])
                )
                db["payments"].insert_many(records)
                print(f"    Payments: {len(records)} records for {loan_id} ({len(ph.get('late_months', []))} late)")

        # Mark as fully seeded so re-runs skip this profile
        db["applications"].update_one(
            {"application_id": app_id},
            {"$set": {"seed_complete": True}}
        )
        print(f"  Seeded profile: {profile['profile_id']} ({app_id})")


def main():
    # Initialize
    db_connector = MongoDBConnector()
    db = db_connector.client[os.getenv("DATABASE_NAME", "lendflow")]

    # Idempotency check — if Marcus already exists AND has documents, skip PDF
    # extraction. If the app exists but documents are gone (e.g. wiped by a prior
    # demo reset before the seed_complete fix), clean up and fall through to
    # full re-ingest.
    existing = db["applications"].count_documents({"application_id": APPLICATION_ID})
    if existing > 0:
        # Idempotent backfill: ensures profile_id and seed_complete are present
        db["applications"].update_one(
            {"application_id": APPLICATION_ID},
            {"$set": {"profile_id": "marcus-delgado", "seed_complete": True}},
        )

        doc_count = db["documents"].count_documents({"application_id": APPLICATION_ID})
        if doc_count == 0:
            # App exists but documents are gone — clean up and fall through to re-ingest
            print(f"  {APPLICATION_ID} exists but has 0 documents — re-seeding from PDFs...")
            app = db["applications"].find_one({"application_id": APPLICATION_ID}, {"borrower_ids": 1})
            old_bids = app.get("borrower_ids", []) if app else []
            db["applications"].delete_many({"application_id": APPLICATION_ID})
            db["borrowers"].delete_many({"application_id": APPLICATION_ID})
            if old_bids:
                db["credit_reports"].delete_many({"borrower_id": {"$in": old_bids}})
        else:
            print(f"Data already ingested for {APPLICATION_ID} ({doc_count} docs). Skipping PDF extraction.")
            print("Checking additional profiles, policies, and payments...\n")
            create_policies(db)
            create_payment_history(db)
            seed_additional_profiles(db)
            print("\nDone.")
            sys.exit(0)

    model_id = os.getenv("CHATCOMPLETIONS_MODEL_ID")
    if not model_id:
        print("ERROR: CHATCOMPLETIONS_MODEL_ID not set in .env")
        sys.exit(1)

    print(f"Using model: {model_id}")
    print(f"PDF directory: {PDF_DIR}")
    print()

    # Step 1: Extract data from all PDFs
    print("=" * 60)
    print("STEP 1: Extracting structured data from PDFs via Claude")
    print("=" * 60)

    extraction_data = {}
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))

    if not pdf_files:
        print(f"ERROR: No PDFs found in {PDF_DIR}")
        sys.exit(1)

    for pdf_path in pdf_files:
        prefix = pdf_path.name[:2]
        doc_type = DOC_TYPES.get(prefix, "unknown")
        print(f"\nProcessing: {pdf_path.name} ({doc_type})")

        try:
            extracted = extract_from_pdf(pdf_path, doc_type)
            extraction_data[doc_type] = extracted

            # Store in documents collection
            text_for_display = extracted.get("text_summary", json.dumps(extracted, indent=2))
            embedding = None
            embedding_pages = 0
            try:
                embedding, embedding_pages = embed_document(pdf_path)
                print(f"  Multimodal embedding: {embedding_pages} pages")
            except Exception as e:
                print(f"  Warning: multimodal embedding failed: {e}")

            doc_record = {
                "application_id": APPLICATION_ID,
                "doc_type": doc_type,
                "filename": pdf_path.name,
                "extracted_text": text_for_display,
                "structured_data": extracted,
                "embedding": embedding,
                "embedding_type": "multimodal" if embedding else None,
                "embedding_pages": embedding_pages if embedding else 0,
                "status": "parsed",
                "created_at": datetime.now(timezone.utc),
            }
            db["documents"].insert_one(doc_record)
            print(f"  Stored document record with extracted data")

        except Exception as e:
            print(f"  ERROR: {e}")
            # Store with error status
            db["documents"].insert_one({
                "application_id": APPLICATION_ID,
                "doc_type": doc_type,
                "filename": pdf_path.name,
                "extracted_text": f"Extraction failed: {str(e)}",
                "structured_data": {},
                "status": "error",
                "created_at": datetime.now(timezone.utc),
            })

    # Step 2: Create borrower records
    print("\n" + "=" * 60)
    print("STEP 2: Creating borrower records")
    print("=" * 60)
    borrowers = create_borrowers(db, extraction_data)

    # Step 3: Create application record
    print("\n" + "=" * 60)
    print("STEP 3: Creating application record")
    print("=" * 60)
    create_application(db, borrowers, extraction_data)

    # Step 4: Create credit reports
    print("\n" + "=" * 60)
    print("STEP 4: Creating credit report records")
    print("=" * 60)
    create_credit_reports(db, borrowers, extraction_data)

    # Step 5: Insert underwriting policies
    print("\n" + "=" * 60)
    print("STEP 5: Inserting underwriting policies")
    print("=" * 60)
    create_policies(db)

    # Step 6: Insert payment history
    print("\n" + "=" * 60)
    print("STEP 6: Inserting payment history")
    print("=" * 60)
    create_payment_history(db)

    # Step 7: Seed additional borrower profiles
    print("\n" + "=" * 60)
    print("STEP 7: Seeding additional borrower profiles")
    print("=" * 60)
    seed_additional_profiles(db)

    print("\n" + "=" * 60)
    print("STEP 8: Seeding loan officer")
    print("=" * 60)
    from services.officer_service import seed_officer, DEFAULT_OFFICER
    seed_officer(db)
    print(f"  Seeded officer: {DEFAULT_OFFICER['full_name']} ({DEFAULT_OFFICER['title']})")

    # Summary
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)
    print(f"  Borrowers: {db['borrowers'].count_documents({})}")
    print(f"  Applications: {db['applications'].count_documents({})}")
    print(f"  Documents: {db['documents'].count_documents({})}")
    print(f"  Credit Reports: {db['credit_reports'].count_documents({})}")
    print(f"  Policies: {db['underwriting_policies'].count_documents({})}")
    print(f"  Payments: {db['payments'].count_documents({})}")


if __name__ == "__main__":
    main()
