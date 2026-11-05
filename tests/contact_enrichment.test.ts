import { describe, it, expect } from "vitest";
import {
  cleanMexicanPhone,
  extractDoctorSearchTerm,
  enrichDoctorLead,
  cleanFirmName,
  enrichAccountingFirmLead,
  enrichLeadByVertical,
} from "../src/services/contactEnrichment";

describe("Contact & Accounting Firm Enrichment Level 2", () => {
  it("cleanMexicanPhone formats valid 10-digit numbers to phone and +52 whatsapp", () => {
    const res1 = cleanMexicanPhone("9994891040");
    expect(res1).toEqual({ phone: "9994891040", whatsapp: "+529994891040" });

    const res2 = cleanMexicanPhone("+52 (999) 489-1040");
    expect(res2).toEqual({ phone: "9994891040", whatsapp: "+529994891040" });

    const res3 = cleanMexicanPhone("5219994891040");
    expect(res3).toEqual({ phone: "9994891040", whatsapp: "+529994891040" });

    expect(cleanMexicanPhone("123")).toBeNull();
  });

  it("extractDoctorSearchTerm chooses real doctor name over generic account placeholder", () => {
    expect(extractDoctorSearchTerm("Dr. Daniel Ramos", "CONSULTORIO CIRUGIA")).toBe("Dr. Daniel Ramos");
    expect(extractDoctorSearchTerm("Sin nombre", "CONSULTORIO ONCOLOGICO YAIR BENJAMIN BAAS CABRERA")).toBe(
      "CONSULTORIO ONCOLOGICO YAIR BENJAMIN BAAS CABRERA"
    );
    expect(extractDoctorSearchTerm("Contacto Corporativo", "Dr. Oliver Franco")).toBe("Dr. Oliver Franco");
  });

  it("cleanFirmName strips common corporate suffixes for clean query targeting", () => {
    expect(cleanFirmName("PORTILLO BENGOA Y ASOCIADOS S.C.")).toBe("PORTILLO BENGOA Y ASOCIADOS");
    expect(cleanFirmName("DESPACHO FISCAL DEL SURESTE S.A. DE C.V.")).toBe("DESPACHO FISCAL DEL SURESTE");
    expect(cleanFirmName("SOLUCIONES CONTABLES S.C.P.")).toBe("SOLUCIONES CONTABLES");
  });

  it("enrichAccountingFirmLead generates Google and LinkedIn search URLs and handles empty gracefully", async () => {
    const result = await enrichAccountingFirmLead({ name: "Sin nombre", accountName: "-" });
    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.google_search_url).toBeDefined();
    expect(result.linkedin_search_url).toBeDefined();
  });

  it("enrichLeadByVertical intelligently delegates between accounting and medical leads", async () => {
    const accountingRes = await enrichLeadByVertical({
      accountName: "PORTILLO BENGOA Y ASOCIADOS",
      scian: "541211",
    });
    expect(accountingRes.vertical).toBe("fiscal");
    expect((accountingRes as any).linkedin_search_url).toBeDefined();

    const medicalRes = await enrichLeadByVertical({
      accountName: "CENTRO MEDICO DE CANCUN",
      scian: "621111",
    });
    expect(medicalRes.vertical).toBe("medical");
    expect((medicalRes as any).doctoralia_search_url).toBeDefined();
  });
});
