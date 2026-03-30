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

# PDF directory
PDF_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "synthetic data"

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
        {"policy_id": "AMORT-001", "section": "Amortization", "title": "Amortization Period Rules", "content": "Maximum 25 years for insured mortgages (LTV > 80%). Maximum 30 years for conventional mortgages (LTV <= 80%). Shorter amortization reduces total interest cost. 5-year term is most common in Canada (renewable at maturity). Fixed vs variable rate at borrower's choice. Break penalties: 3 months interest (variable) or Interest Rate Differential (fixed)."},
        {"policy_id": "CLOSING-001", "section": "Closing", "title": "Closing Requirements and Conditions", "content": "Required before closing: title search and insurance, property insurance (minimum replacement cost coverage), final employment verification (within 10 days of closing), source of down payment confirmation, lawyer/notary engagement letter. Standard conditions: satisfactory appraisal, clear title, no material change in financial circumstances, property insurance binder. Closing costs typically 1.5-4% of purchase price."},
        {"policy_id": "REGULATORY-001", "section": "Regulatory Compliance", "title": "OSFI B-20 and Provincial Requirements", "content": "OSFI Guideline B-20: stress test mandatory for all federally regulated lenders. FINTRAC: anti-money laundering reporting for transactions over $10,000. Provincial requirements: Alberta Real Estate Act compliance, land titles registration, Alberta mortgage broker licensing. Privacy: PIPEDA compliance for all borrower data handling. Fair lending: no discrimination based on protected grounds under Canadian Human Rights Act."},
    ]

    now = datetime.now(timezone.utc)
    for policy in policies:
        policy["version"] = "1.0"
        policy["effective_date"] = now
        policy["created_at"] = now

    for policy in policies:
        db["underwriting_policies"].update_one(
            {"policy_id": policy["policy_id"]},
            {"$setOnInsert": policy},
            upsert=True,
        )
    print(f"  Upserted {len(policies)} underwriting policies")


def main():
    # Initialize
    db_connector = MongoDBConnector()
    db = db_connector.client[os.getenv("DATABASE_NAME", "lendflow")]

    # Idempotency check
    existing = db["applications"].count_documents({"application_id": APPLICATION_ID})
    if existing > 0:
        print(f"Data already ingested for {APPLICATION_ID} ({existing} docs found). Skipping.")
        print("To re-ingest, drop the collections first.")
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
            doc_record = {
                "application_id": APPLICATION_ID,
                "doc_type": doc_type,
                "filename": pdf_path.name,
                "extracted_text": extracted.get("text_summary", json.dumps(extracted, indent=2)),
                "structured_data": extracted,
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

    # Summary
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)
    print(f"  Borrowers: {db['borrowers'].count_documents({})}")
    print(f"  Applications: {db['applications'].count_documents({})}")
    print(f"  Documents: {db['documents'].count_documents({})}")
    print(f"  Credit Reports: {db['credit_reports'].count_documents({})}")
    print(f"  Policies: {db['underwriting_policies'].count_documents({})}")


if __name__ == "__main__":
    main()
