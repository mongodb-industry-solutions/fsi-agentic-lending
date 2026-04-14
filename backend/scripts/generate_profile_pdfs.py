"""
Generate 14 synthetic PDF documents for each borrower profile.
Matches the visual style of Marcus Delgado's existing PDFs.

Usage:
    cd backend && uv run python -m scripts.generate_profile_pdfs              # all profiles
    cd backend && uv run python -m scripts.generate_profile_pdfs sarah-williams  # single profile
"""

import os
from fpdf import FPDF


def _sanitize(text):
    """Replace unicode chars that latin-1 (fpdf2 core font encoding) cannot handle."""
    if not isinstance(text, str):
        return text
    return (text
            .replace("\u2014", "--")   # em dash
            .replace("\u2013", "-")    # en dash
            .replace("\u2019", "'")    # right single quote
            .replace("\u2018", "'")    # left single quote
            .replace("\u201c", '"')    # left double quote
            .replace("\u201d", '"')    # right double quote
            .replace("\u00bc", "1/4")  # fraction
            .replace("\u00bd", "1/2")
            .replace("\u00be", "3/4")
            .replace("\u2022", "*")    # bullet
            .replace("\u00b0", " deg") # degree
            .replace("\u2026", "...")  # ellipsis
            )

# ── Paths ──────────────────────────────────────────────────────────────────
DOCS_ROOT = os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "synthetic data"
)

# ── Colors ─────────────────────────────────────────────────────────────────
DARK_BLUE = (27, 58, 92)       # #1B3A5C
GOLD = (201, 150, 59)          # #C9963B
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
LIGHT_GRAY = (245, 245, 245)
MEDIUM_GRAY = (220, 220, 220)
DARK_GRAY = (80, 80, 80)
CRA_RED = (185, 28, 28)
BANK_GREEN = (46, 100, 56)
EQUIFAX_DARK = (30, 20, 50)
EQUIFAX_GREEN = (46, 139, 87)
SCOTIA_RED = (185, 28, 28)
INSPECTION_GREEN = (56, 102, 65)
UTIL_BROWN = (101, 67, 33)


# ══════════════════════════════════════════════════════════════════════════════
#  StyledPDF -- Reusable FPDF subclass
# ══════════════════════════════════════════════════════════════════════════════
class StyledPDF(FPDF):
    """Base PDF class matching the Marcus Delgado document style."""

    def __init__(self, company_name="", doc_title="", header_color=DARK_BLUE,
                 footer_text="SYNTHETIC DOCUMENT -- FOR DEMONSTRATION PURPOSES ONLY",
                 footer_extra=""):
        super().__init__(orientation="P", unit="mm", format="Letter")
        self.company_name = company_name
        self.doc_title = doc_title
        self.header_color = header_color
        self.footer_text = footer_text
        self.footer_extra = footer_extra
        self.set_auto_page_break(auto=True, margin=25)

    def cell(self, w=None, h=None, text="", *args, **kwargs):
        return super().cell(w, h, _sanitize(text), *args, **kwargs)

    def multi_cell(self, w, h=None, text="", *args, **kwargs):
        return super().multi_cell(w, h, _sanitize(text), *args, **kwargs)

    # ── Header ─────────────────────────────────────────────────────────
    def header(self):
        self.set_fill_color(*self.header_color)
        self.rect(0, 0, self.w, 28, "F")
        self.set_xy(10, 5)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 8, self.company_name, ln=True)
        self.set_xy(10, 13)
        self.set_font("Helvetica", "", 8)
        if hasattr(self, "header_sub"):
            self.cell(0, 4, self.header_sub, ln=True)
        # Doc title right-aligned
        self.set_xy(self.w - 80, 5)
        self.set_text_color(*GOLD)
        self.set_font("Helvetica", "B", 11)
        self.cell(70, 7, self.doc_title, align="R")
        if hasattr(self, "header_ref"):
            self.set_xy(self.w - 80, 12)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*WHITE)
            self.cell(70, 4, self.header_ref, align="R")
        if hasattr(self, "header_date"):
            self.set_xy(self.w - 80, 16)
            self.set_font("Helvetica", "", 7)
            self.cell(70, 4, self.header_date, align="R")
        self.set_text_color(*BLACK)
        self.set_y(32)

    # ── Footer ─────────────────────────────────────────────────────────
    def footer(self):
        self.set_y(-18)
        self.set_fill_color(*self.header_color)
        self.rect(0, self.h - 18, self.w, 18, "F")
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "I", 7)
        if self.footer_extra:
            self.cell(0, 4, self.footer_extra, align="C", ln=True)
        self.set_font("Helvetica", "B", 7)
        self.cell(0, 4, self.footer_text, align="C")

    # ── Helpers ────────────────────────────────────────────────────────
    def section_header(self, title, color=DARK_BLUE):
        self.set_fill_color(*color)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 7, f"  {title}", fill=True, ln=True)
        self.set_text_color(*BLACK)
        self.ln(1)

    def gold_section(self, title):
        self.section_header(title, GOLD)

    def label_value_row(self, label, value, lw=55):
        self.set_font("Helvetica", "B", 8)
        self.cell(lw, 5, f"  {label}", border=0)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, str(value), ln=True)

    def table_header(self, cols, widths, color=DARK_BLUE):
        self.set_fill_color(*color)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 7)
        for i, col in enumerate(cols):
            self.cell(widths[i], 6, f" {col}", fill=True)
        self.ln()
        self.set_text_color(*BLACK)

    def table_row(self, cols, widths, bold_cols=None, fill=False):
        if fill:
            self.set_fill_color(*LIGHT_GRAY)
        for i, col in enumerate(cols):
            if bold_cols and i in bold_cols:
                self.set_font("Helvetica", "B", 7)
            else:
                self.set_font("Helvetica", "", 7)
            self.cell(widths[i], 5, f" {col}", fill=fill)
        self.ln()

    def info_box(self, lines, x=None, y=None, w=None):
        if x is not None:
            self.set_xy(x, y)
        bx = self.get_x()
        by = self.get_y()
        bw = w or (self.w - 20)
        self.set_draw_color(*DARK_BLUE)
        self.set_line_width(0.4)
        h = len(lines) * 5 + 4
        self.rect(bx, by, bw, h)
        self.set_xy(bx + 2, by + 2)
        for line in lines:
            if isinstance(line, tuple):
                self.set_font("Helvetica", "B", 8)
                self.cell(0, 5, line[0], ln=True)
            else:
                self.set_font("Helvetica", "", 7)
                self.cell(0, 5, line, ln=True)
        self.set_xy(bx, by + h + 2)

    def gold_banner(self, text, value):
        self.set_fill_color(*GOLD)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 10)
        self.cell(self.w / 2 - 10, 9, f"  {text}", fill=True)
        self.set_font("Helvetica", "B", 14)
        self.cell(self.w / 2 - 10, 9, value, fill=True, align="R")
        self.ln()
        self.set_text_color(*BLACK)
        self.ln(2)

    def check_page_space(self, needed_mm=40):
        if self.get_y() > self.h - needed_mm:
            self.add_page()


