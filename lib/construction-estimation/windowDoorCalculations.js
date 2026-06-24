export function calculateWindowDoorSchedule(rows = []) {
  const calculatedRows = rows.map((row) => {
    const quantity = number(row.quantity);
    const height = number(row.height);
    const width = number(row.width);
    const area = round(height * width);
    const totalArea = round(area * quantity);
    const isWindow = String(row.type || "").toLowerCase().includes("window");
    const isDoor = String(row.type || "").toLowerCase().includes("door");
    const sillLength = round(isWindow ? width * quantity : 0);
    const headLength = round(width * quantity);
    const jambLength = round(height * 2 * quantity);
    const architraveLength = isDoor ? round(quantity * 5.4 * 2) : round((height * 2 + width) * quantity);

    return {
      ...row,
      quantity,
      height,
      width,
      area,
      totalArea,
      sillLength,
      headLength,
      jambLength,
      architraveLength,
    };
  });

  return {
    rows: calculatedRows,
    totals: {
      windowDoorAreaM2: round(sum(calculatedRows, "totalArea")),
      sillLengthLm: round(sum(calculatedRows, "sillLength")),
      headLengthLm: round(sum(calculatedRows, "headLength")),
      jambLengthLm: round(sum(calculatedRows, "jambLength")),
      architraveLengthLm: round(sum(calculatedRows, "architraveLength")),
      itemCount: calculatedRows.reduce((total, row) => total + number(row.quantity), 0),
    },
  };
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + number(row[key]), 0);
}

function number(value) {
  return Number(value) || 0;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
