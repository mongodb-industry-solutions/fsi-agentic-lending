"""Tests for the pure underwriting math functions extracted from underwriter.py."""
import pytest
from agents.pipeline.underwriter import (
    _calculate_mortgage_payment,
    calculate_gds_tds,
    run_stress_test,
    compute_risk_score,
)


class TestCalculateMortgagePayment:
    """Tests for _calculate_mortgage_payment."""

    def test_known_amortization(self):
        """Verify against a known amortization: $400k @ 5% / 25yr ≈ $2,338/mo."""
        payment = _calculate_mortgage_payment(400_000, 0.05, 25)
        assert 2330 <= payment <= 2345

    def test_zero_rate(self):
        payment = _calculate_mortgage_payment(300_000, 0.0, 25)
        assert payment == 1000  # 300000 / 300

    def test_zero_loan_amount(self):
        payment = _calculate_mortgage_payment(0, 0.05, 25)
        assert payment == 0

    def test_zero_years_zero_rate(self):
        payment = _calculate_mortgage_payment(100_000, 0.0, 0)
        assert payment == 0

    def test_high_rate(self):
        payment = _calculate_mortgage_payment(500_000, 0.15, 25)
        assert payment > 0

    def test_one_year_amortization(self):
        payment = _calculate_mortgage_payment(12_000, 0.0, 1)
        assert payment == 1000


class TestCalculateGdsTds:
    """Tests for calculate_gds_tds."""

    def test_basic_ratios(self):
        gds, tds = calculate_gds_tds(
            mortgage_payment=2000,
            property_tax_monthly=500,
            heating=250,
            existing_debt_payments=300,
            monthly_income=10_000,
        )
        assert abs(gds - 0.275) < 0.001
        assert abs(tds - 0.305) < 0.001

    def test_zero_debt(self):
        gds, tds = calculate_gds_tds(1000, 200, 100, 0, 5000)
        assert gds == tds  # no extra debt => GDS == TDS

    def test_at_gds_limit(self):
        """GDS exactly at 39%."""
        gds, tds = calculate_gds_tds(3000, 600, 300, 0, 10_000)
        assert abs(gds - 0.39) < 0.001

    def test_at_tds_limit(self):
        """TDS exactly at 44%: housing 2750 + debt 1650 = 4400 over 10k income."""
        gds, tds = calculate_gds_tds(2000, 500, 250, 1650, 10_000)
        assert abs(tds - 0.44) < 0.01

    def test_division_by_zero_raises(self):
        with pytest.raises(ZeroDivisionError):
            calculate_gds_tds(2000, 500, 250, 300, 0)


class TestRunStressTest:
    """Tests for run_stress_test (OSFI B-20)."""

    def test_stress_rate_floor(self):
        """When contract + 2% < 5.25%, stress rate should be 5.25%."""
        result = run_stress_test(
            loan_amount=400_000, annual_rate=0.03,
            monthly_income=10_000, property_tax_monthly=500,
            heating=250, existing_debt_payments=300,
        )
        assert result["stress_rate"] == 0.0525

    def test_stress_rate_contract_plus_two(self):
        """When contract + 2% > 5.25%, stress rate = contract + 2%."""
        result = run_stress_test(
            loan_amount=400_000, annual_rate=0.06,
            monthly_income=10_000, property_tax_monthly=500,
            heating=250, existing_debt_payments=300,
        )
        assert abs(result["stress_rate"] - 0.08) < 1e-9

    def test_pass_scenario(self):
        """High income, low debt => stress test passes."""
        result = run_stress_test(
            loan_amount=200_000, annual_rate=0.04,
            monthly_income=15_000, property_tax_monthly=300,
            heating=150, existing_debt_payments=200,
        )
        assert result["passed"] is True
        assert result["stress_gds"] <= 0.39
        assert result["stress_tds"] <= 0.44

    def test_fail_scenario(self):
        """Low income, high debt => stress test fails."""
        result = run_stress_test(
            loan_amount=600_000, annual_rate=0.05,
            monthly_income=5_000, property_tax_monthly=600,
            heating=300, existing_debt_payments=1500,
        )
        assert result["passed"] is False


class TestComputeRiskScore:
    """Tests for compute_risk_score."""

    def test_tier_a(self):
        score, tier = compute_risk_score(30, 0.25, 0.30)
        assert tier == "A"
        assert score <= 30

    def test_tier_b_plus(self):
        score, tier = compute_risk_score(70, 0.30, 0.38)
        assert tier == "B+"
        assert 31 <= score <= 50

    def test_tier_b(self):
        # base 70, gds 0.35 => -5, tds 0.50 => no adj => 65 => tier B (51..65)
        score, tier = compute_risk_score(70, 0.35, 0.50)
        assert tier == "B"
        assert 51 <= score <= 65

    def test_tier_c(self):
        # base 75, gds 0.40/tds 0.50 => no adjustments => 75 => tier C (66..80)
        score, tier = compute_risk_score(75, 0.40, 0.50)
        assert tier == "C"
        assert 66 <= score <= 80

    def test_tier_d(self):
        score, tier = compute_risk_score(100, 0.50, 0.60)
        assert tier == "D"
        assert score > 80

    def test_none_base_risk(self):
        """None base_risk defaults to 100."""
        score, tier = compute_risk_score(None, 0.25, 0.30)
        assert score == 75  # 100 - 15 (gds<=0.32) - 10 (tds<=0.40)

    def test_score_clamped_to_zero(self):
        score, tier = compute_risk_score(0, 0.20, 0.20)
        assert score == 0
        assert tier == "A"

    def test_score_clamped_to_100(self):
        score, tier = compute_risk_score(100, 0.50, 0.60)
        assert score == 100
        assert tier == "D"

    def test_gds_boundary_0_32(self):
        """GDS exactly 0.32 => -15 adjustment."""
        score_at, _ = compute_risk_score(50, 0.32, 0.50)
        score_above, _ = compute_risk_score(50, 0.33, 0.50)
        assert score_at < score_above

    def test_gds_boundary_0_39(self):
        """GDS exactly 0.39 => -5 adjustment."""
        score_at, _ = compute_risk_score(50, 0.39, 0.50)
        score_above, _ = compute_risk_score(50, 0.40, 0.50)
        assert score_at < score_above

    def test_tds_boundary_0_40(self):
        """TDS exactly 0.40 => -10 adjustment."""
        score_at, _ = compute_risk_score(50, 0.50, 0.40)
        score_above, _ = compute_risk_score(50, 0.50, 0.41)
        assert score_at < score_above
