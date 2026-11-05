import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";
import { parseRawSheetsText, normalizeSheetItems, processSheetImport } from "../src/services/sheetsImport";
import { syncEmailDispatchToPipeline } from "../src/routes/superadmin";

const JWT_SECRET = "test-secret-key-sheets-pipeline";

function createMockFullDb() {
  const accounts: any[] = [
    { id: "acc_demo_1", name: "Despacho Alpha", normalized_name: "despacho alpha", city: "Mérida", origin: "crm", created_at: new Date().toISOString() }
  ];
  const contacts: any[] = [
    { id: "cnt_demo_1", account_id: "acc_demo_1", name: "Lic. Alpha", email: "alpha@despacho.com", phone: "+529991234567" }
  ];
  const opportunities: any[] = [
    { id: "opp_demo_1", account_id: "acc_demo_1", contact_id: "cnt_demo_1", stage: "calificado", products_interest_json: '["ledger_pro"]', estimated_value: 399, currency: "MXN", created_at: new Date().toISOString() }
  ];
  const activities: any[] = [];
  const dispatches: any[] = [];
  const templates: any[] = [
    {
      id: "tmpl_test_1",
      slug: "tmpl_test_1",
      subject: "Propuesta Ark Ledger para {{despacho_nombre}}",
      html_content: "<p>Hola {{contacto_nombre}}</p>",
      is_active: 1,
    }
  ];

  return {
    _accounts: accounts,
    _contacts: contacts,
    _opportunities: opportunities,
    _activities: activities,
    _dispatches: dispatches,
    _templates: templates,

    prepare(sql: string) {
      const s = sql.toLowerCase();
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (s.includes("from email_templates where id = ? or slug = ?")) {
                return templates.find(t => t.id === args[0] || t.slug === args[0]) || null;
              }
              if (s.includes("from sales_contacts where email = ?")) {
                return contacts.find(c => c.email === args[0]) || null;
              }
              if (s.includes("from sales_contacts where account_id = ? and email = ?")) {
                return contacts.find(c => c.account_id === args[0] && c.email === args[1]) || null;
              }
              if (s.includes("from sales_contacts where account_id = ? and name = ?")) {
                return contacts.find(c => c.account_id === args[0] && c.name === args[1]) || null;
              }
              if (s.includes("from sales_accounts where normalized_name = ? or name = ?")) {
                return accounts.find(a => a.normalized_name === args[0] || a.name === args[1]) || null;
              }
              if (s.includes("from sales_accounts where id = ?")) {
                return accounts.find(a => a.id === args[0]) || null;
              }
              if (s.includes("from sales_opportunities where account_id = ? or contact_id = ?")) {
                return opportunities.find(o => o.account_id === args[0] || o.contact_id === args[1]) || null;
              }
              if (s.includes("from sales_opportunities where account_id = ?")) {
                return opportunities.find(o => o.account_id === args[0]) || null;
              }
              if (s.includes("from sales_opportunities where contact_id = ?")) {
                return opportunities.find(o => o.contact_id === args[0]) || null;
              }
              if (s.includes("from sales_accounts")) {
                return { n: accounts.length };
              }
              if (s.includes("from sales_contacts")) {
                return { n: contacts.length };
              }
              return null;
            },
            async all() {
              if (s.includes("from sales_accounts")) {
                return { results: [...accounts] };
              }
              if (s.includes("from sales_contacts")) {
                return { results: [...contacts] };
              }
              if (s.includes("from sales_opportunities")) {
                return { results: [...opportunities] };
              }
              if (s.includes("from sales_activities")) {
                return { results: [...activities] };
              }
              return { results: [] };
            },
            async run() {
              if (s.includes("update sales_opportunities") && s.includes("propuesta_enviada")) {
                const oppId = args[args.length - 1];
                const opp = opportunities.find(o => o.id === oppId);
                if (opp) {
                  opp.stage = "propuesta_enviada";
                  opp.products_interest_json = args[0] || '["ledger_pro"]';
                  opp.updated_at = new Date().toISOString();
                }
                return { success: true };
              }
              if (s.includes("into sales_opportunities")) {
                opportunities.push({
                  id: args[0],
                  account_id: args[1],
                  contact_id: args[2],
                  stage: s.includes("propuesta_enviada") ? "propuesta_enviada" : (args[3] || "calificado"),
                  products_interest_json: args[4] || '["ledger_pro"]',
                  estimated_value: args[5] || 399,
                  currency: args[6] || "MXN",
                  created_at: new Date().toISOString(),
                });
                return { success: true };
              }
              if (s.includes("into sales_activities")) {
                activities.push({
                  id: args[0],
                  account_id: args[1],
                  contact_id: args[2],
                  opportunity_id: args[3],
                  type: "email",
                  author_user_id: args[4],
                  content: args[5],
                  metadata_json: args[6],
                  created_at: new Date().toISOString(),
                });
                return { success: true };
              }
              if (s.includes("into sales_accounts")) {
                accounts.push({
                  id: args[0],
                  name: args[1],
                  normalized_name: args[2],
                  city: args[3],
                  origin: args[4] || "google_sheets",
                  tenant_id: "acc_ark_ledger",
                  created_at: new Date().toISOString(),
                });
                return { success: true };
              }
              if (s.includes("into sales_contacts")) {
                contacts.push({
                  id: args[0],
                  account_id: args[1],
                  name: args[2],
                  email: args[3],
                  phone: args[4],
                  whatsapp: args[5],
                  title: args[6] || "Socio / Titular",
                  created_at: new Date().toISOString(),
                });
                return { success: true };
              }
              if (s.includes("into email_dispatches")) {
                dispatches.push({
                  id: args[0],
                  status: args[9] || "simulated",
                  recipient_email: args[5],
                });
                return { success: true };
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

describe("Conexión de Disparo de Correos al Pipeline & Importador Google Sheets", () => {
  let mockDb: any;
  let adminToken: string;
  let writeToken: string;

  beforeEach(async () => {
    mockDb = createMockFullDb();
    adminToken = await signJwt({ sub: "usr_admin", email: "admin@arksystems.site", role: "admin", name: "Admin Test" }, JWT_SECRET);
    writeToken = await signJwt({ sub: "usr_writer", email: "writer@arksystems.site", role: "vendedor", name: "Writer Test" }, JWT_SECRET);
  });

  describe("1. Conexión de Disparo de Correos al Pipeline", () => {
    it("debe promover una oportunidad existente a 'propuesta_enviada' cuando se despacha un email exitosamente", async () => {
      // Oportunidad existente para acc_demo_1 está en 'calificado'
      expect(mockDb._opportunities[0].stage).toBe("calificado");

      await syncEmailDispatchToPipeline(mockDb, {
        accountId: "acc_demo_1",
        contactId: "cnt_demo_1",
        email: "alpha@despacho.com",
        subject: "Propuesta Ark Ledger",
        templateSlug: "tmpl_test_1",
        dispatchId: "disp_101",
        resendId: "sim_101",
        userId: "usr_admin",
        status: "simulated",
      });

      // Debe actualizarse a 'propuesta_enviada'
      expect(mockDb._opportunities[0].stage).toBe("propuesta_enviada");
      expect(mockDb._opportunities[0].products_interest_json).toBe('["ledger_pro"]');

      // Debe registrar la actividad en sales_activities
      expect(mockDb._activities.length).toBe(1);
      expect(mockDb._activities[0].opportunity_id).toBe("opp_demo_1");
      expect(mockDb._activities[0].type).toBe("email");
      expect(mockDb._activities[0].content).toContain("Propuesta Ark Ledger");
    });

    it("debe crear una nueva oportunidad en 'propuesta_enviada' si no existía previamente", async () => {
      // Disparar a un contacto nuevo sin oportunidad previa
      mockDb._contacts.push({ id: "cnt_nuevo_2", account_id: "acc_nuevo_2", name: "Lic. Beta", email: "beta@despacho.com" });
      mockDb._accounts.push({ id: "acc_nuevo_2", name: "Despacho Beta", normalized_name: "despacho beta" });

      await syncEmailDispatchToPipeline(mockDb, {
        accountId: "acc_nuevo_2",
        contactId: "cnt_nuevo_2",
        email: "beta@despacho.com",
        subject: "Propuesta Especial",
        templateSlug: "tmpl_test_1",
        dispatchId: "disp_102",
        resendId: "sim_102",
        userId: "usr_admin",
        status: "simulated",
      });

      // Debe haber creado una oportunidad nueva
      const nuevaOpp = mockDb._opportunities.find((o: any) => o.account_id === "acc_nuevo_2");
      expect(nuevaOpp).toBeDefined();
      expect(nuevaOpp.stage).toBe("propuesta_enviada");
      expect(nuevaOpp.estimated_value).toBe(399);
      expect(nuevaOpp.currency).toBe("MXN");
      expect(nuevaOpp.products_interest_json).toBe('["ledger_pro"]');
    });

    it("POST /api/superadmin/templates/:id/send promueve el pipeline en envío individual simulado", async () => {
      const env = { DB: mockDb, CRM_JWT_SECRET: JWT_SECRET, JWT_SECRET, RESEND_API_KEY: "", RESEND_FROM_EMAIL: "ventas@arksystems.site" };
      const res = await app.request("/api/superadmin/templates/tmpl_test_1/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "alpha@despacho.com",
          account_id: "acc_demo_1",
          contact_id: "cnt_demo_1",
          variables: { despacho_nombre: "Despacho Alpha", contacto_nombre: "Lic. Alpha" },
        }),
      }, env);

      expect(res.status).toBe(200);
      const data = await res.json<any>();
      expect(data.success).toBe(true);
      expect(mockDb._opportunities[0].stage).toBe("propuesta_enviada");
    });
  });

  describe("2. Importador desde Google Sheets / CSV", () => {
    it("debe parsear texto con columnas delimitadas por tabulador (copiado directo de Google Sheets)", () => {
      const sheetsPastedText = `Despacho Contable Morales\tLic. Carlos Morales\tcarlos@morales.com\t5512345678\tCDMX\nFiscalistas del Caribe\tC.P. Sofía Vega\tsofia@caribe.com\t9981234567\tCancún`;
      const rows = parseRawSheetsText(sheetsPastedText);

      expect(rows.length).toBe(2);
      expect(rows[0].despacho_nombre).toBe("Despacho Contable Morales");
      expect(rows[0].titular_nombre).toBe("Lic. Carlos Morales");
      expect(rows[0].email).toBe("carlos@morales.com");
      expect(rows[0].telefono).toBe("5512345678");
      expect(rows[0].ciudad).toBe("CDMX");

      expect(rows[1].despacho_nombre).toBe("Fiscalistas del Caribe");
      expect(rows[1].titular_nombre).toBe("C.P. Sofía Vega");
      expect(rows[1].ciudad).toBe("Cancún");
    });

    it("debe parsear texto con fila de encabezados y delimitado por comas", () => {
      const csvWithHeader = `Empresa,Contacto,Email,WhatsApp,Ciudad\nDespacho Maya,Lic. Juan Maya,juan@maya.com,9999887766,Mérida`;
      const rows = parseRawSheetsText(csvWithHeader);

      expect(rows.length).toBe(1);
      expect(rows[0].despacho_nombre).toBe("Despacho Maya");
      expect(rows[0].titular_nombre).toBe("Lic. Juan Maya");
      expect(rows[0].email).toBe("juan@maya.com");
      expect(rows[0].telefono).toBe("9999887766");
      expect(rows[0].ciudad).toBe("Mérida");
    });

    it("processSheetImport inserta Cuenta, Contacto y Oportunidad vinculada en 'calificado'", async () => {
      const rows = [
        {
          despacho_nombre: "Gómez & Asociados Contadores",
          titular_nombre: "C.P. Roberto Gómez",
          email: "roberto@gomez.com",
          telefono: "+525544332211",
          ciudad: "Guadalajara",
        }
      ];

      const res = await processSheetImport(mockDb, rows, "usr_admin");

      expect(res.success).toBe(true);
      expect(res.imported_accounts).toBe(1);
      expect(res.imported_contacts).toBe(1);
      expect(res.imported_opportunities).toBe(1);

      // Verificar que se crearon los registros en mockDb
      const acc = mockDb._accounts.find((a: any) => a.name === "Gómez & Asociados Contadores");
      expect(acc).toBeDefined();
      expect(acc.city).toBe("Guadalajara");

      const ct = mockDb._contacts.find((c: any) => c.email === "roberto@gomez.com");
      expect(ct).toBeDefined();
      expect(ct.account_id).toBe(acc.id);
      expect(ct.name).toBe("C.P. Roberto Gómez");
      expect(ct.title).toBe("Socio / Titular");

      const opp = mockDb._opportunities.find((o: any) => o.account_id === acc.id);
      expect(opp).toBeDefined();
      expect(opp.stage).toBe("calificado");
      expect(opp.products_interest_json).toBe('["ledger_pro"]');
      expect(opp.estimated_value).toBe(399);
    });

    it("POST /api/crm/import/sheets responde 200 y procesa tanto JSON como TSV directo", async () => {
      const env = { DB: mockDb, CRM_JWT_SECRET: JWT_SECRET, JWT_SECRET };

      // Caso A: JSON con array items
      const resJson = await app.request("/api/crm/import/sheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${writeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              despacho_nombre: "Despacho Norte",
              titular_nombre: "Lic. Norte",
              email: "norte@fiscal.com",
              telefono: "8181818181",
              ciudad: "Monterrey",
            }
          ]
        }),
      }, env);

      expect(resJson.status).toBe(200);
      const dataJson = await resJson.json<any>();
      expect(dataJson.success).toBe(true);
      expect(dataJson.imported_accounts).toBe(1);
      expect(dataJson.imported_contacts).toBe(1);
      expect(dataJson.imported_opportunities).toBe(1);

      // Caso B: Raw text TSV copiado de Google Sheets
      const tsvData = `Auditoría Peninsular\tLic. Manuel Peña\tmanuel@peninsular.com\t9991122334\tMérida`;
      const resTsv = await app.request("/api/crm/import/sheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${writeToken}`,
          "Content-Type": "text/plain",
        },
        body: tsvData,
      }, env);

      expect(resTsv.status).toBe(200);
      const dataTsv = await resTsv.json<any>();
      expect(dataTsv.success).toBe(true);
      expect(dataTsv.imported_accounts).toBe(1);
      expect(dataTsv.imported_contacts).toBe(1);
      expect(dataTsv.imported_opportunities).toBe(1);
    });
  });
});
