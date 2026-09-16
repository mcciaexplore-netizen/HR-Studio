import type { Express } from "express";
import { createHash } from "node:crypto";
import { Store, HttpError, type Actor } from "./store";
import { text } from "./validation";
import { requireModule } from "./suite-domain";
import { attendanceData } from "./suite-records";
import { rateLimit } from "./auth";

/** Machine callers use scoped, revocable tokens; browser sessions are not accepted here. */
export function registerIntegrationEvents(app: Express, store: Store) {
  app.post(
    "/api/integrations/events",
    rateLimit(120, 60000),
    (req, res, next) => {
      try {
        const token = req
          .get("authorization")
          ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
        if (!token)
          throw new HttpError(401, "An integration token is required.");
        const hash = createHash("sha256").update(token).digest("hex");
        const row = store.db
          .prepare(
            "SELECT org_id,id FROM records WHERE kind='integrationKeys' AND json_extract(data,'$.tokenHash')=? AND json_extract(data,'$.active')=1",
          )
          .get(hash);
        if (!row)
          throw new HttpError(401, "Integration token is invalid or revoked.");
        const key = store.get(
          String(row.org_id),
          "integrationKeys",
          String(row.id),
        );
        const actor: Actor = {
          id: key.id,
          orgId: String(row.org_id),
          name: key.name,
          email: "",
          accessRole: "hr",
          employeeId: null,
          mustChangePassword: false,
        };
        requireModule(store, actor, "integrations");
        const externalId = `${key.id}:${text(req.body.eventId, "Unique event ID", 100)}`;
        if (
          store.db
            .prepare(
              "SELECT 1 FROM integration_events WHERE org_id=? AND external_id=?",
            )
            .get(actor.orgId, externalId)
        ) {
          res.json({ ok: true, duplicate: true });
          return;
        }
        store.transaction(() => {
          if (key.scope === "attendance") {
            requireModule(store, actor, "leaves");
            const emp = store.get(
              actor.orgId,
              "employees",
              text(req.body.employeeId, "Employee"),
            );
            if (emp.status !== "Active")
              throw new HttpError(
                400,
                "Attendance requires an active employee.",
              );
            const start = Date.parse(
                text(req.body.checkInAt, "Check-in timestamp", 30),
              ),
              end = Date.parse(
                text(req.body.checkOutAt, "Check-out timestamp", 30),
              );
            if (
              !Number.isFinite(start) ||
              !Number.isFinite(end) ||
              end <= start ||
              end - start > 86400000 ||
              end > Date.now()
            )
              throw new HttpError(
                400,
                "Send a completed attendance period of up to 24 hours.",
              );
            const data = attendanceData(store, actor, {
              employeeId: emp.id,
              employeeName: emp.name,
              checkInAt: new Date(start).toISOString(),
              checkOutAt: new Date(end).toISOString(),
            });
            store.save(actor, "attendance", {
              ...data,
              source: `Integration: ${key.name}`,
              externalId,
            });
          } else {
            requireModule(store, actor, "documents");
            const doc = store.get(
              actor.orgId,
              "documents",
              text(req.body.documentId, "Document"),
            );
            if (doc.signature)
              throw new HttpError(
                409,
                "A signature report is already recorded for this document.",
              );
            const signedAt = text(req.body.signedAt, "Signature timestamp", 30);
            if (
              !Number.isFinite(Date.parse(signedAt)) ||
              Date.parse(signedAt) > Date.now()
            )
              throw new HttpError(
                400,
                "Enter a valid completed signature timestamp.",
              );
            store.save(
              actor,
              "documents",
              {
                ...doc,
                signature: {
                  provider: key.name,
                  reference: text(req.body.reference, "Provider reference"),
                  signedAt: new Date(signedAt).toISOString(),
                  status: "Provider reported",
                  receivedAt: new Date().toISOString(),
                },
              },
              doc.id,
              doc.version,
            );
          }
          store.db
            .prepare("INSERT INTO integration_events VALUES(?,?,?)")
            .run(actor.orgId, externalId, new Date().toISOString());
        });
        res.status(201).json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );
}
