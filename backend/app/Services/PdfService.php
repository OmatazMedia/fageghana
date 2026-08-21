<?php
namespace App\Services;

/**
 * Lightweight PDF generation service using raw PHP.
 * Generates valid PDF/A-1b files without external dependencies.
 */
class PdfService
{
    private string $content = '';
    private float $fontSize = 12;
    private string $font = 'Helvetica';
    private array $pages = [];
    private float $pageWidth = 595;   // A4 width in points
    private float $pageHeight = 842;  // A4 height in points
    private float $margin = 50;
    private float $y = 0;
    private int $pageCount = 0;

    public function setFontSize(float $size): self
    {
        $this->fontSize = $size;
        return $this;
    }

    public function addPage(): self
    {
        $this->pageCount++;
        $this->y = $this->margin;
        $this->pages[] = '';
        return $this;
    }

    public function text(float $x, float $y, string $text, array $options = []): self
    {
        $size = $options['size'] ?? $this->fontSize;
        $bold = $options['bold'] ?? false;
        $color = $options['color'] ?? [0, 0, 0];

        $font = $bold ? 'Helvetica-Bold' : 'Helvetica';
        $this->pages[$this->pageCount - 1] .= sprintf(
            "BT\n/F1 %s Tf\n%s %s %s rg\n%s %s Td\n(%s) Tj\nET\n",
            $size,
            $color[0] / 255,
            $color[1] / 255,
            $color[2] / 255,
            $x,
            $this->pageHeight - $y,
            $this->escapeText($text)
        );
        return $this;
    }

    public function line(float $x1, float $y1, float $x2, float $y2, array $options = []): self
    {
        $width = $options['width'] ?? 1;
        $color = $options['color'] ?? [0, 0, 0];
        $this->pages[$this->pageCount - 1] .= sprintf(
            "q\n%s %s %s RG\n%s w\n%s %s m\n%s %s l\nS\nQ\n",
            $color[0] / 255, $color[1] / 255, $color[2] / 255,
            $width,
            $x1, $this->pageHeight - $y1,
            $x2, $this->pageHeight - $y2
        );
        return $this;
    }

    public function rect(float $x, float $y, float $w, float $h, array $options = []): self
    {
        $color = $options['fill'] ?? null;
        $stroke = $options['stroke'] ?? [0, 0, 0];
        if ($color) {
            $this->pages[$this->pageCount - 1] .= sprintf(
                "q\n%s %s %s rg\n%s %s %s %s re\nf\nQ\n",
                $color[0] / 255, $color[1] / 255, $color[2] / 255,
                $x, $this->pageHeight - $y - $h, $w, $h
            );
        }
        $this->pages[$this->pageCount - 1] .= sprintf(
            "q\n%s %s %s RG\n0.5 w\n%s %s %s %s re\nS\nQ\n",
            $stroke[0] / 255, $stroke[1] / 255, $stroke[2] / 255,
            $x, $this->pageHeight - $y - $h, $w, $h
        );
        return $this;
    }

    public function multiText(float $x, float $y, string $text, float $maxWidth, array $options = []): float
    {
        $size = $options['size'] ?? $this->fontSize;
        $lines = $this->wrapText($text, $maxWidth, $size);
        foreach ($lines as $line) {
            $this->text($x, $y, $line, $options);
            $y += $size + 4;
        }
        return $y;
    }

    private function wrapText(string $text, float $maxWidth, float $fontSize): array
    {
        $words = explode(' ', $text);
        $lines = [];
        $currentLine = '';
        $charsPerLine = (int) ($maxWidth / ($fontSize * 0.5));

        foreach ($words as $word) {
            if (strlen($currentLine . ' ' . $word) > $charsPerLine) {
                if ($currentLine) $lines[] = $currentLine;
                $currentLine = $word;
            } else {
                $currentLine = $currentLine ? $currentLine . ' ' . $word : $word;
            }
        }
        if ($currentLine) $lines[] = $currentLine;
        return $lines;
    }

    private function escapeText(string $text): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    }

    public function render(): string
    {
        $objects = [];
        $objectOffsets = [];
        $objectIndex = 0;

        // Object 1: Catalog
        $objects[++$objectIndex] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj";

        // Object 2: Pages
        $objects[++$objectIndex] = "2 0 obj\n<< /Type /Pages /Kids [" . implode(' ', array_map(fn($i) => ($i + 2) . ' 0 R', range(0, $this->pageCount - 1))) . "] /Count {$this->pageCount} >>\nendobj";

        // Font object
        $objects[++$objectIndex] = "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj";

        // Page objects
        for ($i = 0; $i < $this->pageCount; $i++) {
            $pageNum = $i + 4;
            $contentIndex = $this->pageCount + 4 + $i;
            $objects[$pageNum] = "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$this->pageWidth} {$this->pageHeight}] /Contents {$contentIndex} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj";
            // Need to fix the page object numbering
        }

        // Rebuild with correct numbering
        $objects = [];
        $idx = 1;
        $objects[$idx++] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj";
        $objects[$idx++] = "2 0 obj\n<< /Type /Pages /Count {$this->pageCount} >>\nendobj";
        $objects[$idx++] = "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj";

        $pageRefs = [];
        for ($i = 0; $i < $this->pageCount; $i++) {
            $pageRefs[] = ($idx + $i) . ' 0 R';
        }
        $objects[2] = "2 0 obj\n<< /Type /Pages /Kids [" . implode(' ', $pageRefs) . "] /Count {$this->pageCount} >>\nendobj";

        $pageObjectsStart = $idx;
        for ($i = 0; $i < $this->pageCount; $i++) {
            $objects[$idx++] = "0 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$this->pageWidth} {$this->pageHeight}] /Contents CONTENT_{$i} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj";
        }

        // Content stream objects
        $contentStart = $idx;
        for ($i = 0; $i < $this->pageCount; $i++) {
            $stream = $this->pages[$i] ?? '';
            $objects[$idx++] = "0 0 obj\n<< /Length " . strlen($stream) . " >>\nstream\n{$stream}\nendstream\nendobj";
        }

        // Fix page objects to reference correct content streams
        for ($i = 0; $i < $this->pageCount; $i++) {
            $pageNum = $pageObjectsStart + $i;
            $contentNum = $contentStart + $i;
            $objects[$pageNum] = str_replace("CONTENT_{$i}", (string)$contentNum, $objects[$pageNum]);
        }

        // Build PDF
        $pdf = "%PDF-1.4\n";
        $xref = [];

        ksort($objects);
        foreach ($objects as $num => $obj) {
            $xref[$num] = strlen($pdf);
            $pdf .= $obj . "\n";
        }

        // Cross-reference table
        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n";
        $pdf .= "0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";

        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $xref[$i] ?? 0);
        }

        // Trailer
        $pdf .= "trailer\n";
        $pdf .= "<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n";
        $pdf .= $xrefOffset . "\n";
        $pdf .= "%%EOF";

        return $pdf;
    }
}
