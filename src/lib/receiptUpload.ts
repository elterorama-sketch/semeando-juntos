import { createClient } from "@/lib/supabase/client";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

// Phone camera photos routinely run 3-5MB; nobody needs that resolution to
// read a Pix receipt, and it burns through Supabase Storage fast across
// hundreds of orders. Downscale + re-encode as JPEG client-side before
// upload -- typically lands under 200KB.
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste dispositivo.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir imagem."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

// Uploads to the private "payment-receipts" bucket, path prefixed by the
// order id (RLS on storage.objects checks that prefix against orders.seller_id
// / is_treasurer_or_admin() -- see 0014_payment_receipt_photo.sql). Returns
// the storage path to save on payments.receipt_path.
export async function uploadPaymentReceipt(orderId: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const supabase = createClient();
  const path = `${orderId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("payment-receipts").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getReceiptSignedUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(path, 60 * 10);
  if (error || !data) throw error ?? new Error("Falha ao gerar link do comprovante.");
  return data.signedUrl;
}
