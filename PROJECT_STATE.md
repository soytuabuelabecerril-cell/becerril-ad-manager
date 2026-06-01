# Becerril Ad-Manager Platform - Master Project Context

## Project Overview
A web-based ad management and reservation platform designed to manage a 92-page magazine layout. It tracks ad space availability, customer reservations, and generates invoices for purchased space.

## Current Configuration
- **Frontend Framework**: React, Vite, TailwindCSS
- **Backend/Database**: Supabase
- **Current State**: Operating in a hybrid state. Some data relies on fallback data and an in-memory store (`invoicesStore.js`) while pending full database schema migrations on Supabase.

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
  - **Pre-Reserve Space**: Creates a temporary 1-week hold on the space, now also generating an initial invoice.
  - Pre-reservations can later be confirmed, prolonged, or cancelled/liberated (resetting the page to 'Available').

### 3. Invoices & Billing
- **In-Memory Store**: Currently storing invoices in `invoicesStore.js`.
- **Actions**:
  - Download PDF (via jsPDF/html2canvas).
  - Send via WhatsApp / Email.
  - Mark as Paid (turns ad green in grid).
  - **Cancel Invoice**: Removes the ad from the grid (liberating the page) and marks the invoice as 'Cancelled'. Optionally generates a compensating 'Refund' (Abono) invoice.
  - **Hard Delete**: A trash can icon allows the user to permanently erase a cancelled invoice and any associated refund completely from the system.

## Pending Tasks & Next Steps
1. **Supabase Schema Migration**: Transition fully from the local `invoicesStore.js` and fallback data to the actual Supabase backend tables. Ensure the schema (`customers`, `magazine_pages`, `invoices`, `ads`) is correctly set up.
2. **Pre-Reservation Confirmation Logic Check**: Since pre-reservations now generate an invoice up-front, the logic for confirming a pre-reservation later should be reviewed to ensure it doesn't generate duplicate invoices unnecessarily (unless intended as a final invoice).
3. **Persist Page Colors/State**: Ensure that `isNew` flags or other UI states are correctly saved to and loaded from the database once the backend is fully connected.