# ══════════════════════════════════════════════════════════════════════════════
#  Profile Data
# ══════════════════════════════════════════════════════════════════════════════
PROFILES = {
    "jane-doe": {
        "slug": "jane-doe",
        "province": "BC",
        "prov_long": "British Columbia",
        "has_co_applicant": True,
        "applicant": {
            "full_name": "Jane Marie Doe",
            "last": "DOE", "first": "JANE MARIE",
            "short_name": "Jane M. Doe",
            "dob": "1992-03-14", "sex": "F", "height": "5'7\"",
            "address": "2150 Marine Drive, Apt 804, West Vancouver, BC V7V 1K4",
            "city": "West Vancouver", "prov": "BC", "pc": "V7V 1K4",
            "sin": "483-621-XXX",
            "email": "j.doe@pacificcoastmed.ca",
            "phone": "(604) 555-0184",
            "id_number": "BC-7241-5583-JMD",
            "id_expires": "2029-03-14",
            "employer": "Pacific Coast Medical Group",
            "employer_addr": "4580 Marine Drive, West Vancouver, BC V7V 1N6",
            "employer_phone": "(604) 555-0210",
            "employer_dept": "Primary Care",
            "position": "Nurse Practitioner",
            "emp_start": "March 15, 2019",
            "emp_start_short": "03/15/2019",
            "emp_years": "5 yrs / 11 mos",
            "salary": 95000,
            "hr_name": "Karen L. Whitfield",
            "hr_title": "Director, Human Resources",
            "emp_id": "PCM-5583",
            "noa_2024_employment": 95000,
            "noa_2024_other": 1800,
            "noa_2024_rrsp": 5000,
            "noa_2024_other_ded": 1200,
            "noa_2023_employment": 91000,
            "noa_2023_other": 1500,
            "noa_2023_rrsp": 4000,
            "noa_2023_other_ded": 1000,
            "credit_score": 798,
            "credit_rating": "740-850 -- EXCELLENT",
            "credit_accounts": [
                ("TD Visa", "Revolving", "Jun 2018", "Open", "$8,000", "$1,200", "$0", "On Time"),
                ("RBC Line of Credit", "Revolving", "Sep 2020", "Open", "$15,000", "$0", "$0", "On Time"),
            ],
            "credit_open": 2,
            "credit_balance": "$1,200.00",
            "credit_history": "100% on-time payments (last 6 years)",
            "credit_derogatory": "None",
            "credit_collections": "None on file",
            "credit_bankruptcies": "None on file",
            "credit_inquiries": [
                ("Feb 18, 2025", "Axiom Mortgage Solutions (Mortgage Application)", "Hard Inquiry"),
            ],
            "rrsp_value": 35000,
            "rrsp_institution": "RBC Direct Investing",
            "rrsp_acct": "RBC-RRSP-7241-JD",
        },
        "co_applicant": {
            "full_name": "John Robert Doe",
            "last": "DOE", "first": "JOHN ROBERT",
            "short_name": "John R. Doe",
            "dob": "1990-08-22", "sex": "M", "height": "5'10\"",
            "address": "2150 Marine Drive, Apt 804, West Vancouver, BC V7V 1K4",
            "city": "West Vancouver", "prov": "BC", "pc": "V7V 1K4",
            "sin": "518-734-XXX",
            "email": "j.doe@doeaccounting.ca",
            "phone": "(604) 555-0297",
            "id_number": "BC-8392-6147-JRD",
            "id_expires": "2029-08-22",
            "employer": "Doe & Associates Accounting",
            "employer_addr": "900 W Georgia St, Ste 1200, Vancouver, BC V6C 2W6",
            "employer_phone": "(604) 555-0345",
            "employer_dept": "Tax Advisory",
            "position": "Senior Accountant",
            "emp_start": "June 1, 2018",
            "emp_start_short": "06/01/2018",
            "emp_years": "6 yrs / 9 mos",
            "salary": 70000,
            "hr_name": "Michael P. Santos",
            "hr_title": "Managing Partner",
            "emp_id": "DA-6147",
            "noa_2024_employment": 70000,
            "noa_2024_other": 1200,
            "noa_2024_rrsp": 4000,
            "noa_2024_other_ded": 800,
            "noa_2023_employment": 67000,
            "noa_2023_other": 1000,
            "noa_2023_rrsp": 3500,
            "noa_2023_other_ded": 700,
            "credit_score": 772,
            "credit_rating": "740-850 -- EXCELLENT",
            "credit_accounts": [
                ("CIBC Visa", "Revolving", "Mar 2017", "Open", "$6,000", "$800", "$0", "On Time"),
                ("Student Loan (NSLSC)", "Installment", "Sep 2012", "Open", "$35,000", "$12,000", "$550/mo", "On Time"),
            ],
            "credit_open": 2,
            "credit_balance": "$12,800.00",
            "credit_history": "100% on-time payments (last 7 years)",
            "credit_derogatory": "None",
            "credit_collections": "None on file",
            "credit_bankruptcies": "None on file",
            "credit_inquiries": [
                ("Feb 18, 2025", "Axiom Mortgage Solutions (Mortgage Application)", "Hard Inquiry"),
            ],
            "rrsp_value": 20000,
            "rrsp_institution": "TD Direct Investing",
            "rrsp_acct": "TD-RRSP-8392-JD",
        },
        "property": {
            "address": "1438 Garden Terrace, Burnaby, BC V5A 3G2",
            "city": "Burnaby", "prov": "BC", "pc": "V5A 3G2",
            "type": "Townhouse", "style": "Three-Level",
            "price": 425000, "beds": 3, "baths": 2.5, "sqft": 1680,
            "year_built": 2015, "lot_size": "2,100 sq ft",
            "legal_desc": "Strata Plan BCS4218, Lot 14, District Lot 86, New Westminster",
            "condo_fee": "$285/mo",
        },
        "mortgage": {
            "down_payment": 85000, "down_pct": 20, "loan": 340000,
        },
        "bank": {
            "institution": "RBC Royal Bank",
            "branch": "1500 Marine Drive, West Vancouver, BC V7V 1H8",
            "phone": "(604) 555-0120",
            "acct": "****-****-4218", "transit": "00247", "inst": "003",
            "savings": 92400,
        },
        "car": {
            "year": 2022, "make": "Toyota", "model": "Corolla LE",
            "vin": "2T1BURHE8NC198473",
            "color": "Classic Silver Metallic",
            "licence": "BC  JD-4218",
            "dealer": "Jim Pattison Toyota, North Vancouver",
            "purchase_date": "March 20, 2022",
            "original": 24000, "balance": 8500, "monthly": 195,
            "rate": 3.49, "term": "60 months (Mar 2022 - Mar 2027)",
            "payments_made": 35, "payments_total": 60, "payments_remaining": 25,
            "lender": "Toyota Financial Services",
            "lender_addr": "80 Micro Court, Ste 200, Markham, ON L3R 9Z5",
        },
        "prop_tax": {
            "municipality": "City of Burnaby",
            "muni_addr": "4949 Canada Way, Burnaby, BC V5G 1M2",
            "phone": "311 or (604) 294-7944",
            "website": "burnaby.ca/property-tax",
            "annual_tax": 3950, "assessed_value": 440000,
            "roll_number": "0842-31567-100-02",
            "prev_assessed": 415000,
        },
        "utilities": [
            {
                "company": "BC Hydro",
                "addr": "333 Dunsmuir St, Vancouver, BC V6B 5R3",
                "phone": "1-800-224-9376",
                "website": "bchydro.com",
                "bill_type": "ELECTRIC BILL",
                "acct": "BCH-ACT-42181-2025",
                "amount": 142.00,
                "prev_paid": 138.50,
            },
            {
                "company": "FortisBC",
                "addr": "16705 Fraser Hwy, Surrey, BC V4N 0E8",
                "phone": "1-888-224-2710",
                "website": "fortisbc.com",
                "bill_type": "NATURAL GAS BILL",
                "acct": "FBC-GAS-84273-RES",
                "amount": 85.00,
                "prev_paid": 82.00,
            },
        ],
        "inspection": {
            "company": "PillarToPost Home Inspectors",
            "company_addr": "Suite 100, 4700 Kingsway, Burnaby, BC V5H 4M1",
            "phone": "(604) 555-8844",
            "inspector": "Sarah J. Nakamura",
            "lic": "BC-RHI-08847",
            "report_num": "PTP-BUR-2025-00184",
            "date": "March 2, 2025",
            "time": "10:00 AM - 12:30 PM (2.5 hrs)",
            "weather": "Overcast, 8C, light rain earlier, dry during inspection",
            "overall": "GOOD CONDITION -- Minor Items Noted",
            "overall_detail": "This townhouse is in good overall condition for its age (10 years). No major structural, safety, or mechanical deficiencies were identified.",
            "findings_monitor": [
                "Some exterior deck boards show weathering -- recommend sealing within 12 months (~$400-$600)",
                "One bathroom exhaust fan running slow -- clean or replace motor (~$80-$150)",
            ],
            "findings_maintenance": [
                "Annual HVAC servicing recommended -- currently up to date",
                "Recommend re-caulking exterior window perimeters during dry weather",
            ],
        },
        "id_authority": "ServiceBC",
        "id_authority_addr": "Service BC, 4946 Canada Way, Burnaby, BC V5G 4J6",
        "id_authority_phone": "1-800-663-7867",
        "id_authority_web": "gov.bc.ca/servicebc",
        "purchase_brokerage": "RE/MAX Crest Realty",
        "purchase_brokerage_addr": "1428 W 7th Ave, Vancouver, BC V6H 1C1",
        "purchase_brokerage_phone": "(604) 555-3344",
        "seller_name": "Westwood Strata Holdings Ltd. (James & Linda Park)",
        "seller_addr": "8821 Greenwood Crescent, Burnaby, BC V5A 1T7",
        "seller_brokerage": "Sutton Group -- West Coast Realty",
        "buyer_realtor": "Angela K. Chen",
        "seller_realtor": "Brian D. O'Leary",
        "contract_ref": "RMX-BUR-2025-00184",
        "existing_property_text": "No other real property owned.",
    },

    "john-smith": {
        "slug": "john-smith",
        "province": "ON",
        "prov_long": "Ontario",
        "has_co_applicant": False,
        "applicant": {
            "full_name": "John Richard Smith",
            "last": "SMITH", "first": "JOHN RICHARD",
            "short_name": "John R. Smith",
            "dob": "1994-11-07", "sex": "M", "height": "6'0\"",
            "address": "88 Harbour Street, Unit 1207, Toronto, ON M5J 2L4",
            "city": "Toronto", "prov": "ON", "pc": "M5J 2L4",
            "sin": "592-147-XXX",
            "email": "j.smith@meridiancreative.ca",
            "phone": "(416) 555-0372",
            "id_number": "ON-6184-2293-JRS",
            "id_expires": "2029-11-07",
            "employer": "Meridian Creative Agency",
            "employer_addr": "151 Front Street W, Ste 400, Toronto, ON M5J 2N1",
            "employer_phone": "(416) 555-0488",
            "employer_dept": "Strategy & Marketing",
            "position": "Marketing Manager",
            "emp_start": "January 6, 2024",
            "emp_start_short": "01/06/2024",
            "emp_years": "1 yr / 2 mos",
            "salary": 108000,
            "hr_name": "Priya R. Mehta",
            "hr_title": "Director, People Operations",
            "emp_id": "MCA-2293",
            "noa_2024_employment": 108000,
            "noa_2024_other": 2400,
            "noa_2024_rrsp": 6000,
            "noa_2024_other_ded": 1500,
            "noa_2023_employment": 95000,
            "noa_2023_other": 1800,
            "noa_2023_rrsp": 5000,
            "noa_2023_other_ded": 1200,
            "credit_score": 695,
            "credit_rating": "660-724 -- FAIR",
            "credit_accounts": [
                ("BMO Mastercard", "Revolving", "Apr 2020", "Open", "$10,000", "$3,200", "$96/mo", "Fair -- 2 late 30+"),
                ("Honda Financial", "Installment", "May 2021", "Open", "$26,000", "$8,500", "$195/mo", "On Time"),
                ("Student Loan (OSAP)", "Installment", "Sep 2016", "Open", "$28,000", "$4,800", "$109/mo", "On Time"),
            ],
            "credit_open": 3,
            "credit_balance": "$16,500.00",
            "credit_history": "2 late payments 30+ days in 2025",
            "credit_derogatory": "2 late payments",
            "credit_collections": "None on file",
            "credit_bankruptcies": "None on file",
            "credit_inquiries": [
                ("Jan 10, 2026", "TD Bank (Personal Loan Inquiry)", "Hard Inquiry"),
                ("Feb 5, 2026", "Scotiabank (Mortgage Pre-Approval)", "Hard Inquiry"),
                ("Feb 18, 2025", "Axiom Mortgage Solutions (Mortgage Application)", "Hard Inquiry"),
            ],
            "rrsp_value": 0,
            "rrsp_institution": "",
            "rrsp_acct": "",
            "tfsa_value": 15000,
            "tfsa_institution": "Wealthsimple",
            "tfsa_acct": "WS-TFSA-6184-JS",
        },
        "co_applicant": None,
        "property": {
            "address": "55 Bremner Blvd, Unit 3402, Toronto, ON M5J 0A6",
            "city": "Toronto", "prov": "ON", "pc": "M5J 0A6",
            "type": "Condominium", "style": "High-Rise",
            "price": 490000, "beds": "1+den", "baths": 1, "sqft": 720,
            "year_built": 2018, "lot_size": "N/A",
            "legal_desc": "Unit 3402, Level 34, TSCC 2847, Toronto",
            "condo_fee": "$520/mo",
        },
        "mortgage": {
            "down_payment": 98000, "down_pct": 20, "loan": 392000,
        },
        "bank": {
            "institution": "Scotiabank",
            "branch": "44 King Street West, Toronto, ON M5H 1H1",
            "phone": "(416) 555-0201",
            "acct": "****-****-6391", "transit": "47216", "inst": "002",
            "savings": 105200,
        },
        "car": {
            "year": 2021, "make": "Honda", "model": "Civic Sport",
            "vin": "2HGFE2F59MH514823",
            "color": "Sonic Grey Pearl",
            "licence": "Ontario  CZKS 814",
            "dealer": "Markham Honda, Markham ON",
            "purchase_date": "May 10, 2021",
            "original": 26000, "balance": 8500, "monthly": 195,
            "rate": 4.49, "term": "72 months (May 2021 - May 2027)",
            "payments_made": 45, "payments_total": 72, "payments_remaining": 27,
            "lender": "Honda Financial Services",
            "lender_addr": "180 Honda Blvd, Markham, ON L6C 0H9",
        },
        "prop_tax": {
            "municipality": "City of Toronto",
            "muni_addr": "5100 Yonge Street, Toronto, ON M2N 5V7",
            "phone": "311 or (416) 338-4829",
            "website": "toronto.ca/property-tax",
            "annual_tax": 4200, "assessed_value": 475000,
            "roll_number": "1904-287-340-02100",
            "prev_assessed": 460000,
        },
        "utilities": [
            {
                "company": "Toronto Hydro",
                "addr": "14 Carlton Street, Toronto, ON M5B 1K5",
                "phone": "(416) 542-8000",
                "website": "torontohydro.com",
                "bill_type": "ELECTRIC BILL",
                "acct": "TH-ACT-63912-2025",
                "amount": 95.00,
                "prev_paid": 92.00,
            },
            {
                "company": "Enbridge Gas",
                "addr": "500 Consumers Road, Toronto, ON M2J 1P8",
                "phone": "1-877-362-7434",
                "website": "enbridgegas.com",
                "bill_type": "NATURAL GAS BILL",
                "acct": "ENB-GAS-47293-RES",
                "amount": 68.00,
                "prev_paid": 65.00,
            },
        ],
        "inspection": {
            "company": "PillarToPost Home Inspectors",
            "company_addr": "Suite 300, 2200 Yonge Street, Toronto, ON M4S 2C6",
            "phone": "(416) 555-8844",
            "inspector": "Marcus A. Williams",
            "lic": "ON-RHI-12847",
            "report_num": "PTP-TOR-2025-00372",
            "date": "March 3, 2025",
            "time": "2:00 PM - 4:00 PM (2 hrs)",
            "weather": "Clear, 2C, dry conditions",
            "overall": "GOOD CONDITION -- Minor Items Noted",
            "overall_detail": "This condo unit is in good overall condition for its age (7 years). No major structural, safety, or mechanical deficiencies were identified.",
            "findings_monitor": [
                "Some grout cracking in bathroom tile -- re-grout within 6 months (~$150-$250)",
                "Balcony sliding door track needs cleaning and lubrication -- minor maintenance item",
            ],
            "findings_maintenance": [
                "Bathroom exhaust fan filter should be cleaned quarterly",
                "Recommend checking caulking around bathtub annually",
            ],
        },
        "id_authority": "ServiceOntario",
        "id_authority_addr": "ServiceOntario, 777 Bay Street, Toronto, ON M5G 2C8",
        "id_authority_phone": "1-800-267-8097",
        "id_authority_web": "ontario.ca/serviceontario",
        "purchase_brokerage": "Royal LePage Signature Realty",
        "purchase_brokerage_addr": "477 Mount Pleasant Road, Toronto, ON M4S 2L9",
        "purchase_brokerage_phone": "(416) 555-7200",
        "seller_name": "CityView Developments Inc. (Resale via David & Sarah Kim)",
        "seller_addr": "55 Bremner Blvd, Unit 2201, Toronto, ON M5J 0A6",
        "seller_brokerage": "Harvey Kalles Real Estate Ltd.",
        "buyer_realtor": "Derek M. Patel",
        "seller_realtor": "Jennifer L. Wong",
        "contract_ref": "RLP-TOR-2025-00372",
        "existing_property_text": "No other real property owned.",
    },

    "bob-johnson": {
        "slug": "bob-johnson",
        "province": "ON",
        "prov_long": "Ontario",
        "has_co_applicant": True,
        "applicant": {
            "full_name": "Bob Thomas Johnson",
            "last": "JOHNSON", "first": "BOB THOMAS",
            "short_name": "Bob T. Johnson",
            "dob": "1986-05-30", "sex": "M", "height": "5'9\"",
            "address": "312 Lakeshore Road E, Oakville, ON L6J 1J6",
            "city": "Oakville", "prov": "ON", "pc": "L6J 1J6",
            "sin": "647-382-XXX",
            "email": "b.johnson@greatlakeslogistics.ca",
            "phone": "(905) 555-0463",
            "id_number": "ON-3847-9215-BTJ",
            "id_expires": "2029-05-30",
            "employer": "Great Lakes Logistics Ltd.",
            "employer_addr": "2085 Speers Road, Oakville, ON L6L 2X5",
            "employer_phone": "(905) 555-0710",
            "employer_dept": "Operations",
            "position": "Operations Coordinator",
            "emp_start": "April 1, 2023",
            "emp_start_short": "04/01/2023",
            "emp_years": "2 yrs / 0 mos",
            "salary": 85000,
            "hr_name": "Thomas R. Gallagher",
            "hr_title": "Director, Human Resources",
            "emp_id": "GLL-9215",
            "noa_2024_employment": 85000,
            "noa_2024_other": 1500,
            "noa_2024_rrsp": 3000,
            "noa_2024_other_ded": 900,
            "noa_2023_employment": 82000,
            "noa_2023_other": 1200,
            "noa_2023_rrsp": 2500,
            "noa_2023_other_ded": 800,
            "credit_score": 648,
            "credit_rating": "580-659 -- POOR",
            "credit_accounts": [
                ("TD Visa Infinite", "Revolving", "Jan 2019", "Open", "$20,000", "$18,000", "$540/mo", "Fair -- 3 late 30+"),
                ("Ford Credit F-150", "Installment", "Jun 2023", "Open", "$52,000", "$38,000", "$720/mo", "Fair -- 2 late 30+"),
                ("CIBC Personal LOC", "Revolving", "Mar 2021", "Open", "$30,000", "$25,000", "$625/mo", "Fair"),
                ("Furniture Financing", "Installment", "Aug 2024", "Open", "$6,000", "$6,000", "$200/mo", "Good"),
            ],
            "credit_open": 4,
            "credit_balance": "$87,000.00",
            "credit_history": "5 late payments 30+ days, 1 payment 60+ days (2025)",
            "credit_derogatory": "5 late 30+, 1 late 60+",
            "credit_collections": "Bell Canada $2,400 (Jun 2025, unpaid)",
            "credit_bankruptcies": "None on file",
            "credit_inquiries": [
                ("Nov 15, 2025", "RBC (Personal Loan Inquiry)", "Hard Inquiry"),
                ("Dec 10, 2025", "National Bank (Mortgage Pre-Approval)", "Hard Inquiry"),
                ("Jan 20, 2026", "First National (Mortgage Application)", "Hard Inquiry"),
            ],
            "rrsp_value": 30000,
            "rrsp_institution": "TD Direct Investing",
            "rrsp_acct": "TD-RRSP-3847-BJ",
        },
        "co_applicant": {
            "full_name": "Alice Marie Johnson",
            "last": "JOHNSON", "first": "ALICE MARIE",
            "short_name": "Alice M. Johnson",
            "dob": "1988-12-19", "sex": "F", "height": "5'5\"",
            "address": "312 Lakeshore Road E, Oakville, ON L6J 1J6",
            "city": "Oakville", "prov": "ON", "pc": "L6J 1J6",
            "sin": "731-492-XXX",
            "email": "a.johnson@hdsb.ca",
            "phone": "(905) 555-0518",
            "id_number": "ON-5291-7483-AMJ",
            "id_expires": "2029-12-19",
            "employer": "Halton District School Board",
            "employer_addr": "2050 Guelph Line, Burlington, ON L7P 5A8",
            "employer_phone": "(905) 555-0820",
            "employer_dept": "Education -- Supply Teaching",
            "position": "Supply Teacher",
            "emp_start": "September 1, 2021",
            "emp_start_short": "09/01/2021",
            "emp_years": "3 yrs / 6 mos",
            "salary": 50000,
            "hr_name": "Rebecca S. Thompson",
            "hr_title": "Manager, Human Resources",
            "emp_id": "HDSB-7483",
            "noa_2024_employment": 50000,
            "noa_2024_other": 800,
            "noa_2024_rrsp": 2000,
            "noa_2024_other_ded": 600,
            "noa_2023_employment": 48000,
            "noa_2023_other": 600,
            "noa_2023_rrsp": 1500,
            "noa_2023_other_ded": 500,
            "credit_score": 612,
            "credit_rating": "580-659 -- POOR",
            "credit_accounts": [
                ("RBC Visa", "Revolving", "Feb 2018", "Open", "$15,000", "$12,000", "$360/mo", "Fair -- 2 late 30+"),
                ("Student Loan (OSAP)", "Installment", "Sep 2010", "Open", "$40,000", "$28,000", "$520/mo", "Good"),
                ("Retail Store Card", "Revolving", "Nov 2023", "Open", "$5,000", "$3,500", "$105/mo", "Fair -- 1 late 30+"),
            ],
            "credit_open": 3,
            "credit_balance": "$43,500.00",
            "credit_history": "3 late payments 30+ days (2025-2026)",
            "credit_derogatory": "3 late 30+",
            "credit_collections": "None on file",
            "credit_bankruptcies": "None on file",
            "credit_inquiries": [
                ("Jan 20, 2026", "First National (Mortgage Application)", "Hard Inquiry"),
            ],
            "rrsp_value": 0,
            "rrsp_institution": "",
            "rrsp_acct": "",
        },
        "property": {
            "address": "27 Chartwell Crescent, Oakville, ON L6J 3Z8",
            "city": "Oakville", "prov": "ON", "pc": "L6J 3Z8",
            "type": "Single-Family Detached", "style": "Two-Storey",
            "price": 1200000, "beds": 4, "baths": 3, "sqft": 2850,
            "year_built": 1992, "lot_size": "7,200 sq ft",
            "legal_desc": "Plan 20M-847, Lot 42, Town of Oakville, Halton Region",
            "condo_fee": "N/A",
        },
        "mortgage": {
            "down_payment": 240000, "down_pct": 20, "loan": 960000,
        },
        "bank": {
            "institution": "TD Canada Trust",
            "branch": "234 Lakeshore Road E, Oakville, ON L6J 1H8",
            "phone": "(905) 555-0180",
            "acct": "****-****-8503", "transit": "23418", "inst": "004",
            "savings": 252000,
        },
        "car": {
            "year": 2023, "make": "Ford", "model": "F-150 XLT 4x4",
            "vin": "1FTFW1E82PFA84721",
            "color": "Oxford White",
            "licence": "Ontario  BVTN 247",
            "dealer": "Budds Ford Lincoln, Oakville ON",
            "purchase_date": "June 15, 2023",
            "original": 52000, "balance": 38000, "monthly": 720,
            "rate": 5.99, "term": "84 months (Jun 2023 - Jun 2030)",
            "payments_made": 20, "payments_total": 84, "payments_remaining": 64,
            "lender": "Ford Credit Canada",
            "lender_addr": "The Canadian Road, Oakville, ON L6J 5C7",
        },
        "prop_tax": {
            "municipality": "Town of Oakville",
            "muni_addr": "1225 Trafalgar Road, Oakville, ON L6H 0H3",
            "phone": "311 or (905) 845-6601",
            "website": "oakville.ca/property-tax",
            "annual_tax": 9200, "assessed_value": 1100000,
            "roll_number": "2425-041-027-08400",
            "prev_assessed": 1050000,
        },
        "utilities": [
            {
                "company": "Oakville Hydro",
                "addr": "861 Redwood Square, Oakville, ON L6J 7V5",
                "phone": "(905) 825-9400",
                "website": "oakvillehydro.com",
                "bill_type": "ELECTRIC BILL",
                "acct": "OH-ACT-85031-2025",
                "amount": 185.00,
                "prev_paid": 178.00,
            },
            {
                "company": "Union Gas (Enbridge)",
                "addr": "500 Consumers Road, Toronto, ON M2J 1P8",
                "phone": "1-888-774-3111",
                "website": "uniongas.com",
                "bill_type": "NATURAL GAS BILL",
                "acct": "UG-GAS-39274-RES",
                "amount": 125.00,
                "prev_paid": 118.00,
            },
        ],
        "inspection": {
            "company": "PillarToPost Home Inspectors",
            "company_addr": "Suite 200, 2501 Third Line, Oakville, ON L6H 7L4",
            "phone": "(905) 555-8844",
            "inspector": "Robert K. Fitzgerald",
            "lic": "ON-RHI-09421",
            "report_num": "PTP-OAK-2025-00463",
            "date": "March 4, 2025",
            "time": "9:00 AM - 1:00 PM (4 hrs)",
            "weather": "Overcast, -2C, dry conditions, no snow",
            "overall": "FAIR CONDITION -- Multiple Items Require Attention",
            "overall_detail": "This 33-year-old detached home shows signs of deferred maintenance. Several systems are original and approaching or past typical service life. Foundation and HVAC concerns warrant attention.",
            "findings_immediate": [
                "Foundation hairline cracks observed on east wall -- recommend structural engineer assessment (~$500 consultation)",
            ],
            "findings_monitor": [
                "HVAC system original 1992 -- replacement recommended within 2-3 years (~$8,000-$12,000)",
                "Several window seals broken (3 of 14 windows) -- condensation between panes, budget for replacement (~$3,000-$5,000)",
                "Roof approximately 15 years old -- approaching end of useful life, budget for replacement within 3-5 years (~$12,000-$18,000)",
            ],
            "findings_maintenance": [
                "Eavestroughs need cleaning and re-pitching on north side",
                "Exterior wood trim showing paint peeling -- repaint recommended within 12 months",
                "Basement sump pump should be tested quarterly -- currently functional",
            ],
        },
        "id_authority": "ServiceOntario",
        "id_authority_addr": "ServiceOntario, 777 Bay Street, Toronto, ON M5G 2C8",
        "id_authority_phone": "1-800-267-8097",
        "id_authority_web": "ontario.ca/serviceontario",
        "purchase_brokerage": "RE/MAX Aboutowne Realty",
        "purchase_brokerage_addr": "124 Lakeshore Road E, Oakville, ON L6J 1H4",
        "purchase_brokerage_phone": "(905) 555-4400",
        "seller_name": "Estate of Harold G. Patterson (Executor: Susan Patterson)",
        "seller_addr": "27 Chartwell Crescent, Oakville, ON L6J 3Z8",
        "seller_brokerage": "Coldwell Banker -- The Real Estate Centre",
        "buyer_realtor": "Natasha P. Romanov",
        "seller_realtor": "William J. Hendricks",
        "contract_ref": "RMX-OAK-2025-00463",
        "existing_property_text": "No other real property owned.",
    },

    "sarah-williams": {
        "slug": "sarah-williams",
        "province": "ON",
        "prov_long": "Ontario",
        "has_co_applicant": False,
        "applicant": {
            "full_name": "Sarah Katherine Williams",
            "last": "WILLIAMS", "first": "SARAH KATHERINE",
            "short_name": "Sarah K. Williams",
            "dob": "1993-07-18", "sex": "F", "height": "5'8\"",
            "address": "45 Sparks Street, Unit 1504, Ottawa, ON K1P 5A5",
            "city": "Ottawa", "prov": "ON", "pc": "K1P 5A5",
            "sin": "641-829-XXX",
            "email": "s.williams@shopify.com",
            "phone": "(613) 555-0241",
            "id_number": "ON-7641-2293-SKW",
            "id_expires": "2029-07-18",
            "employer": "Shopify Inc.",
            "employer_addr": "150 Elgin Street, Suite 800, Ottawa, ON K2P 1L4",
            "employer_phone": "(613) 241-2828",
            "employer_dept": "Data Science & Analytics",
            "position": "Senior Data Analyst",
            "emp_start": "February 12, 2022",
            "emp_start_short": "02/12/2022",
            "emp_years": "4 yrs / 0 mos",
            "salary": 115000,
            "hr_name": "HR Department",
            "hr_title": "Human Resources, Shopify Inc.",
            "emp_id": "SHP-2293",
            "noa_2024_employment": 115000,
            "noa_2024_other": 1200,
            "noa_2024_rrsp": 6000,
            "noa_2024_other_ded": 0,
            "noa_2023_employment": 108000,
            "noa_2023_other": 1000,
            "noa_2023_rrsp": 5000,
            "noa_2023_other_ded": 0,
            "credit_score": 760,
            "credit_rating": "740-850 -- VERY GOOD",
            "credit_accounts": [
                ("RBC Visa", "Revolving", "Mar 2020", "Open", "$5,000", "$1,800", "$54/mo", "On Time"),
                ("Student Loan (NSLSC)", "Installment", "Sep 2015", "Open", "$20,000", "$8,200", "$296/mo", "On Time"),
            ],
            "credit_open": 2,
            "credit_balance": "$10,000.00",
            "credit_history": "100% on-time payments (last 36 months)",
            "credit_derogatory": "None",
            "credit_collections": "None on file",
            "credit_bankruptcies": "None on file",
            "credit_inquiries": [
                ("Feb 10, 2026", "Axiom Mortgage Solutions (Mortgage Application)", "Hard Inquiry"),
            ],
            "rrsp_value": 28000,
            "rrsp_institution": "RBC Direct Investing",
            "rrsp_acct": "RBC-RRSP-7641-SW",
            "tfsa_value": 15000,
            "tfsa_institution": "Wealthsimple",
            "tfsa_acct": "WS-TFSA-7641-SW",
        },
        "co_applicant": None,
        "property": {
            "address": "280 Metcalfe Street, Unit 801, Ottawa, ON K2P 1R7",
            "city": "Ottawa", "prov": "ON", "pc": "K2P 1R7",
            "type": "Condominium", "style": "Mid-Rise",
            "price": 455000, "beds": "1+den", "baths": 1, "sqft": 780,
            "year_built": 2019, "lot_size": "N/A",
            "legal_desc": "Unit 801, Level 8, OSCC 2019-0184, Ottawa",
            "condo_fee": "$380/mo",
        },
        "mortgage": {
            "down_payment": 91000, "down_pct": 20, "loan": 364000,
        },
        "bank": {
            "institution": "RBC Royal Bank",
            "branch": "90 Sparks Street, Ottawa, ON K1P 5B4",
            "phone": "(613) 555-0316",
            "acct": "****-****-4218", "transit": "00316", "inst": "003",
            "savings": 98400,
        },
        "car": None,  # No car loan -- uses Ottawa transit / bike
        "prop_tax": {
            "municipality": "City of Ottawa",
            "muni_addr": "110 Laurier Avenue West, Ottawa, ON K1P 1J1",
            "phone": "311 or (613) 580-2400",
            "website": "ottawa.ca/property-tax",
            "annual_tax": 3800, "assessed_value": 445000,
            "roll_number": "0614-280-801-00100",
            "prev_assessed": 430000,
        },
        "utilities": [
            {
                "company": "Hydro Ottawa",
                "addr": "2711 Hunt Club Road, Ottawa, ON K1T 3N2",
                "phone": "(613) 738-6400",
                "website": "hydroottawa.com",
                "bill_type": "ELECTRIC BILL",
                "acct": "HO-ACT-42181-2025",
                "amount": 118.00,
                "prev_paid": 115.00,
            },
            {
                "company": "Enbridge Gas",
                "addr": "500 Consumers Road, Toronto, ON M2J 1P8",
                "phone": "1-877-362-7434",
                "website": "enbridgegas.com",
                "bill_type": "NATURAL GAS BILL",
                "acct": "ENB-GAS-72931-RES",
                "amount": 72.00,
                "prev_paid": 69.00,
            },
        ],
        "inspection": {
            "company": "PillarToPost Home Inspectors",
            "company_addr": "Suite 150, 1600 Merivale Road, Ottawa, ON K2G 5J8",
            "phone": "(613) 555-8844",
            "inspector": "Daniel R. Fournier",
            "lic": "ON-RHI-11293",
            "report_num": "PTP-OTT-2025-00241",
            "date": "March 1, 2025",
            "time": "11:00 AM - 1:00 PM (2 hrs)",
            "weather": "Clear, -4C, dry conditions",
            "overall": "EXCELLENT CONDITION -- Minor Items Noted",
            "overall_detail": "This condo unit is in excellent overall condition for its age (6 years). No structural, safety, or mechanical deficiencies were identified. The unit is well-maintained.",
            "findings_monitor": [
                "Some paint touch-up needed in hallway -- minor cosmetic (~$100-$200)",
                "One kitchen drawer runner slightly loose -- tighten or replace runner (~$30-$50)",
            ],
            "findings_maintenance": [
                "Annual HVAC filter replacement recommended -- currently clean",
                "Recommend checking bathroom caulking annually",
            ],
        },
        "id_authority": "ServiceOntario",
        "id_authority_addr": "ServiceOntario, 110 Laurier Avenue West, Ottawa, ON K1P 1J1",
        "id_authority_phone": "1-800-267-8097",
        "id_authority_web": "ontario.ca/serviceontario",
        "purchase_brokerage": "Royal LePage Team Realty",
        "purchase_brokerage_addr": "1335 Carling Avenue, Ottawa, ON K1Z 8N8",
        "purchase_brokerage_phone": "(613) 555-7200",
        "seller_name": "Metcalfe Developments Inc. (James & Patricia Harmon)",
        "seller_addr": "280 Metcalfe Street, Unit 401, Ottawa, ON K2P 1R7",
        "seller_brokerage": "Coldwell Banker First Ottawa Realty",
        "buyer_realtor": "Michelle A. Leblanc",
        "seller_realtor": "Patrick J. O'Brien",
        "contract_ref": "RLP-OTT-2025-00241",
        "existing_property_text": "No other real property owned.",
    },
}


