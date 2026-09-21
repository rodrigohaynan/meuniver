export type AttendanceCategory = "adult" | "child";

export type AttendanceExportGroup = {
  contactName: string;
  whatsapp?: string | null;
  createdAt?: string | null;
  attendees: Array<{
    name: string;
    category: AttendanceCategory;
    age?: number | null;
  }>;
};

export type AttendanceExportPayload = {
  eventTitle: string;
  groups: AttendanceExportGroup[];
};

type AttendanceRow = {
  number: number;
  name: string;
  category: AttendanceCategory;
  age: number | null;
  contactName: string;
  whatsapp: string;
  createdAt: string;
};

type AgeGroupKey = "0-3" | "3-6" | "6-12" | "12-17" | "unknown";

type AgeGroupDefinition = {
  key: AgeGroupKey;
  label: string;
};

const AGE_GROUPS: AgeGroupDefinition[] = [
  { key: "0-3", label: "0 a 3 anos" },
  { key: "3-6", label: "3 a 6 anos" },
  { key: "6-12", label: "6 a 12 anos" },
  { key: "12-17", label: "12 a 17 anos" },
  { key: "unknown", label: "Idade não informada" },
];

function normalizeAge(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const age = Number(value);
  if (!Number.isInteger(age) || age < 0 || age > 17) return null;
  return age;
}

function ageGroupKey(age: number | null): AgeGroupKey {
  if (age === null) return "unknown";
  // Para evitar dupla contagem nos limites solicitados:
  // 3 fica em 0–3; 6 em 3–6; 12 em 6–12.
  if (age <= 3) return "0-3";
  if (age <= 6) return "3-6";
  if (age <= 12) return "6-12";
  return "12-17";
}

function attendanceRows(payload: AttendanceExportPayload) {
  let number = 0;
  return payload.groups.flatMap((group) =>
    group.attendees.map((attendee) => {
      const age = attendee.category === "child" ? normalizeAge(attendee.age) : null;
      return {
        number: ++number,
        name: attendee.name.trim(),
        category: attendee.category,
        age,
        contactName: group.contactName.trim(),
        whatsapp: group.whatsapp?.trim() ?? "",
        createdAt: formatDateTime(group.createdAt),
      } satisfies AttendanceRow;
    }),
  );
}

function summary(rows: AttendanceRow[]) {
  const children = rows.filter((row) => row.category === "child");
  const ageGroups = Object.fromEntries(
    AGE_GROUPS.map((group) => [
      group.key,
      children.filter((row) => ageGroupKey(row.age) === group.key).length,
    ]),
  ) as Record<AgeGroupKey, number>;

  return {
    total: rows.length,
    adults: rows.filter((row) => row.category === "adult").length,
    children: children.length,
    ageGroups,
  };
}

