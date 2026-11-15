import PDFDocument from 'pdfkit';
import type {
  FoodSensitivityRecord,
  HydrationEntry,
  MealEntry,
  ReportRecord,
  SymptomEntry,
  UserRecord,
} from './types.ts';

export function generateClinicalReportPdf(
  report: ReportRecord,
  user: UserRecord,
  meals: MealEntry[],
  hydration: HydrationEntry[],
  symptoms: SymptomEntry[],
  sensitivities: FoodSensitivityRecord[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const start = new Date(report.dateRangeStart);
    const end = new Date(report.dateRangeEnd);
    const inRange = (ts: string) => {
      const d = new Date(ts);
      return d >= start && d <= end;
    };

    const rMeals = meals
      .filter((m) => inRange(m.timestamp))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const rHydration = hydration
      .filter((h) => inRange(h.timestamp))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const rSymptoms = symptoms
      .filter((s) => inRange(s.timestamp))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Header
    doc
      .fontSize(18)
      .fillColor('#0F172A')
      .text('OncoByte Clinical Nutrition & Symptom Summary', { align: 'left' });
    doc
      .fontSize(10)
      .fillColor('#475569')
      .text(`Report Title: ${report.title}`)
      .text(`Patient: ${user.name} (${user.email})`)
      .text(
        `Care Team: ${user.profile.clinicianName || 'Not specified'} | Dietitian: ${
          user.profile.dietitianName || 'Not specified'
        }`
      )
      .text(
        `Reporting Period: ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`
      )
      .text(`Generated: ${new Date(report.generatedAt).toUTCString()}`);

    doc.moveDown(0.75);
    doc.moveTo(48, doc.y).lineTo(564, doc.y).strokeColor('#CBD5E1').stroke();
    doc.moveDown(0.75);

    // Clinical Disclaimer
    doc
      .fontSize(8.5)
      .fillColor('#334155')
      .text(
        'CLINICAL NOTICE: This document compiles patient-reported dietary intake, hydration, and symptom logs. Observational tolerance patterns do not establish medical causation and do not constitute medical advice. Review alongside clinical labs and oncology registered dietitian assessment.'
      );

    doc.moveDown(1);

    // Summary Metrics
    doc.fontSize(13).fillColor('#0F766E').text('1. Executive Summary');
    doc.moveDown(0.35);
    doc.fontSize(10).fillColor('#0F172A');
    doc.text(`• Meals Recorded: ${report.summary.totalMeals}`);
    doc.text(
      `• Average Daily Fluid Intake: ${report.summary.avgDailyFluidMl} ml (Target: ${report.summary.fluidGoalMl} ml)`
    );
    doc.text(
      `• Average Appetite Score: ${
        report.summary.avgAppetiteScore !== null ? `${report.summary.avgAppetiteScore} / 5.0` : 'N/A'
      }`
    );
    doc.text(
      `• Average Meal Tolerance Rating: ${
        report.summary.avgToleranceRating !== null
          ? `${report.summary.avgToleranceRating} / 5.0`
          : 'N/A'
      }`
    );

    if (report.summary.topSymptoms.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#0F172A').text('Most Frequently Logged Symptoms:');
      doc.fontSize(9.5).fillColor('#334155');
      for (const sym of report.summary.topSymptoms) {
        doc.text(`  - ${sym.name}: ${sym.count} occurrence(s), avg severity ${sym.avgSeverity}/5`);
      }
    }

    if (report.includedCategories.includes('tolerances')) {
      doc.moveDown(0.75);
      doc.fontSize(13).fillColor('#0F766E').text('2. Observational Food Tolerance Patterns');
      doc.moveDown(0.35);
      doc.fontSize(9.5).fillColor('#0F172A');
      if (report.summary.wellToleratedFoods.length > 0) {
        doc.text(
          `Well-Tolerated Ingredients: ${report.summary.wellToleratedFoods
            .map((f) => `${f.ingredient} (${f.avgRating}/5 across ${f.count}x)`)
            .join(', ')}`
        );
      }
      if (report.summary.cautionFoods.length > 0) {
        doc.text(
          `Foods Warranting Attention: ${report.summary.cautionFoods
            .map((f) => `${f.ingredient} (${f.avgRating}/5 across ${f.count}x)`)
            .join(', ')}`
        );
      }
      if (report.summary.wellToleratedFoods.length === 0 && report.summary.cautionFoods.length === 0) {
        doc.text('Insufficient repeated entries to classify tolerance patterns in this window.');
      }
    }

    if (report.includedCategories.includes('sensitivities') && sensitivities.length > 0) {
      doc.moveDown(0.75);
      doc.fontSize(13).fillColor('#0F766E').text('3. Patient-Reported Food Sensitivities');
      doc.moveDown(0.35);
      doc.fontSize(9.5).fillColor('#334155');
      for (const s of sensitivities) {
        doc.text(`• ${s.foodName} — ${s.reactionType} (Severity ${s.severity}/5): ${s.notes}`);
      }
    }

    if (report.includedCategories.includes('meals') && rMeals.length > 0) {
      doc.moveDown(0.75);
      doc.fontSize(13).fillColor('#0F766E').text('4. Chronological Meal & Tolerance Log');
      doc.moveDown(0.35);
      doc.fontSize(9).fillColor('#0F172A');
      for (const m of rMeals.slice(0, 25)) {
        const dt = new Date(m.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        doc.text(
          `[${dt}] ${m.mealType.toUpperCase()} — ${m.foodName} (${m.portion}) | Tolerance: ${m.toleranceRating}/5`
        );
        if (m.toleranceNotes) {
          doc.fillColor('#475569').text(`    Note: ${m.toleranceNotes}`).fillColor('#0F172A');
        }
      }
    }

    if (report.includedCategories.includes('hydration') && rHydration.length > 0) {
      doc.moveDown(0.75);
      doc.fontSize(13).fillColor('#0F766E').text('5. Hydration Log Summary');
      doc.moveDown(0.35);
      doc.fontSize(9).fillColor('#0F172A');
      for (const h of rHydration.slice(0, 20)) {
        const dt = new Date(h.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        doc.text(`[${dt}] ${h.fluidType} — ${h.amountMl} ml (${h.temperature} temp)`);
      }
    }

    if (
      (report.includedCategories.includes('symptoms') ||
        report.includedCategories.includes('appetite')) &&
      rSymptoms.length > 0
    ) {
      doc.moveDown(0.75);
      doc.fontSize(13).fillColor('#0F766E').text('6. Symptom & Appetite Timeline');
      doc.moveDown(0.35);
      doc.fontSize(9).fillColor('#0F172A');
      for (const s of rSymptoms.slice(0, 20)) {
        const dt = new Date(s.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const appetiteText =
          typeof s.appetiteScore === 'number' ? ` | Appetite: ${s.appetiteScore}/5` : '';
        doc.text(`[${dt}] ${s.symptomName} (Severity ${s.severity}/5${appetiteText})`);
        if (s.notes) {
          doc.fillColor('#475569').text(`    Note: ${s.notes}`).fillColor('#0F172A');
        }
      }
    }

    doc.moveDown(1);
    doc.moveTo(48, doc.y).lineTo(564, doc.y).strokeColor('#CBD5E1').stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .fillColor('#64748B')
      .text(
        `Report Accuracy Validation Checksum: ${report.validationChecksum} | Records Verified: ${report.recordCounts.meals} meals, ${report.recordCounts.hydration} hydration, ${report.recordCounts.symptoms} symptoms, ${report.recordCounts.sensitivities} sensitivities.`
      );

    doc.end();
  });
}
