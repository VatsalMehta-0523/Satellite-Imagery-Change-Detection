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

class MissionReportGenerator:
    def __init__(self, data: dict):
        """
        data: dict containing:
            - project_id
            - aoi_geojson
            - t1_date, t2_date
            - source
            - change_pct, area_m2, area_km2, area_ha
            - mask_path
            - t1_path, t2_path
            - indices: list of {name, mean_val, heatmap_path}
            - ai_summary: {summary, change_type, severity, key_findings, recommendation}
        """
        self.data = data
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        self.styles.add(ParagraphStyle(
            name='UrbanEyeTitle',
            parent=self.styles['Heading1'],
            fontSize=26,
            textColor=colors.HexColor("#38bdf8"),
            alignment=TA_CENTER,
            spaceAfter=20,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.black,
            spaceBefore=15,
            spaceAfter=10,
            borderPadding=5,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='NormalText',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=14
        ))

    def generate(self) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        story = []

        # --- HEADER ---
        story.append(Paragraph("URBANEYE INTELLIGENCE REPORT", self.styles['UrbanEyeTitle']))
        story.append(Paragraph(f"Mission ID: {self.data['project_id']} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", self.styles['Normal']))
        story.append(Spacer(1, 0.3 * inch))

        # --- MISSION OVERVIEW ---
        story.append(Paragraph("1. MISSION OVERVIEW", self.styles['SectionHeader']))
        overview_data = [
            ["PARAMETER", "VALUE"],
            ["Observation Sync", f"{self.data['t1_date']} to {self.data['t2_date']}"],
            ["Orbital Source", self.data['source'].upper()],
            ["Coordinate Reference", "WGS 84 / Web Mercator"],
            ["Spatial Resolution", f"{10.0 if self.data['source'] == 'gee' else (4.0 if self.data['source'] == 'planet' else 1.0)}m / pixel"]
        ]
        t = Table(overview_data, colWidths=[2 * inch, 3.5 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#38bdf8")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.2 * inch))

        # --- GEOSPATIAL METRICS ---
        story.append(Paragraph("2. GEOSPATIAL IMPACT METRICS", self.styles['SectionHeader']))
        metrics_data = [
            ["METRIC", "MEASUREMENT"],
            ["Detected Change Percentage", f"{self.data['change_pct']:.2f}%"],
            ["Total Disturbed Area (m²)", f"{self.data['area_m2']:,.1f}"],
            ["Total Disturbed Area (km²)", f"{self.data['area_km2']:.4f}"],
            ["Total Disturbed Area (Hectares)", f"{self.data['area_ha']:.2f}"]
        ]
        t_met = Table(metrics_data, colWidths=[3 * inch, 2.5 * inch])
        t_met.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(t_met)
        story.append(Spacer(1, 0.4 * inch))

        # --- VISUAL TELEMETRY: T1 vs T2 ---
        story.append(PageBreak())
        story.append(Paragraph("3. VISUAL TELEMETRY (RGB COMPARISON)", self.styles['SectionHeader']))
        
        # Prepare T1 and T2 images
        img_width = 2.5 * inch
        t1_img = self._prepare_image(self.data['t1_path'], img_width)
        t2_img = self._prepare_image(self.data['t2_path'], img_width)
        
        if t1_img and t2_img:
            img_table = Table([[t1_img, t2_img]], colWidths=[2.8 * inch, 2.8 * inch])
            img_table.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
            story.append(img_table)
            story.append(Table([[Paragraph(f"Baseline ({self.data['t1_date']})", self.styles['Normal']), 
                                Paragraph(f"Monitoring ({self.data['t2_date']})", self.styles['Normal'])]],
                                colWidths=[2.8 * inch, 2.8 * inch]))
        
        story.append(Spacer(1, 0.3 * inch))

        # --- CHANGE MASK ---
        story.append(Paragraph("4. NEURAL CHANGE MASK", self.styles['SectionHeader']))
        mask_img = self._prepare_image(self.data['mask_path'], 4.5 * inch)
        if mask_img:
            story.append(mask_img)
            story.append(Paragraph("Binary mask indicating temporal discrepancies (ChangeFormer V6 inference result).", self.styles['Normal']))

        # --- AI INTELLIGENCE ---
        story.append(PageBreak())
        story.append(Paragraph("5. AI MISSION SUMMARY & NARRATIVE", self.styles['SectionHeader']))
        ai = self.data['ai_summary']
        
        story.append(Paragraph(f"<b>Overall Classification:</b> {ai.get('change_type', 'Undefined').upper()}", self.styles['Normal']))
        story.append(Paragraph(f"<b>Risk Severity:</b> {ai.get('severity', 'Moderate').upper()}", self.styles['Normal']))
        story.append(Spacer(1, 0.1 * inch))
        
        story.append(Paragraph("Executive Summary:", self.styles['Normal']))
        story.append(Paragraph(ai.get('summary', 'No summary available.'), self.styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))
        
        story.append(Paragraph("Key Intelligence Findings:", self.styles['SectionHeader']))
        for finding in ai.get('key_findings', []):
            story.append(Paragraph(f"• {finding}", self.styles['Normal']))
        
        story.append(Spacer(1, 0.3 * inch))
        story.append(Paragraph("STRATEGIC RECOMMENDATION:", self.styles['SectionHeader']))
        story.append(Paragraph(ai.get('recommendation', 'Continue monitoring.'), self.styles['Normal']))

        # --- SPECTRAL ANALYTICS ---
        if self.data.get('indices'):
            story.append(PageBreak())
            story.append(Paragraph("6. MULTI-SPECTRAL INDEX ANALYSIS", self.styles['SectionHeader']))
            
            idx_table_data = [["INDEX", "DESCRIPTION", "MEAN VALUE"]]
            for idx in self.data['indices']:
                idx_table_data.append([
                    idx['name'],
                    idx.get('description', ''),
                    f"{idx.get('mean_val', 0):.4f}"
                ])
            
            it = Table(idx_table_data, colWidths=[1 * inch, 3.5 * inch, 1 * inch])
            it.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
                ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
                ('FONTSIZE', (0,0), (-1,-1), 9),
            ]))
            story.append(it)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _prepare_image(self, path, width):
        if not path:
            return None
            
        # Ensure path is absolute and normalized for Windows/Linux consistency
        if not os.path.isabs(path):
            abs_path = os.path.normpath(os.path.join(DATA_DIR, "..", path))
        else:
            abs_path = os.path.normpath(path)

        if not os.path.exists(abs_path):
            logger.error(f">>> [REPORT] Image not found: {abs_path}")
            return None
            
        try:
            # Get original aspects
            with Image.open(abs_path) as pil_img:
                w, h = pil_img.size
                aspect = h / float(w)
            
            return RLImage(abs_path, width=width, height=width * aspect)
        except Exception as e:
            logger.error(f">>> [REPORT] Failed to prepare image {abs_path}: {e}")
            return None