function groupedChildren(rows: AttendanceRow[]) {
  const children = rows.filter((row) => row.category === "child");
  return AGE_GROUPS.map((group) => ({
    ...group,
    rows: children.filter((row) => ageGroupKey(row.age) === group.key),
  }));
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(category: AttendanceCategory) {
  return category === "child" ? "Criança" : "Adulto";
}

function safeFilename(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || "evento";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let output = "";
  while (value > 0) {
    const mod = (value - 1) % 26;
    output = String.fromCharCode(65 + mod) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function xlsxCell(value: string | number, row: number, column: number, style = 0) {
  const reference = `${columnName(column)}${row}`;
  const styleAttr = style ? ` s="${style}"` : "";
  if (typeof value === "number") {
    return `<c r="${reference}"${styleAttr}><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function makeSheetXml(payload: AttendanceExportPayload) {
  const rows = attendanceRows(payload);
  const counts = summary(rows);
  const grouped = groupedChildren(rows);
  const data: Array<Array<string | number>> = [
    [`Lista de presença - ${payload.eventTitle}`],
    ["Total de convidados", counts.total],
    ["Adultos", counts.adults],
    ["Crianças", counts.children],
    ["Crianças de 0 a 3 anos", counts.ageGroups["0-3"]],
    ["Crianças de 3 a 6 anos", counts.ageGroups["3-6"]],
    ["Crianças de 6 a 12 anos", counts.ageGroups["6-12"]],
    ["Crianças de 12 a 17 anos", counts.ageGroups["12-17"]],
    ["Crianças sem idade informada", counts.ageGroups.unknown],
    [],
    ["Nº", "Convidado", "Categoria", "Idade", "Responsável", "WhatsApp", "Confirmado em"],
    ...rows.map((row) => [
      row.number,
      row.name,
      categoryLabel(row.category),
      row.category === "child" && row.age !== null ? row.age : "",
      row.contactName,
      row.whatsapp,
      row.createdAt,
    ]),
    [],
    ["Crianças separadas por faixa etária"],
  ];

  for (const group of grouped) {
    data.push([]);
    data.push([`${group.label} (${group.rows.length})`]);
    data.push(["Nº", "Convidado", "Idade", "Responsável", "WhatsApp"]);
    if (group.rows.length === 0) {
      data.push(["", "Nenhuma criança nesta faixa"]);
    } else {
      for (const row of group.rows) {
        data.push([
          row.number,
          row.name,
          row.age === null ? "Não informada" : row.age,
          row.contactName,
          row.whatsapp,
        ]);
      }
    }
  }

  const mainHeaderRow = 11;
  const sheetRows = data
    .map((values, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const isSectionHeader =
        rowNumber === 1 ||
        rowNumber === mainHeaderRow ||
        values[0] === "Crianças separadas por faixa etária" ||
        (typeof values[0] === "string" && AGE_GROUPS.some((group) => String(values[0]).startsWith(group.label))) ||
        values.join("|") === "Nº|Convidado|Idade|Responsável|WhatsApp";
      const style = rowNumber === 1 ? 1 : isSectionHeader ? 2 : 0;
      const cells = values
        .map((value, columnIndex) => xlsxCell(value, rowNumber, columnIndex, style))
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:G${Math.max(mainHeaderRow, data.length)}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <cols>
    <col min="1" max="1" width="7" customWidth="1"/>
    <col min="2" max="2" width="32" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="30" customWidth="1"/>
    <col min="6" max="6" width="20" customWidth="1"/>
    <col min="7" max="7" width="21" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  <pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
</worksheet>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

function makeZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const { time, day } = dosDateTime();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, day);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, data.byteLength);
    writeUint32(localView, 22, data.byteLength);
    writeUint16(localView, 26, name.byteLength);
    writeUint16(localView, 28, 0);
    localParts.push(localHeader, name, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, day);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, data.byteLength);
    writeUint32(centralView, 24, data.byteLength);
    writeUint16(centralView, 28, name.byteLength);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.byteLength + name.byteLength + data.byteLength;
  }

  const localData = concatBytes(localParts);
  const centralData = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralData.byteLength);
  writeUint32(endView, 16, localData.byteLength);
  writeUint16(endView, 20, 0);
  return concatBytes([localData, centralData, end]);
}

export function exportAttendanceXlsx(payload: AttendanceExportPayload) {
  const now = new Date().toISOString();
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Convidata</Application></Properties>`,
    },
    {
      name: "docProps/core.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(`Lista de presença - ${payload.eventTitle}`)}</dc:title><dc:creator>Convidata</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Lista e faixas etárias" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: makeSheetXml(payload) },
  ];

  const bytes = makeZip(files);
  const xlsxBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(xlsxBuffer).set(bytes);
  downloadBlob(
    new Blob([xlsxBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `lista-presenca-${safeFilename(payload.eventTitle)}.xlsx`,
  );
}

const cp1252: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function pdfLiteral(value: string) {
  let output = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 63;
    const byte = codePoint <= 255 ? codePoint : cp1252[character] ?? 63;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      output += `\\${String.fromCharCode(byte)}`;
    } else if (byte >= 32 && byte <= 126) {
      output += String.fromCharCode(byte);
    } else {
      output += `\\${byte.toString(8).padStart(3, "0")}`;
    }
  }
  return output;
}

function truncate(value: string, max: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(1, max - 1))}…`;
}

function pdfText(text: string, x: number, y: number, size = 9, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfLiteral(text)}) Tj ET\n`;
}

