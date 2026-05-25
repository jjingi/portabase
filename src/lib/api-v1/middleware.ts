import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import * as drizzleDb from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "api-v1/middleware" });

export type ApiKeyContext = {
  userId: string;
  orgIds: string[];
};

type ApiKeyHandler = (
  req: Request,
  ctx: ApiKeyContext,
  params: Record<string, string>
) => Promise<Response>;

export function withApiKey(handler: ApiKeyHandler) {
  return async (
    req: Request,
    context?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      const key = req.headers.get("x-api-key");
      if (!key) {
        return NextResponse.json(
          { error: "Missing API key" },
          { status: 401 }
        );
      }

      // @ts-ignore — verifyApiKey is added by the @better-auth/api-key plugin
      const result = await auth.api.verifyApiKey({ body: { key } });

      if (!result?.valid || !result?.key) {
        return NextResponse.json(
          { error: "Invalid or expired API key" },
          { status: 401 }
        );
      }

      const userId = result.key.referenceId as string;

      const memberships = await db.query.member.findMany({
        where: eq(drizzleDb.schemas.member.userId, userId),
        columns: { organizationId: true },
      });

      const orgIds = memberships.map((m) => m.organizationId);
      const resolvedParams = context?.params ? await context.params : {};

      return handler(req, { userId, orgIds }, resolvedParams);
    } catch (err) {
      log.error({ error: err }, "Error in withApiKey middleware");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
