import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBR } from "@/lib/dateUtils";

export const generatePortalReceiptPdf = (client: any, installment: any, company: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE PAGAMENTO", pageWidth / 2, 25, { align: "center" });

  // Company Info
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(company?.name || "System Juros", 20, 50);
  doc.setFont("helvetica", "normal");
  doc.text(`Chave PIX: ${company?.pix_key || "Não informada"}`, 20, 55);

  // Client Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE", 20, 75);
  doc.setLineWidth(0.5);
  doc.line(20, 77, 80, 77);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome: ${client.name}`, 20, 85);
  doc.text(`CPF/CNPJ: ${client.cpf_cnpj}`, 20, 90);

  // Payment Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DETALHES DO PAGAMENTO", 20, 110);
  doc.line(20, 112, 80, 112);

  const amount = Number(installment.paid_amount || installment.amount);
  const data = [
    ["Descrição", "Parcela #" + installment.installment_number],
    ["Vencimento Original", formatBR(installment.due_date)],
    ["Data do Pagamento", installment.paid_at ? formatBR(installment.paid_at) : "Confirmado via Portal"],
    ["Valor Pago", `R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Status", "LIQUIDADO / PAGO"]
  ];

  autoTable(doc, {
    startY: 120,
    head: [["Campo", "Valor"]],
    body: data,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: 20, right: 20 }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  doc.setFontSize(10);
  doc.text("__________________________________________", pageWidth / 2, finalY, { align: "center" });
  doc.text(company?.name || "Assinatura do Credor", pageWidth / 2, finalY + 7, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} pelo Portal do Cliente`, pageWidth / 2, 285, { align: "center" });

  doc.save(`Recibo_Parcela_${installment.installment_number}_${client.name.replace(/\s+/g, "_")}.pdf`);
};