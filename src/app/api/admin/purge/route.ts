import { isAdmin } from "@/lib/admin-auth";
import { getPool, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY. Deletes signup rows by exact name.
 *
 * The database only listens on Zeabur's internal network, so removing a spam
 * submission or a smoke-test row needs code running inside the deployment.
 * This route exists to clear two known rows and is removed in the next commit;
 * it is not the beginnings of an admin feature.
 */
export async function POST(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? undefined;
  if (!isAdmin(key)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { names } = (await request.json()) as { names?: string[] };
  if (!Array.isArray(names) || names.length === 0) {
    return Response.json({ error: "names required" }, { status: 400 });
  }

  await ensureSchema();
  const result = await getPool().query(
    `DELETE FROM signups WHERE name = ANY($1::text[]) RETURNING name, wechat`,
    [names],
  );

  return Response.json({ deleted: result.rowCount, rows: result.rows });
}
