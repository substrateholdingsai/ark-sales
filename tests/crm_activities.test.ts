import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";

function createMockDb() {
  const accounts = [{ id: "acc_1" }];
  const contacts = [{ id: "ct_1", account_id: "acc_1" }, { id: "ct_2", account_id: "acc_2" }];
  const opportunities = [{ id: "opp_1", account_id: "acc_1", contact_id: "ct_1" }];
  const activities: any[] = [];

  return {
    activities,
    prepare(sql: string) {
      const query = sql.toLowerCase().replace(/\s+/g, " ").trim();
      const execute = (args: any[] = []) => ({
        async first() {
          if (query.includes("from sales_accounts where id = ?")) {
            return accounts.find(account => account.id === args[0]) || null;
          }
          if (query.includes("from sales_contacts where id = ?")) {
            return contacts.find(contact => contact.id === args[0]) || null;
          }
          if (query.includes("from sales_opportunities where id = ?")) {
            return opportunities.find(opportunity => opportunity.id === args[0]) || null;
          }
          if (query.includes("from sales_activities a") && query.includes("where a.id = ?")) {
            const activity = activities.find(item => item.id === args[0]);
            return activity ? { ...activity, author_name: "Vendedor" } : null;
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (query.startsWith("insert into sales_activities")) {
            activities.push({
              id: args[0],
              account_id: args[1],
              contact_id: args[2],
              opportunity_id: args[3],
              lead_id: args[4],
              type: args[5],
              author_user_id: args[6],
              content: args[7],
              metadata_json: args[8],
              created_at: "2026-11-05 12:00:00"
            });
          }
          return { success: true };
        }
      });

      return {
        ...execute(),
        bind(...args: any[]) {
          return execute(args);
        }
      };
    }
  };
}

describe("CRM account notes", () => {
  const secret = "test-secret-1234567890";

  async function postActivity(db: ReturnType<typeof createMockDb>, body: Record<string, unknown>, role = "vendedor") {
    const token = await signJwt(
      { sub: "usr_1", email: "rep@ark.test", role, name: "Sales Rep" },
      secret
    );
    return app.fetch(new Request("http://localhost/api/crm/activities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }), { DB: db, CRM_JWT_SECRET: secret } as any);
  }

  it("requires authentication to create notes", async () => {
    const response = await app.fetch(new Request("http://localhost/api/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", account_id: "acc_1", content: "Seguimiento" })
    }), { DB: createMockDb(), CRM_JWT_SECRET: secret } as any);

    expect(response.status).toBe(401);
  });

  it("creates an audited note associated with an account, contact, and opportunity", async () => {
    const db = createMockDb();
    const response = await postActivity(db, {
      type: "note",
      account_id: "acc_1",
      contact_id: "ct_1",
      opportunity_id: "opp_1",
      content: "  Prefiere que le contactemos por correo.  "
    });

    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.activity.content).toBe("Prefiere que le contactemos por correo.");
    expect(body.activity.account_id).toBe("acc_1");
    expect(body.activity.contact_id).toBe("ct_1");
    expect(body.activity.opportunity_id).toBe("opp_1");
    expect(body.activity.author_name).toBe("Vendedor");
    expect(db.activities).toHaveLength(1);
  });

  it("rejects blank notes and notes without a customer association", async () => {
    const db = createMockDb();
    const blank = await postActivity(db, { type: "note", account_id: "acc_1", content: "   " });
    const unassociated = await postActivity(db, { type: "note", content: "Nota sin cliente" });

    expect(blank.status).toBe(400);
    expect(unassociated.status).toBe(400);
    expect(db.activities).toHaveLength(0);
  });

  it("rejects contact or opportunity associations from another account", async () => {
    const db = createMockDb();
    const response = await postActivity(db, {
      type: "note",
      account_id: "acc_1",
      contact_id: "ct_2",
      content: "No debe vincularse"
    });

    expect(response.status).toBe(400);
    expect(db.activities).toHaveLength(0);
  });

  it("enforces the note length limit", async () => {
    const db = createMockDb();
    const response = await postActivity(db, {
      type: "note",
      account_id: "acc_1",
      content: "x".repeat(10001)
    });

    expect(response.status).toBe(400);
    expect(db.activities).toHaveLength(0);
  });
});
