export const cleanData = (worksheet1: any[], worksheet2: any[]) => {
  const result: any[] = [];
  const maxLength = Math.max(worksheet1.length, worksheet2.length);

  for (let i = 0; i < maxLength; i++) {
    const row1 = i < worksheet1.length ? worksheet1[i] : {};
    const row2 = i < worksheet2.length ? worksheet2[i] : {};

    const mergedRow: any = {};

    // Add worksheet1 properties with _file1 postfix
    Object.keys(row1).forEach((key) => {
      mergedRow[`${key}_file1`] = row1[key];
    });

    // Add worksheet2 properties with _file2 postfix
    Object.keys(row2).forEach((key) => {
      mergedRow[`${key}_file2`] = row2[key];
    });

    result.push(mergedRow);
  }

  console.log("result", result);
  return result;
};
