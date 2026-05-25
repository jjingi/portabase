import { db } from "@/db";
import * as drizzleDb from "@/db";
import { eq, inArray, and, or, isNull } from "drizzle-orm";

export async function getAccessibleAgentIds(userId: string): Promise<string[]> {
  const memberships = await db.query.member.findMany({
    where: eq(drizzleDb.schemas.member.userId, userId),
    columns: { organizationId: true },
  });

  if (memberships.length === 0) return [];

  const orgIds = memberships.map((m) => m.organizationId);
  const isActiveAgent = or(
    eq(drizzleDb.schemas.agent.isArchived, false),
    isNull(drizzleDb.schemas.agent.isArchived)
  );

  // Path 1: via organizationAgent junction table
  const orgAgents = await db.query.organizationAgent.findMany({
    where: inArray(drizzleDb.schemas.organizationAgent.organizationId, orgIds),
    columns: { agentId: true },
  });
  const junctionAgentIds = orgAgents.map((oa) => oa.agentId);

  // Path 2: via agent.organizationId direct FK
  const directAgents = await db.query.agent.findMany({
    where: and(
      inArray(drizzleDb.schemas.agent.organizationId, orgIds),
      isActiveAgent
    ),
    columns: { id: true },
  });
  const directAgentIds = directAgents.map((a) => a.id);

  const allAgentIds = [...new Set([...junctionAgentIds, ...directAgentIds])];
  if (allAgentIds.length === 0) return [];

  // Filter junction-path agents by active status
  const agents = await db.query.agent.findMany({
    where: and(
      inArray(drizzleDb.schemas.agent.id, allAgentIds),
      isActiveAgent
    ),
    columns: { id: true },
  });

  return agents.map((a) => a.id);
}

export async function getAccessibleDatabaseIds(userId: string): Promise<string[]> {
  const agentIds = await getAccessibleAgentIds(userId);
  if (agentIds.length === 0) return [];

  const databases = await db.query.database.findMany({
    where: inArray(drizzleDb.schemas.database.agentId, agentIds),
    columns: { id: true },
  });

  return databases.map((d) => d.id);
}
