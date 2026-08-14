import { redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { CategoryForm } from "./CategoryForm";
import { CategoryRow } from "./CategoryRow";

export default async function CategoriesPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const canManage = hasPermission(actor.role, "category:manage");
  const rows = await listCategories(actor.orgId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Categories
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Organize documents and videos into categories.
        </p>
      </header>

      {canManage && (
        <section className="mb-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-heading">Add a category</h2>
          <CategoryForm />
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-heading">
          All categories
          <span className="ml-2 text-sm font-normal text-muted">
            {rows.length}
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-body">
            No categories yet.
            {canManage ? " Add one above to get started." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                name={c.name}
                slug={c.slug}
                color={c.color}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
