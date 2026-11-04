import { describe, it, expect } from "vitest";
import { cleanMexicanPhone, extractDoctorSearchTerm, enrichDoctorLead } from "../src/services/contactEnrichment";

describe("Contact Enrichment Level 2 (Google / Doctoralia)", () => {
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

  it("enrichDoctorLead generates Google and Doctoralia search URLs and handles empty gracefully", async () => {
    const result = await enrichDoctorLead({ name: "Sin nombre", accountName: "-" });
    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.google_search_url).toBeDefined();
    expect(result.doctoralia_search_url).toBeDefined();
  });
});
