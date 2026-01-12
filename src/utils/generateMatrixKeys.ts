// type columnMappings = Record<string, string>;
// export const generateMatchKeys = (
//   row1: any,
//   row2: any,
//   columnMappings: columnMappings
// ): string => {
//   return `${row1["Placing No."]},${row1["Premiun"]}|${
//     row2[columnMappings["placing no"]]
//   },${row2[columnMappings["amount"]]}`;
// };

export const generateMatrixKeys = (
  selectedRowCBL: any[],
  selectedRowInsurer: any[]
) => {
  let matrixKey = "";
  let cblMatrix = "";
  let insurerMatrix = "";

  selectedRowCBL.forEach((cblRow, index) => {
    const isLast = index === selectedRowCBL.length - 1;
    cblMatrix += `${cblRow["PlacingNo"] || ""}#${cblRow["PolicyNo_1"] || ""}#${
      cblRow["ClientName"] || ""
    }#${cblRow["Amount"] || ""}${isLast ? "" : ","}`;
  });

  selectedRowInsurer.forEach((insurerRow, index) => {
    const isLast = index === selectedRowInsurer.length - 1;
    insurerMatrix += `${insurerRow["PlacingNo"] || ""}#${
      insurerRow["PolicyNo_1"] || ""
    }#${insurerRow["ClientName"] || ""}#${insurerRow["Amount"] || ""}${
      isLast ? "" : ","
    }`;
  });

  matrixKey = `${cblMatrix}|${insurerMatrix}`;

  return matrixKey;
};
