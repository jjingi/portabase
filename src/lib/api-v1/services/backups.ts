import {ApiKeyContextUser} from "@/lib/api-v1/types";
import {getAccessibleDatabaseIds} from "@/lib/api-v1/services/databases";
import {db} from "@/db";
import {eq} from "drizzle-orm";
import * as drizzleDb from "@/db";

export async function resolveDatabaseAccess(id: string, user: ApiKeyContextUser) {
    const accessibleIds = await getAccessibleDatabaseIds(user);
    if (accessibleIds.includes(id)) return "ok";
    const exists = await db.query.database.findFirst({
        where: eq(drizzleDb.schemas.database.id, id),
        columns: { id: true },
    });
    return exists ? "forbidden" : "not_found";
}