# ══════════════════════════════════════════════════════════════════════════════
#  Tax calculation helpers
# ══════════════════════════════════════════════════════════════════════════════

def calc_federal_tax(taxable):
    """Simplified 2024 federal tax brackets."""
    brackets = [(55867, 0.15), (55866, 0.205), (61942, 0.26), (62562, 0.29), (float("inf"), 0.33)]
    tax = 0
    remaining = taxable
    for width, rate in brackets:
        if remaining <= 0:
            break
        chunk = min(remaining, width)
        tax += chunk * rate
        remaining -= chunk
    return round(tax)


def calc_bc_tax(taxable):
    brackets = [(45654, 0.0506), (45656, 0.077), (13525, 0.105), (22464, 0.1229),
                (45522, 0.147), (67084, 0.168), (float("inf"), 0.205)]
    tax = 0
    remaining = taxable
    for width, rate in brackets:
        if remaining <= 0:
            break
        chunk = min(remaining, width)
        tax += chunk * rate
        remaining -= chunk
    return round(tax)


def calc_on_tax(taxable):
    brackets = [(51446, 0.0505), (51454, 0.0915), (47008, 0.1116), (70000, 0.1216),
                (float("inf"), 0.1316)]
    tax = 0
    remaining = taxable
    for width, rate in brackets:
        if remaining <= 0:
            break
        chunk = min(remaining, width)
        tax += chunk * rate
        remaining -= chunk
    return round(tax)


def calc_prov_tax(taxable, prov):
    if prov == "BC":
        return calc_bc_tax(taxable)
    return calc_on_tax(taxable)


