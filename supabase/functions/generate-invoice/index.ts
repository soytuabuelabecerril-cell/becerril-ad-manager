// This is a Supabase Edge Function template
// Deploy using: supabase functions deploy generate-invoice

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb } from "https://cdn.skypack.dev/pdf-lib";

serve(async (req) => {
  try {
    const { customerName, pageNumber, amount } = await req.json();

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);

    // Add some text
    page.drawText('I AM YOUR GRANNY S.L. - Reservation Note', {
      x: 50,
      y: 350,
      size: 20,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Customer: ${customerName}`, { x: 50, y: 300, size: 15 });
    page.drawText(`Reserved Page: ${pageNumber}`, { x: 50, y: 270, size: 15 });
    page.drawText(`Amount (Excl. VAT): €${amount}`, { x: 50, y: 240, size: 15 });
    
    // Simulate traffic light status
    page.drawText(`Status: PENDING PAYMENT`, { x: 50, y: 200, size: 15, color: rgb(1, 0.5, 0) });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // In a real implementation, you would upload `pdfBytes` to Supabase Storage here
    // const { data, error } = await supabase.storage.from('invoices').upload(fileName, pdfBytes)

    const mockPdfUrl = `https://storage.supabase.com/invoices/mock_${Date.now()}.pdf`;

    return new Response(
      JSON.stringify({ success: true, pdfUrl: mockPdfUrl }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});
