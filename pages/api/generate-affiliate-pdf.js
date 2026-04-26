// pages/api/generate-affiliate-pdf.js
// Server-side PDF generation for affiliate applications
import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { application } = req.body;
    if (!application) return res.status(400).json({ error: 'Missing application data' });

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 760;
    const lineHeight = 28;
    const fields = [
      ['Affiliate Application Snapshot', true],
      ['Name', application.name],
      ['Email', application.email],
      ['Affiliate User ID', application.affiliate_user_id],
      ['Message', application.message],
      ['Submitted At', application.created_at],
    ];
    fields.forEach(([label, value], i) => {
      page.drawText(`${label}: ${value || ''}`, {
        x: 40,
        y: y - i * lineHeight,
        size: i === 0 ? 20 : 14,
        font,
        color: rgb(0, 0, 0),
      });
    });
    const pdfBytes = await pdfDoc.save();

    // Upload to Supabase Storage
    const fileName = `affiliate-applications/${application.affiliate_user_id}_${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from('affiliate-applications')
      .upload(fileName, Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (error) throw error;
    const { publicURL } = supabase.storage.from('affiliate-applications').getPublicUrl(fileName).data;
    return res.status(200).json({ url: publicURL });
  } catch (e) {
    console.error('generate-affiliate-pdf error:', e);
    return res.status(500).json({ error: e.message || 'PDF generation failed' });
  }
}