def calc_payroll_deductions(annual_salary, prov):
    """Return semi-monthly deductions dict."""
    semi = round(annual_salary / 24, 2)
    fed = round(calc_federal_tax(annual_salary) / 24, 2)
    prov_tax = round(calc_prov_tax(annual_salary, prov) / 24, 2)
    cpp = round(min(annual_salary * 0.0595, 3867.50) / 24, 2)
    ei = round(min(annual_salary * 0.0166, 1049.12) / 24, 2)
    return {
        "gross": semi,
        "fed": fed,
        "prov": prov_tax,
        "cpp": cpp,
        "ei": ei,
        "total_ded": round(fed + prov_tax + cpp + ei, 2),
        "net": round(semi - fed - prov_tax - cpp - ei, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  Document generators
# ══════════════════════════════════════════════════════════════════════════════

def fmt(val):
    """Format number as $X,XXX.XX"""
    return f"${val:,.2f}"


def gen_01_government_id(p, out_dir):
    """Provincial ID cards."""
    pdf = StyledPDF(p["id_authority"].upper(), "Government Identification Card -- Document Package")
    pdf.header_sub = f"{p['id_authority_addr']} | {p['id_authority_phone']} | {p['id_authority_web']}"
    pdf.add_page()

    # Gold banner
    pdf.set_fill_color(*GOLD)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 7, "  IDENTIFICATION CARDS -- CARTES D'IDENTITE -- FOR DEMO PURPOSES ONLY -- A DES FINS DE DEMONSTRATION UNIQUEMENT", fill=True, ln=True)
    pdf.set_text_color(*BLACK)
    pdf.ln(4)

    people = [("APPLICANT", p["applicant"])]
    if p["has_co_applicant"] and p["co_applicant"]:
        people.append(("CO-APPLICANT", p["co_applicant"]))

    for role, person in people:
        pdf.set_font("Helvetica", "BU", 11)
        pdf.cell(0, 7, f"{role} -- {person['full_name']}", ln=True)
        pdf.ln(2)

        # Front card
        card_x = pdf.get_x() + 5
        card_y = pdf.get_y()
        card_w = 85
        card_h = 55
        # Province header bar
        pdf.set_fill_color(*DARK_BLUE)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_xy(card_x, card_y)
        pdf.cell(card_w, 7, f"  {p['prov_long'].upper()} -- CANADA", fill=True)
        pdf.set_xy(card_x, card_y + 7)
        pdf.set_draw_color(*DARK_BLUE)
        pdf.rect(card_x, card_y + 7, card_w, card_h - 7)
        # Photo placeholder
        pdf.set_fill_color(*MEDIUM_GRAY)
        pdf.rect(card_x + 2, card_y + 9, 22, 28, "F")
        pdf.set_text_color(*DARK_GRAY)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_xy(card_x + 5, card_y + 19)
        pdf.cell(15, 5, "PHOTO", align="C")
        # ID details
        pdf.set_text_color(*BLACK)
        det_x = card_x + 28
        pdf.set_xy(det_x, card_y + 9)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(50, 4, "IDENTIFICATION CARD")
        pdf.set_xy(det_x, card_y + 13)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(50, 3, "CARTE D'IDENTITE")
        pdf.set_xy(det_x, card_y + 17)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(50, 3, "SURNAME / NOM DE FAMILLE")
        pdf.set_xy(det_x, card_y + 20)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(50, 4, person["last"])
        pdf.set_xy(det_x, card_y + 24)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(50, 3, "GIVEN NAME(S) / PRENOM(S)")
        pdf.set_xy(det_x, card_y + 27)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(50, 4, person["first"])
        # DOB, Sex, Height row
        pdf.set_xy(card_x + 2, card_y + 38)
        pdf.set_font("Helvetica", "", 5)
        pdf.cell(25, 3, "DATE OF BIRTH / DATE DE NAISSANCE")
        pdf.cell(10, 3, "SEX / SEXE")
        pdf.cell(15, 3, "HEIGHT / TAILLE")
        pdf.set_xy(card_x + 2, card_y + 41)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(25, 4, person["dob"])
        pdf.cell(10, 4, person["sex"])
        pdf.cell(15, 4, person["height"])
        # ID number, expires
        pdf.set_xy(card_x + 2, card_y + 46)
        pdf.set_font("Helvetica", "", 5)
        pdf.cell(35, 3, "ID NUMBER / NUMERO D'ID")
        pdf.cell(25, 3, "EXPIRES / EXPIRE")
        pdf.set_xy(card_x + 2, card_y + 49)
        pdf.set_font("Helvetica", "B", 6)
        pdf.cell(35, 3, person["id_number"])
        pdf.cell(25, 3, person["id_expires"])
        pdf.set_xy(card_x + 52, card_y + 49)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(30, 3, "FRONT / RECTO")

        # Back card
        back_x = card_x + card_w + 10
        pdf.set_fill_color(*DARK_BLUE)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_xy(back_x, card_y)
        pdf.cell(card_w, 7, f"  {p['prov_long'].upper()} -- CANADA", fill=True)
        pdf.set_xy(back_x, card_y + 7)
        pdf.set_draw_color(*DARK_BLUE)
        pdf.rect(back_x, card_y + 7, card_w, card_h - 7)
        # Signature
        pdf.set_text_color(*BLACK)
        pdf.set_xy(back_x + 3, card_y + 18)
        pdf.set_font("Helvetica", "BI", 11)
        pdf.cell(70, 6, person["short_name"])
        pdf.set_xy(back_x + 3, card_y + 24)
        pdf.set_font("Helvetica", "", 5)
        pdf.set_text_color(*DARK_GRAY)
        pdf.cell(70, 3, "AUTHORIZED SIGNATURE / SIGNATURE AUTORISEE")
        pdf.set_xy(back_x + 3, card_y + 30)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(70, 3, f"This card is the property of the Province of {p['prov_long']}.")
        pdf.set_xy(back_x + 3, card_y + 33)
        pdf.cell(70, 3, f"If found, please return to the nearest {p['id_authority']} office.")
        pdf.set_xy(back_x + 10, card_y + 42)
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(*BLACK)
        pdf.cell(60, 4, f"{person['id_number']}  {person['dob']}")
        pdf.set_xy(back_x + 52, card_y + 49)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(30, 3, "BACK / VERSO")

        pdf.set_y(card_y + card_h + 8)

    # Issuing authority
    pdf.ln(4)
    pdf.info_box([
        ("ISSUING AUTHORITY",),
        f"{p['id_authority']} -- Registry Services",
        f"{p['id_authority_addr']}",
        f"Phone: {p['id_authority_phone']} | {p['id_authority_web']}",
        f"Issue Date: March 1, 2024 | Document Reference: SA-2024-{p['province']}-00847",
    ])

    pdf.output(os.path.join(out_dir, "01_government_id.pdf"))


def gen_02_employment_letter(p, out_dir):
    """Employment verification letters."""
    people = [("applicant", p["applicant"])]
    if p["has_co_applicant"] and p["co_applicant"]:
        people.append(("co_applicant", p["co_applicant"]))

    pages = []
    for role, person in people:
        initials = "".join(w[0] for w in person["full_name"].split())
        ref = f"{person['employer'][:3].upper()}-HR-2025-0314-{initials}"
        pages.append((person, ref))

    # Use first person's employer for the PDF header
    first = pages[0][0]
    pdf = StyledPDF(first["employer"], "EMPLOYMENT VERIFICATION LETTER")
    pdf.header_sub = f"{first['employer_addr']} | Tel: {first['employer_phone']}"
    pdf.footer_extra = "This document is confidential and issued solely for the purpose stated herein."

    for idx, (person, ref) in enumerate(pages):
        if idx > 0:
            pdf.company_name = person["employer"]
            pdf.header_sub = f"{person['employer_addr']} | Tel: {person['employer_phone']}"
        pdf.header_ref = f"Ref: {ref}"
        pdf.add_page()

        pdf.ln(4)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, "March 14, 2025", ln=True)
        pdf.ln(2)
        # Gold line
        pdf.set_fill_color(*GOLD)
        pdf.rect(10, pdf.get_y(), pdf.w - 20, 0.5, "F")
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*DARK_BLUE)
        pdf.cell(0, 5, f"RE: Confirmation of Employment -- {person['full_name']}", ln=True)
        pdf.set_text_color(*BLACK)
        pdf.ln(4)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, "To Whom It May Concern,", ln=True)
        pdf.ln(4)
        pdf.multi_cell(0, 5,
            f"This letter is to confirm that {person['full_name']} is currently employed with {person['employer']} "
            f"in the position of {person['position']}, within the {person['employer_dept']} Department.")
        pdf.ln(3)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, "Details of employment are as follows:", ln=True)
        pdf.ln(2)

        details = [
            ("Employee Name:", person["full_name"]),
            ("Position / Title:", person["position"]),
            ("Department:", person["employer_dept"]),
            ("Employment Start Date:", person["emp_start"]),
            ("Employment Type:", "Permanent, Full-Time"),
            ("Annual Gross Salary:", f"${person['salary']:,.2f} CAD per annum"),
            ("Current Employment Status:", "Active -- In Good Standing"),
        ]
        pdf.set_draw_color(*MEDIUM_GRAY)
        for label, val in details:
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(55, 6, f"  {label}", border="TB")
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(0, 6, val, border="TB", ln=True)

        pdf.ln(6)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5,
            f"{person['full_name']} is a valued member of our team and their employment is expected to continue "
            f"on a permanent basis. This letter has been issued at the request of the employee for the "
            f"purpose of mortgage financing.")
        pdf.ln(4)
        pdf.multi_cell(0, 5,
            f"Should you require any additional information or clarification, please do not hesitate to "
            f"contact our Human Resources Department at {person['employer_phone']}.")
        pdf.ln(6)
        pdf.cell(0, 5, "Sincerely,", ln=True)
        pdf.ln(4)
        pdf.set_font("Helvetica", "BI", 12)
        pdf.cell(0, 6, person["hr_name"], ln=True)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(0, 4, person["hr_title"], ln=True)
        pdf.cell(0, 4, person["employer"], ln=True)
        pdf.cell(0, 4, "Date: March 14, 2025", ln=True)

    pdf.output(os.path.join(out_dir, "02_employment_letter.pdf"))


def gen_03_paystubs(p, out_dir):
    """3 semi-monthly pay stubs per applicant."""
    people = [p["applicant"]]
    if p["has_co_applicant"] and p["co_applicant"]:
        people.append(p["co_applicant"])

    pay_periods = [
        ("Feb 15, 2025 - Feb 28, 2025", "Mar 5, 2025", 2),
        ("Feb 1, 2025 - Feb 15, 2025", "Feb 19, 2025", 1),
        ("Jan 15, 2025 - Jan 31, 2025", "Feb 5, 2025", 0),
    ]

    first = people[0]
    pdf = StyledPDF(first["employer"], "EARNINGS STATEMENT")
    pdf.header_sub = "Payroll Services Department\nDirect Deposit -- Electronic Earnings Statement"
    pdf.footer_extra = "This is an official payroll document. Please retain for your records."

    for person in people:
        ded = calc_payroll_deductions(person["salary"], p["province"])
        pdf.company_name = person["employer"]
        pdf.header_sub = f"Payroll Services Department | Direct Deposit -- Electronic Earnings Statement"

        for period_label, pay_date, period_num in pay_periods:
            pdf.header_ref = f"Pay Period: {period_label}"
            pdf.header_date = f"Pay Date: {pay_date}"
            pdf.add_page()

            # Employee info box
            pdf.ln(2)
            y0 = pdf.get_y()
            pdf.set_draw_color(*DARK_BLUE)
            pdf.set_line_width(0.3)
            # 3 column info box
            bw = (pdf.w - 20) / 3
            for i, (hdr, vals) in enumerate([
                ("EMPLOYEE", [person["full_name"], f"ID: {person['emp_id']} | {person['position']}"]),
                ("DEPARTMENT", [person["employer_dept"]]),
                ("PAY FREQUENCY", ["Semi-Monthly (24x/yr)"]),
            ]):
                x0 = 10 + i * bw
                pdf.set_fill_color(*DARK_BLUE)
                pdf.set_text_color(*WHITE)
                pdf.set_font("Helvetica", "B", 7)
                pdf.set_xy(x0, y0)
                pdf.cell(bw, 5, f"  {hdr}", fill=True)
                pdf.set_text_color(*BLACK)
                pdf.set_font("Helvetica", "", 7)
                for j, v in enumerate(vals):
                    pdf.set_xy(x0 + 2, y0 + 6 + j * 4)
                    pdf.cell(bw - 4, 4, v)
                pdf.rect(x0, y0, bw, 16)
            pdf.set_y(y0 + 20)

            # Earnings table
            hourly_rate = round(person["salary"] / (2080), 2)
            ytd_gross = round(ded["gross"] * (period_num + 1), 2) if period_num > 0 else 0
            cols = ["DESCRIPTION", "HOURS", "RATE", "CURRENT ($)", "YTD ($)"]
            widths = [55, 25, 25, 40, 45]
            pdf.table_header(cols, widths)
            pdf.table_row(
                [" Regular Salary", "86.67", f"${hourly_rate:.2f}", f"{ded['gross']:,.2f}", f"{ytd_gross:,.2f}"],
                widths
            )
            pdf.table_row(
                [" Vacation Pay (Included)", "--", "--", "--", "--"],
                widths
            )
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_fill_color(*GOLD)
            pdf.set_text_color(*WHITE)
            pdf.cell(widths[0] + widths[1] + widths[2], 5, " GROSS EARNINGS", fill=True)
            pdf.cell(widths[3], 5, f" ${ded['gross']:,.2f}", fill=True, align="R")
            pdf.cell(widths[4], 5, f" ${ytd_gross:,.2f}", fill=True, align="R")
            pdf.ln()
            pdf.set_text_color(*BLACK)
            pdf.ln(3)

            # Deductions table
            prov_label = f"Provincial Income Tax ({p['province']})"
            pdf.table_header(cols, widths)
            ytd_mult = period_num + 1 if period_num > 0 else 0
            ded_rows = [
                ("Federal Income Tax", ded["fed"], round(ded["fed"] * ytd_mult, 2)),
                (prov_label, ded["prov"], round(ded["prov"] * ytd_mult, 2)),
                ("Canada Pension Plan (CPP)", ded["cpp"], round(ded["cpp"] * ytd_mult, 2)),
                ("Employment Insurance (EI)", ded["ei"], round(ded["ei"] * ytd_mult, 2)),
            ]
            for desc, curr, ytd in ded_rows:
                pdf.table_row([f" {desc}", "--", "--", f"{curr:,.2f}", f"{ytd:,.2f}"], widths)
            ytd_total_ded = round(ded["total_ded"] * ytd_mult, 2)
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_fill_color(*GOLD)
            pdf.set_text_color(*WHITE)
            pdf.cell(widths[0] + widths[1] + widths[2], 5, " TOTAL DEDUCTIONS", fill=True)
            pdf.cell(widths[3], 5, f" ${ded['total_ded']:,.2f}", fill=True, align="R")
            pdf.cell(widths[4], 5, f" ${ytd_total_ded:,.2f}", fill=True, align="R")
            pdf.ln()
            pdf.set_text_color(*BLACK)
            pdf.ln(4)

            # Net pay box
            ytd_net = round(ded["net"] * ytd_mult, 2)
            pdf.set_fill_color(*DARK_BLUE)
            pdf.set_text_color(*WHITE)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(100, 10, "  NET PAY -- DIRECT DEPOSIT", fill=True)
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(90, 10, f"${ded['net']:,.2f}", fill=True, align="R")
            pdf.ln()
            pdf.set_text_color(*DARK_GRAY)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(190, 5, f"YTD Net: ${ytd_net:,.2f}", align="R", ln=True)
            pdf.set_text_color(*BLACK)
            pdf.ln(4)

            # Deposit account
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(0, 5, "DEPOSIT ACCOUNT", ln=True)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(0, 4, f"Institution: {p['bank']['institution']}", ln=True)
            pdf.cell(0, 4, f"Account: {p['bank']['acct']} | Transit: {p['bank']['transit']}", ln=True)

    pdf.output(os.path.join(out_dir, "03_paystubs.pdf"))


def gen_04_income_tax(p, out_dir):
    """CRA Notice of Assessment for 2023 and 2024."""
    pdf = StyledPDF("Canada Revenue Agency", "")
    pdf.header_color = CRA_RED
    pdf.header_sub = "Agence du revenu du Canada"

    people = [p["applicant"]]
    if p["has_co_applicant"] and p["co_applicant"]:
        people.append(p["co_applicant"])

    tax_centre = "Sudbury, ON P3A 0C1" if p["province"] == "ON" else "Surrey, BC V3T 5E1"
    prov_tax_name = f"{p['prov_long']} provincial tax"

    for person in people:
        for year in [2024, 2023]:
            suffix = "2024" if year == 2024 else "2023"
            emp_inc = person[f"noa_{suffix}_employment"]
            other_inc = person[f"noa_{suffix}_other"]
            total_inc = emp_inc + other_inc
            rrsp_ded = person[f"noa_{suffix}_rrsp"]
            other_ded = person[f"noa_{suffix}_other_ded"]
            net_inc = total_inc - rrsp_ded - other_ded
            taxable = net_inc

            fed = calc_federal_tax(taxable)
            prov = calc_prov_tax(taxable, p["province"])
            total_tax = fed + prov
            tax_deducted = round(total_tax * 1.03) if year == 2024 else round(total_tax * 0.98)
            diff = tax_deducted - total_tax

            initials = "".join(w[0] for w in person["full_name"].split())
            ref = f"CRA-{year}-{p['province']}-{person['sin'][:3].replace('-','')}-{initials}"
            issue_date = f"May 12, {year}" if year == 2024 else f"June 3, {year}"

            pdf.doc_title = f"NOTICE OF ASSESSMENT -- TAX YEAR {year}"
            pdf.footer_extra = f"If you disagree with this assessment, you have 90 days from the date of this notice to file a Notice of Objection."
            pdf.footer_text = f"SYNTHETIC DOCUMENT -- FOR DEMONSTRATION PURPOSES ONLY | canada.ca/cra"
            pdf.header_ref = ""
            pdf.header_date = ""
            pdf.add_page()

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 7, f"NOTICE OF ASSESSMENT -- AVIS DE COTISATION  |  TAX YEAR {year}", align="C", ln=True)
            pdf.ln(3)

            # Taxpayer info box
            y0 = pdf.get_y()
            pdf.set_draw_color(*DARK_BLUE)
            pdf.rect(10, y0, pdf.w - 20, 22)
            pdf.set_xy(12, y0 + 1)
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*DARK_BLUE)
            pdf.cell(80, 4, "TAXPAYER / CONTRIBUABLE")
            pdf.set_xy(12, y0 + 5)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*BLACK)
            pdf.cell(80, 5, person["full_name"])
            pdf.set_xy(12, y0 + 10)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(80, 4, person["address"])

            pdf.set_xy(110, y0 + 2)
            pdf.set_font("Helvetica", "B", 7)
            pdf.cell(25, 4, "SIN / NAS")
            pdf.cell(30, 4, "REF #")
            pdf.set_xy(110, y0 + 6)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(25, 4, person["sin"])
            pdf.set_font("Helvetica", "", 6)
            pdf.cell(55, 4, ref)
            pdf.set_xy(110, y0 + 11)
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*DARK_BLUE)
            pdf.cell(40, 4, "ISSUE DATE / DATE D'EMISSION")
            pdf.set_xy(110, y0 + 15)
            pdf.set_text_color(*BLACK)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(40, 4, issue_date)

            pdf.set_y(y0 + 26)

            # Income section
            pdf.section_header("INCOME / REVENU")
            lw = 45
            vw = pdf.w - 20 - lw
            rows = [
                ("Line 10100", "Employment income", fmt(emp_inc)),
                ("Line 13000", "Other income", fmt(other_inc)),
            ]
            for line, desc, val in rows:
                pdf.set_font("Helvetica", "", 7)
                pdf.cell(lw, 5, f"  {line}  {desc}")
                pdf.cell(vw, 5, val, align="R", ln=True)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(lw, 5, "  Line 15000  Total income / Revenu total")
            pdf.cell(vw, 5, fmt(total_inc), align="R", ln=True)
            pdf.ln(2)

            # Deductions
            pdf.section_header("DEDUCTIONS / DEDUCTIONS")
            rows = [
                ("Line 20800", "RRSP/PRPP deduction", fmt(rrsp_ded)),
                ("Line 23200", "Other deductions", fmt(other_ded)),
            ]
            for line, desc, val in rows:
                pdf.set_font("Helvetica", "", 7)
                pdf.cell(lw, 5, f"  {line}  {desc}")
                pdf.cell(vw, 5, val, align="R", ln=True)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(lw, 5, "  Line 23600  Net income / Revenu net")
            pdf.cell(vw, 5, fmt(net_inc), align="R", ln=True)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(lw, 5, "  Line 26000  Taxable income / Revenu imposable")
            pdf.cell(vw, 5, fmt(taxable), align="R", ln=True)
            pdf.ln(2)

            # Tax calc
            pdf.section_header("TAX CALCULATION / CALCUL DE L'IMPOT")
            rows = [
                ("Line 42000", "Federal tax / Impot federal", fmt(fed)),
                ("Line 42800", prov_tax_name, fmt(prov)),
            ]
            for line, desc, val in rows:
                pdf.set_font("Helvetica", "", 7)
                pdf.cell(lw, 5, f"  {line}  {desc}")
                pdf.cell(vw, 5, val, align="R", ln=True)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(lw, 5, "  Line 43500  Total payable / Total a payer")
            pdf.cell(vw, 5, fmt(total_tax), align="R", ln=True)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(lw, 5, "  Line 43700  Total income tax deducted")
            pdf.cell(vw, 5, fmt(tax_deducted), align="R", ln=True)
            pdf.ln(3)

            # Refund or owing
            if diff >= 0:
                pdf.set_fill_color(200, 230, 200)
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(100, 9, "  REFUND / REMBOURSEMENT", fill=True)
                pdf.set_font("Helvetica", "B", 14)
                pdf.cell(90, 9, fmt(diff), fill=True, align="R")
            else:
                pdf.set_fill_color(255, 220, 220)
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(100, 9, "  AMOUNT OWING / SOLDE DU", fill=True)
                pdf.set_font("Helvetica", "B", 14)
                pdf.cell(90, 9, fmt(abs(diff)), fill=True, align="R")
            pdf.ln(6)

            # RRSP limit
            rrsp_limit = round(taxable * 0.18, 2)
            next_yr = year + 1
            pdf.set_fill_color(*LIGHT_GRAY)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(0, 5, "  RRSP/PRPP DEDUCTION LIMIT FOR NEXT YEAR", fill=True, ln=True)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(0, 5, f"  Your RRSP deduction limit for {next_yr} is: ${rrsp_limit:,.2f}", ln=True)
            pdf.cell(0, 4, "  This amount is based on your earned income for the current tax year.", ln=True)

    pdf.output(os.path.join(out_dir, "04_income_tax.pdf"))


