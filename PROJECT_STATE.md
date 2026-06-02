# Becerril Ad-Manager Platform - Master Project Context

## Project Overview
A web-based ad management and reservation platform designed to manage a 92-page magazine layout for Revista Becerril. It tracks ad space availability, customer reservations, and generates invoices for purchased space.

## Current Configuration
- **Frontend Framework**: React, Vite, TailwindCSS (auto-deployed to [Vercel](https://becerril-ad-manager.vercel.app) from `main` branch)
- **Backend/Database**: Supabase
- **Current State**: Transitioned from LocalStorage/Fallback to Supabase database. The 5 key tables (`ad_reservations`, `invoices`, `recibos`, `orders`, and `invoice_settings`) have been created, and legacy data is migrated. Local state updates immediately on mutations to avoid lag.

## Database Schema & Migrated Data
1. **Tables Created**:
   - `ad_reservations`: Stores the active reservations mapped to specific pages.
   - `invoices`: System invoices for reservations.
   - `recibos`: Digital receipts.
   - `orders`: Details of the orders.
   - `invoice_settings`: Invoicing settings (VAT rate, starting numbers, etc.).
2. **Legacy Data Migration**:
   - 29 legacy reserved pages (e.g. page 1 "Portada", page 23 "Fundación", etc.) have been migrated to the Supabase `ad_reservations` table with `customer_id = 'legacy'` and their labels correctly set to the legacy page names.
   - Corresponding records in `magazine_pages` have been set to `Reserved`.

## Core Logic & Implemented Features

### 1. Magazine Grid (92 Pages)
- Visually displays the 92 pages of the magazine.
- **Color Coding**: 
  - **Red**: Standard (older) reservations.
  - **Blue**: Newly reserved pages (from the current session).
  - **Orange**: Pre-reserved pages (with a 1-week expiration).
  - **Green**: Paid reservations.
- Features real-time visual updates and tooltip hovers for occupant details.

### 2. Reservation Panel
- Allows assigning customers (existing or newly created) and products to specific pages.
- Enforces space constraints (e.g., checking if a product fits based on required slots like top, middle, bottom).
- **Actions**:
  - **Reserve & Generate Invoice**: Creates a confirmed reservation and immediately generates an invoice.
  - **Pre-Reserve Space**: Creates a temporary 1-week hold on the space.
  - Pre-reservations can later be confirmed, prolonged, or cancelled/liberated (resetting the page to 'Available').

### 3. Invoices & Billing
- **Actions**:
  - Download PDF (via jsPDF/html2canvas).
  - Send via WhatsApp / Email.
  - Mark as Paid (turns ad green in grid).
  - **Cancel Invoice**: Removes the ad from the grid (liberating the page) and marks the invoice as 'Cancelled'. Optionally generates a compensating 'Refund' (Abono) invoice.
  - **Hard Delete**: A trash can icon allows the user to permanently erase a cancelled invoice and any associated refund completely from the system.

## Next Steps & Remaining Work

1. **Enable Supabase Realtime Replication for New Tables (HIGH PRIORITY)**:
   - The tables `ad_reservations`, `orders`, `recibos`, and `invoices` are not yet added to the Supabase realtime replication publication.
   - Without this, cross-device updates won't fire automatically.
   - **Fix**: The user should run the following query in the Supabase SQL Editor:
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_reservations;
     ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
     ALTER PUBLICATION supabase_realtime ADD TABLE public.recibos;
     ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
     ```

2. **Verify Legacy Named Pages & End-to-End Mobile Flow**:
   - Verify that the grid correctly renders the names of legacy reserved pages (e.g. pages 1, 23, 5, 7, 9, etc.) from `ad_reservations`.
   - Test the reservation flow end-to-end from a real mobile device.

3. **Pre-Reservation Expiration Cron/Worker**:
   - Setup a script/cron job to automatically release pre-reservations after 1 week if not confirmed.

## AI Coding Guidelines
- **Automatic Translation**: Every time a new field or new functionality is created, automatically translate all user-facing text (labels, buttons, placeholders, etc.) into Spanish to maintain full localization.
