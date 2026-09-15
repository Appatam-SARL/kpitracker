import type { LeadTypeValue } from '@/config/lead-options';
import { LEAD_TYPE_OPTIONS } from '@/config/lead-options';

export const leadTypeEnumValues = LEAD_TYPE_OPTIONS.map(
  (o) => o.value,
) as [LeadTypeValue, ...LeadTypeValue[]];