def gen_05_bank_statements(p, out_dir):
    """3 months of bank statements."""
    bank = p["bank"]
    pdf = StyledPDF(bank["institution"], "ACCOUNT STATEMENT")
    pdf.header_color = BANK_GREEN
    pdf.header_sub = f"Personal Banking | Branch: {bank['branch']} | Tel: {bank['phone']}"

    holders = p["applicant"]["full_name"]
    if p["has_co_applicant"] and p["co_applicant"]:
        holders += f" & {p['co_applicant']['full_name']}"

    months = [
        ("February 1, 2025 - February 28, 2025", "February 28, 2025", "FEBRUARY 2025"),
        ("January 1, 2025 - January 31, 2025", "January 31, 2025", "JANUARY 2025"),
        ("December 1, 2024 - December 31, 2024", "December 31, 2024", "DECEMBER 2024"),
    ]

    # Simulate balances working backward from savings
    savings = bank["savings"]
    closing_balances = [
        round(savings * 0.58, 2),
        round(savings * 0.52, 2),
        round(savings * 0.47, 2),
    ]
    opening_balances = [
        closing_balances[1],
        closing_balances[2],
        round(savings * 0.40, 2),
    ]

    app_emp = p["applicant"]["employer"].upper()
    app_salary = calc_payroll_deductions(p["applicant"]["salary"], p["province"])
    co_emp = ""
    co_salary = None
    if p["has_co_applicant"] and p["co_applicant"]:
        co_emp = p["co_applicant"]["employer"].upper()
        co_salary = calc_payroll_deductions(p["co_applicant"]["salary"], p["province"])

    for idx, (period, stmt_date, month_label) in enumerate(months):
        pdf.header_ref = period
        pdf.header_date = f"Statement Date: {stmt_date}"
        pdf.add_page()
        pdf.footer_extra = f"Member of Canada Deposit Insurance Corporation. Questions? Call {bank['phone']}"

        # Account holder box
        y0 = pdf.get_y()
        pdf.set_draw_color(*BANK_GREEN)
        box_h = 16
        pdf.rect(10, y0, 105, box_h)
        pdf.rect(117, y0, 80, box_h)
        pdf.set_xy(12, y0 + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(0, 4, "ACCOUNT HOLDER")
        pdf.set_xy(12, y0 + 5)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(100, 4, holders)
        pdf.set_xy(12, y0 + 9)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(100, 4, p["applicant"]["address"])
        pdf.set_xy(12, y0 + 13)
        joint = "Joint Account -- " if p["has_co_applicant"] else ""
        pdf.cell(100, 3, f"{joint}Personal Chequing")

        pdf.set_xy(119, y0 + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(0, 4, "ACCOUNT NUMBER")
        pdf.set_xy(119, y0 + 5)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(70, 5, bank["acct"])
        pdf.set_xy(119, y0 + 10)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(70, 4, f"Transit: {bank['transit']} | Inst: {bank['inst']}")

        pdf.set_y(y0 + box_h + 3)

        # Balance header bar
        opening = opening_balances[idx]
        closing = closing_balances[idx]
        pdf.set_fill_color(*BANK_GREEN)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(65, 6, f"  OPENING BALANCE: ${opening:,.2f}", fill=True)
        pdf.cell(60, 6, f"  {month_label}", fill=True, align="C")
        pdf.cell(0, 6, f"CLOSING BALANCE: ${closing:,.2f}  ", fill=True, align="R")
        pdf.ln()
        pdf.set_text_color(*BLACK)

        # Transaction header
        cols = ["DATE", "DESCRIPTION", "TYPE", "DEBIT", "CREDIT / BALANCE"]
        widths = [18, 72, 15, 28, 57]
        pdf.table_header(cols, widths, BANK_GREEN)

        # Generate plausible transactions
        balance = opening
        txns = []
        month_abbr = month_label.split()[0][:3]

        # Payroll deposits
        txns.append((f"{month_abbr} 3", f"{app_emp} - PAYROLL", "DEP", 0, app_salary["net"]))
        txns.append((f"{month_abbr} 15", f"{app_emp} - PAYROLL", "DEP", 0, app_salary["net"]))
        if co_salary:
            txns.append((f"{month_abbr} 8", f"{co_emp} - PAYROLL", "DEP", 0, co_salary["net"]))
            txns.append((f"{month_abbr} 19", f"{co_emp} - PAYROLL", "DEP", 0, co_salary["net"]))

        # Common expenses
        txns.append((f"{month_abbr} 5", "NETFLIX CANADA INC", "PAP", 23.99, 0))
        txns.append((f"{month_abbr} 6", "SPOTIFY PREMIUM", "PAP", 14.39, 0))
        txns.append((f"{month_abbr} 7", "GROCERY STORE", "POS", 187.42, 0))
        txns.append((f"{month_abbr} 10", "GAS STATION", "POS", 98.50, 0))
        txns.append((f"{month_abbr} 12", "AMAZON.CA MARKETPLACE", "POS", 95.67, 0))
        txns.append((f"{month_abbr} 17", "VISA PAYMENT", "TFR", 800.00, 0))
        txns.append((f"{month_abbr} 20", "SAVINGS TRANSFER", "TFR", 1500.00, 0))
        txns.append((f"{month_abbr} 22", "RESTAURANT", "POS", 87.60, 0))
        txns.append((f"{month_abbr} 24", "GROCERY STORE", "POS", 156.30, 0))
        if p["car"] and p["car"]["monthly"] > 0:
            txns.append((f"{month_abbr} 26", f"{p['car']['lender'].upper()} - AUTO LOAN", "PAP", p["car"]["monthly"], 0))

        # Sort by day
        txns.sort(key=lambda t: int(t[0].split()[1]))

        for date, desc, typ, debit, credit in txns:
            balance = balance - debit + credit
            debit_str = f"- ${debit:,.2f}" if debit > 0 else ""
            credit_str = f"+ ${credit:,.2f} |" if credit > 0 else ""
            bal_str = f"${balance:,.2f}"
            entry = f"{credit_str} {bal_str}" if credit > 0 else bal_str

            # Type badge
            pdf.set_font("Helvetica", "", 6)
            pdf.cell(widths[0], 5, f" {date}")
            pdf.cell(widths[1], 5, f" {desc}")
            pdf.set_font("Helvetica", "B", 5)
            pdf.cell(widths[2], 5, f" {typ}")
            pdf.set_font("Helvetica", "", 6)
            pdf.cell(widths[3], 5, debit_str, align="R")
            pdf.cell(widths[4], 5, entry, align="R")
            pdf.ln()

        # Closing balance
        pdf.set_fill_color(*BANK_GREEN)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(widths[0] + widths[1] + widths[2] + widths[3], 5, " CLOSING BALANCE", fill=True)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(widths[4], 5, f"${closing:,.2f}", fill=True, align="R")
        pdf.ln()
        pdf.set_text_color(*BLACK)

    pdf.output(os.path.join(out_dir, "05_bank_statements.pdf"))


def gen_06_purchase_agreement(p, out_dir):
    """Real estate purchase contract (3 pages)."""
    prop = p["property"]
    mtg = p["mortgage"]
    pdf = StyledPDF(p["purchase_brokerage"].upper(), "REAL ESTATE PURCHASE CONTRACT")
    pdf.header_sub = f"{p['purchase_brokerage_addr']} | {p['purchase_brokerage_phone']}"
    pdf.footer_extra = f"This contract is subject to standard provincial real estate terms and conditions."

    buyers = p["applicant"]["full_name"]
    if p["has_co_applicant"] and p["co_applicant"]:
        buyers += f" & {p['co_applicant']['full_name']}"

    # Page 1: Parties + Property + Price
    pdf.header_ref = f"Page 1 of 3"
    pdf.header_date = f"Contract Ref: {p['contract_ref']}"
    pdf.add_page()
    pdf.ln(2)

    # Title banner
    pdf.set_fill_color(*GOLD)
    pdf.set_draw_color(*GOLD)
    pdf.set_text_color(*DARK_BLUE)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 8, f"  REAL ESTATE PURCHASE CONTRACT -- PROVINCE OF {p['prov_long'].upper()}", fill=True, ln=True, align="C")
    pdf.set_text_color(*BLACK)
    pdf.ln(2)

    pdf.section_header("1. PARTIES")
    for lbl, val in [
        ("Buyer(s):", buyers),
        ("Buyer Address:", p["applicant"]["address"]),
        ("Buyer Phone:", p["applicant"]["phone"] + (" | " + p["co_applicant"]["phone"] if p["co_applicant"] else "")),
        ("Seller(s):", p["seller_name"]),
        ("Seller Address:", p["seller_addr"]),
        ("Seller's Brokerage:", p["seller_brokerage"]),
        ("Buyer's Brokerage:", p["purchase_brokerage"]),
    ]:
        pdf.label_value_row(lbl, val)

    pdf.ln(2)
    pdf.section_header("2. PROPERTY")
    for lbl, val in [
        ("Civic Address:", prop["address"]),
        ("Legal Description:", prop["legal_desc"]),
        ("Property Type:", prop["type"]),
        ("Year Built:", str(prop["year_built"])),
        ("Finished Area:", f"{prop['sqft']:,} sq ft"),
        ("Bedrooms:", str(prop["beds"])),
        ("Bathrooms:", str(prop["baths"])),
    ]:
        pdf.label_value_row(lbl, val)

    pdf.ln(2)
    pdf.section_header("3. PURCHASE PRICE & DEPOSIT")
    initial_dep = round(prop["price"] * 0.035)
    addl_dep = round(mtg["down_payment"] * 0.30)
    bal_dp = mtg["down_payment"] - initial_dep - addl_dep

    pdf.gold_banner("PURCHASE PRICE:", f"${prop['price']:,.2f} CAD")
    for lbl, val in [
        ("Initial Deposit:", f"${initial_dep:,.2f} (paid to listing brokerage)"),
        ("Additional Deposit:", f"${addl_dep:,.2f}"),
        ("Balance of Down Payment:", f"${bal_dp:,.2f}"),
        ("Total Down Payment:", f"${mtg['down_payment']:,.2f} ({mtg['down_pct']}% of Purchase Price)"),
        ("Mortgage Required:", f"${mtg['loan']:,.2f}"),
    ]:
        pdf.label_value_row(lbl, val)

    pdf.ln(2)
    pdf.section_header("4. DATES")
    for lbl, val in [
        ("Offer Date:", "February 18, 2025"),
        ("Acceptance Deadline:", "February 21, 2025 at 11:59 PM"),
        ("Condition Date:", "March 5, 2025"),
        ("Possession Date:", "April 15, 2025"),
        ("Completion Date:", "April 14, 2025"),
    ]:
        pdf.label_value_row(lbl, val)

    # Page 2: Conditions
    pdf.header_ref = "Page 2 of 3"
    pdf.add_page()
    pdf.section_header("5. CONDITIONS")
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "  5.1  FINANCING CONDITION", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.multi_cell(0, 4,
        "This Contract is conditional upon the Buyer arranging, at the Buyer's own expense, mortgage financing "
        "satisfactory to the Buyer in the Buyer's sole discretion on or before March 5, 2025. This condition is "
        "for the sole benefit of the Buyer. If this condition is not satisfied or waived on or before the Condition "
        "Date, this Contract shall be null and void and the deposit(s) shall be returned to the Buyer.")
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "  5.2  HOME INSPECTION CONDITION", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.multi_cell(0, 4,
        "This Contract is conditional upon the Buyer obtaining, at the Buyer's own expense, a home inspection "
        "satisfactory to the Buyer in the Buyer's sole discretion by a qualified home inspector on or before "
        "March 5, 2025. This condition is for the sole benefit of the Buyer.")
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "  5.3  TITLE SEARCH CONDITION", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.multi_cell(0, 4,
        "This Contract is conditional upon the Buyer's solicitor being satisfied with the title to the Property "
        "on or before March 10, 2025. Title shall be good and marketable and free from all encumbrances except "
        "those specifically permitted herein.")
    pdf.ln(4)

    pdf.section_header("6. INCLUSIONS & EXCLUSIONS")
    pdf.label_value_row("Included:", "All window coverings, light fixtures, appliances (refrigerator, stove, dishwasher, washer, dryer), garage door openers.")
    pdf.label_value_row("Excluded:", "Seller's personal items not affixed to the property.")
    pdf.ln(3)

    pdf.section_header("7. TAXES & ADJUSTMENTS")
    annual_tax = p["prop_tax"]["annual_tax"]
    monthly_tax = round(annual_tax / 12, 2)
    pdf.label_value_row("Annual Property Tax:", f"${annual_tax:,.2f}")
    pdf.label_value_row("Monthly Portion:", f"${monthly_tax:,.2f}")
    pdf.label_value_row("Tax Adjustment:", "Adjusted as of Completion Date. Seller pays up to and including Completion Date.")
    pdf.label_value_row("GST:", "No GST applicable -- this is a resale residential property.")

    pdf.ln(3)
    pdf.section_header("9. REPRESENTATIONS & WARRANTIES")
    pdf.set_font("Helvetica", "", 7)
    for clause in [
        "9.1 The Seller warrants that the Property will be in the same condition on the Completion Date as on the date of acceptance, reasonable wear and tear excepted.",
        "9.2 The Seller is not aware of any material latent defects in the Property that are not disclosed herein.",
        "9.3 The Seller warrants that all appliances and mechanical systems will be in good working order on the Completion Date.",
    ]:
        pdf.multi_cell(0, 4, clause)
        pdf.ln(1)

    # Page 3: Signatures
    pdf.header_ref = "Page 3 of 3"
    pdf.add_page()
    pdf.section_header("10. ACCEPTANCE & SIGNATURES")
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 8)
    pdf.multi_cell(0, 5,
        "This offer, when accepted, shall constitute a binding contract of purchase and sale. The parties confirm "
        "they have read and understood this contract in its entirety and have had the opportunity to seek independent legal advice.")
    pdf.ln(4)

    # Signature boxes
    def sig_box(title, name, role, date_str):
        x0 = pdf.get_x()
        y0 = pdf.get_y()
        bw = 88
        pdf.set_draw_color(*DARK_BLUE)
        pdf.rect(x0, y0, bw, 28)
        pdf.set_xy(x0 + 2, y0 + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(80, 4, title)
        pdf.set_xy(x0 + 2, y0 + 5)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(80, 4, f"Name: {name}")
        pdf.set_xy(x0 + 2, y0 + 9)
        pdf.cell(80, 4, f"Role: {role}")
        pdf.set_xy(x0 + 2, y0 + 15)
        pdf.set_font("Helvetica", "BI", 10)
        pdf.cell(80, 5, name.split()[0][0] + ". " + name.split()[-1] if len(name.split()) > 1 else name)
        pdf.set_xy(x0 + 2, y0 + 20)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(80, 3, "Signature")
        pdf.set_xy(x0 + 2, y0 + 23)
        pdf.cell(80, 4, date_str)
        return bw

    # Buyer 1
    bw = sig_box("BUYER #1", p["applicant"]["full_name"], "Buyer", "02/18/2025")
    pdf.set_xy(10 + bw + 4, pdf.get_y())
    if p["has_co_applicant"] and p["co_applicant"]:
        sig_box("BUYER #2", p["co_applicant"]["full_name"], "Buyer", "02/18/2025")
    pdf.set_y(pdf.get_y() + 32)

    # Seller
    sig_box("SELLER", p["seller_name"].split("(")[0].strip(), "Seller", "02/20/2025")
    pdf.set_y(pdf.get_y() + 32)

    # Realtors
    sig_box("BUYER'S REALTOR", p["buyer_realtor"], f"Licensed Realtor -- {p['purchase_brokerage']}", "02/18/2025")
    pdf.set_xy(10 + bw + 4, pdf.get_y())
    sig_box("SELLER'S REALTOR", p["seller_realtor"], f"Licensed Realtor -- {p['seller_brokerage']}", "02/20/2025")
    pdf.set_y(pdf.get_y() + 34)

    # Acceptance banner
    pdf.set_fill_color(*GOLD)
    pdf.set_text_color(*DARK_BLUE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 8, "  CONTRACT ACCEPTED -- February 20, 2025 at 6:42 PM EST", fill=True, align="C", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*WHITE)
    pdf.set_fill_color(*GOLD)
    pdf.cell(0, 5, "Conditions waived March 4, 2025  |  Binding Agreement in Full Force and Effect", fill=True, align="C", ln=True)
    pdf.set_text_color(*BLACK)

    pdf.output(os.path.join(out_dir, "06_purchase_agreement.pdf"))


def gen_07_investment_statements(p, out_dir):
    """Investment account summary."""
    pdf = StyledPDF("", "INVESTMENT ACCOUNT STATEMENT")
    pdf.header_color = (30, 55, 60)  # Dark teal
    pdf.footer_extra = "Market values are as of the last business day of the statement period. Past performance does not guarantee future results."

    people = [("applicant", p["applicant"])]
    if p["has_co_applicant"] and p["co_applicant"]:
        people.append(("co_applicant", p["co_applicant"]))

    holders = p["applicant"]["full_name"]
    if p["has_co_applicant"] and p["co_applicant"]:
        holders += f" & {p['co_applicant']['full_name']}"

    for role, person in people:
        rrsp = person.get("rrsp_value", 0)
        tfsa = person.get("tfsa_value", 0)
        if rrsp <= 0 and tfsa <= 0:
            continue

        # Build list of accounts to render (supports both RRSP and TFSA for one person)
        accounts = []
        if rrsp > 0:
            accounts.append(("RRSP Account", rrsp, person.get("rrsp_institution", ""), person.get("rrsp_acct", ""), "rrsp"))
        if tfsa > 0:
            accounts.append(("TFSA Account", tfsa, person.get("tfsa_institution", ""), person.get("tfsa_acct", ""), "tfsa"))

        for acct_type, value, inst, acct_id, acct_kind in accounts:
            pdf.company_name = f"{inst}"
            pdf.header_sub = f"Investment Services"
            pdf.header_ref = f"Period: January 1 - February 28, 2025"
            pdf.header_date = f"Acct: {acct_id}"
            pdf.add_page()

            # Account holder box
            y0 = pdf.get_y()
            pdf.set_draw_color(*(30, 55, 60))
            pdf.rect(10, y0, 105, 18)
            pdf.rect(117, y0, 80, 18)
            pdf.set_xy(12, y0 + 1)
            pdf.set_font("Helvetica", "B", 7)
            pdf.cell(100, 4, "ACCOUNT HOLDER")
            pdf.set_xy(12, y0 + 5)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(100, 4, holders)
            pdf.set_xy(12, y0 + 9)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(100, 4, p["applicant"]["address"])
            pdf.set_xy(12, y0 + 13)
            pdf.cell(100, 4, f"Account Type: {acct_type} ({person['full_name'].split()[0]} {person['full_name'].split()[-1]})")

            pdf.set_xy(119, y0 + 1)
            pdf.set_font("Helvetica", "", 6)
            pdf.cell(70, 4, "OPENING MARKET VALUE")
            pdf.set_xy(119, y0 + 5)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(70, 5, fmt(value))
            pdf.set_xy(119, y0 + 11)
            pdf.set_font("Helvetica", "", 6)
            pdf.cell(70, 3, "CLOSING MARKET VALUE")
            pdf.set_xy(119, y0 + 14)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(70, 4, fmt(value))

            pdf.set_y(y0 + 22)

            # Holdings table
            cols = ["HOLDING", "TYPE", "UNITS", "PRICE", "MARKET VALUE", "RETURN"]
            widths = [50, 30, 20, 20, 35, 20]
            pdf.table_header(cols, widths, (30, 55, 60))

            # Generate realistic holdings
            if acct_kind == "rrsp":
                holdings = [
                    ("Balanced Growth Fund", "Mutual Fund", round(value * 0.55 / 52.30, 1), 52.30, round(value * 0.55), "+3.6%"),
                    ("Canadian Bond Fund", "Fixed Income", round(value * 0.25 / 24.80, 0), 24.80, round(value * 0.25), "+1.2%"),
                    ("Cash / Money Market", "Cash Equiv.", 1, round(value * 0.20, 2), round(value * 0.20), "+0.2%"),
                ]
            else:  # TFSA
                holdings = [
                    ("Wealthsimple Growth", "ETF Portfolio", round(value * 0.70 / 18.50, 1), 18.50, round(value * 0.70), "+5.1%"),
                    ("Cash / Money Market", "Cash Equiv.", 1, round(value * 0.30, 2), round(value * 0.30), "+0.2%"),
                ]

            for name, typ, units, price, mkt_val, ret in holdings:
                pdf.table_row([f" {name}", typ, f"{units:.1f}", f"${price:.2f}", fmt(mkt_val), ret], widths)

            pdf.set_fill_color(*(30, 55, 60))
            pdf.set_text_color(*WHITE)
            pdf.set_font("Helvetica", "B", 7)
            pdf.cell(widths[0] + widths[1] + widths[2] + widths[3], 5, " TOTAL PORTFOLIO VALUE", fill=True)
            pdf.cell(widths[4], 5, fmt(value), fill=True, align="R")
            pdf.cell(widths[5], 5, "+0.0%", fill=True, align="R")
            pdf.ln()
            pdf.set_text_color(*BLACK)

    pdf.output(os.path.join(out_dir, "07_investment_statements.pdf"))


def gen_08_other_property_docs(p, out_dir):
    """Other property documentation -- statutory declaration for 'no other property'."""
    pdf = StyledPDF("STATUTORY DECLARATION", "No Other Real Property")
    pdf.header_sub = f"Province of {p['prov_long']} -- Canada Evidence Act"
    pdf.add_page()

    holders = p["applicant"]["full_name"]
    if p["has_co_applicant"] and p["co_applicant"]:
        holders += f" & {p['co_applicant']['full_name']}"

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "STATUTORY DECLARATION -- NO OTHER REAL PROPERTY", align="C", ln=True)
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5,
        f"I/We, {holders}, of {p['applicant']['address']}, do solemnly declare that:")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 9)
    declarations = [
        "1. I/We do not own any other real property, either solely or jointly, in any province or territory of Canada or in any foreign jurisdiction.",
        "2. I/We do not have any legal or beneficial interest in any other real property.",
        "3. The property described in our mortgage application is intended as our primary residence.",
        f"4. Subject Property: {p['property']['address']}",
        f"5. Purchase Price: ${p['property']['price']:,.2f}",
    ]
    for d in declarations:
        pdf.multi_cell(0, 5, d)
        pdf.ln(2)

    pdf.ln(4)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5,
        "I/We make this solemn declaration conscientiously believing it to be true and knowing that it is of "
        "the same force and effect as if made under oath.")
    pdf.ln(6)

    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, f"DECLARED AT: {p['applicant']['city']}, {p['province']}  THIS 14th DAY OF March, 2025", ln=True)
    pdf.ln(6)

    # Signatures
    pdf.set_font("Helvetica", "BI", 11)
    pdf.cell(90, 6, p["applicant"]["short_name"], ln=False)
    if p["has_co_applicant"] and p["co_applicant"]:
        pdf.cell(90, 6, p["co_applicant"]["short_name"])
    pdf.ln()
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(90, 4, "Declarant", ln=False)
    if p["has_co_applicant"] and p["co_applicant"]:
        pdf.cell(90, 4, "Co-Declarant")
    pdf.ln()

    pdf.output(os.path.join(out_dir, "08_other_property_docs.pdf"))


