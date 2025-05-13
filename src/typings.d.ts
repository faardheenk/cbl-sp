export type BrokerFile = {
  clientName: string;
  curr: string;
  insuranceCompany: string;
  placingNo: string;
  placingEndorsementNo: string;
  policyNo: string;
  premiun: number;
  matchCondition: string;
  rowId1: number;
  rowId2: number;
};

export type ColumnMappingType = {
  policyNo: string;
  placingNo: string;
  clientName: string;
  amount: string;
};
