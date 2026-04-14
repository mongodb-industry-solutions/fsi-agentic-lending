"""Document extraction service — uses Bedrock Claude to extract structured data from PDFs."""
import os
import json
import logging
import re
from pathlib import Path

import boto3

logger = logging.getLogger(__name__)

# Document type extraction prompts
EXTRACTION_PROMPTS = {
    "government_id": "Extract all identity information from this government ID document. Return JSON with fields: persons (array of {full_name, date_of_birth, gender, height, address, id_number, expiry_date}). Also provide a text_summary field with a natural language summary of the document.",
    "employment_letter": "Extract employment details from this letter. Return JSON with fields: persons (array of {full_name, employer, job_title, start_date, annual_salary, employment_status}). Also provide a text_summary field.",
    "paystubs": "Extract pay stub information. Return JSON with fields: pay_periods (array of {employee_name, employer, pay_period_start, pay_period_end, gross_pay, net_pay, deductions}). Also provide a text_summary field.",
    "income_tax": "Extract tax assessment information. Return JSON with fields: assessments (array of {taxpayer_name, tax_year, total_income, taxable_income, tax_owing_or_refund, assessment_date}). Also provide a text_summary field.",
    "bank_statements": "Extract bank statement information. Return JSON with fields: account_holder, account_number_masked, institution, statements (array of {period, opening_balance, closing_balance, total_deposits, total_withdrawals}). Also provide a text_summary field.",
    "purchase_agreement": "Extract real estate purchase agreement details. Return JSON with fields: property_address, purchase_price, deposit_amount, buyer_names, seller_names, offer_date, acceptance_date, closing_date, conditions. Also provide a text_summary field.",
    "investment_statements": "Extract investment account information. Return JSON with fields: accounts (array of {account_type, account_number_masked, total_value, holdings}). Also provide a text_summary field.",
    "other_property_docs": "Extract property and rental information. Return JSON with fields: properties (array of {address, assessed_value, mortgage_outstanding, monthly_payment, rental_income, tenant_info}). Also provide a text_summary field.",
    "mortgage_application": "Extract mortgage application details. Return JSON with fields: primary_applicant, co_applicant, subject_property, loan_amount, down_payment, assets_summary, liabilities_summary, application_date. Also provide a text_summary field.",
    "utility_bills": "Extract utility bill information. Return JSON with fields: bills (array of {provider, service_type, billing_period, amount_due, account_holder, service_address}). Also provide a text_summary field.",
    "credit_report": "Extract credit report information. Return JSON with fields: reports (array of {person_name, credit_score, score_range, accounts (array of {creditor, balance, status}), total_outstanding, payment_history_summary, inquiries, derogatory_items}). Also provide a text_summary field.",
    "car_loan_statement": "Extract auto loan details. Return JSON with fields: vehicle, original_loan_amount, current_balance, monthly_payment, interest_rate, remaining_payments, maturity_date, payment_history. Also provide a text_summary field.",
    "property_tax": "Extract property tax information. Return JSON with fields: property_address, assessed_value, annual_tax, monthly_equivalent, tax_year, payment_status. Also provide a text_summary field.",
    "property_inspection": "Extract home inspection details. Return JSON with fields: property_address, inspection_date, inspector, overall_assessment, key_findings, systems_reviewed. Also provide a text_summary field.",
}


def _get_bedrock_client():
    """Get a Bedrock runtime client."""
    return boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )


def extract_from_pdf(pdf_path: Path, doc_type: str) -> dict:
    """Extract structured data from a PDF using Bedrock Claude.

    Args:
        pdf_path: Path to the PDF file
        doc_type: Document type key (e.g., 'government_id', 'employment_letter')

    Returns:
        dict with extracted structured data and text_summary
    """
    client = _get_bedrock_client()
    model_id = os.getenv("CHATCOMPLETIONS_MODEL_ID")

    if not model_id:
        raise EnvironmentError("CHATCOMPLETIONS_MODEL_ID not set")

    pdf_bytes = pdf_path.read_bytes()
    prompt = EXTRACTION_PROMPTS.get(
        doc_type,
        "Extract all structured data from this document. Return JSON with relevant fields and a text_summary field."
    )

    try:
        response = client.converse(
            modelId=model_id,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "document": {
                            "format": "pdf",
                            "name": pdf_path.stem,
                            "source": {"bytes": pdf_bytes},
                        }
                    },
                    {
                        "text": f"{prompt}\n\nReturn ONLY valid JSON, no markdown formatting."
                    }
                ]
            }],
            inferenceConfig={"maxTokens": 4096, "temperature": 0.0},
        )
    except Exception as e:
        logger.error(f"Bedrock extraction call failed for {pdf_path.name}: {e}")
        return {"error": str(e), "text_summary": f"Extraction failed: {str(e)[:200]}"}

    try:
        result_text = response["output"]["message"]["content"][0]["text"]
    except (KeyError, IndexError, TypeError) as e:
        logger.warning(f"Unexpected Bedrock response structure for {pdf_path.name}: {e}")
        return {"error": str(e), "text_summary": "Extraction produced unexpected response format"}
    # Strip markdown code fences if present
    result_text = result_text.strip()
    result_text = re.sub(r"^```[a-z]*\n?", "", result_text)
    result_text = re.sub(r"\n?```$", "", result_text)

    try:
        return json.loads(result_text)
    except (json.JSONDecodeError, ValueError) as e:
        logging.getLogger(__name__).warning(f"JSON parse failed for {doc_type}: {e}")
        return {"error": str(e), "text_summary": result_text, "raw_response": result_text[:2000]}