def gen_09_mortgage_application(p, out_dir):
    """Mortgage application form."""
    pdf = StyledPDF("AXIOM MORTGAGE SOLUTIONS", "MORTGAGE APPLICATION")
    pdf.header_sub = "133 - 1 Street N.W. | Airdrie, Alberta | T4B 0R3 | axiommortgage.ca"
    pdf.footer_extra = "Suite 102, 2016 Sherwood Drive | Sherwood Park, AB | T8A 3X3 | axiommortgage.ca"

    app = p["applicant"]
    prop = p["property"]
    mtg = p["mortgage"]

    # Page 1: Applicant
    pdf.add_page()
    pdf.section_header("APPLICANT")
    title_check = "MR." if app["sex"] == "M" else ("MRS." if p["has_co_applicant"] else "MS.")
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 5, f"  [X] {title_check}    DEPENDANTS: 0", ln=True)

    fields = [
        ("NAME (First/Initial/Last):", app["short_name"]),
        ("EMAIL:", app["email"]),
        ("HOME PH:", app["phone"]),
        ("SIN #:", app["sin"]),
        ("DOB (MM/DD/YYYY):", "/".join(app["dob"].split("-")[::-1]) if "-" in app["dob"] else app["dob"]),
        ("MARITAL STATUS:", "Married" if p["has_co_applicant"] else "Single"),
    ]
    for lbl, val in fields:
        pdf.label_value_row(lbl, val)

    pdf.ln(2)
    pdf.section_header("CURRENT ADDRESS")
    pdf.label_value_row("ADDRESS:", app["address"])
    pdf.label_value_row("CITY:", f"{app['city']}  PROV: {app['prov']}  PC: {app['pc']}")

    pdf.ln(2)
    pdf.section_header("CURRENT EMPLOYMENT INFORMATION")
    emp_fields = [
        ("EMPLOYER:", app["employer"]),
        ("ADDRESS:", app["employer_addr"]),
        ("PHONE:", app["employer_phone"]),
        ("OCCUPATION:", app["position"]),
        ("START DATE:", f"{app['emp_start_short']}    YEARS/MONTHS: {app['emp_years']}"),
        ("GROSS SALARY:", f"${app['salary']:,.2f}/yr"),
    ]
    for lbl, val in emp_fields:
        pdf.label_value_row(lbl, val)
    noa1 = app["noa_2024_employment"] + app["noa_2024_other"]
    noa2 = app["noa_2023_employment"] + app["noa_2023_other"]
    pdf.label_value_row("MOST RECENT 2 YRS NOA:", f"1. ${noa1:,.2f} (2024)    2. ${noa2:,.2f} (2023)")

    # Page 2: Co-applicant (if any)
    if p["has_co_applicant"] and p["co_applicant"]:
        co = p["co_applicant"]
        pdf.add_page()
        pdf.section_header("CO-APPLICANT")
        title_check2 = "MRS." if co["sex"] == "F" else "MR."
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(0, 5, f"  [X] {title_check2}    DEPENDANTS: 0", ln=True)
        co_fields = [
            ("NAME (First/Initial/Last):", co["short_name"]),
            ("EMAIL:", co["email"]),
            ("HOME PH:", co["phone"]),
            ("SIN #:", co["sin"]),
            ("DOB (MM/DD/YYYY):", "/".join(co["dob"].split("-")[::-1]) if "-" in co["dob"] else co["dob"]),
            ("MARITAL STATUS:", "Married"),
        ]
        for lbl, val in co_fields:
            pdf.label_value_row(lbl, val)
        pdf.ln(2)
        pdf.section_header("CURRENT ADDRESS (CO-APPLICANT)")
        pdf.label_value_row("ADDRESS:", co["address"])
        pdf.ln(2)
        pdf.section_header("CURRENT EMPLOYMENT (CO-APPLICANT)")
        co_emp_fields = [
            ("EMPLOYER:", co["employer"]),
            ("ADDRESS:", co["employer_addr"]),
            ("PHONE:", co["employer_phone"]),
            ("OCCUPATION:", co["position"]),
            ("START DATE:", f"{co['emp_start_short']}    YEARS/MONTHS: {co['emp_years']}"),
            ("GROSS SALARY:", f"${co['salary']:,.2f}/yr"),
        ]
        for lbl, val in co_emp_fields:
            pdf.label_value_row(lbl, val)
        co_noa1 = co["noa_2024_employment"] + co["noa_2024_other"]
        co_noa2 = co["noa_2023_employment"] + co["noa_2023_other"]
        pdf.label_value_row("MOST RECENT 2 YRS NOA:", f"1. ${co_noa1:,.2f} (2024)    2. ${co_noa2:,.2f} (2023)")

    # Final page: Finances + Subject Property
    pdf.add_page()
    pdf.section_header("FINANCIAL INFORMATION -- ASSETS & LIABILITIES")

    # Assets
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(95, 5, "  ASSETS", ln=False)
    pdf.cell(95, 5, "  LIABILITIES", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.label_value_row("CHEQUING/SAVING:", f"${p['bank']['savings']:,.0f} at {p['bank']['institution']}")
    pdf.label_value_row("RRSP:", f"${app.get('rrsp_value', 0):,.0f}" if app.get('rrsp_value', 0) > 0 else "N/A")
    if app.get("tfsa_value", 0) > 0:
        pdf.label_value_row("TFSA:", f"${app['tfsa_value']:,.0f} at {app['tfsa_institution']}")

    pdf.ln(2)
    pdf.section_header("AUTOMOBILES")
    car = p["car"]
    if car:
        pdf.label_value_row("VEHICLE:", f"{car['year']} {car['make']} {car['model']}")
        pdf.label_value_row("LOAN BALANCE:", f"${car['balance']:,.2f} at ${car['monthly']}/mo")
    else:
        pdf.label_value_row("VEHICLE:", "None -- No auto loan on file")

    pdf.ln(2)
    pdf.section_header("SUBJECT PROPERTY DESCRIPTION")
    sp_fields = [
        ("ADDRESS:", prop["address"]),
        ("CITY:", f"{prop['city']}    PROVINCE: {prop['prov']}    POSTAL CODE: {prop['pc']}"),
        ("PROPERTY TYPE:", prop["type"]),
        ("HOUSE SIZE:", f"{prop['sqft']:,} sq ft"),
        ("PURCHASE PRICE:", f"${prop['price']:,.2f}"),
        ("CONDO FEE:", prop.get("condo_fee", "N/A")),
    ]
    for lbl, val in sp_fields:
        pdf.label_value_row(lbl, val)

    pdf.ln(4)
    pdf.section_header("CONSENT")
    pdf.set_font("Helvetica", "", 6)
    pdf.multi_cell(0, 3.5,
        "I/we warrant and confirm that the information given in this mortgage application is true and correct "
        "and I/we understand it is being used to determine my/our credit responsibility. You are authorized to "
        "obtain any information you may require relative to this application from any sources to which you may "
        "apply, and each such source is authorized to provide you with such information.")
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, f"DATED AT: {prop['city']}, {prop['prov']}  THIS 14th DAY OF March, 2025", ln=True)
    pdf.ln(4)

    # Signatures
    x0 = 10
    bw = 90
    pdf.set_draw_color(*GOLD)
    pdf.rect(x0, pdf.get_y(), bw, 18)
    pdf.set_xy(x0 + 2, pdf.get_y() + 1)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(80, 4, "SIGNATURE OF APPLICANT")
    pdf.set_xy(x0 + 2, pdf.get_y() + 5)
    pdf.set_font("Helvetica", "BI", 11)
    pdf.cell(80, 5, app["short_name"])
    pdf.set_xy(x0 + 2, pdf.get_y() + 6)
    pdf.set_font("Helvetica", "", 6)
    pdf.cell(80, 4, "Dated: 03/14/2025")

    if p["has_co_applicant"] and p["co_applicant"]:
        co = p["co_applicant"]
        x1 = x0 + bw + 6
        y_sig = pdf.get_y() - 10
        pdf.set_xy(x1, y_sig)
        pdf.rect(x1, y_sig, bw, 18)
        pdf.set_xy(x1 + 2, y_sig + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(80, 4, "SIGNATURE OF CO-APPLICANT")
        pdf.set_xy(x1 + 2, y_sig + 6)
        pdf.set_font("Helvetica", "BI", 11)
        pdf.cell(80, 5, co["short_name"])
        pdf.set_xy(x1 + 2, y_sig + 12)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(80, 4, "Dated: 03/14/2025")

    pdf.output(os.path.join(out_dir, "09_mortgage_application.pdf"))


def gen_10_utility_bills(p, out_dir):
    """Two utility bills."""
    first_util = p["utilities"][0]
    pdf = StyledPDF(first_util["company"], first_util["bill_type"])

    for idx, util in enumerate(p["utilities"]):
        if idx == 0:
            header_colors = DARK_BLUE
        else:
            header_colors = UTIL_BROWN if "Gas" in util["bill_type"] else DARK_BLUE

        pdf.header_color = header_colors
        pdf.company_name = util["company"]
        pdf.doc_title = util["bill_type"]
        pdf.header_sub = f"{util['addr']} | {util['phone']} | {util['website']}"
        pdf.header_ref = f"Account: {util['acct']}"
        pdf.header_date = f"Bill Date: February 28, 2025"
        pdf.add_page()
        pdf.footer_extra = f"Questions about your bill? Contact {util['company']} at the number above or visit their website."

        # Service address and amount box
        y0 = pdf.get_y()
        pdf.set_draw_color(*header_colors)
        pdf.rect(10, y0, 95, 20)
        pdf.set_xy(12, y0 + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(0, 4, "SERVICE ADDRESS")
        pdf.set_xy(12, y0 + 5)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(90, 4, p["applicant"]["address"])
        pdf.set_xy(12, y0 + 10)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(0, 4, "BILLING PERIOD")
        pdf.set_xy(12, y0 + 14)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(90, 4, "January 29 - February 27, 2025 (30 days)")

        # Amount due box
        pdf.rect(110, y0, 87, 20)
        pdf.set_xy(112, y0 + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(30, 4, "PREVIOUS BALANCE")
        pdf.set_xy(150, y0 + 1)
        pdf.set_text_color(*GOLD)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(40, 4, "AMOUNT DUE")
        pdf.set_xy(150, y0 + 5)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(40, 6, fmt(util["amount"]))
        pdf.set_text_color(*BLACK)
        pdf.set_xy(112, y0 + 5)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(30, 4, "$0.00")
        pdf.set_xy(112, y0 + 10)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(35, 3, f"PAYMENT RECEIVED -- THANK YOU")
        pdf.set_xy(112, y0 + 13)
        pdf.cell(35, 3, f"- ${util['prev_paid']:,.2f}")
        pdf.set_xy(150, y0 + 12)
        pdf.set_font("Helvetica", "", 6)
        pdf.cell(40, 4, "Due: March 21, 2025")

        pdf.set_y(y0 + 24)

        # Charge table
        cols = ["CHARGE DESCRIPTION", "CATEGORY", "AMOUNT"]
        widths = [100, 45, 45]
        pdf.table_header(cols, widths, header_colors)

        subtotal = round(util["amount"] / 1.05, 2)  # Back out 5% GST
        gst = round(util["amount"] - subtotal, 2)

        charges = [
            ("Basic/Customer charge", "", "$12.50"),
            ("Energy consumption charges", "", fmt(subtotal - 12.50)),
        ]
        for desc, cat, amt in charges:
            pdf.table_row([f" {desc}", cat, amt], widths)

        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(widths[0] + widths[1], 5, " Subtotal")
        pdf.cell(widths[2], 5, fmt(subtotal), align="R")
        pdf.ln()
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(widths[0] + widths[1], 5, " GST (5%)")
        pdf.cell(widths[2], 5, fmt(gst), align="R")
        pdf.ln()

        pdf.set_fill_color(*GOLD)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(widths[0] + widths[1], 6, " TOTAL CHARGES THIS PERIOD", fill=True)
        pdf.cell(widths[2], 6, fmt(util["amount"]), fill=True, align="R")
        pdf.ln()
        pdf.set_text_color(*BLACK)

    pdf.output(os.path.join(out_dir, "10_utility_bills.pdf"))


def gen_11_credit_report(p, out_dir):
    """Equifax credit report."""
    pdf = StyledPDF("Equifax Canada Co.", "CREDIT REPORT -- CONFIDENTIAL")
    pdf.header_color = EQUIFAX_DARK
    pdf.header_sub = "Consumer Credit Report | Box 190 Jean Talon, Montreal, QC H1S 2Z2 | equifax.ca | 1-800-465-7166"
    pdf.footer_extra = "This report is provided in confidence to the requesting party. Consumer has the right to dispute inaccuracies under PIPEDA."
    pdf.footer_text = "SYNTHETIC DOCUMENT -- FOR DEMONSTRATION PURPOSES ONLY | equifax.ca"

    people = [p["applicant"]]
    if p["has_co_applicant"] and p["co_applicant"]:
        people.append(p["co_applicant"])

    for person in people:
        pdf.header_ref = f"File #: EFX-CA-2025-0218-{person['sin'][:3].replace('-','')}"
        pdf.header_date = "Report Date: February 18, 2025"
        pdf.add_page()

        # Red separator line
        pdf.set_fill_color(200, 30, 30)
        pdf.rect(0, 28, pdf.w, 1.5, "F")
        pdf.set_y(33)

        # Consumer info + score box
        y0 = pdf.get_y()
        pdf.set_draw_color(*DARK_GRAY)
        pdf.rect(10, y0, 110, 24)
        pdf.set_xy(12, y0 + 1)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(0, 4, "CONSUMER INFORMATION")
        pdf.set_xy(12, y0 + 5)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(100, 5, person["full_name"])
        pdf.set_xy(12, y0 + 10)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(100, 4, f"DOB: {person['dob']} | SIN: {person['sin']}")
        pdf.set_xy(12, y0 + 14)
        pdf.cell(100, 4, f"Current: {person['address']}")
        pdf.set_xy(12, y0 + 18)
        pdf.cell(100, 4, f"Employer: {person['employer']}, {person['city']}, {person['prov']}")

        # Score circle
        score = person["credit_score"]
        cx = 155
        cy = y0 + 12
        # Draw circle outline
        pdf.set_draw_color(*EQUIFAX_GREEN)
        pdf.set_line_width(1.5)
        pdf.ellipse(cx - 14, cy - 14, 28, 28)
        pdf.set_line_width(0.2)
        # Score text
        pdf.set_xy(cx - 12, cy - 6)
        pdf.set_font("Helvetica", "", 5)
        pdf.set_text_color(*EQUIFAX_GREEN)
        pdf.cell(24, 4, person["credit_rating"].split("--")[0].strip(), align="C")
        pdf.set_xy(cx - 12, cy - 2)
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(24, 8, str(score), align="C")
        pdf.set_xy(cx - 12, cy + 6)
        pdf.set_font("Helvetica", "", 5)
        pdf.cell(24, 3, "CREDIT SCORE", align="C")
        pdf.set_text_color(*BLACK)
        pdf.set_xy(cx - 16, cy + 12)
        pdf.set_font("Helvetica", "", 5)
        pdf.cell(32, 3, "Scale: 300 - 900 (Equifax)", align="C")

        pdf.set_y(y0 + 28)

        # Accounts table
        cols = ["CREDITOR / ACCOUNT", "TYPE", "OPENED", "STATUS", "LIMIT", "BALANCE", "PAYMENT", "HISTORY"]
        widths = [38, 20, 17, 13, 18, 20, 22, 20]
        pdf.table_header(cols, widths, EQUIFAX_DARK)

        for acct in person["credit_accounts"]:
            row = [f" {acct[0]}", acct[1], acct[2], acct[3], acct[4], acct[5], acct[6], acct[7]]
            pdf.table_row(row, widths)

        pdf.ln(3)

        # Credit summary
        pdf.section_header("CREDIT SUMMARY", EQUIFAX_DARK)
        for lbl, val in [
            ("Total Open Accounts:", str(person["credit_open"])),
            ("Total Outstanding Balance:", person["credit_balance"]),
            ("Payment History:", person["credit_history"]),
            ("Derogatory Marks:", person["credit_derogatory"]),
            ("Collections / Judgments:", person["credit_collections"]),
            ("Bankruptcies:", person["credit_bankruptcies"]),
        ]:
            pdf.label_value_row(lbl, val)

        pdf.ln(3)

        # Inquiries
        pdf.section_header("CREDIT INQUIRIES (Last 24 Months)", EQUIFAX_DARK)
        for date, desc, inq_type in person["credit_inquiries"]:
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(30, 5, f"  {date}")
            pdf.cell(110, 5, desc)
            color = EQUIFAX_GREEN if "Soft" in inq_type else (200, 30, 30)
            pdf.set_text_color(*color)
            pdf.set_font("Helvetica", "B", 7)
            pdf.cell(40, 5, inq_type, align="R", ln=True)
            pdf.set_text_color(*BLACK)

    pdf.output(os.path.join(out_dir, "11_credit_report.pdf"))


def gen_12_car_loan_statement(p, out_dir):
    """Auto loan statement (or 'No Auto Loan' declaration if car is None)."""
    car = p["car"]
    if car is None:
        # Generate a simple "No Auto Loan on File" statement
        pdf = StyledPDF("AUTO LOAN SERVICES", "NO AUTO LOAN ON FILE")
        pdf.header_color = SCOTIA_RED
        pdf.header_sub = "Consumer Auto Loan Records"
        pdf.add_page()
        pdf.ln(8)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(*DARK_BLUE)
        pdf.cell(0, 8, "NO AUTO LOAN ON FILE", align="C", ln=True)
        pdf.set_text_color(*BLACK)
        pdf.ln(6)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6,
            f"This document confirms that {p['applicant']['full_name']} of "
            f"{p['applicant']['address']} does not currently have any outstanding "
            f"automobile loans, vehicle financing agreements, or auto leases on file.")
        pdf.ln(4)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5,
            "No monthly vehicle payment obligations exist. The applicant has indicated "
            "that they rely on public transit and cycling for transportation.")
        pdf.ln(6)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(0, 5, "Statement Date: February 28, 2025", ln=True)
        pdf.cell(0, 5, "SYNTHETIC DOCUMENT -- FOR DEMONSTRATION PURPOSES ONLY", ln=True)
        pdf.output(os.path.join(out_dir, "12_car_loan_statement.pdf"))
        return
    pdf = StyledPDF(car["lender"], "AUTO LOAN STATEMENT")
    pdf.header_color = SCOTIA_RED
    pdf.header_sub = f"{car['lender_addr']}"
    pdf.header_ref = f"Statement Date: February 28, 2025"
    initials = "".join(w[0] for w in p["applicant"]["full_name"].split())
    pdf.header_date = f"Loan Account: AUTO-{car['year']}-{initials}"
    pdf.footer_extra = f"{car['lender']} | For inquiries: 1-800-472-6842"
    pdf.add_page()

    # Borrower + Vehicle info boxes
    y0 = pdf.get_y()
    pdf.set_draw_color(*SCOTIA_RED)
    pdf.rect(10, y0, 92, 28)
    pdf.rect(105, y0, 92, 28)

    pdf.set_xy(12, y0 + 1)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 4, "BORROWER INFORMATION")
    pdf.set_xy(12, y0 + 5)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(85, 4, p["applicant"]["full_name"])
    pdf.set_xy(12, y0 + 9)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(85, 4, p["applicant"]["address"])
    pdf.set_xy(12, y0 + 13)
    pdf.cell(85, 4, f"Tel: {p['applicant']['phone']}")
    pdf.set_xy(12, y0 + 17)
    pdf.cell(85, 4, f"Email: {p['applicant']['email']}")
    pdf.set_xy(12, y0 + 21)
    pdf.cell(85, 4, f"SIN: {p['applicant']['sin']}")

    pdf.set_xy(107, y0 + 1)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*SCOTIA_RED)
    pdf.cell(0, 4, "VEHICLE INFORMATION")
    pdf.set_text_color(*BLACK)
    pdf.set_xy(107, y0 + 5)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(85, 4, f"{car['year']} {car['make']} {car['model']}")
    pdf.set_xy(107, y0 + 9)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(85, 4, f"VIN: {car['vin']}")
    pdf.set_xy(107, y0 + 13)
    pdf.cell(85, 4, f"Colour: {car['color']}")
    pdf.set_xy(107, y0 + 17)
    pdf.cell(85, 4, f"Licence: {car['licence']}")
    pdf.set_xy(107, y0 + 21)
    pdf.cell(85, 4, f"Dealership: {car['dealer']}")

    pdf.set_y(y0 + 32)

    # 4 key metrics
    metrics = [
        ("Original Loan Amount", fmt(car["original"])),
        ("Current Balance", fmt(car["balance"])),
        ("Monthly Payment", fmt(car["monthly"])),
        ("Next Payment Due", "March 15, 2025"),
    ]
    bw = (pdf.w - 20) / 4
    y1 = pdf.get_y()
    for i, (label, val) in enumerate(metrics):
        x = 10 + i * bw
        pdf.set_fill_color(*SCOTIA_RED)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_xy(x, y1)
        pdf.cell(bw - 1, 5, f"  {label}", fill=True)
        pdf.set_text_color(*BLACK)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_xy(x, y1 + 6)
        pdf.cell(bw - 1, 7, val, align="C")
    pdf.set_y(y1 + 16)

    # Loan details
    pdf.section_header("LOAN DETAILS", SCOTIA_RED)
    for lbl, val in [
        ("Loan Type:", "Closed-End Consumer Auto Loan"),
        ("Interest Rate:", f"{car['rate']}% per annum (fixed)"),
        ("Loan Term:", car["term"]),
        ("Payments Made:", f"{car['payments_made']} of {car['payments_total']}"),
        ("Payments Remaining:", str(car["payments_remaining"])),
    ]:
        pdf.label_value_row(lbl, val)

    pdf.ln(3)

    # Payment history
    pdf.section_header("RECENT PAYMENT HISTORY (Last 6 Months)", SCOTIA_RED)
    cols = ["DATE", "PAYMENT", "PRINCIPAL", "INTEREST", "BALANCE", "STATUS"]
    widths = [30, 25, 25, 25, 35, 25]
    pdf.table_header(cols, widths, SCOTIA_RED)

    balance = car["balance"]
    monthly_rate = car["rate"] / 100 / 12
    months_back = [
        "Feb 15, 2025", "Jan 15, 2025", "Dec 15, 2024",
        "Nov 15, 2024", "Oct 15, 2024", "Sep 15, 2024"
    ]
    for date in months_back:
        interest = round(balance * monthly_rate, 2)
        principal = round(car["monthly"] - interest, 2)
        pdf.table_row(
            [f" {date}", fmt(car["monthly"]), fmt(principal), fmt(interest), fmt(balance), "PAID"],
            widths
        )
        balance += principal  # Going backward

    pdf.ln(3)

    # Payoff progress bar
    pct_paid = round(car["payments_made"] / car["payments_total"] * 100)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 5, "LOAN PAYOFF PROGRESS", ln=True)
    bar_w = pdf.w - 20
    pdf.set_fill_color(*EQUIFAX_GREEN)
    pdf.rect(10, pdf.get_y(), bar_w * pct_paid / 100, 6, "F")
    pdf.set_fill_color(*MEDIUM_GRAY)
    pdf.rect(10 + bar_w * pct_paid / 100, pdf.get_y(), bar_w * (100 - pct_paid) / 100, 6, "F")
    pdf.set_xy(12, pdf.get_y() + 1)
    pdf.set_font("Helvetica", "B", 6)
    pdf.set_text_color(*WHITE)
    pdf.cell(bar_w * pct_paid / 100 - 4, 4, f"{pct_paid}% Paid")
    pdf.set_text_color(*BLACK)

    pdf.output(os.path.join(out_dir, "12_car_loan_statement.pdf"))


