// Static (chave-based) Pix QR/"copia e cola" for the campaign's receiving
// account. No amount is encoded -- the buyer types it in their own banking
// app, same trust model as reading a Pix key aloud, just with a QR to scan
// instead. Generated fresh from the bank's original code (see
// public/pix-qrcode.png) and verified to decode back to this exact string.
export const PIX_COPIA_COLA =
  "00020101021126480014br.gov.bcb.pix0126toldosromarcos@outlook.com5204000053039865802BR5916TOLDOS ROMARCO'S6009SAO PAULO622905251M2BVBZJFS913H0PMA7K2T4EK63048F8E";

export const PIX_RECEIVER_NAME = "TOLDOS ROMARCO'S";

// Same static charge, hosted by the bank as a web page (shows the same QR
// + copia e cola) -- handy to share as a link over WhatsApp instead of
// showing the in-app QR on screen.
export const PIX_PAYMENT_LINK = "https://cobranca.c6pix.com.br/01M2BVBZ0SZBP3QSVWC48N9MAA";
