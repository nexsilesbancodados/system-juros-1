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
  });

  it("diário por parcelas", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, periods: 10, frequency: "daily", loanMode: "installments" })!;
    expect(r.totalAmount).toBeCloseTo(2000);
    expect(r.perPeriodLabel).toBe("dia");
  });

  it("percentage mensal sem nº = 1 pagamento", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, frequency: "monthly", loanMode: "percentage" })!;
    expect(r.numInstallments).toBe(1);
    expect(r.installmentAmount).toBeCloseTo(1100);
  });

  it("percentage diário sem nº = auto periods (ceil(100/taxa))", () => {
    const r = calculateLoan({ capital: 1000, rate: 10, frequency: "daily", loanMode: "percentage" })!;
    expect(r.numInstallments).toBe(10);
    expect(r.installmentAmount).toBeCloseTo(100);
  });

  it("percentage com nº informado", () => {
    const r = calculateLoan({ capital: 1000, rate: 5, periods: 6, frequency: "weekly", loanMode: "percentage" })!;
    expect(r.totalInterest).toBeCloseTo(300);
    expect(r.totalAmount).toBeCloseTo(1300);
    expect(r.installmentAmount).toBeCloseTo(1300 / 6);
  });

  it("valueMode installment deriva taxa", () => {
    const r = calculateLoan({
      capital: 1000,
      periods: 10,
      installmentValue: 200,
      frequency: "monthly",
      loanMode: "installments",
      valueMode: "installment",
    })!;
    expect(r.totalAmount).toBeCloseTo(2000);
    expect(r.derivedRate).toBeCloseTo(10);
  });

  it("valueMode installment retorna null sem nº", () => {
    expect(calculateLoan({
      capital: 1000, periods: 0, installmentValue: 200,
      frequency: "monthly", loanMode: "installments", valueMode: "installment",
    })).toBeNull();
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
    expect(periodLabelFor("weekly")).toBe("semana");
    expect(periodLabelFor("biweekly")).toBe("quinzena");
    expect(periodLabelFor("monthly")).toBe("mês");
    expect(periodLabelFor("custom")).toBe("parcela");
  });
});

describe("generateInstallmentSchedule", () => {
  it("mensal sem firstDueDate soma 1 mês a partir do start", () => {
    const dates = generateInstallmentSchedule({
      startDate: "2025-01-15", count: 3, frequency: "monthly",
    });
    expect(dates).toHaveLength(3);
    expect(new Date(dates[0]).getMonth()).toBe(1); // fevereiro (0-indexed)
    expect(new Date(dates[2]).getMonth()).toBe(3); // abril
  });

  it("semanal com firstDueDate começa nele e soma 7 dias", () => {
    const dates = generateInstallmentSchedule({
      startDate: "2025-01-01", firstDueDate: "2025-01-10", count: 2, frequency: "weekly",
    });
    expect(new Date(dates[0]).toISOString().slice(0, 10)).toBe("2025-01-10");
    expect(new Date(dates[1]).toISOString().slice(0, 10)).toBe("2025-01-17");
  });

  it("diário mon-fri pula fim de semana", () => {
    // sexta-feira: 2025-01-03 → próxima parcela deve ser segunda 2025-01-06
    const dates = generateInstallmentSchedule({
      startDate: "2025-01-03", count: 1, frequency: "daily", dailyMode: "mon-fri",
    });
    expect(new Date(dates[0]).toISOString().slice(0, 10)).toBe("2025-01-06");
  });

  it("custom usa datas fornecidas", () => {
    const dates = generateInstallmentSchedule({
      startDate: "2025-01-01", count: 2, frequency: "custom",
      customDates: ["2025-03-10", "2025-06-20"],
    });
    expect(new Date(dates[0]).toISOString().slice(0, 10)).toBe("2025-03-10");
    expect(new Date(dates[1]).toISOString().slice(0, 10)).toBe("2025-06-20");
  });
});