def gen_13_property_tax(p, out_dir):
    """Municipal property tax notice."""
    prop = p["property"]
    tax = p["prop_tax"]
    pdf = StyledPDF(tax["municipality"], f"PROPERTY TAX NOTICE -- 2025")
    pdf.header_color = SCOTIA_RED
    pdf.header_sub = f"{tax['muni_addr']} | {tax['phone']} | {tax['website']}"
    pdf.header_ref = f"Roll Number: {tax['roll_number']}"
    pdf.header_date = "Issued: March 1, 2025"
    pdf.footer_extra = f"Questions? Call {tax['phone']} or visit {tax['website']}. Assessment appeals must be filed by April 30, 2025."
    pdf.add_page()

    # Property address box
    holders = p["applicant"]["full_name"]
    if p["has_co_applicant"] and p["co_applicant"]:
        holders += f" & {p['co_applicant']['full_name']}"

    pdf.set_draw_color(*DARK_BLUE)
    y0 = pdf.get_y()
    pdf.rect(10, y0, pdf.w - 20, 22)
    pdf.set_xy(12, y0 + 1)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, "PROPERTY ADDRESS")
    pdf.set_xy(12, y0 + 5)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, prop["address"])
    pdf.set_xy(12, y0 + 10)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 4, f"Legal Description: {prop['legal_desc']}")
    pdf.set_xy(12, y0 + 14)
    pdf.cell(0, 4, f"Property Class: Residential -- {prop['type']} | Year Built: {prop['year_built']}")
    pdf.set_xy(12, y0 + 18)
    pdf.set_font("Helvetica", "", 6)
    pdf.cell(0, 3, f"REGISTERED OWNER: {holders} (Pending Transfer -- Completion April 14, 2025)")
    pdf.set_y(y0 + 26)

    # Assessed value
    assessed = tax["assessed_value"]
    prev = tax["prev_assessed"]
    change = assessed - prev
    change_pct = round(change / prev * 100, 1)
    land = round(assessed * 0.40)
    improvement = assessed - land

    pdf.section_header("ASSESSED VALUE -- January 1, 2025", SCOTIA_RED)
    for lbl, val in [
        ("Land Value:", fmt(land)),
        ("Improvement Value:", fmt(improvement)),
        ("Total Assessed Value:", fmt(assessed)),
        ("Previous Year Assessment (2024):", f"{fmt(prev)}    Change: +{fmt(change)} (+{change_pct}%)"),
    ]:
        pdf.label_value_row(lbl, val)

    pdf.ln(2)

    # Tax calculation
    annual = tax["annual_tax"]
    monthly = round(annual / 12, 2)
    muni_levy = round(annual * 0.63)
    edu_levy = round(annual * 0.34)
    other_levy = annual - muni_levy - edu_levy

    pdf.section_header("TAX CALCULATION -- 2025", SCOTIA_RED)
    pdf.label_value_row("Assessed Value:", fmt(assessed))
    pdf.label_value_row("Municipal Levy:", fmt(muni_levy))
    pdf.label_value_row("Education Levy:", fmt(edu_levy))
    pdf.label_value_row("Other Levies:", fmt(other_levy))
    pdf.ln(2)

    # Total tax banner
    pdf.gold_banner(f"TOTAL ANNUAL PROPERTY TAX -- 2025", fmt(annual))
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 4, f"Monthly equivalent: ${monthly:,.2f}", ln=True)

    pdf.ln(3)
    pdf.section_header("PAYMENT INFORMATION", SCOTIA_RED)
    for lbl, val in [
        ("Full Payment Due Date:", "June 30, 2025"),
        ("Payment Methods:", "Online banking, in-person, or by mail"),
        ("Late Payment Penalty:", "Penalty on unpaid balance after June 30, 2025"),
        ("Current Payment Status:", "NOTICE ISSUED -- Payment Pending (New Owner)"),
    ]:
        pdf.label_value_row(lbl, val)

    pdf.ln(4)
    pdf.info_box([
        ("NOTE FOR MORTGAGE LENDER:",),
        f"Property is subject to a change of ownership (Transfer pending). Annual tax of {fmt(annual)} to be confirmed post-transfer.",
    ])

    pdf.output(os.path.join(out_dir, "13_property_tax.pdf"))


