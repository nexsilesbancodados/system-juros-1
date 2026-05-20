import { describe, it, expect } from "vitest";
import {
  calculateLoan,
  deriveRateFromInstallment,
  generateInstallmentSchedule,
  periodLabelFor,
} from "@/lib/loanMath";

describe("calculateLoan", () => {
  it("retorna null se capital <= 0", () => {
    expect(calculateLoan({ capital: 0, rate: 10, periods: 10, frequency: "monthly", loanMode: "installments" })).toBeNull();
  });

  it("juros simples mensal por parcelas", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, periods: 10, frequency: "monthly", loanMode: "installments" })!;
    expect(r.totalInterest).toBeCloseTo(1000);
    expect(r.totalAmount).toBeCloseTo(2000);
    expect(r.installmentAmount).toBeCloseTo(200);
    expect(r.numInstallments).toBe(10);
    expect(r.schedule).toHaveLength(10);
    expect(r.schedule.every(v => Math.abs(v - 200) < 1e-9)).toBe(true);
  });

  it("percentage mensal sem nº = 1 pagamento", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, frequency: "monthly", loanMode: "percentage" })!;
    expect(r.numInstallments).toBe(1);
    expect(r.schedule).toEqual([1100]);
  });

  it("valueMode installment deriva taxa", () => {
    const r = calculateLoan({
      capital: 1000, periods: 10, installmentValue: 200,
      frequency: "monthly", loanMode: "installments", valueMode: "installment",
    })!;
    expect(r.derivedRate).toBeCloseTo(10);
  });

  it("interest_only: n-1 parcelas de juros + última com capital", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, periods: 5, frequency: "monthly", loanMode: "interest_only" })!;
    // 4 parcelas de 100 (juros) + 1 final de 1100
    expect(r.schedule).toEqual([100, 100, 100, 100, 1100]);
    expect(r.totalAmount).toBeCloseTo(1500);
    expect(r.totalInterest).toBeCloseTo(500);
    expect(r.installmentAmount).toBeCloseTo(100);
    expect(r.numInstallments).toBe(5);
  });

  it("price: PMT compostos uniformes", () => {
    // capital 1000, i=10%, n=10 → PMT ≈ 162.7454
    const r = calculateLoan({ capital: 1000, rate: 10, periods: 10, frequency: "monthly", loanMode: "price" })!;
    expect(r.installmentAmount).toBeCloseTo(162.7454, 2);
    expect(r.totalAmount).toBeCloseTo(1627.454, 1);
    expect(r.schedule).toHaveLength(10);
    expect(r.schedule[0]).toBeCloseTo(r.schedule[9]);
  });

  it("price com taxa 0% = capital/n", () => {
    const r = calculateLoan({ capital: 1000, rate: 0.0001, periods: 10, frequency: "monthly", loanMode: "price" })!;
    expect(r.installmentAmount).toBeCloseTo(100.05, 1);
  });

  it("bullet: 1 pagamento juros simples × N períodos", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, periods: 3, frequency: "monthly", loanMode: "bullet" })!;
    expect(r.numInstallments).toBe(1);
    expect(r.schedule).toEqual([1300]);
    expect(r.totalInterest).toBeCloseTo(300);
  });

  it("grace: parcelas zero na carência + parcelas iguais depois", () => {
    // capital 1000, 10%, 2 carências + 5 parcelas
    // capital' = 1000 * (1 + 0.1*2) = 1200; juros = 1200*0.1*5 = 600; total = 1800; parcela = 360
    const r = calculateLoan({
      capital: 1000, rate: 10, periods: 5, gracePeriods: 2,
      frequency: "monthly", loanMode: "grace",
    })!;
    expect(r.schedule).toHaveLength(7);
    expect(r.schedule.slice(0, 2)).toEqual([0, 0]);
    expect(r.schedule.slice(2).every(v => Math.abs(v - 360) < 1e-9)).toBe(true);
    expect(r.totalAmount).toBeCloseTo(1800);
    expect(r.numInstallments).toBe(7);
  });

  it("grace com 0 carências == installments", () => {
    const a = calculateLoan({ capital: 1000, rate: 10, periods: 5, gracePeriods: 0, frequency: "monthly", loanMode: "grace" })!;
    const b = calculateLoan({ capital: 1000, rate: 10, periods: 5, frequency: "monthly", loanMode: "installments" })!;
    expect(a.totalAmount).toBeCloseTo(b.totalAmount);
    expect(a.installmentAmount).toBeCloseTo(b.installmentAmount);
  });
});

describe("deriveRateFromInstallment", () => {
  it("calcula corretamente", () => {
    expect(deriveRateFromInstallment({ capital: 1000, installment: 200, periods: 10 })).toBeCloseTo(10);
  });
  it("retorna null em entradas inválidas", () => {
    expect(deriveRateFromInstallment({ capital: 0, installment: 200, periods: 10 })).toBeNull();
  });
});

describe("periodLabelFor", () => {
  it("mapeia frequências", () => {
    expect(periodLabelFor("daily")).toBe("dia");
    expect(periodLabelFor("monthly")).toBe("mês");
  });
});

describe("generateInstallmentSchedule", () => {
  it("mensal sem firstDueDate soma 1 mês a partir do start", () => {
    const dates = generateInstallmentSchedule({ startDate: "2025-01-15", count: 3, frequency: "monthly" });
    expect(dates).toHaveLength(3);
    expect(new Date(dates[0]).getMonth()).toBe(1);
  });

  it("bullet: 1 data N períodos no futuro (mensal)", () => {
    const dates = generateInstallmentSchedule({
      startDate: "2025-01-15", count: 1, frequency: "monthly", periodsAhead: 3,
    });
    expect(dates).toHaveLength(1);
    expect(new Date(dates[0]).getMonth()).toBe(3); // abril
  });

  it("custom usa datas fornecidas", () => {
    const dates = generateInstallmentSchedule({
      startDate: "2025-01-01", count: 2, frequency: "custom",
      customDates: ["2025-03-10", "2025-06-20"],
    });
    expect(new Date(dates[0]).toISOString().slice(0, 10)).toBe("2025-03-10");
  });
});