function createPdf(payload: AttendanceExportPayload) {
  const rows = attendanceRows(payload);
  const counts = summary(rows);
  const grouped = groupedChildren(rows);
  const pageStreams: string[] = [];
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const mainRowsPerPage = 37;
  const mainPages = Math.max(1, Math.ceil(rows.length / mainRowsPerPage));

  for (let pageIndex = 0; pageIndex < mainPages; pageIndex += 1) {
    const pageRows = rows.slice(pageIndex * mainRowsPerPage, pageIndex * mainRowsPerPage + mainRowsPerPage);
    let stream = "";
    stream += pdfText("Lista de presença", 34, 806, 16, true);
    stream += pdfText(truncate(payload.eventTitle, 70), 34, 786, 11, true);
    stream += pdfText(`Total: ${counts.total}   Adultos: ${counts.adults}   Crianças: ${counts.children}`, 34, 765, 10, true);
    stream += pdfText(
      `0 a 3: ${counts.ageGroups["0-3"]}   3 a 6: ${counts.ageGroups["3-6"]}   6 a 12: ${counts.ageGroups["6-12"]}   12 a 17: ${counts.ageGroups["12-17"]}   Sem idade: ${counts.ageGroups.unknown}`,
      34,
      748,
      8,
    );
    stream += pdfText(`Página ${pageIndex + 1} de ${mainPages}`, 500, 806, 8);

    stream += "0.75 w 34 730 m 560 730 l S\n";
    stream += pdfText("Nº", 34, 714, 8, true);
    stream += pdfText("Convidado", 58, 714, 8, true);
    stream += pdfText("Tipo", 230, 714, 8, true);
    stream += pdfText("Idade", 282, 714, 8, true);
    stream += pdfText("Responsável", 330, 714, 8, true);
    stream += pdfText("WhatsApp", 465, 714, 8, true);
    stream += "0.5 w 34 706 m 560 706 l S\n";

    if (pageRows.length === 0) {
      stream += pdfText("Nenhum convidado confirmado.", 34, 680, 10);
    } else {
      pageRows.forEach((row, index) => {
        const y = 688 - index * 16;
        stream += pdfText(String(row.number), 34, y, 8.2);
        stream += pdfText(truncate(row.name, 27), 58, y, 8.2);
        stream += pdfText(categoryLabel(row.category), 230, y, 8.2);
        stream += pdfText(row.category === "child" ? (row.age === null ? "—" : String(row.age)) : "—", 282, y, 8.2);
        stream += pdfText(truncate(row.contactName, 20), 330, y, 8.2);
        stream += pdfText(truncate(row.whatsapp, 18), 465, y, 8.2);
      });
    }

    pageStreams.push(stream);
  }

  for (const group of grouped) {
    const rowsPerGroupPage = 40;
    const pages = Math.max(1, Math.ceil(group.rows.length / rowsPerGroupPage));
    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
      const pageRows = group.rows.slice(pageIndex * rowsPerGroupPage, pageIndex * rowsPerGroupPage + rowsPerGroupPage);
      let stream = "";
      stream += pdfText("Crianças por faixa etária", 34, 806, 16, true);
      stream += pdfText(`${group.label} — ${group.rows.length} criança(s)`, 34, 782, 12, true);
      stream += pdfText(truncate(payload.eventTitle, 70), 34, 764, 9);
      stream += pdfText(`Página ${pageIndex + 1} de ${pages}`, 500, 806, 8);

      stream += "0.75 w 34 744 m 560 744 l S\n";
      stream += pdfText("Nº", 34, 728, 8, true);
      stream += pdfText("Convidado", 70, 728, 8, true);
      stream += pdfText("Idade", 300, 728, 8, true);
      stream += pdfText("Responsável", 345, 728, 8, true);
      stream += pdfText("WhatsApp", 475, 728, 8, true);
      stream += "0.5 w 34 720 m 560 720 l S\n";

      if (pageRows.length === 0) {
        stream += pdfText("Nenhuma criança nesta faixa.", 34, 694, 10);
      } else {
        pageRows.forEach((row, index) => {
          const y = 702 - index * 16;
          stream += pdfText(String(row.number), 34, y, 8.5);
          stream += pdfText(truncate(row.name, 35), 70, y, 8.5);
          stream += pdfText(row.age === null ? "—" : String(row.age), 300, y, 8.5);
          stream += pdfText(truncate(row.contactName, 20), 345, y, 8.5);
          stream += pdfText(truncate(row.whatsapp, 18), 475, y, 8.5);
        });
      }
      pageStreams.push(stream);
    }
  }

  const objects: string[] = [];
  const pageIds: number[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  pageStreams.forEach((stream, pageIndex) => {
    const pageId = 5 + pageIndex * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  });

  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function exportAttendancePdf(payload: AttendanceExportPayload) {
  const bytes = createPdf(payload);
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  downloadBlob(
    new Blob([pdfBuffer], { type: "application/pdf" }),
    `lista-presenca-${safeFilename(payload.eventTitle)}.pdf`,
  );
}