def gen_14_property_inspection(p, out_dir):
    """Home inspection report (3 pages)."""
    insp = p["inspection"]
    prop = p["property"]
    pdf = StyledPDF(insp["company"], "HOME INSPECTION REPORT")
    pdf.header_color = INSPECTION_GREEN
    pdf.header_sub = f"{insp['company_addr']} | {insp['phone']}"
    pdf.footer_extra = f"This report is for the exclusive use of the named client. Inspector is not liable for defects discovered after date of inspection."

    buyers = p["applicant"]["full_name"]
    if p["has_co_applicant"] and p["co_applicant"]:
        buyers += f" & {p['co_applicant']['full_name']}"

    # Page 1
    pdf.header_ref = f"Report #: {insp['report_num']}"
    pdf.header_date = "Page 1 of 3"
    pdf.add_page()

    # Inspection details box
    y0 = pdf.get_y()
    pdf.set_draw_color(*INSPECTION_GREEN)
    pdf.rect(10, y0, pdf.w - 20, 24)
    for lbl, val in [
        ("Inspection Date:", f"{insp['date']} | Time: {insp['time']}"),
        ("Property Address:", prop["address"]),
        ("Client:", buyers),
        ("Inspector:", f"{insp['inspector']} | Lic #: {insp['lic']}"),
        ("Weather Conditions:", insp["weather"]),
    ]:
        pdf.set_xy(12, y0 + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(35, 4, lbl)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(140, 4, val)
        y0 += 4.5
    pdf.set_y(y0 + 4)

    # Overall assessment banner
    pdf.set_fill_color(*INSPECTION_GREEN)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(50, 7, "  OVERALL ASSESSMENT:", fill=True)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 7, f"  {insp['overall']}", fill=True, ln=True)
    pdf.set_text_color(*BLACK)
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 7)
    pdf.multi_cell(0, 4, insp["overall_detail"])
    pdf.ln(3)

    # Inspection sections
    def insp_section(title, items):
        pdf.check_page_space(25)
        pdf.section_header(title, INSPECTION_GREEN)
        for item_name, desc, rating in items:
            pdf.check_page_space(15)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(140, 5, f"  {item_name}")
            # Rating badge
            color = INSPECTION_GREEN if rating in ("SATISFACTORY", "GOOD") else GOLD if rating == "MONITOR" else (200, 30, 30)
            pdf.set_fill_color(*color)
            pdf.set_text_color(*WHITE)
            pdf.set_font("Helvetica", "B", 6)
            pdf.cell(40, 5, rating, fill=True, align="C", ln=True)
            pdf.set_text_color(*BLACK)
            pdf.set_font("Helvetica", "", 7)
            pdf.multi_cell(0, 3.5, f"  {desc}")
            pdf.ln(1)

    insp_section("1. ROOF & ATTIC", [
        ("Roof Covering", "Roof in good condition, adequate useful life remaining.", "SATISFACTORY"),
        ("Gutters & Downspouts", "Properly pitched, no leaks observed.", "SATISFACTORY"),
        ("Attic Insulation", "Adequate insulation levels for climate zone.", "SATISFACTORY"),
    ])

    insp_section("2. EXTERIOR", [
        ("Foundation (Visible)", "Foundation walls inspected -- no significant deficiencies." if "bob" not in p["slug"] else "Hairline cracks observed on east wall. Recommend structural engineer assessment.", "SATISFACTORY" if "bob" not in p["slug"] else "MONITOR"),
        ("Exterior Cladding", "Cladding in good condition overall.", "SATISFACTORY"),
        ("Windows & Doors", "Windows operate properly, weatherstripping intact." if "bob" not in p["slug"] else "3 of 14 window seals broken, condensation between panes.", "SATISFACTORY" if "bob" not in p["slug"] else "MONITOR"),
    ])

    # Page 2
    pdf.header_date = "Page 2 of 3"
    pdf.add_page()

    insp_section("3. INTERIOR -- STRUCTURE & FINISHES", [
        ("Floors", "Flooring in good condition throughout.", "GOOD"),
        ("Walls & Ceilings", "Painted drywall, minor cosmetic items only.", "SATISFACTORY"),
        ("Doors (Interior)", "All doors latch and operate properly.", "GOOD"),
    ])

    insp_section("4. PLUMBING", [
        ("Water Supply Lines", "Water pressure tested -- normal range. No evidence of leaks.", "SATISFACTORY"),
        ("Drain, Waste & Vent", "All fixtures drain freely.", "SATISFACTORY"),
        ("Hot Water Tank", "Hot water system functional.", "SATISFACTORY"),
    ])

    insp_section("5. HEATING & COOLING", [
        ("Furnace / HVAC", "HVAC system operational." if "bob" not in p["slug"] else "HVAC system original 1992 (33 years old). Functional but approaching end of useful life. Replacement recommended within 2-3 years.", "GOOD" if "bob" not in p["slug"] else "MONITOR"),
        ("Ductwork & Registers", "Ductwork in good condition.", "SATISFACTORY"),
    ])

    insp_section("6. ELECTRICAL", [
        ("Electrical Panel", "Panel in good condition, properly labelled.", "SATISFACTORY"),
        ("GFCI Protection", "GFCI outlets present and tested in all required locations.", "SATISFACTORY"),
        ("Smoke & CO Detectors", "All detectors tested and operational.", "SATISFACTORY"),
    ])

    # Page 3 -- Summary
    pdf.header_date = "Page 3 of 3"
    pdf.add_page()

    insp_section("7. KITCHEN & BATHROOMS", [
        ("Kitchen", "Kitchen in good condition." if "bob" not in p["slug"] else "Kitchen functional, some cabinet hardware loose.", "GOOD" if "bob" not in p["slug"] else "SATISFACTORY"),
        ("Bathrooms", "All bathrooms functional." if "john" not in p["slug"] else "Some grout cracking in bathroom. Balcony sliding door track needs cleaning.", "SATISFACTORY" if "john" not in p["slug"] else "MONITOR"),
    ])

    pdf.ln(3)
    pdf.section_header("8. SUMMARY OF FINDINGS", INSPECTION_GREEN)
    pdf.ln(1)

    # Immediate action
    immediate = insp.get("findings_immediate", [])
    pdf.set_fill_color(200, 30, 30)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 5, f"  IMMEDIATE ACTION REQUIRED ({len(immediate) if immediate else 'None'})", fill=True, ln=True)
    pdf.set_text_color(*BLACK)
    pdf.set_font("Helvetica", "", 7)
    if immediate:
        for item in immediate:
            pdf.cell(0, 5, f"  * {item}", ln=True)
    else:
        pdf.cell(0, 5, "  * None identified", ln=True)
    pdf.ln(2)

    # Monitor
    monitor = insp.get("findings_monitor", [])
    pdf.set_fill_color(*GOLD)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 5, f"  MONITOR / BUDGET FOR FUTURE ({len(monitor)} item(s))", fill=True, ln=True)
    pdf.set_text_color(*BLACK)
    pdf.set_font("Helvetica", "", 7)
    for item in monitor:
        pdf.cell(0, 5, f"  * {item}", ln=True)
    pdf.ln(2)

    # Maintenance
    maint = insp.get("findings_maintenance", [])
    pdf.set_fill_color(*EQUIFAX_GREEN)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 5, f"  MAINTENANCE NOTES ({len(maint)} item(s))", fill=True, ln=True)
    pdf.set_text_color(*BLACK)
    pdf.set_font("Helvetica", "", 7)
    for item in maint:
        pdf.cell(0, 5, f"  * {item}", ln=True)
    pdf.ln(4)

    # Inspector declaration
    pdf.set_draw_color(*INSPECTION_GREEN)
    y0 = pdf.get_y()
    pdf.rect(10, y0, pdf.w - 20, 24)
    pdf.set_xy(12, y0 + 1)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 4, "INSPECTOR DECLARATION")
    pdf.set_xy(12, y0 + 5)
    pdf.set_font("Helvetica", "", 6)
    pdf.multi_cell(pdf.w - 24, 3.5,
        f"I, {insp['inspector']}, Certified Home Inspector, confirm that this report was prepared following "
        f"the Standards of Practice of CAHPI and represents my professional opinion based on conditions observed "
        f"on the inspection date only. This report does not constitute a warranty or guarantee of any systems or components.")
    pdf.set_xy(12, y0 + 16)
    pdf.set_font("Helvetica", "BI", 10)
    pdf.cell(80, 5, insp["inspector"])
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(80, 5, f"Lic #{insp['lic']} | Date: {insp['date']}")

    pdf.output(os.path.join(out_dir, "14_property_inspection.pdf"))


# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════

GENERATORS = [
    gen_01_government_id,
    gen_02_employment_letter,
    gen_03_paystubs,
    gen_04_income_tax,
    gen_05_bank_statements,
    gen_06_purchase_agreement,
    gen_07_investment_statements,
    gen_08_other_property_docs,
    gen_09_mortgage_application,
    gen_10_utility_bills,
    gen_11_credit_report,
    gen_12_car_loan_statement,
    gen_13_property_tax,
    gen_14_property_inspection,
]


def main(only_slug=None):
    targets = {only_slug: PROFILES[only_slug]} if only_slug else PROFILES
    for slug, profile in targets.items():
        out_dir = os.path.join(DOCS_ROOT, slug)
        os.makedirs(out_dir, exist_ok=True)
        print(f"\n--- Generating PDFs for: {slug} ---")
        for gen_fn in GENERATORS:
            name = gen_fn.__name__.replace("gen_", "")
            try:
                gen_fn(profile, out_dir)
                print(f"  [OK] {name}")
            except Exception as e:
                print(f"  [FAIL] {name}: {e}")
                import traceback
                traceback.print_exc()
    total = len(targets) * len(GENERATORS)
    print(f"\nDone! Generated {total} PDFs across {len(targets)} profile(s).")


if __name__ == "__main__":
    import sys
    slug_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if slug_arg and slug_arg not in PROFILES:
        print(f"Unknown profile: {slug_arg}")
        print(f"Available: {', '.join(PROFILES.keys())}")
        sys.exit(1)
    main(only_slug=slug_arg)
