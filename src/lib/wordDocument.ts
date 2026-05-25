/* Word Document Generator - creates .doc files compatible with Microsoft Word */
export interface WordDocumentOptions {
  title: string;
  content?: string;
  sections?: { heading: string; text: string }[];
  tableData?: { headers: string[]; rows: string[][] };
  fileName?: string;
}

export function generateWordDocument({
  title,
  content,
  sections,
  tableData,
  fileName = "document.doc",
}: WordDocumentOptions): Promise<void> {
  const htmlContent = `
<html xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${title}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
</w:WordDocument>
</xml>
<![endif]-->
<style>
body { font-family: 'Calibri', sans-serif; font-size: 11pt; }
h1 { font-size: 28pt; font-weight: bold; margin: 24pt 0 18pt 0; }
h2 { font-size: 16pt; font-weight: bold; margin: 18pt 0 10pt 0; }
p { margin: 0 0 12pt 0; line-height: 1.5; }
table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
th, td { border: 1pt solid #000; padding: 6pt; vertical-align: top; }
th { font-weight: bold; background: #f0f0f0; }
</style>
</head>
<body>
<h1>${title}</h1>
${content ? `<p>${content.replace(/\n/g, "<br/>")}</p>` : ""}
${sections?.map((s) => `<h2>${s.heading}</h2><p>${s.text.replace(/\n/g, "<br/>")}</p>`).join("") || ""}
${tableData ? `<table><tr>${tableData.headers.map((h) => `<th>${h}</th>`).join("")}</tr>${tableData.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>` : ""}
</body>
</html>`;

  const blob = new Blob(["\ufeff" + htmlContent], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve();
}
