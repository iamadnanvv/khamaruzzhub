import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "./customers";

export const Route = createFileRoute("/_authed/suppliers")({
  component: () => (
    <CrudPage
      table="suppliers"
      title="Retailers"
      subtitle="Stockists and retail partners distributing our pickles."
      fields={[
        { k: "name", label: "Name", required: true },
        { k: "phone", label: "Phone" },
        { k: "material", label: "Region / Outlet" },
        { k: "outstanding", label: "Outstanding (₹)" },
        { k: "notes", label: "Notes", textarea: true },
      ]}
    />
  ),
});
