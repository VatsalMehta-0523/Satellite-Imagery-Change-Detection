import os
import json
from datetime import datetime
from io import BytesIO
from PIL import Image

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
from app.core.config import DATA_DIR
import logging

logger = logging.getLogger("app.reports.generator")

# Color palette constants
ACCENT = colors.HexColor("#38bdf8")
ACCENT_DARK = colors.HexColor("#0284c7")
HEADER_BG = colors.HexColor("#0f172a")
ROW_ALT = colors.HexColor("#f0f9ff")
DANGER = colors.HexColor("#ef4444")
SUCCESS = colors.HexColor("#22c55e")
WARNING = colors.HexColor("#f59e0b")

class MissionReportGenerator:
    def __init__(self, data: dict):
        self.data = data
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        self.styles.add(ParagraphStyle(
            name='UrbanEyeTitle',
            parent=self.styles['Heading1'],
            fontSize=28,
            textColor=ACCENT,
            alignment=TA_CENTER,
            spaceAfter=6,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='SubTitle',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.grey,
            alignment=TA_CENTER,
            spaceAfter=20,
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=ACCENT_DARK,
            spaceBefore=20,
            spaceAfter=12,
            borderPadding=5,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='UESubSection',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor("#475569"),
            spaceBefore=12,
            spaceAfter=8,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='UEBody',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=15,
            spaceAfter=8,
        ))
        self.styles.add(ParagraphStyle(
            name='UEBullet',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14,
            leftIndent=20,
            spaceAfter=4,
        ))
        self.styles.add(ParagraphStyle(
            name='UESmallMono',
            parent=self.styles['Normal'],
            fontSize=8,
            fontName='Courier',
            textColor=colors.grey,
        ))

    def _severity_color(self, severity: str):
        s = (severity or "").lower()
        if s == "critical": return DANGER
        if s == "high": return colors.HexColor("#f97316")
        if s == "moderate": return WARNING
        return SUCCESS

    def _make_table(self, data, col_widths=None, header_bg=ACCENT):
        """Create a consistently styled table."""
        t = Table(data, colWidths=col_widths)
        style_commands = [
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ]
        t.setStyle(TableStyle(style_commands))
        return t

    def generate(self) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=45, leftMargin=45, topMargin=45, bottomMargin=45)
        story = []
        page_w = A4[0] - 90  # usable width

        # ═══════════════════════════════════════════
        # COVER / HEADER
        # ═══════════════════════════════════════════
        story.append(Spacer(1, 0.5 * inch))
        story.append(Paragraph("URBANEYE", self.styles['UrbanEyeTitle']))
        story.append(Paragraph("GEOSPATIAL INTELLIGENCE DOSSIER", self.styles['SubTitle']))
        story.append(Spacer(1, 0.1 * inch))

        # Mission ID badge
        meta_data = [
            ["MISSION ID", "GENERATED", "CLASSIFICATION"],
            [str(self.data['project_id']), datetime.now().strftime('%Y-%m-%d %H:%M UTC'), "RESTRICTED — OFFICIAL USE"]
        ]
        story.append(self._make_table(meta_data, col_widths=[page_w * 0.3, page_w * 0.35, page_w * 0.35]))
        story.append(Spacer(1, 0.3 * inch))

        # ═══════════════════════════════════════════
        # 1. MISSION OVERVIEW
        # ═══════════════════════════════════════════
        story.append(Paragraph("1. MISSION OVERVIEW", self.styles['SectionHeader']))

        source_name = (self.data.get('source') or 'unknown').upper()
        res_map = {'GEE': '10m', 'PLANET': '3m', 'S2DR3': '2.5m'}
        resolution = res_map.get(source_name, '10m')

        overview_data = [
            ["PARAMETER", "VALUE"],
            ["Temporal Baseline (T1)", self.data.get('t1_date', 'N/A')],
            ["Monitoring Period (T2)", self.data.get('t2_date', 'N/A')],
            ["Orbital Sensor Platform", source_name],
            ["Spatial Resolution", f"{resolution} / pixel"],
            ["Coordinate Reference System", "WGS 84 / EPSG:4326"],
            ["Processing Pipeline", "UrbanEye v2.0 — ORION Autonomous Engine"],
        ]
        story.append(self._make_table(overview_data, col_widths=[page_w * 0.4, page_w * 0.6]))
        story.append(Spacer(1, 0.2 * inch))

        # ═══════════════════════════════════════════
        # 2. GEOSPATIAL IMPACT METRICS
        # ═══════════════════════════════════════════
        story.append(Paragraph("2. GEOSPATIAL IMPACT METRICS", self.styles['SectionHeader']))

        change_pct = self.data.get('change_pct', 0)
        area_m2 = self.data.get('area_m2', 0)
        area_km2 = self.data.get('area_km2', 0)
        area_ha = self.data.get('area_ha', 0)

        metrics_data = [
            ["METRIC", "VALUE", "INTERPRETATION"],
            ["Detected Change", f"{change_pct:.2f}%", self._interpret_change_pct(change_pct)],
            ["Disturbed Area", f"{area_m2:,.0f} m²", f"{area_ha:.2f} hectares / {area_km2:.4f} km²"],
            ["Detection Model", "ChangeFormer V6", "Siamese Transformer — Tiled Inference"],
            ["Neural Confidence", f"{change_pct:.1f}%", "Pixel-level binary mask confidence"],
        ]
        story.append(self._make_table(metrics_data, col_widths=[page_w * 0.25, page_w * 0.25, page_w * 0.5]))
        story.append(Spacer(1, 0.3 * inch))

        # ═══════════════════════════════════════════
        # 3. VISUAL TELEMETRY
        # ═══════════════════════════════════════════
        story.append(PageBreak())
        story.append(Paragraph("3. VISUAL TELEMETRY — RGB COMPARISON", self.styles['SectionHeader']))
        story.append(Paragraph(
            "Side-by-side true-color composite (TCI) imagery showing the baseline and monitoring periods. "
            "Visual differences indicate areas of land-use modification, construction activity, or environmental change.",
            self.styles['UEBody']
        ))

        img_width = 2.4 * inch
        t1_img = self._prepare_image(self.data.get('t1_path'), img_width)
        t2_img = self._prepare_image(self.data.get('t2_path'), img_width)

        if t1_img and t2_img:
            img_table = Table([[t1_img, t2_img]], colWidths=[page_w * 0.5, page_w * 0.5])
            img_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(img_table)
            label_table = Table([
                [Paragraph(f"<b>T1 Baseline</b> — {self.data.get('t1_date', 'N/A')}", self.styles['UESmallMono']),
                 Paragraph(f"<b>T2 Monitoring</b> — {self.data.get('t2_date', 'N/A')}", self.styles['UESmallMono'])]
            ], colWidths=[page_w * 0.5, page_w * 0.5])
            label_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
            story.append(label_table)
        elif t1_img:
            story.append(t1_img)
            story.append(Paragraph(f"T1 Baseline — {self.data.get('t1_date', 'N/A')}", self.styles['UESmallMono']))
        else:
            story.append(Paragraph("<i>TCI imagery not available for this mission.</i>", self.styles['UEBody']))

        story.append(Spacer(1, 0.2 * inch))

        # ═══════════════════════════════════════════
        # 4. NEURAL CHANGE MASK
        # ═══════════════════════════════════════════
        story.append(Paragraph("4. NEURAL CHANGE DETECTION MASK", self.styles['SectionHeader']))
        mask_img = self._prepare_image(self.data.get('mask_path'), 4.5 * inch)
        if mask_img:
            story.append(Paragraph(
                "Binary change mask generated by the ChangeFormer V6 neural network. "
                "White/bright regions indicate pixels classified as 'changed' between T1 and T2. "
                "The model uses a Siamese Transformer architecture with tiled inference for high-resolution analysis.",
                self.styles['UEBody']
            ))
            story.append(mask_img)
        else:
            story.append(Paragraph(
                "<i>Change detection has not been executed for this mission yet. "
                "Navigate to the Change Detection page and trigger the ChangeFormer V6 inference to generate this analysis.</i>",
                self.styles['UEBody']
            ))

        # ═══════════════════════════════════════════
        # 5. MULTI-SPECTRAL INDEX ANALYSIS
        # ═══════════════════════════════════════════
        indices = self.data.get('indices', [])
        if indices:
            story.append(PageBreak())
            story.append(Paragraph("5. MULTI-SPECTRAL INDEX ANALYSIS", self.styles['SectionHeader']))
            story.append(Paragraph(
                "The following spectral indices were computed from the multi-spectral (MS) bands of the satellite imagery. "
                "Each index isolates a specific environmental signal — vegetation health, water presence, built-up density, or bare soil exposure. "
                "Values are derived from the T2 (monitoring) period imagery.",
                self.styles['UEBody']
            ))

            # Index summary table
            idx_table_data = [["INDEX", "MEAN VALUE", "SIGNAL", "DESCRIPTION"]]
            for idx in indices:
                name = idx.get('name', '')
                mean = idx.get('mean_val', 0)
                desc = idx.get('description', '')
                signal = self._interpret_index_signal(name, mean)
                idx_table_data.append([name, f"{mean:.4f}", signal, desc])

            story.append(self._make_table(idx_table_data, col_widths=[page_w * 0.12, page_w * 0.15, page_w * 0.23, page_w * 0.5]))
            story.append(Spacer(1, 0.3 * inch))

            # ── SPECTRAL HEATMAP IMAGES ──
            story.append(Paragraph("5.1 SPECTRAL HEATMAP GALLERY", self.styles['UESubSection']))
            story.append(Paragraph(
                "Color-coded heatmaps visualizing the spatial distribution of each spectral index across the AOI. "
                "Hot colors indicate high values; cool colors indicate low values.",
                self.styles['UEBody']
            ))

            # Render heatmaps in a 2-column grid
            heatmap_pairs = []
            current_pair = []
            for idx in indices:
                heatmap_path = idx.get('heatmap_path')
                hm_img = self._prepare_image(heatmap_path, 2.3 * inch)
                if hm_img:
                    name = idx.get('name', 'INDEX')
                    mean = idx.get('mean_val', 0)
                    current_pair.append((hm_img, name, mean))
                    if len(current_pair) == 2:
                        heatmap_pairs.append(current_pair)
                        current_pair = []
            if current_pair:
                heatmap_pairs.append(current_pair)

            for pair in heatmap_pairs:
                if len(pair) == 2:
                    img_row = Table([[pair[0][0], pair[1][0]]], colWidths=[page_w * 0.5, page_w * 0.5])
                    img_row.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('PADDING', (0, 0), (-1, -1), 4)]))
                    story.append(img_row)
                    lbl_row = Table([
                        [Paragraph(f"<b>{pair[0][1]}</b> (mean: {pair[0][2]:.4f})", self.styles['UESmallMono']),
                         Paragraph(f"<b>{pair[1][1]}</b> (mean: {pair[1][2]:.4f})", self.styles['UESmallMono'])]
                    ], colWidths=[page_w * 0.5, page_w * 0.5])
                    lbl_row.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
                    story.append(lbl_row)
                else:
                    story.append(pair[0][0])
                    story.append(Paragraph(f"<b>{pair[0][1]}</b> (mean: {pair[0][2]:.4f})", self.styles['UESmallMono']))
                story.append(Spacer(1, 0.15 * inch))

        # ═══════════════════════════════════════════
        # 6. AI STRATEGIC INTELLIGENCE ASSESSMENT
        # ═══════════════════════════════════════════
        story.append(PageBreak())
        story.append(Paragraph("6. AI STRATEGIC INTELLIGENCE ASSESSMENT", self.styles['SectionHeader']))

        ai = self.data.get('ai_summary', {})

        if isinstance(ai, str):
            story.append(Paragraph(ai, self.styles['UEBody']))
        else:
            # Classification & Severity
            severity = ai.get('severity', 'Moderate')
            sev_color = self._severity_color(severity)
            class_data = [
                ["CLASSIFICATION", "SEVERITY", "CONFIDENCE"],
                [ai.get('change_type', 'Undetermined'), severity.upper(), ai.get('confidence_level', 'N/A')]
            ]
            ct = Table(class_data, colWidths=[page_w * 0.4, page_w * 0.3, page_w * 0.3])
            ct.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('PADDING', (0, 0), (-1, -1), 10),
                ('BACKGROUND', (1, 1), (1, 1), sev_color),
                ('TEXTCOLOR', (1, 1), (1, 1), colors.white),
                ('FONTNAME', (1, 1), (1, 1), 'Helvetica-Bold'),
            ]))
            story.append(ct)
            story.append(Spacer(1, 0.2 * inch))

            # Executive Summary
            story.append(Paragraph("6.1 EXECUTIVE SUMMARY", self.styles['UESubSection']))
            summary_text = ai.get('executive_summary') or ai.get('summary', 'No summary available.')
            story.append(Paragraph(summary_text, self.styles['UEBody']))
            story.append(Spacer(1, 0.15 * inch))

            # Key Findings
            findings = ai.get('key_findings', [])
            if findings:
                story.append(Paragraph("6.2 KEY INTELLIGENCE FINDINGS", self.styles['UESubSection']))
                for i, finding in enumerate(findings, 1):
                    story.append(Paragraph(f"<b>{i}.</b> {finding}", self.styles['UEBullet']))
                story.append(Spacer(1, 0.15 * inch))

            # Per-Index Interpretations
            interps = ai.get('index_interpretations', {})
            if interps:
                story.append(Paragraph("6.3 SPECTRAL INDEX INTERPRETATIONS", self.styles['UESubSection']))
                interp_data = [["INDEX", "AI INTERPRETATION"]]
                for idx_name, interp_text in interps.items():
                    interp_data.append([idx_name, Paragraph(str(interp_text), self.styles['UEBody'])])
                story.append(self._make_table(interp_data, col_widths=[page_w * 0.15, page_w * 0.85]))
                story.append(Spacer(1, 0.15 * inch))

            # Environmental Impact
            env_impact = ai.get('environmental_impact', '')
            if env_impact:
                story.append(Paragraph("6.4 ENVIRONMENTAL IMPACT ASSESSMENT", self.styles['UESubSection']))
                story.append(Paragraph(env_impact, self.styles['UEBody']))
                story.append(Spacer(1, 0.15 * inch))

            # Urban Compliance
            compliance = ai.get('urban_compliance_assessment', '')
            if compliance:
                story.append(Paragraph("6.5 URBAN COMPLIANCE ASSESSMENT", self.styles['UESubSection']))
                story.append(Paragraph(compliance, self.styles['UEBody']))
                story.append(Spacer(1, 0.15 * inch))

            # Risk Factors
            risks = ai.get('risk_factors', [])
            if risks:
                story.append(Paragraph("6.6 RISK FACTORS", self.styles['UESubSection']))
                for risk in risks:
                    story.append(Paragraph(f"⚠ {risk}", self.styles['UEBullet']))
                story.append(Spacer(1, 0.15 * inch))

            # Strategic Recommendations
            recs = ai.get('recommendations', [])
            if not recs:
                recs = [ai.get('recommendation', 'Continue monitoring.')]
            if recs:
                story.append(Paragraph("6.7 STRATEGIC RECOMMENDATIONS", self.styles['UESubSection']))
                rec_data = [["#", "RECOMMENDED ACTION"]]
                for i, rec in enumerate(recs, 1):
                    rec_data.append([str(i), Paragraph(str(rec), self.styles['UEBody'])])
                story.append(self._make_table(rec_data, col_widths=[page_w * 0.08, page_w * 0.92]))

        # ═══════════════════════════════════════════
        # FOOTER / DISCLAIMER
        # ═══════════════════════════════════════════
        story.append(Spacer(1, 0.5 * inch))
        story.append(Paragraph(
            "<i>This report was generated autonomously by the UrbanEye ORION-1 Intelligence Engine. "
            "All spectral computations are derived from calibrated Level-2A surface reflectance data. "
            "AI narrative sections are synthesized by Llama-3.3 70B. Results should be validated with field surveys before regulatory action.</i>",
            self.styles['UESmallMono']
        ))

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _interpret_change_pct(self, pct):
        if pct < 1: return "Negligible — within sensor noise threshold"
        if pct < 5: return "Minor — localized modifications detected"
        if pct < 15: return "Moderate — significant land-use change"
        if pct < 30: return "High — widespread transformation"
        return "Critical — massive environmental disruption"

    def _interpret_index_signal(self, name, mean):
        signals = {
            'NDVI': ('Vegetation', 'Dense' if mean > 0.4 else 'Moderate' if mean > 0.2 else 'Sparse/Absent'),
            'NDBI': ('Built-Up', 'High Density' if mean > 0.1 else 'Low Density' if mean > 0 else 'Natural'),
            'NDWI': ('Water', 'Present' if mean > 0.3 else 'Trace' if mean > 0 else 'Dry'),
            'MNDWI': ('Water (Urban)', 'Detected' if mean > 0.2 else 'Minimal'),
            'BSI': ('Bare Soil', 'Exposed' if mean > 0.2 else 'Covered' if mean < 0 else 'Mixed'),
            'EVI': ('Vegetation (Corrected)', 'Healthy' if mean > 0.3 else 'Stressed' if mean > 0.1 else 'Absent'),
        }
        category, signal = signals.get(name, ('General', 'N/A'))
        return f"{category}: {signal}"

    def _prepare_image(self, path, width):
        if not path:
            return None

        # Ensure path is absolute and normalized
        if not os.path.isabs(path):
            abs_path = os.path.normpath(os.path.join(DATA_DIR, "..", path))
        else:
            abs_path = os.path.normpath(path)

        if not os.path.exists(abs_path):
            logger.error(f">>> [REPORT] Image not found: {abs_path}")
            return None

        try:
            with Image.open(abs_path) as pil_img:
                w, h = pil_img.size
                aspect = h / float(w)
            return RLImage(abs_path, width=width, height=width * aspect)
        except Exception as e:
            logger.error(f">>> [REPORT] Failed to prepare image {abs_path}: {e}")
            return None
