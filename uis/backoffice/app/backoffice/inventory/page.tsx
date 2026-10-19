import { redirect } from "next/navigation";

export default function InventoryIndexPage() {
  redirect("/backoffice/inventory/products");
}
