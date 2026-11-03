import axiosClient from "./axiosClient";

/**
 * Upload a file directly to S3/MinIO using a short-lived presigned PUT URL.
 * The backend never proxies the file bytes.
 *
 * @param {File} file
 * @param {"avatar"|"event-cover"|"trailer"} kind
 * @returns {Promise<string>} public URL served by CloudFront (or MinIO locally)
 */
export async function uploadMedia(file, kind) {
  if (!file) {
    throw new Error("No file provided");
  }

  const { data } = await axiosClient.post("/uploads/presign", {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    kind,
  });

  const response = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return data.publicUrl;
}
