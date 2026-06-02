Based on a full review of the Khamaruzz Hub codebase — which currently covers Products, Inventory, Orders, Customers, Retailers, Materials Purchased, Billing & GST, Barcodes, Labels, Posters, and Reports — here are five high-impact feature proposals designed to close critical operational gaps for a small pickle-manufacturing business.

---

## Feature 1: Production Planning & Recipe Costing (BOM)
**What it does:** Allows the admin to define a "recipe" (Bill of Materials) for each product variant — e.g., "Mango Pickle 500g requires 400g raw mango, 50g chilli powder, 30ml oil, 10g mustard." The system then auto-calculates the theoretical production cost by looking up the latest unit costs from `materials_purchased`. It compares this against the product's `selling_price` to show real-time margin per variant.

**Why it matters:** Currently, `materials_purchased` tracks raw material buys and `products` tracks selling prices, but there is no bridge between them. The admin cannot answer: "Am I actually profitable on this variant at today's raw material prices?"

**Technical scope:**
- New `recipes` table: `product_id`, `material_name`, `quantity_required`, `unit`
- New `recipe_cost_snapshots` table: stores calculated cost per recipe version
- Dashboard widget: "Today's production cost vs. selling price" per product
- UI page under a new "Production" nav item to create/edit recipes and view margins

---

## Feature 2: Raw Material Inventory & Production Batch Tracking
**What it does:** Maintains a live stock ledger for raw materials (independent of finished goods). When a production batch is recorded, the system deducts consumed raw materials from stock and adds finished goods to the `inventory` table. Tracks yield rate: "I put in 10kg of raw mango and got 24 jars — was that expected?"

**Why it matters:** `materials_purchased` only logs purchases. The admin currently has no way to know current raw stock levels (e.g., "Do I have enough chillies to fulfil this week's production plan?"). This prevents production stoppages and over-purchasing.

**Technical scope:**
- New `raw_materials` table: `name`, `current_stock`, `unit`, `low_stock_threshold`
- New `production_batches` table: `product_id`, `batch_no`, `quantity_produced`, `production_date`, `yield_notes`
- New `raw_material_consumption` table: links batches to materials consumed
- UI page: "Raw Materials" stock view + "Record Production Batch" form
- Auto-deduct on batch creation; auto-alert on low raw stock

---

## Feature 3: Smart Alerts & Notification Hub
**What it does:** A dedicated "Alerts" page and dashboard badge that proactively surfaces: (a) low finished-goods stock, (b) low raw-material stock, (c) products expiring within 30/60/90 days, (d) pending order payments, (e) unpaid material purchases, and (f) retailer outstanding balances. Each alert is dismissible, actionable (links directly to the relevant page), and optionally sent as a daily/weekly digest email.

**Why it matters:** The dashboard currently shows low-stock and expiry snippets, but they are passive. A business owner needs to be *notified* before a problem becomes a crisis — especially expiry, which directly impacts food safety and FSSAI compliance.

**Technical scope:**
- New `alerts` table: `type`, `message`, `severity`, `dismissed`, `created_at`
- Scheduled TanStack server route (`/api/public/hooks/daily-alerts`) triggered by `pg_cron`
- Alert-generation logic queries `inventory`, `raw_materials`, `orders`, `materials_purchased`, `suppliers`
- UI: "Alerts" nav item with bell icon + badge count; alert detail cards with direct action links
- Optional: email digest via a simple SMTP connector or webhook

---

## Feature 4: Customer 360° View (Mini-CRM)
**What it does:** Transforms the flat "Customers" list into a lightweight CRM. Clicking a customer opens a detail view showing: complete order history, total lifetime spend, average order value, favorite products, last purchase date, and purchase frequency. Adds a "Top Customers" ranking card to the Reports page.

**Why it matters:** The current `customers` table is just a contact list. For a small business, repeat customers are the backbone. Knowing who your best customers are, what they buy, and when they last ordered enables targeted outreach (e.g., "Mrs. Sharma hasn't ordered in 60 days — send her a WhatsApp message").

**Technical scope:**
- Reuses existing `customers` and `orders` + `order_items` tables (no schema changes needed)
- Server function to compute: lifetime_value, order_count, avg_order_value, favorite_product, days_since_last_order
- Enhanced customer dialog with tabbed view: Overview | Orders | Insights
- Reports addition: "Top 10 Customers by Revenue" bar chart
- Optional: "At Risk" flag for customers with >60 days since last order

---

## Feature 5: Purchase Order (PO) Management
**What it does:** Introduces a formal purchase order workflow for raw materials. Admin creates a PO (selecting from existing suppliers), specifies materials, quantities, and expected delivery. The PO moves through statuses: Draft → Sent → Partially Received → Received → Paid. Upon full receipt, the system auto-generates a `materials_purchased` entry.

**Why it matters:** Currently, purchases are logged after the fact. There is no way to track: "I ordered 50kg of raw mango from Supplier X last week — has it arrived? Did I receive the full quantity?" This is essential for supplier relationship management and cash-flow planning.

**Technical scope:**
- New `purchase_orders` table: `po_no`, `supplier_id`, `status`, `total`, `created_at`, `expected_delivery`
- New `purchase_order_items` table: `po_id`, `material_name`, `quantity`, `unit`, `unit_cost`, `received_qty`
- New UI page: "Purchase Orders" with kanban-style status board or table
- Receipt flow: update `received_qty`, on full receipt auto-insert into `materials_purchased`
- Outstanding POs feed into the Alerts hub (Feature 3)

---

## Summary
These five features form a closed operational loop:

```
Plan production  →  Buy raw materials (PO)  →  Receive & stock raw materials
       ↑                                                   ↓
  Sell & ship ←  Produce batch (BOM + costing)  ←  Consume raw materials
       ↓
  Invoice & bill customer  →  Analyse (CRM + Reports + Alerts)
```

**Recommended priority order:** 2 (Raw Material Inventory) → 1 (Recipe Costing) → 5 (POs) → 3 (Alerts) → 4 (Customer 360°). Raw material stock is the foundational dependency for production planning and POs; alerts and CRM build on top of the core data.