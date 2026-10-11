export type ConvertRule = {
  class: string;
  field: string;
  from: { type: string; value?: string; key?: string; class?: string };
  to: { type: string; value?: string; key?: string; class?: string };
};

import RULES_JSON from "./convert-rules.json";
const RULES: ConvertRule[] = RULES_JSON as ConvertRule[];
export default RULES;
