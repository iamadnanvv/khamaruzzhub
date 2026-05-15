import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "./customers";

export const Route = createFileRoute("/_authed/suppliers")({
  component: () => (
    <CrudPage
      table="suppliers"
      title="Suppliers"
      subtitle="Raw material suppliers and outstanding payments."
      fields={[
        { k: "name", label: "Name", required: true },
        { k: "phone", label: "Phone" },
        { k: "material", label: "Material" },
        { k: "outstanding", label: "Outstanding (₹)" },
        { k: "notes", label: "Notes", textarea: true },
      ]}
    />
  ),
});
