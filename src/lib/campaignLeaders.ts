export interface CampaignLeader {
  name: string;
  phone: string; // dígitos, DDD + número, sem +55
}

export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/55${digits}`;
}
